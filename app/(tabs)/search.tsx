import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { searchPostsByEmbedding } from '../../lib/embedding';

const CATEGORIES = ['전체', '자유', '질문', '정보', '익명'];
const TRENDING_TAGS = ['기말고사', '학식 메뉴', '인턴 후기', '수강신청 꿀팁', '근처 카페'];

type Post = {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  similarity?: number;
};

type SearchMode = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [posts, setPosts] = useState<Post[]>([]);
  const [mode, setMode] = useState<SearchMode>('idle');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isAI, setIsAI] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string, cat: string) => {
    const trimmed = q.trim();
    if (!trimmed) { setMode('idle'); setPosts([]); return; }

    setMode('loading');
    try {
      // Add to recent searches
      setRecentSearches(prev => [trimmed, ...prev.filter(r => r !== trimmed)].slice(0, 5));

      // Try vector search first (RAG)
      let results: Post[] = [];
      let usedAI = false;
      try {
        const vectorHits = await searchPostsByEmbedding(trimmed, 10);
        if (vectorHits.length > 0) {
          const ids = vectorHits.map(h => h.post_id);
          const simMap = Object.fromEntries(vectorHits.map(h => [h.post_id, h.similarity]));
          let q2 = supabase
            .from('posts')
            .select('id, title, content, category, created_at, like_count, comment_count')
            .in('id', ids);
          if (cat !== '전체') q2 = q2.eq('category', cat);
          const { data } = await q2;
          if (data && data.length > 0) {
            results = data.map(p => ({ ...p, similarity: simMap[p.id] ?? 0 }))
              .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
            usedAI = true;
          }
        }
      } catch {
        // Vector search failed — fall through to full-text
      }

      // Fallback: Supabase full-text search
      if (results.length === 0) {
        let q3 = supabase
          .from('posts')
          .select('id, title, content, category, created_at, like_count, comment_count')
          .or(`title.ilike.%${trimmed}%,content.ilike.%${trimmed}%`)
          .order('created_at', { ascending: false })
          .limit(20);
        if (cat !== '전체') q3 = q3.eq('category', cat);
        const { data, error } = await q3;
        if (error) throw error;
        results = data ?? [];
      }

      setIsAI(usedAI);
      setPosts(results);
      setMode(results.length > 0 ? 'results' : 'empty');
    } catch {
      setMode('error');
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text, selectedCategory), 500);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    if (query.trim()) runSearch(query, cat);
  };

  const handleTagPress = (tag: string) => {
    setQuery(tag);
    runSearch(tag, selectedCategory);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>검색 ✦</Text>
        <Text style={styles.subtitle}>커뮤니티 데이터 기반 AI 검색</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleQueryChange}
            placeholder="교수님, 맛집, 강의 뭐든지..."
            placeholderTextColor="#44445a"
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query, selectedCategory)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setMode('idle'); setPosts([]); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filter */}
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
            onPress={() => handleCategoryChange(cat)}
          >
            <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content area */}
      {mode === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color="#7c6fff" size="large" />
          <Text style={styles.loadingText}>AI가 검색 중...</Text>
        </View>
      )}

      {mode === 'results' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultCount}>{posts.length}개 결과</Text>
            {isAI && (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>✦ AI 벡터 검색</Text>
              </View>
            )}
          </View>
          {posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postTop}>
                <View style={styles.catBadge}>
                  <Text style={styles.catBadgeText}>{post.category}</Text>
                </View>
                {post.similarity !== undefined && (
                  <Text style={styles.similarityText}>
                    유사도 {Math.round(post.similarity * 100)}%
                  </Text>
                )}
              </View>
              <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
              <Text style={styles.postContent} numberOfLines={2}>{post.content}</Text>
              <View style={styles.postMeta}>
                <Text style={styles.metaText}>❤️ {post.like_count ?? 0}</Text>
                <Text style={styles.metaText}>💬 {post.comment_count ?? 0}</Text>
                <Text style={styles.metaDate}>{formatDate(post.created_at)}</Text>
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {mode === 'empty' && (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🔎</Text>
          <Text style={styles.emptyTitle}>검색 결과 없음</Text>
          <Text style={styles.emptySubtitle}>"{query}"에 대한 게시글이 없어요</Text>
        </View>
      )}

      {mode === 'error' && (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>검색 오류</Text>
          <TouchableOpacity onPress={() => runSearch(query, selectedCategory)}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'idle' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>최근 검색</Text>
                <TouchableOpacity onPress={() => setRecentSearches([])}>
                  <Text style={styles.sectionAction}>전체 삭제</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((item, i) => (
                <TouchableOpacity key={i} style={styles.recentItem} onPress={() => handleTagPress(item)}>
                  <Text style={styles.recentIcon}>🕐</Text>
                  <Text style={styles.recentText}>{item}</Text>
                  <TouchableOpacity onPress={() => setRecentSearches(prev => prev.filter((_, j) => j !== i))}>
                    <Text style={styles.recentDeleteText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔥 인기 키워드</Text>
            </View>
            {TRENDING_TAGS.map((tag, i) => (
              <TouchableOpacity key={i} style={styles.trendingItem} onPress={() => handleTagPress(tag)}>
                <Text style={styles.trendingRank}>{i + 1}</Text>
                <Text style={styles.trendingTag}># {tag}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.aiCard}>
            <Text style={styles.aiCardLabel}>✦ AI 벡터 검색</Text>
            <Text style={styles.aiCardTitle}>의미 기반으로 관련 게시글을 찾아드려요</Text>
            <View style={styles.aiPillRow}>
              {['기말고사 족보', '맛집 혼밥', '편입 정보'].map((p, i) => (
                <TouchableOpacity key={i} style={styles.aiPill} onPress={() => handleTagPress(p)}>
                  <Text style={styles.aiPillText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
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

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#7c6fff', fontSize: 14, marginTop: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#eee' },
  emptySubtitle: { fontSize: 13, color: '#666' },
  retryText: { color: '#7c6fff', fontSize: 14, fontWeight: '700' },

  content: { flex: 1, paddingHorizontal: 16 },
  resultHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 12, marginTop: 4,
  },
  resultCount: { fontSize: 13, color: '#888' },
  aiBadge: {
    backgroundColor: '#1a1a2e', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#7c6fff',
  },
  aiBadgeText: { fontSize: 10, color: '#7c6fff', fontWeight: '700' },

  postCard: {
    backgroundColor: '#13131a', borderRadius: 14,
    borderWidth: 1, borderColor: '#1e1e30',
    padding: 14, marginBottom: 10,
  },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catBadge: {
    backgroundColor: '#1a1a2e', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  catBadgeText: { fontSize: 10, color: '#7c6fff', fontWeight: '700' },
  similarityText: { fontSize: 10, color: '#555' },
  postTitle: { fontSize: 14, fontWeight: '700', color: '#eee', marginBottom: 5 },
  postContent: { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 10 },
  postMeta: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  metaText: { fontSize: 11, color: '#555' },
  metaDate: { fontSize: 11, color: '#444', marginLeft: 'auto' },

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
  recentDeleteText: { fontSize: 12, color: '#44445a', padding: 4 },

  trendingItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  trendingRank: { fontSize: 13, fontWeight: '900', color: '#7c6fff', width: 24 },
  trendingTag: { flex: 1, fontSize: 13, color: '#ccc' },

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
