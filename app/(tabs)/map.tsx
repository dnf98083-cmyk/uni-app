import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import WebView from 'react-native-webview';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';

const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';

// ── 카테고리 ─────────────────────────────────────────────────
const CATEGORIES = [
  { label: '전체',  code: 'ALL',  emoji: '🍽️' },
  { label: '한식',  code: 'FD6',  emoji: '🍲', keyword: '한식' },
  { label: '중식',  code: 'FD6',  emoji: '🌶️', keyword: '중식' },
  { label: '일식',  code: 'FD6',  emoji: '🍱', keyword: '일식' },
  { label: '양식',  code: 'FD6',  emoji: '🍕', keyword: '양식' },
  { label: '카페',  code: 'CE7',  emoji: '☕' },
  { label: '술집',  code: 'FD6',  emoji: '🍺', keyword: '술' },
  { label: '분식',  code: 'FD6',  emoji: '🍢', keyword: '분식' },
];

const CAT_COLORS: Record<string, string> = {
  한식: '#FF6B6B',
  중식: '#FF8C42',
  일식: '#4ECDC4',
  양식: '#45B7D1',
  카페: '#6BCB77',
  술집: '#C77DFF',
  분식: '#FFD166',
  기타: '#7c6fff',
};

const CAT_EMOJIS: Record<string, string> = {
  한식: '🍲', 중식: '🌶️', 일식: '🍱', 양식: '🍕',
  카페: '☕', 술집: '🍺', 분식: '🍢', 기타: '🍽️',
};

type Place = {
  id: string;
  name: string;
  categorySimple: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  url: string;
};

type Review = {
  id: string;
  user_id: string;
  rating: number;
  review: string;
  created_at: string;
};

// ── 카테고리 → Overpass 태그 매핑 (웹용) ────────────────────
const OVERPASS_TAGS: Record<string, string> = {
  전체: '"amenity"~"restaurant|cafe|fast_food|bar|pub"',
  한식: '"cuisine"~"korean"',
  중식: '"cuisine"~"chinese"',
  일식: '"cuisine"~"japanese|sushi|ramen"',
  양식: '"cuisine"~"pizza|burger|italian|western"',
  카페: '"amenity"~"cafe"',
  술집: '"amenity"~"bar|pub"',
  분식: '"cuisine"~"korean;bunsik|bunsik"',
};

const getCategorySimple = (categoryName: string, code: string): string => {
  if (code === 'CE7') return '카페';
  const n = categoryName;
  if (n.includes('한식')) return '한식';
  if (n.includes('중식')) return '중식';
  if (n.includes('일식')) return '일식';
  if (n.includes('양식') || n.includes('서양')) return '양식';
  if (n.includes('술집') || n.includes('주점') || n.includes('호프')) return '술집';
  if (n.includes('분식')) return '분식';
  return '기타';
};

// ── 웹: Nominatim 학교 검색 ──────────────────────────────────
const searchSchoolWeb = async (query: string) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=ko`,
    { headers: { 'User-Agent': 'UniApp/1.0' } }
  );
  const data = await res.json();
  if (!data.length) throw new Error('학교를 찾을 수 없어요. 정확한 학교명을 입력해보세요.');
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: query };
};

// ── 웹: Overpass API 장소 검색 ───────────────────────────────
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const fetchPlacesWeb = async (lat: number, lng: number, cat: typeof CATEGORIES[0]): Promise<Place[]> => {
  const query = `[out:json][timeout:25];(node["amenity"~"restaurant|cafe|fast_food|bar|pub|food_court"](around:1000,${lat},${lng});way["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:1000,${lat},${lng}););out center;`;

  let text = '';
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, { method: 'POST', body: query });
      text = await res.text();
      if (text.startsWith('{')) break;
    } catch {
      continue;
    }
  }

  if (!text.startsWith('{')) throw new Error('장소 정보를 불러올 수 없어요.\n웹에서는 데이터가 제한적이에요.\n모바일 앱에서 사용하면 Kakao 데이터로 더 많은 결과가 나와요.');

  const data = JSON.parse(text);

  const getSimpleCategory = (el: any): string => {
    const amenity = el.tags?.amenity ?? '';
    const cuisine = (el.tags?.cuisine ?? '').toLowerCase();
    if (amenity === 'cafe') return '카페';
    if (amenity === 'bar' || amenity === 'pub') return '술집';
    if (cuisine.includes('korean')) return '한식';
    if (cuisine.includes('chinese')) return '중식';
    if (cuisine.includes('japanese') || cuisine.includes('sushi') || cuisine.includes('ramen')) return '일식';
    if (cuisine.includes('pizza') || cuisine.includes('burger') || cuisine.includes('italian') || cuisine.includes('western')) return '양식';
    return '한식';
  };

  const all: Place[] = (data.elements ?? [])
    .map((el: any) => {
      const center = el.center ?? el;
      return {
        id: String(el.id),
        name: el.tags?.['name:ko'] || el.tags?.name || '',
        categorySimple: getSimpleCategory(el),
        address: el.tags?.['addr:full'] || el.tags?.['addr:street'] || '',
        phone: el.tags?.phone || '',
        lat: center.lat,
        lng: center.lon,
        url: '',
      };
    })
    .filter((p: Place) => p.name.length > 0);

  if (cat.label === '전체') return all;
  return all.filter(p => p.categorySimple === cat.label);
};

