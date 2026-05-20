import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !roomId) return;
      setMyId(user.id);

      // Load room info to get partner name
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (room) {
        setPartnerName(
          user.id === room.user1_id ? room.user2_nickname : room.user1_nickname
        );
      }

      await loadMessages(user.id);
      subscribeToMessages(user.id);
    })();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [roomId]);

  const loadMessages = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    setMessages(data ?? []);
    setLoading(false);

    // Mark partner messages as read
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .eq('is_read', false)
      .neq('sender_id', uid);
  };

  const subscribeToMessages = (uid: string) => {
    channelRef.current = supabase
      .channel(`chat_room_${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => [...prev, newMsg]);

          // Mark as read if from partner
          if (newMsg.sender_id !== uid) {
            await supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', newMsg.id);
          }
        }
      )
      .subscribe();
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !myId || !roomId || sending) return;

    setSending(true);
    setInput('');

    const { error } = await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_id: myId,
      content: text,
      is_read: false,
    });

    if (!error) {
      // Update room last_message
      await supabase
        .from('chat_rooms')
        .update({ last_message: text, last_message_at: new Date().toISOString() })
        .eq('id', roomId);
    }
    setSending(false);
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.sender_id === myId;
    const prev = index > 0 ? messages[index - 1] : null;
    const showTime = !prev || new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() > 60000;

    return (
      <>
        {showTime && (
          <Text style={styles.timeLabel}>{formatTime(item.created_at)}</Text>
        )}
        <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
          </View>
          {isMine && (
            <Text style={styles.readReceipt}>{item.is_read ? '읽음' : '안읽음'}</Text>
          )}
        </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{partnerName || '채팅'}</Text>
          <Text style={styles.headerSub}>1:1 대화</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#7c6fff" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>첫 메시지를 보내보세요 👋</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="메시지를 입력하세요..."
          placeholderTextColor="#44445a"
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendBtnText}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070d' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 55, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#13131a',
  },
  backBtn: { padding: 4 },
  backText: { color: '#7c6fff', fontSize: 22, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700', color: '#eee' },
  headerSub: { fontSize: 11, color: '#555' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  messageList: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 },
  timeLabel: {
    textAlign: 'center', fontSize: 11, color: '#555',
    marginVertical: 12,
  },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  messageRowMine: { flexDirection: 'row-reverse' },
  bubble: {
    maxWidth: '72%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleMine: { backgroundColor: '#7c6fff', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#1e1e30', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: '#bbb', lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  readReceipt: { fontSize: 9, color: '#555', marginHorizontal: 6, marginBottom: 2 },

  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyChatText: { fontSize: 14, color: '#444' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#13131a',
    backgroundColor: '#07070d',
  },
  input: {
    flex: 1, color: '#eee', fontSize: 14, lineHeight: 20,
    backgroundColor: '#13131a', borderRadius: 22,
    borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 16, paddingVertical: 10,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#7c6fff',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#2a2a40' },
  sendBtnText: { fontSize: 20, color: '#fff', fontWeight: '700' },
});
