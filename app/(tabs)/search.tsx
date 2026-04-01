import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const CATEGORIES = ['전체', '교수님', '맛집', '강의', '취업', '동아리', '기숙사'];
const TRENDING = [
  { tag: '# 기말고사', count: '1.2k' },
  { tag: '# 학식 메뉴', count: '843' },
  { tag: '# 인턴 후기', count: '721' },
  { tag: '# 수강신청 꿀팁', count: '619' },
  { tag: '# 근처 카페', count: '504' },
];
const RECENT = ['컴퓨터공학과 교수님', '학식 맛집', '취업 면접 후기'];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>검색 ✦</Text>
        <Text style={styles.subtitle}>커뮤니티 데이터 기반 AI 검색</Text>
      </View>

      {/* 검색창 */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="교수님, 맛집, 강의 뭐든지..."
            placeholderTextColor="#44445a"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 카테고리 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 최근 검색 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>최근 검색</Text>
            <TouchableOpacity>
              <Text style={styles.sectionAction}>전체 삭제</Text>
            </TouchableOpacity>
          </View>
          {RECENT.map((item, i) => (
            <TouchableOpacity key={i} style={styles.recentItem} onPress={() => setQuery(item)}>
              <Text style={styles.recentIcon}>🕐</Text>
              <Text style={styles.recentText}>{item}</Text>
              <Text style={styles.recentDeleteText}>✕</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 트렌딩 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 지금 핫한 검색어</Text>
          </View>
          {TRENDING.map((item, i) => (
            <TouchableOpacity key={i} style={styles.trendingItem} onPress={() => setQuery(item.tag)}>
              <Text style={styles.trendingRank}>{i + 1}</Text>
              <Text style={styles.trendingTag}>{item.tag}</Text>
              <View style={styles.trendingBadge}>
                <Text style={styles.trendingCount}>{item.count}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* AI 추천 */}
        <View style={styles.aiCard}>
          <Text style={styles.aiCardLabel}>✦ AI 추천</Text>
          <Text style={styles.aiCardTitle}>이런 걸 찾고 있지 않으신가요?</Text>
          <View style={styles.aiPillRow}>
            {['기말고사 족보', '맛집 혼밥', '편입 정보'].map((p, i) => (
              <TouchableOpacity key={i} style={styles.aiPill} onPress={() => setQuery(p)}>
                <Text style={styles.aiPillText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070d' },
  header: { paddingHorizontal: 20, paddingTop: 55, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '900', color: '#a78bfa' },
  subtitle: { fontSize: 12, color: '#555', marginTop: 3 },

  searchRow: { paddingHorizontal: 16, marginBottom: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#13131a', borderRadius: 16,
    borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, color: '#eee', fontSize: 14 },
  clearBtn: { color: '#555', fontSize: 14, paddingLeft: 8 },

  categoryScroll: { flexGrow: 0, marginBottom: 12 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#13131a',
    borderWidth: 1, borderColor: '#2a2a40',
  },
  categoryChipActive: { backgroundColor: '#7c6fff', borderColor: '#7c6fff' },
  categoryText: { fontSize: 12, color: '#888', fontWeight: '600' },
  categoryTextActive: { color: '#fff' },

  content: { flex: 1, paddingHorizontal: 16 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#eee' },
  sectionAction: { fontSize: 12, color: '#7c6fff' },

  recentItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  recentIcon: { fontSize: 14, marginRight: 10 },
  recentText: { flex: 1, fontSize: 13, color: '#ccc' },
  recentDeleteText: { fontSize: 12, color: '#44445a' },

  trendingItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  trendingRank: { fontSize: 13, fontWeight: '900', color: '#7c6fff', width: 24 },
  trendingTag: { flex: 1, fontSize: 13, color: '#ccc' },
  trendingBadge: {
    backgroundColor: '#1a1a2e', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  trendingCount: { fontSize: 11, color: '#7c6fff', fontWeight: '700' },

  aiCard: {
    backgroundColor: '#13131a', borderRadius: 16,
    borderWidth: 1, borderColor: '#2a2a40',
    padding: 16, marginBottom: 32,
  },
  aiCardLabel: { fontSize: 10, color: '#7c6fff', fontWeight: '700', marginBottom: 6 },
  aiCardTitle: { fontSize: 13, color: '#eee', fontWeight: '600', marginBottom: 12 },
  aiPillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  aiPill: {
    backgroundColor: '#0d0d16', borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 12, paddingVertical: 7,
  },
  aiPillText: { fontSize: 12, color: '#a78bfa' },
});