// ── 모바일: Kakao API ────────────────────────────────────────
const kakaoHeaders = () => ({ Authorization: `KakaoAK ${process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? ''}` });

const mapDocs = (docs: any[], code: string): Place[] =>
  docs.map(d => ({
    id: d.id,
    name: d.place_name,
    categorySimple: getCategorySimple(d.category_name ?? '', code),
    address: d.road_address_name || d.address_name || '',
    phone: d.phone ?? '',
    lat: parseFloat(d.y),
    lng: parseFloat(d.x),
    url: d.place_url ?? '',
  }));

const searchSchoolKakao = async (query: string) => {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
    { headers: kakaoHeaders() }
  );
  const data = await res.json();
  if (data.errorType) throw new Error(`Kakao 오류: ${data.message}`);
  if (!data.documents?.length) throw new Error('학교를 찾을 수 없어요');
  const d = data.documents[0];
  return { lat: parseFloat(d.y), lng: parseFloat(d.x), name: d.place_name };
};

const fetchPlacesKakao = async (lat: number, lng: number, cat: typeof CATEGORIES[0]): Promise<Place[]> => {
  const h = kakaoHeaders();
  if (cat.label === '전체') {
    const [food, cafe] = await Promise.all([
      fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=FD6&x=${lng}&y=${lat}&radius=1000&size=15`, { headers: h }).then(r => r.json()),
      fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CE7&x=${lng}&y=${lat}&radius=1000&size=15`, { headers: h }).then(r => r.json()),
    ]);
    return [...mapDocs(food.documents ?? [], 'FD6'), ...mapDocs(cafe.documents ?? [], 'CE7')];
  }
  if ('keyword' in cat && cat.keyword) {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(cat.keyword!)}&category_group_code=${cat.code}&x=${lng}&y=${lat}&radius=1000&size=15`,
      { headers: h }
    );
    const data = await res.json();
    return mapDocs(data.documents ?? [], cat.code);
  }
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${cat.code}&x=${lng}&y=${lat}&radius=1000&size=15`,
    { headers: h }
  );
  const data = await res.json();
  return mapDocs(data.documents ?? [], cat.code);
};

// ── 플랫폼별 분기 ────────────────────────────────────────────
const searchSchoolLocation = (query: string) =>
  Platform.OS === 'web' ? searchSchoolWeb(query) : searchSchoolKakao(query);

const fetchPlaces = (lat: number, lng: number, cat: typeof CATEGORIES[0]) =>
  Platform.OS === 'web' ? fetchPlacesWeb(lat, lng, cat) : fetchPlacesKakao(lat, lng, cat);

