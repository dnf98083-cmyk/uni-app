import { router } from 'expo-router';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const SCHOOLS = [
  { name: '전남대학교', region: '광주', emoji: '🏛️', restaurants: ['참이슬 감자탕', '카페 드 유니', '마라탕 천국', '분식이 최고야', '스시로 일식당'] },
  { name: '조선대학교', region: '광주', emoji: '🎓', restaurants: ['조선 족발', '대학로 카페', '금남 분식', '충장로 피자'] },
  { name: '광주과학기술원(GIST)', region: '광주', emoji: '🔬', restaurants: ['GIST 학식당', '상무 국밥', '운남동 삼겹살'] },
  { name: '서울대학교', region: '서울', emoji: '🏫', restaurants: ['관악 순대국', '샤로수길 카페', '서울대입구 초밥'] },
  { name: '연세대학교', region: '서울', emoji: '🏛️', restaurants: ['신촌 감자탕', '홍대 마라탕', '연남동 파스타'] },
  { name: '고려대학교', region: '서울', emoji: '🎓', restaurants: ['안암 곱창', '고대 앞 분식', '성북 국밥'] },
  { name: '한양대학교', region: '서울', emoji: '🏫', restaurants: ['왕십리 낙곱새', '한양대 카페', '성수 브런치'] },
  { name: '성균관대학교', region: '서울/수원', emoji: '🔬', restaurants: ['인사동 한식', '수원 갈비', '혜화 카페'] },
  { name: '부산대학교', region: '부산', emoji: '🌊', restaurants: ['부산 돼지국밥', '서면 밀면', '해운대 회'] },
  { name: '경북대학교', region: '대구', emoji: '🏛️', restaurants: ['대구 납작만두', '동성로 카페', '북구 삼겹살'] },
  { name: '충남대학교', region: '대전', emoji: '🎓', restaurants: ['대전 성심당', '둔산 갈비', '유성 온천 칼국수'] },
  { name: '전북대학교', region: '전주', emoji: '🏫', restaurants: ['전주 비빔밥', '객리단길 카페', '한옥마을 국밥'] },
];

const RESTAURANT_EMOJIS = ['🍲', '☕', '🌶️', '🍢', '🍱', '🍕', '🥩', '🍜'];

type School = typeof SCHOOLS[number];

