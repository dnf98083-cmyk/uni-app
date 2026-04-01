import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/lib/ThemeContext';

const FILTERS = ['전체', '한식', '중식', '일식', '양식', '카페', '분식'];
const CATEGORY_EMOJIS: Record<string, string> = {
  한식: '🍲', 중식: '🌶️', 일식: '🍱', 양식: '🍕', 카페: '☕', 분식: '🍢', 기타: '🍽️',
};

type Place = {
  id: number;
  name: string;
  category: string;
  lat: number;
  lon: number;
  address: string;
};

type Location = { lat: number; lon: number };

const CUISINE_MAP: [string, string][] = [
  ['korean', '한식'], ['bunsik', '분식'], ['chicken', '한식'], ['gukbap', '한식'],
  ['chinese', '중식'], ['malatang', '중식'], ['dimsum', '중식'],
  ['japanese', '일식'], ['sushi', '일식'], ['ramen', '일식'],
  ['pizza', '양식'], ['burger', '양식'], ['western', '양식'], ['italian', '양식'],
  ['cafe', '카페'], ['coffee', '카페'],
];

const getCategoryFromTags = (tags: any): string => {
  const cuisine = (tags?.cuisine ?? '').toLowerCase();
  const amenity = tags?.amenity ?? '';
  if (amenity === 'cafe') return '카페';
  for (const [key, val] of CUISINE_MAP) {
    if (cuisine.includes(key)) return val;
  }
  return '한식';
};

const geocodeSchool = async (name: string): Promise<Location> => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&accept-language=ko`,
    { headers: { 'User-Agent': 'UniApp/1.0' } }
  );
  const data = await res.json();
  if (!data.length) throw new Error('학교를 찾을 수 없어요');
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
};

const fetchRestaurants = async (lat: number, lon: number): Promise<Place[]> => {
  const query = `[out:json][timeout:25];(node["amenity"~"restaurant|cafe|fast_food"](around:600,${lat},${lon}););out body;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
  });
  const data = await res.json();
  return data.elements
    .map((el: any) => ({
      id: el.id,
      name: el.tags?.['name:ko'] || el.tags?.name || '',
      category: getCategoryFromTags(el.tags),
      lat: el.lat,
      lon: el.lon,
      address: el.tags?.['addr:full'] || el.tags?.['addr:street'] || '',
    }))
    .filter((p: Place) => p.name.length > 0);
};

export default function MapScreen() {
  const { colors } = useTheme();
  const [schoolQuery, setSchoolQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('전체');
  const [location, setLocation] = useState<Location | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    if (!schoolQuery.trim()) return;
    setLoading(true);
    setError('');
    setPlaces([]);
    setLocation(null);
    try {
      const loc = await geocodeSchool(schoolQuery.trim());
      setLocation(loc);
      const results = await fetchRestaurants(loc.lat, loc.lon);
      setPlaces(results);
      if (results.length === 0) setError('주변 맛집 정보가 없어요. 다른 학교를 검색해보세요.');
    } catch (e: any) {
      setError(e.message || '검색 중 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = places
    .filter(p => selectedFilter === '전체' || p.category === selectedFilter)
    .filter(p => nameQuery.trim() === '' || p.name.includes(nameQuery.trim()));

  const mapUrl = location
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${location.lon - 0.006},${location.lat - 0.004},${location.lon + 0.006},${location.lat + 0.004}&layer=mapnik&marker=${location.lat},${location.lon}`
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.accent }]}>맛집 🗺️</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>학교 주변 실시간 맛집 검색</Text>
      </View>

      {/* 학교 검색 */}
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="학교 이름을 입력하세요 (예: 전남대학교)"
          placeholderTextColor={colors.subText}
          value={schoolQuery}
          onChangeText={setSchoolQuery}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={search} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.searchBtnText}>검색</Text>
          }
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* 지도 */}
      {mapUrl && Platform.OS === 'web' && (
        <View style={styles.mapContainer}>
          {React.createElement('iframe', {
            src: mapUrl,
            style: { width: '100%', height: 220, border: 'none', borderRadius: 12 },
            loading: 'lazy',
          })}
        </View>
      )}

      {!location && !loading && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>학교를 검색해보세요</Text>
          <Text style={[styles.emptySub, { color: colors.subText }]}>
            학교 이름 입력 후 검색하면{'\n'}주변 맛집이 지도와 함께 나타나요
          </Text>
        </View>
      )}

      {location && (
        <>
          {/* 맛집 이름 검색 */}
          <View style={[styles.nameSearchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.nameSearchIcon}>🔍</Text>
            <TextInput
              style={[styles.nameSearchInput, { color: colors.text }]}
              placeholder="맛집 이름 검색"
              placeholderTextColor={colors.subText}
              value={nameQuery}
              onChangeText={setNameQuery}
            />
            {nameQuery.length > 0 && (
              <TouchableOpacity onPress={() => setNameQuery('')}>
                <Text style={[{ color: colors.subText, fontSize: 16 }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 카테고리 필터 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {FILTERS.map(f => (
              <TouchableOpacity key={f}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedFilter === f && styles.filterChipActive,
                ]}
                onPress={() => setSelectedFilter(f)}>
                <Text style={[
                  styles.filterText,
                  { color: colors.subText },
                  selectedFilter === f && styles.filterTextActive,
                ]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 맛집 목록 */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            <Text style={[styles.listCount, { color: colors.subText }]}>총 {filtered.length}곳</Text>
            {filtered.length === 0 ? (
              <Text style={[styles.noResult, { color: colors.subText }]}>검색 결과가 없어요</Text>
            ) : (
              filtered.map(place => (
                <View key={place.id} style={[styles.placeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.placeEmojiBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={styles.placeEmoji}>
                      {CATEGORY_EMOJIS[place.category] ?? '🍽️'}
                    </Text>
                  </View>
                  <View style={styles.placeInfo}>
                    <View style={styles.placeTopRow}>
                      <Text style={[styles.placeName, { color: colors.text }]}>{place.name}</Text>
                      <View style={[styles.categoryBadge, { backgroundColor: colors.accent + '18' }]}>
                        <Text style={[styles.categoryBadgeText, { color: colors.accent }]}>{place.category}</Text>
                      </View>
                    </View>
                    {place.address ? (
                      <Text style={[styles.placeAddress, { color: colors.subText }]}>📍 {place.address}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 3 },

  searchRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, marginBottom: 12,
  },
  searchInput: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  },
  searchBtn: {
    backgroundColor: '#7c6fff', borderRadius: 12,
    paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minWidth: 60,
  },
  searchBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  errorText: { fontSize: 13, color: '#ff6b6b', textAlign: 'center', marginBottom: 8 },

  mapContainer: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, overflow: 'hidden', height: 180 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  nameSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  nameSearchIcon: { fontSize: 16 },
  nameSearchInput: { flex: 1, fontSize: 13 },

  filterScroll: { flexGrow: 0, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1,
  },
  filterChipActive: { backgroundColor: '#7c6fff', borderColor: '#7c6fff' },
  filterText: { fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  list: { flex: 1, paddingHorizontal: 16 },
  listCount: { fontSize: 12, marginBottom: 10 },
  noResult: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },

  placeCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1,
    padding: 18, marginBottom: 12, gap: 16,
  },
  placeEmojiBox: {
    width: 56, height: 56, borderRadius: 14,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  placeEmoji: { fontSize: 28 },
  placeInfo: { flex: 1 },
  placeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  placeName: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  categoryBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  categoryBadgeText: { fontSize: 11, fontWeight: '700' },
  placeAddress: { fontSize: 12, marginTop: 3 },
});