// ── Kakao Maps WebView HTML (커스텀 핀 마커) ─────────────────
const makeMapHtml = (jsKey: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="//dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false"></script>
  <script>
    var CAT_COLORS=${JSON.stringify(CAT_COLORS)};
    var CAT_EMOJIS=${JSON.stringify(CAT_EMOJIS)};

    kakao.maps.load(function(){
      var map=new kakao.maps.Map(document.getElementById('map'),{center:new kakao.maps.LatLng(37.5665,126.9780),level:5});
      var overlays=[];

      function getColor(cat){return CAT_COLORS[cat]||CAT_COLORS['기타'];}
      function getEmoji(cat){return CAT_EMOJIS[cat]||'🍽️';}

      function makePinContent(p,selected){
        var c=getColor(p.categorySimple);
        var e=getEmoji(p.categorySimple);
        var sz=selected?46:36;
        var fs=selected?22:16;
        var bw=selected?'3px':'2px';
        var sh=selected?'0 4px 14px rgba(0,0,0,0.45)':'0 2px 8px rgba(0,0,0,0.28)';
        var zIndex=selected?'z-index:10;':'';
        return '<div onclick="handleTap(\''+p.id+'\')" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;-webkit-tap-highlight-color:transparent;position:relative;'+zIndex+'">'
          +'<div style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:'+c+';display:flex;align-items:center;justify-content:center;font-size:'+fs+'px;box-shadow:'+sh+';border:'+bw+' solid rgba(255,255,255,0.9)">'
          +e+'</div>'
          +'<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid '+c+';margin-top:-1px"></div>'
          +'</div>';
      }

      function handleTap(id){
        overlays.forEach(function(o){o.setContent(makePinContent(o._p,o._p.id===id));});
        if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'tap',id:id}));
      }
      window.handleTap=handleTap;

      function clearAll(){overlays.forEach(function(o){o.setMap(null);});overlays=[];}

      function load(places){
        clearAll();
        var bounds=new kakao.maps.LatLngBounds();
        places.forEach(function(p){
          var pos=new kakao.maps.LatLng(p.lat,p.lng);
          var o=new kakao.maps.CustomOverlay({position:pos,content:makePinContent(p,false),yAnchor:1,zIndex:1});
          o._p=p;
          o.setMap(map);
          bounds.extend(pos);
          overlays.push(o);
        });
        if(places.length>0) map.setBounds(bounds);
      }

      function center(lat,lng){map.setCenter(new kakao.maps.LatLng(lat,lng));map.setLevel(4);}

      function selectPin(id){
        overlays.forEach(function(o){o.setContent(makePinContent(o._p,o._p.id===id));});
      }

      function handle(e){
        try{
          var d=JSON.parse(e.data);
          if(d.type==='center') center(d.lat,d.lng);
          if(d.type==='markers') load(d.places);
          if(d.type==='select') selectPin(d.id);
        }catch(err){}
      }
      document.addEventListener('message',handle);
      window.addEventListener('message',handle);
    });
  </script>
