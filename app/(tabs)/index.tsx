import { geminiModel } from '@/lib/gemini';
import { searchLocalData } from '@/lib/localSearch';
import type { ChatSession } from '@google/generative-ai';
import { useRef, useState } from 'react';
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
import { useTheme } from '@/lib/ThemeContext';

type Message = { role: 'user' | 'ai'; text: string };

export default function HomeScreen() {
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: '안녕! 나는 신구대 전용 AI 친구 Uni야 🎓\n학교 주변 맛집, 학교생활 고민, 수강신청, 취업 정보까지 뭐든 물어봐!' }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const chatRef = useRef<ChatSession | null>(null);

  const getChat = () => {
    if (!chatRef.current) {
      chatRef.current = geminiModel.startChat();
    }
    return chatRef.current;
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setMessage('');
    setLoading(true);

    try {
      const localContext = searchLocalData(text);
      const prompt = localContext
        ? `[앱 내 정보]\n${localContext}\n\n[사용자 질문]\n${text}`
        : text;
      const result = await getChat().sendMessage(prompt);
      const reply = result.response.text();
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (e: any) {
      const msg = e?.message?.includes('API_KEY') ? 'API 키가 올바르지 않아요.' :
        e?.message?.includes('quota') ? '오늘 사용량을 초과했어요.' :
        '오류가 발생했어요: ' + (e?.message ?? '다시 시도해주세요.');
      setMessages(prev => [...prev, { role: 'ai', text: msg }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>

      {/* 날씨 바 */}
      <View style={[styles.weatherBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.weatherIcon}>🌤️</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.weatherTemp, { color: colors.text }]}>18°C  광주 · 맑음</Text>
          <Text style={[styles.weatherSub, { color: colors.subText }]}>미세먼지 좋음</Text>
        </View>
        <Text style={styles.commute}>🚌 버스 14분</Text>
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
        {['🍜 주변 맛집 추천', '📚 수강신청 꿀팁', '💰 장학금 정보', '☕ 근처 카페 어디?', '📝 과제 도움', '💼 취업 정보'].map((q, i) => (
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
          placeholder="학교 맛집, 학교생활 등 뭐든 물어봐..."
          placeholderTextColor={colors.subText}
          multiline
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
});