export default function SchoolScreen() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<School | null>(null);

  const filtered = query
    ? SCHOOLS.filter(s => s.name.includes(query) || s.region.includes(query))
    : SCHOOLS;

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>

        {/* 단계 표시 */}
        <View style={styles.stepRow}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={[styles.stepDot, s <= 2 && styles.stepDotActive]} />
          ))}
        </View>

        <Text style={styles.title}>어느 학교에 다니세요?</Text>
        <Text style={styles.sub}>학교에 맞는 커뮤니티와 맛집 정보를 제공해요</Text>

        {/* 검색 */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="학교 이름 또는 지역 검색"
            placeholderTextColor="#44445a"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {/* 학교 목록 */}
        {!selected && filtered.map((school, i) => (
          <TouchableOpacity
            key={i}
            style={styles.schoolCard}
            onPress={() => setSelected(school)}
          >
            <Text style={styles.schoolEmoji}>{school.emoji}</Text>
            <View style={styles.schoolInfo}>
              <Text style={styles.schoolName}>{school.name}</Text>
              <Text style={styles.schoolRegion}>📍 {school.region}</Text>
            </View>
            <Text style={styles.schoolArrow}>›</Text>
          </TouchableOpacity>
        ))}

        {/* 선택된 학교 + 맛집 지도 미리보기 */}
        {selected && (
          <View>
            {/* 선택된 학교 카드 */}
            <View style={styles.selectedCard}>
              <View style={styles.selectedLeft}>
                <Text style={styles.selectedEmoji}>{selected.emoji}</Text>
                <View>
                  <Text style={styles.selectedName}>{selected.name}</Text>
                  <Text style={styles.selectedRegion}>📍 {selected.region}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.changeBtn}>
                <Text style={styles.changeBtnText}>변경</Text>
              </TouchableOpacity>
            </View>

            {/* 맛집 지도 미리보기 */}
            <View style={styles.mapSection}>
              <Text style={styles.mapTitle}>🍽️ {selected.name} 근처 인증 맛집</Text>
              <View style={styles.mapPreview}>
                {/* 지도 배경 */}
                <View style={styles.mapBg}>
                  <Text style={styles.mapBgText}>🗺️ 지도 영역</Text>
                  <Text style={styles.mapBgSub}>react-native-maps 연동 예정</Text>
                </View>
                {/* 학교 핀 */}
                <View style={[styles.pin, styles.schoolPin, { top: '40%', left: '42%' }]}>
                  <Text style={styles.pinText}>{selected.emoji}</Text>
                </View>
                {/* 맛집 핀들 */}
                {selected.restaurants.slice(0, 5).map((_, ri) => {
                  const positions = [
                    { top: '25%', left: '20%' },
                    { top: '20%', left: '60%' },
                    { top: '55%', left: '70%' },
                    { top: '65%', left: '25%' },
                    { top: '45%', left: '80%' },
                  ];
                  return (
                    <View key={ri} style={[styles.pin, styles.restaurantPin, positions[ri]]}>
                      <Text style={styles.pinText}>{RESTAURANT_EMOJIS[ri]}</Text>
                    </View>
                  );
                })}
                {/* 내 위치 */}
                <View style={[styles.myLoc, { top: '50%', left: '48%' }]}>
                  <View style={styles.myLocDot} />
                </View>
              </View>

              {/* 맛집 목록 */}
              <View style={styles.restaurantList}>
                {selected.restaurants.map((r, ri) => (
                  <View key={ri} style={styles.restaurantItem}>
                    <Text style={styles.restaurantEmoji}>{RESTAURANT_EMOJIS[ri % RESTAURANT_EMOJIS.length]}</Text>
                    <Text style={styles.restaurantName}>{r}</Text>
                    <Text style={styles.restaurantTag}>커뮤니티 인증</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 다음 버튼 */}
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => router.push('/onboarding/register')}
            >
              <Text style={styles.nextBtnText}>다음 → 시간표 등록</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070d' },

  header: { paddingHorizontal: 20, paddingTop: 55, paddingBottom: 12 },
  backText: { color: '#555', fontSize: 14, marginBottom: 16 },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#2a2a40' },
  stepDotActive: { backgroundColor: '#7c6fff' },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 8 },
  sub: { fontSize: 13, color: '#888', marginBottom: 14 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#13131a', borderRadius: 14,
    borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, color: '#eee', fontSize: 14 },

  list: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  schoolCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#13131a', borderRadius: 14,
    borderWidth: 1, borderColor: '#2a2a40',
    padding: 14, marginBottom: 8,
  },
  schoolEmoji: { fontSize: 28, marginRight: 14 },
  schoolInfo: { flex: 1 },
  schoolName: { fontSize: 15, fontWeight: '700', color: '#eee' },
  schoolRegion: { fontSize: 12, color: '#555', marginTop: 3 },
  schoolArrow: { fontSize: 20, color: '#44445a' },

  selectedCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(124,111,255,0.12)', borderRadius: 14,
    borderWidth: 1, borderColor: '#7c6fff',
    padding: 14, marginBottom: 16,
  },
  selectedLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectedEmoji: { fontSize: 28 },
  selectedName: { fontSize: 15, fontWeight: '700', color: '#eee' },
  selectedRegion: { fontSize: 12, color: '#888', marginTop: 2 },
  changeBtn: {
    backgroundColor: '#2a2a40', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  changeBtnText: { fontSize: 12, color: '#aaa', fontWeight: '600' },

  mapSection: { marginBottom: 20 },
  mapTitle: { fontSize: 14, fontWeight: '700', color: '#eee', marginBottom: 12 },
  mapPreview: {
    height: 200, backgroundColor: '#0d1117',
    borderRadius: 16, borderWidth: 1, borderColor: '#2a2a40',
    overflow: 'hidden', position: 'relative', marginBottom: 12,
  },
  mapBg: {
    position: 'absolute', inset: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  mapBgText: { fontSize: 24, marginBottom: 4 },
  mapBgSub: { fontSize: 11, color: '#333' },

  pin: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  schoolPin: { backgroundColor: 'rgba(124,111,255,0.3)', borderColor: '#7c6fff' },
  restaurantPin: { backgroundColor: '#13131a', borderColor: '#3eeea0' },
  pinText: { fontSize: 16 },
  myLoc: {
    position: 'absolute',
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(124,111,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  myLocDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#7c6fff' },

  restaurantList: { gap: 8 },
  restaurantItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#13131a', borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  restaurantEmoji: { fontSize: 20, marginRight: 12 },
  restaurantName: { flex: 1, fontSize: 13, color: '#eee', fontWeight: '600' },
  restaurantTag: {
    fontSize: 10, color: '#3eeea0', fontWeight: '700',
    backgroundColor: 'rgba(62,238,160,0.1)', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },

  nextBtn: {
    backgroundColor: '#7c6fff', borderRadius: 16,
    height: 54, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7c6fff', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    marginTop: 8,
  },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