</body>
</html>
`;

// ── 장소 상세 하단 시트 ──────────────────────────────────────
// Supabase에 place_reviews 테이블이 필요합니다:
// create table place_reviews (
//   id uuid default gen_random_uuid() primary key,
//   place_id text not null,
//   place_name text not null,
//   user_id uuid references auth.users(id) not null,
//   rating integer not null check (rating between 1 and 5),
//   review text default '',
//   created_at timestamptz default now(),
//   unique(place_id, user_id)
// );
function PlaceDetailSheet({
  place,
  visible,
  onClose,
  colors,
}: {
  place: Place | null;
  visible: boolean;
  onClose: () => void;
  colors: any;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myRating, setMyRating] = useState(0);
  const [myReview, setMyReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasMyReview, setHasMyReview] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (visible && place) {
      loadReviews(place.id);
    } else {
      setReviews([]);
      setMyRating(0);
      setMyReview('');
      setHasMyReview(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, place?.id]);

  const loadReviews = async (placeId: string) => {
    setLoadingReviews(true);
    try {
      const { data } = await supabase
        .from('place_reviews')
        .select('id, user_id, rating, review, created_at')
        .eq('place_id', placeId)
        .order('created_at', { ascending: false });
      if (data) {
        setReviews(data);
        const uid = (await supabase.auth.getUser()).data.user?.id;
        const mine = data.find(r => r.user_id === uid);
        if (mine) {
          setHasMyReview(true);
          setMyRating(mine.rating);
          setMyReview(mine.review || '');
        }
      }
    } catch {}
    setLoadingReviews(false);
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const handleSubmit = async () => {
    if (!place || !userId || myRating === 0) return;
    setSubmitting(true);
    try {
      await supabase.from('place_reviews').upsert({
        place_id: place.id,
        place_name: place.name,
        user_id: userId,
        rating: myRating,
        review: myReview.trim(),
      }, { onConflict: 'place_id,user_id' });
      await loadReviews(place.id);
    } catch {}
    setSubmitting(false);
  };

  const catColor = place ? (CAT_COLORS[place.categorySimple] ?? '#7c6fff') : '#7c6fff';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sheetStyles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[sheetStyles.sheet, { backgroundColor: colors.card }]}>
        <View style={[sheetStyles.handle, { backgroundColor: colors.border }]} />

        {place && (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* 헤더 */}
            <View style={sheetStyles.headerRow}>
              <View style={sheetStyles.headerLeft}>
                <View style={[sheetStyles.catDot, { backgroundColor: catColor }]}>
                  <Text style={sheetStyles.catDotEmoji}>{CAT_EMOJIS[place.categorySimple] ?? '🍽️'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[sheetStyles.sheetPlaceName, { color: colors.text }]} numberOfLines={2}>
                    {place.name}
                  </Text>
                  <View style={[sheetStyles.catBadge, { backgroundColor: catColor + '22' }]}>
                    <Text style={[sheetStyles.catBadgeText, { color: catColor }]}>{place.categorySimple}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={sheetStyles.closeBtn}>
                <Text style={[sheetStyles.closeBtnText, { color: colors.subText }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 평점 요약 */}
            <View style={[sheetStyles.ratingBanner, { backgroundColor: colors.bg }]}>
              {avgRating ? (
                <>
                  <Text style={sheetStyles.ratingBig}>⭐ {avgRating}</Text>
                  <Text style={[sheetStyles.ratingCount, { color: colors.subText }]}>리뷰 {reviews.length}개</Text>
                </>
              ) : (
                <Text style={[sheetStyles.noReviewText, { color: colors.subText }]}>아직 리뷰가 없어요. 첫 리뷰를 남겨보세요!</Text>
              )}
            </View>

            {/* 정보 */}
            <View style={[sheetStyles.infoBox, { borderColor: colors.border }]}>
              {place.address ? (
                <View style={sheetStyles.infoRow}>
                  <Text style={sheetStyles.infoIcon}>📍</Text>
                  <Text style={[sheetStyles.infoText, { color: colors.text }]}>{place.address}</Text>
                </View>
              ) : null}
              {place.phone ? (
                <View style={sheetStyles.infoRow}>
                  <Text style={sheetStyles.infoIcon}>📞</Text>
                  <Text style={[sheetStyles.infoText, { color: colors.text }]}>{place.phone}</Text>
                </View>
              ) : null}
            </View>

            {/* 카카오맵 메뉴/리뷰 링크 */}
            {place.url ? (
              <TouchableOpacity
                style={[sheetStyles.kakaoMapBtn, { borderColor: colors.border }]}
                onPress={() => Linking.openURL(place.url)}>
                <Text style={sheetStyles.kakaoMapBtnText}>🗺️ 카카오맵에서 메뉴 · 리뷰 보기</Text>
              </TouchableOpacity>
            ) : null}

            {/* 내 별점 남기기 */}
            <Text style={[sheetStyles.sectionTitle, { color: colors.text }]}>
              {hasMyReview ? '내 리뷰 수정' : '⭐ 리뷰 남기기'}
            </Text>
            <View style={sheetStyles.starInputRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setMyRating(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Text style={[sheetStyles.starBtn, { color: myRating >= n ? '#FFD166' : colors.border }]}>★</Text>
                </TouchableOpacity>
              ))}
              {myRating > 0 && (
                <Text style={[sheetStyles.starLabel, { color: colors.subText }]}>
                  {['', '별로예요', '그냥 그래요', '괜찮아요', '좋아요', '최고예요!'][myRating]}
                </Text>
              )}
            </View>
            <TextInput
              style={[sheetStyles.reviewInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
              placeholder="이 식당 어땠나요? (선택)"
              placeholderTextColor={colors.subText}
              value={myReview}
              onChangeText={setMyReview}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[sheetStyles.submitBtn, myRating === 0 && { opacity: 0.4 }]}
              onPress={handleSubmit}
              disabled={myRating === 0 || submitting}>
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={sheetStyles.submitBtnText}>{hasMyReview ? '수정하기' : '리뷰 등록'}</Text>}
            </TouchableOpacity>

            {/* 리뷰 목록 */}
            {(reviews.length > 0 || loadingReviews) && (
              <>
                <Text style={[sheetStyles.sectionTitle, { color: colors.text }]}>리뷰 목록</Text>
                {loadingReviews
                  ? <ActivityIndicator color="#7c6fff" style={{ marginVertical: 16 }} />
                  : reviews.map(r => (
                    <View key={r.id} style={[sheetStyles.reviewCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <View style={sheetStyles.reviewCardHeader}>
                        <Text style={[sheetStyles.reviewStars, { color: '#FFD166' }]}>{'★'.repeat(r.rating)}<Text style={{ color: colors.border }}>{'★'.repeat(5 - r.rating)}</Text></Text>
                        <Text style={[sheetStyles.reviewDate, { color: colors.subText }]}>
                          {new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                        </Text>
                      </View>
                      {r.review ? <Text style={[sheetStyles.reviewBody, { color: colors.text }]}>{r.review}</Text> : null}
                    </View>
                  ))
                }
              </>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ── 화면 ────────────────────────────────────────────────────
export default function MapScreen() {
  const { colors } = useTheme();
  const webViewRef = useRef<WebView>(null);

  const [schoolQuery, setSchoolQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState(CATEGORIES[0]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const mapHtml = makeMapHtml(KAKAO_JS_KEY);

  const postToMap = useCallback((msg: object) => {
    webViewRef.current?.injectJavaScript(`
      (function(){
        var e=new MessageEvent('message',{data:${JSON.stringify(JSON.stringify(msg))}});
        window.dispatchEvent(e);
      })();true;
    `);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data?.user?.user_metadata ?? {};
      if (meta.school_name) setSchoolQuery(meta.school_name);
    });
  }, []);

  useEffect(() => {
    if (!location) return;
    loadPlaces(location.lat, location.lng, selectedCat);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCat]);

  useEffect(() => {
    if (mapReady && location) {
      postToMap({ type: 'center', lat: location.lat, lng: location.lng });
    }
  }, [mapReady, location, postToMap]);

  useEffect(() => {
    if (mapReady && places.length > 0) {
      postToMap({ type: 'markers', places });
    }
  }, [mapReady, places, postToMap]);

  const loadPlaces = async (lat: number, lng: number, cat: typeof CATEGORIES[0]) => {
    setLoading(true);
    setError('');
    try {
      const results = await fetchPlaces(lat, lng, cat);
      setPlaces(results);
      if (mapReady) postToMap({ type: 'markers', places: results });
      if (results.length === 0) setError('해당 카테고리 결과가 없어요');
    } catch (e: any) {
      setError(e.message || '장소 검색 중 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    if (!schoolQuery.trim()) return;
    setLoading(true);
    setError('');
    setPlaces([]);
    setLocation(null);
    setNameQuery('');
    setSheetVisible(false);
    try {
      const loc = await searchSchoolLocation(schoolQuery.trim());
      setLocation(loc);
      if (mapReady) postToMap({ type: 'center', lat: loc.lat, lng: loc.lng });
      await loadPlaces(loc.lat, loc.lng, selectedCat);
    } catch (e: any) {
      setError(e.message || '검색 중 오류가 발생했어요');
      setLoading(false);
    }
  };

  const openDetail = (place: Place) => {
    setSelectedPlace(place);
    setSheetVisible(true);
    postToMap({ type: 'select', id: place.id });
    postToMap({ type: 'center', lat: place.lat, lng: place.lng });
  };

  const filtered = places.filter(p =>
    nameQuery.trim() === '' || p.name.includes(nameQuery.trim())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>

      {/* 검색바 + 카테고리 */}
      <View style={[styles.topSection, { backgroundColor: colors.bg }]}>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="학교 이름 검색 (예: 연세대학교)"
            placeholderTextColor={colors.subText}
            value={schoolQuery}
            onChangeText={setSchoolQuery}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={search} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.searchBtnText}>검색</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.label}
              style={[
                styles.catChip,
                { backgroundColor: colors.card, borderColor: colors.border },
                selectedCat.label === cat.label && styles.catChipActive,
              ]}
              onPress={() => setSelectedCat(cat)}>
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <Text style={[
                styles.catText,
                { color: colors.subText },
                selectedCat.label === cat.label && styles.catTextActive,
              ]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 지도 */}
      <View style={styles.mapWrap}>
        {Platform.OS === 'web' ? (
          location ? React.createElement('iframe', {
            src: `https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.006},${location.lat - 0.004},${location.lng + 0.006},${location.lat + 0.004}&layer=mapnik&marker=${location.lat},${location.lng}`,
            style: { width: '100%', height: '100%', border: 'none' },
          }) : (
            <View style={[styles.mapPlaceholder, { backgroundColor: colors.card }]}>
              <Text style={styles.mapPlaceholderEmoji}>🗺️</Text>
              <Text style={[styles.mapPlaceholderText, { color: colors.subText }]}>학교를 검색하면 지도가 나타나요</Text>
            </View>
          )
        ) : !KAKAO_JS_KEY ? (
          <View style={[styles.mapPlaceholder, { backgroundColor: colors.card }]}>
            <Text style={styles.mapPlaceholderEmoji}>🗺️</Text>
            <Text style={[styles.mapPlaceholderText, { color: colors.subText }]}>KAKAO_JS_KEY를 설정해주세요</Text>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            style={styles.map}
            onLoadEnd={() => setMapReady(true)}
            onMessage={e => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'tap') {
                  const place = places.find(p => p.id === msg.id);
                  if (place) {
                    setSelectedPlace(place);
                    setSheetVisible(true);
                  }
                }
              } catch {}
            }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
          />
        )}
      </View>

      {/* 맛집 리스트 */}
      <ScrollView style={styles.listSection} showsVerticalScrollIndicator={false}>

        {location && (
          <View style={[styles.nameSearchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text>🔍 </Text>
            <TextInput
              style={[styles.nameSearchInput, { color: colors.text }]}
              placeholder="맛집 이름으로 검색"
              placeholderTextColor={colors.subText}
              value={nameQuery}
              onChangeText={setNameQuery}
            />
            {nameQuery.length > 0 && (
              <TouchableOpacity onPress={() => setNameQuery('')}>
                <Text style={{ color: colors.subText, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!location && !loading && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🗺️</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>학교를 검색해보세요</Text>
            <Text style={[styles.emptySub, { color: colors.subText }]}>
              학교 이름 검색 후 주변 맛집이{'\n'}지도와 리스트로 나타나요
            </Text>
          </View>
        )}

        {location && (
          <>
            <Text style={[styles.listCount, { color: colors.subText }]}>
              {selectedCat.emoji} {selectedCat.label} {filtered.length}곳
            </Text>
            {filtered.map(place => (
              <TouchableOpacity
                key={place.id}
                style={[
                  styles.placeCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedPlace?.id === place.id && styles.placeCardActive,
                ]}
                onPress={() => openDetail(place)}>
                <View style={[styles.placeEmojiBox, { backgroundColor: colors.bg, borderColor: CAT_COLORS[place.categorySimple] ?? colors.border }]}>
                  <Text style={styles.placeEmoji}>{CAT_EMOJIS[place.categorySimple] ?? '🍽️'}</Text>
                </View>
                <View style={styles.placeInfo}>
                  <View style={styles.placeTopRow}>
                    <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={1}>{place.name}</Text>
                    <View style={[styles.catBadge, { backgroundColor: (CAT_COLORS[place.categorySimple] ?? '#7c6fff') + '22' }]}>
                      <Text style={[styles.catBadgeText, { color: CAT_COLORS[place.categorySimple] ?? '#7c6fff' }]}>{place.categorySimple}</Text>
                    </View>
                  </View>
                  {place.address ? (
                    <Text style={[styles.placeAddr, { color: colors.subText }]} numberOfLines={1}>📍 {place.address}</Text>
                  ) : null}
                  {place.phone ? (
                    <Text style={[styles.placePhone, { color: colors.subText }]}>📞 {place.phone}</Text>
                  ) : null}
                  <Text style={[styles.tapHint, { color: colors.subText }]}>탭하여 리뷰 · 평점 보기 →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* 장소 상세 하단 시트 */}
      <PlaceDetailSheet
        place={selectedPlace}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topSection: { paddingTop: 10 },
  searchRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, marginBottom: 10,
  },
  searchInput: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14,
  },
  searchBtn: {
    backgroundColor: '#7c6fff', borderRadius: 12,
    paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minWidth: 60,
  },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  catScroll: { flexGrow: 0, marginBottom: 10 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  catChipActive: { backgroundColor: '#7c6fff', borderColor: '#7c6fff' },
  catEmoji: { fontSize: 13 },
  catText: { fontSize: 12, fontWeight: '600' },
  catTextActive: { color: '#fff' },

  mapWrap: { height: 220, marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: 'hidden' },
  map: { flex: 1 },
  mapPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16,
  },
  mapPlaceholderEmoji: { fontSize: 40, marginBottom: 8 },
  mapPlaceholderText: { fontSize: 13 },

  listSection: { flex: 1, paddingHorizontal: 16 },
  nameSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10,
  },
  nameSearchInput: { flex: 1, fontSize: 13 },
  errorText: { fontSize: 13, color: '#ff6b6b', textAlign: 'center', marginBottom: 8 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  listCount: { fontSize: 12, marginBottom: 8 },
  placeCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 14, borderWidth: 1,
    padding: 14, marginBottom: 10, gap: 14,
  },
  placeCardActive: { borderColor: '#7c6fff', borderWidth: 2 },
  placeEmojiBox: {
    width: 48, height: 48, borderRadius: 12,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    marginTop: 2, flexShrink: 0,
  },
  placeEmoji: { fontSize: 24 },
  placeInfo: { flex: 1 },
  placeTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  placeName: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 6 },
  catBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 10, fontWeight: '700' },
  placeAddr: { fontSize: 11, marginTop: 2 },
  placePhone: { fontSize: 11, marginTop: 2 },
  tapHint: { fontSize: 10, marginTop: 5 },
});

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    maxHeight: '80%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },

  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 12, gap: 12,
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  catDot: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  catDotEmoji: { fontSize: 24 },
  sheetPlaceName: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  catBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 11, fontWeight: '700' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18 },

  ratingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, marginBottom: 12,
  },
  ratingBig: { fontSize: 22, fontWeight: '800' },
  ratingCount: { fontSize: 13 },
  noReviewText: { fontSize: 13 },

  infoBox: {
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12, gap: 6,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  infoIcon: { fontSize: 13, marginTop: 1 },
  infoText: { fontSize: 13, flex: 1, lineHeight: 18 },

  kakaoMapBtn: {
    borderWidth: 1, borderRadius: 12, paddingVertical: 11,
    alignItems: 'center', marginBottom: 16,
    backgroundColor: '#FEE500',
  },
  kakaoMapBtnText: { fontSize: 13, fontWeight: '700', color: '#3C1E1E' },

  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10, marginTop: 4 },

  starInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  starBtn: { fontSize: 34 },
  starLabel: { fontSize: 13, marginLeft: 6 },

  reviewInput: {
    borderWidth: 1, borderRadius: 12,
    padding: 12, fontSize: 13, minHeight: 72,
    marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: '#7c6fff', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginBottom: 20,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  reviewCard: {
    borderWidth: 1, borderRadius: 12,
    padding: 12, marginBottom: 8, gap: 6,
  },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewStars: { fontSize: 16, fontWeight: '700' },
  reviewDate: { fontSize: 11 },
  reviewBody: { fontSize: 13, lineHeight: 18 },
});
