import { buildSystemPrompt } from '@/lib/gemini';
import { formatTimetableContext, isCommunityQuery, isTimetableQuery, searchLocalData } from '@/lib/localSearch';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Message = { role: 'user' | 'ai'; text: string; mapCategory?: string; restaurantQuery?: string };

const MAP_KEYWORDS: { keywords: string[]; category: string }[] = [
  { keywords: ['한식', '한국음식', '국밥', '찌개', '비빔밥', '설렁탕'], category: '한식' },
  { keywords: ['중식', '중국집', '짜장', '짬뽕', '탕수육'], category: '중식' },
  { keywords: ['일식', '초밥', '스시', '라멘', '돈카츠', '우동'], category: '일식' },
  { keywords: ['양식', '파스타', '피자', '스테이크', '버거'], category: '양식' },
  { keywords: ['카페', '커피', '디저트', '케이크', '라떼'], category: '카페' },
  { keywords: ['술집', '포차', '이자카야', '맥주', '소주'], category: '술집' },
  { keywords: ['분식', '떡볶이', '순대', '튀김', '김밥'], category: '분식' },
  { keywords: ['맛집', '식당', '음식점', '밥집', '먹을'], category: '전체' },
];

function detectMapCategory(text: string): string | null {
  const lower = text.toLowerCase().replace(/\s+/g, '');
  for (const { keywords, category } of MAP_KEYWORDS) {
    if (keywords.some(k => lower.includes(k.replace(/\s+/g, '')))) return category;
  }
  return null;
}

