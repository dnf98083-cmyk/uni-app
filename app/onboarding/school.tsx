import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const KAKAO_REST_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';

type School = { name: string; region: string; emoji: string };

const searchSchools = async (query: string): Promise<School[]> => {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=15`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
    );
    const data = await res.json();
    return (data.documents ?? [])
      .filter((d: any) =>
        (d.place_name.endsWith('대학교') || d.place_name.endsWith('캠퍼스')) &&
        d.place_name.includes(query.trim())
      )
      .map((d: any) => ({
        name: d.place_name,
        region: d.address_name?.split(' ').slice(0, 2).join(' ') ?? '',
        emoji: '🏫',
      }));
  } catch {
    return [];
  }
};

export default function SchoolScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<School[]>([]);
  const [selected, setSelected] = useState<School | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const found = await searchSchools(query);
      setResults(found);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (school: School) => {
    setSelected(school);
    setResults([]);
    setQuery('');
  };

  const handleCustom = () => {
    handleSelect({ name: query.trim(), region: '직접 입력', emoji: '🏫' });
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>

        <View style={styles.stepRow}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={[styles.stepDot, s <= 2 && styles.stepDotActive]} />
          ))}
        </View>

        <Text style={styles.title}>어느 학교에 다니세요?</Text>
        <Text style={styles.sub}>학교에 맞는 AI 맞춤 서비스를 제공해요</Text>

        {/* 검색창 */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="학교 이름 검색"
            placeholderTextColor="#44445a"
            value={query}
            onChangeText={v => { setQuery(v); setSelected(null); }}
            autoCorrect={false}
          />
          {loading && <ActivityIndicator size="small" color="#7c6fff" />}
          {query.length > 0 && !loading && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
              <Text style={{ color: '#555', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* 검색 결과 */}
        {!selected && results.map((school, i) => (
          <TouchableOpacity
            key={i}
            style={styles.schoolCard}
            onPress={() => handleSelect(school)}>
            <Text style={styles.schoolEmoji}>{school.emoji}</Text>
            <View style={styles.schoolInfo}>
              <Text style={styles.schoolName}>{school.name}</Text>
              <Text style={styles.schoolRegion}>📍 {school.region}</Text>
            </View>
            <Text style={styles.schoolArrow}>›</Text>
          </TouchableOpacity>
        ))}

        {/* 결과 없을 때 직접 입력 */}
        {!selected && query.trim().length > 0 && !loading && results.length === 0 && (
          <TouchableOpacity style={styles.customCard} onPress={handleCustom}>
            <Text style={styles.schoolEmoji}>🏫</Text>
            <View style={styles.schoolInfo}>
              <Text style={styles.customName}>"{query.trim()}" 직접 입력</Text>
              <Text style={styles.customSub}>목록에 없는 학교도 사용할 수 있어요</Text>
            </View>
            <Text style={styles.schoolArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* 검색 전 안내 */}
        {!selected && query.trim().length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎓</Text>
            <Text style={styles.emptyText}>학교 이름을 검색해보세요</Text>
            <Text style={styles.emptySub}>전국 모든 대학교를 검색할 수 있어요</Text>
          </View>
        )}

        {/* 선택된 학교 */}
        {selected && (
          <View>
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

            <TouchableOpacity
              style={styles.nextBtn}
              onPress={async () => {
                await AsyncStorage.setItem('selected_school', JSON.stringify(selected));
                router.push('/onboarding/register');
              }}>
              <Text style={styles.nextBtnText}>다음 →</Text>
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
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: '#eee', fontSize: 14 },

  list: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  schoolCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#13131a', borderRadius: 14,
    borderWidth: 1, borderColor: '#2a2a40',
    padding: 14, marginBottom: 8,
  },
  schoolEmoji: { fontSize: 26, marginRight: 14 },
  schoolInfo: { flex: 1 },
  schoolName: { fontSize: 15, fontWeight: '700', color: '#eee' },
  schoolRegion: { fontSize: 12, color: '#555', marginTop: 3 },
  schoolArrow: { fontSize: 20, color: '#44445a' },

  customCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(62,238,160,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: '#3eeea0',
    padding: 14, marginBottom: 8,
  },
  customName: { fontSize: 15, fontWeight: '700', color: '#3eeea0' },
  customSub: { fontSize: 12, color: '#555', marginTop: 3 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#eee', marginBottom: 8 },
  emptySub: { fontSize: 13, color: '#555' },

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

  nextBtn: {
    backgroundColor: '#7c6fff', borderRadius: 16,
    height: 54, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7c6fff', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    marginTop: 8,
  },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