function extractFirstRestaurantName(text: string): string | null {
  const SKIP_WORDS = ['맛집', '음식점', '식당', '가게', '추천', '근처', '주변', '학교', '메뉴', '위치', '특징'];
  // 1. **볼드** 텍스트
  const boldMatches = [...text.matchAll(/\*\*([^*\n]+?)\*\*/g)];
  for (const m of boldMatches) {
    const raw = m[1].trim();
    if (raw.endsWith(':') || SKIP_WORDS.some(k => raw === k || raw.startsWith(k))) continue;
    const quoted = raw.match(/['''"]([^'''"\s]{1,15})['''"]/);
    if (quoted) return quoted[1].trim();
    if (raw.length >= 2 && raw.length <= 15) return raw;
  }
  // 2. 따옴표/홑따옴표로 감싼 이름 '가게명' or '가게명'
  const quoteMatches = [...text.matchAll(/['']([^'']{2,15})['']/g)];
  for (const m of quoteMatches) {
    const raw = m[1].trim();
    if (!SKIP_WORDS.some(k => raw === k)) return raw;
  }
  // 3. 번호 목록 첫 항목
  const listMatch = text.match(/^\d+[\.\)]\s*([^\n\-:：'''"/]{2,12})/m);
  if (listMatch) return listMatch[1].trim();
  return null;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const historyRef = useRef<Array<{ role: string; parts: Array<{ text: string }> }>>([]);
  const schoolInfoRef = useRef({ name: '대학교', region: '' });

  const loadUserSchool = useCallback(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      const meta = session?.user?.user_metadata ?? {};
      const name = meta.school_name ?? '';
      const region = meta.school_region ?? '';
      setSchoolName(name);
      schoolInfoRef.current = { name: name || '대학교', region };
      historyRef.current = [];
      setMessages([{
        role: 'ai',
        text: name
          ? `안녕! 나는 ${name} 전용 AI 친구 Uni야 🎓\n학교 주변 맛집, 학교생활 고민, 수강신청, 취업 정보까지 뭐든 물어봐!`
          : '안녕! 나는 AI 친구 Uni야 🎓\n학교생활 고민, 맛집, 수강신청, 취업 정보까지 뭐든 물어봐!',
      }]);
    });
  }, []);

  useFocusEffect(loadUserSchool);

  const sendToGemini = async (prompt: string): Promise<string> => {
    const { name, region } = schoolInfoRef.current;
    const res = await fetch('/api/gemini-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        systemInstruction: buildSystemPrompt(name, region),
        history: historyRef.current,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'API 오류');
    return data.text ?? '';
  };

  // 커뮤니티 게시글 검색 (Supabase)
  const searchCommunityPosts = async (query: string): Promise<string | null> => {
    try {
      const { data } = await supabase
        .from('posts')
        .select('tab, title, body, author_nickname, is_anonymous, created_at')
        .order('created_at', { ascending: false })
        .limit(60);
      if (!data || data.length === 0) return null;

      const keywords = query.split(/\s+/).filter(w => w.length > 1);
      const matched = data.filter(post => {
        const content = `${post.title} ${post.body}`.toLowerCase();
        return keywords.some(k => content.includes(k.toLowerCase()));
      }).slice(0, 5);

      if (matched.length === 0) return null;

      const lines = matched.map(p =>
        `[${p.tab}] ${p.title}\n${p.body.slice(0, 120)}${p.body.length > 120 ? '...' : ''}`
      );
      return `💬 커뮤니티 관련 글 (${matched.length}개):\n${lines.join('\n\n')}`;
    } catch {
      return null;
    }
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setMessage('');
    setLoading(true);

    try {
      const contexts: string[] = [];

      // 1. 시간표 컨텍스트
      if (isTimetableQuery(text)) {
        const uid = userId ?? (await supabase.auth.getUser()).data.user?.id;
        if (uid) {
          const stored = await AsyncStorage.getItem(`timetable_${uid}`);
          if (stored) {
            const timetableCtx = formatTimetableContext(stored, text);
            if (timetableCtx) contexts.push(timetableCtx);
          } else {
            contexts.push('📅 아직 시간표가 등록되지 않았어요. 시간표 탭에서 먼저 등록해보세요!');
          }
        }
      }

      // 2. 커뮤니티 컨텍스트
      if (isCommunityQuery(text)) {
        const communityCtx = await searchCommunityPosts(text);
        if (communityCtx) contexts.push(communityCtx);
      }

      // 3. 앱 내 일반 팁
      const localCtx = searchLocalData(text);
      if (localCtx) contexts.push(localCtx);

      const prompt = contexts.length > 0
        ? `[앱 내 정보]\n${contexts.join('\n\n')}\n\n[사용자 질문]\n${text}`
        : text;

      historyRef.current = [...historyRef.current, { role: 'user', parts: [{ text: prompt }] }];
      const reply = await sendToGemini(prompt);
      historyRef.current = [...historyRef.current, { role: 'model', parts: [{ text: reply }] }];
      // reply에서 구체적 카테고리 우선, 없으면 사용자 질문에서 감지
      const replyCategory = detectMapCategory(reply);
      const textCategory = detectMapCategory(text);
      const mapCategory = (replyCategory && replyCategory !== '전체' ? replyCategory : textCategory) ?? undefined;
      const restaurantQuery = mapCategory ? (extractFirstRestaurantName(reply) ?? undefined) : undefined;
      setMessages(prev => [...prev, { role: 'ai', text: reply, mapCategory, restaurantQuery }]);
    } catch (e: any) {
      const msg = e?.message?.includes('API_KEY') ? 'API 키가 올바르지 않아요.' :
        (e?.message?.includes('quota') || e?.message?.includes('RESOURCE_EXHAUSTED') || e?.message?.includes('429')) ? '잠시 후 다시 시도해줘! (요청이 너무 많았어요 😅)' :
        '오류가 발생했어요: ' + (e?.message ?? '다시 시도해주세요.');
      setMessages(prev => [...prev, { role: 'ai', text: msg }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const quickQuestions = schoolName
    ? [`🍜 ${schoolName} 주변 맛집`, '📚 수강신청 꿀팁', '💰 장학금 정보', `☕ 학교 근처 카페`, '📝 과제 도움', '💼 취업 정보']
    : ['🍜 주변 맛집 추천', '📚 수강신청 꿀팁', '💰 장학금 정보', '☕ 근처 카페 어디?', '📝 과제 도움', '💼 취업 정보'];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>

      {/* 검색바 */}
      <TouchableOpacity
        style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push('/(tabs)/search' as any)}
        activeOpacity={0.8}>
        <Text style={styles.searchBarIcon}>🔍</Text>
        <Text style={[styles.searchBarText, { color: colors.subText }]}>커뮤니티 AI 검색...</Text>
        <View style={styles.searchBarBadge}>
          <Text style={styles.searchBarBadgeText}>AI</Text>
        </View>
      </TouchableOpacity>

      {/* 상단 바 */}
      <View style={[styles.weatherBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.weatherIcon}>🌤️</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.weatherTemp, { color: colors.text }]}>18°C · 맑음</Text>
          <Text style={[styles.weatherSub, { color: colors.subText }]}>미세먼지 좋음</Text>
        </View>
        <TouchableOpacity
          style={[styles.schoolBadge, { borderColor: colors.border }]}
          onPress={() => router.push('/edit-profile')}>
          <Text style={styles.schoolBadgeEmoji}>🏫</Text>
          <Text style={[styles.schoolBadgeText, { color: colors.subText }]} numberOfLines={1}>
            {schoolName || '학교 설정'}
          </Text>
          <Text style={{ color: colors.subText, fontSize: 10 }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 채팅 */}
      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.map((m, i) => (
          <View key={i} style={[
            styles.bubble,
            m.role === 'user'
              ? styles.userBubble
              : [styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}>
            {m.role === 'ai' && <Text style={styles.aiLabel}>✦ UNI</Text>}
            <Text style={[styles.bubbleText, { color: m.role === 'user' ? '#fff' : colors.text }]}>
              {m.text}
            </Text>
            {m.role === 'ai' && m.mapCategory && (
              <TouchableOpacity
                style={styles.mapBtn}
                onPress={async () => {
                  await AsyncStorage.setItem('map_ai_query', JSON.stringify({
                    restaurantName: m.restaurantQuery ?? '',
                    category: m.mapCategory ?? '전체',
                  }));
                  router.push('/(tabs)/map' as any);
                }}>
                <Text style={styles.mapBtnText}>🗺️ 지도에서 보기</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {loading && (
          <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.aiLabel}>✦ UNI</Text>
            <ActivityIndicator color="#7c6fff" size="small" />
          </View>
        )}
      </ScrollView>

      {/* 빠른 질문 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
        {quickQuestions.map((q, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.quickPill, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setMessage(q)}>
            <Text style={[styles.quickText, { color: colors.subText }]}>{q}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 입력창 */}
      <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={message}
          onChangeText={setMessage}
          placeholder={schoolName ? `${schoolName} 맛집, 학교생활 등 뭐든 물어봐...` : '학교 맛집, 학교생활 등 뭐든 물어봐...'}
          placeholderTextColor={colors.subText}
          multiline
          blurOnSubmit
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={loading}>
          <Text style={{ color: '#fff', fontSize: 18 }}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginTop: 10, marginBottom: 6,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, gap: 10,
  },
  searchBarIcon: { fontSize: 15 },
  searchBarText: { flex: 1, fontSize: 13 },
  searchBarBadge: {
    backgroundColor: '#7c6fff22', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: '#7c6fff',
  },
  searchBarBadgeText: { fontSize: 10, color: '#7c6fff', fontWeight: '800' },
  weatherBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginTop: 10,
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1,
  },
  weatherIcon: { fontSize: 22, marginRight: 10 },
  weatherTemp: { fontSize: 13, fontWeight: '700' },
  weatherSub: { fontSize: 10 },
  commute: { fontSize: 12, color: '#3eeea0', fontWeight: '700' },
  schoolBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    maxWidth: 140,
  },
  schoolBadgeEmoji: { fontSize: 12 },
  schoolBadgeText: { fontSize: 11, fontWeight: '600', flex: 1 },
  chat: { flex: 1, paddingHorizontal: 14 },
  bubble: { maxWidth: '85%', padding: 10, borderRadius: 14, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#7c6fff' },
  aiBubble: { alignSelf: 'flex-start', borderWidth: 1 },
  aiLabel: { fontSize: 9, color: '#7c6fff', fontWeight: '700', marginBottom: 4 },
  bubbleText: { fontSize: 13, lineHeight: 20 },
  quickScroll: { paddingHorizontal: 14, marginBottom: 8, flexGrow: 0 },
  quickPill: {
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: 8,
    borderWidth: 1,
  },
  quickText: { fontSize: 11 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginBottom: 20,
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 13, maxHeight: 80 },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#7c6fff', alignItems: 'center',
    justifyContent: 'center', marginLeft: 8,
  },
  sendBtnDisabled: { opacity: 0.5 },
  mapBtn: {
    marginTop: 8, backgroundColor: '#7c6fff',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  mapBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
