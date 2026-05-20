import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type Room = {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_nickname: string;
  user2_nickname: string;
  last_message: string;
  last_message_at: string;
  unread_count?: number;
};

export default function ChatListScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);
      await loadRooms(user.id);
      subscribeToRooms(user.id);
    })();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  const loadRooms = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('chat_rooms')
      .select('*')
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .order('last_message_at', { ascending: false });

    if (data) {
      // Count unread messages for each room
      const roomsWithUnread = await Promise.all(
        data.map(async (room) => {
          const { count } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', room.id)
            .eq('is_read', false)
            .neq('sender_id', uid);
          return { ...room, unread_count: count ?? 0 };
        })
      );
      setRooms(roomsWithUnread);
    }
    setLoading(false);
  };

  const subscribeToRooms = (uid: string) => {
    channelRef.current = supabase
      .channel('chat_rooms_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
        loadRooms(uid);
      })
      .subscribe();
  };

  const getPartnerName = (room: Room) => {
    if (!myId) return '';
    return myId === room.user1_id ? room.user2_nickname : room.user1_nickname;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return '방금';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>채팅 ✦</Text>
        <Text style={styles.subtitle}>1:1 대화</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#7c6fff" />
        </View>
      ) : rooms.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>채팅이 없어요</Text>
          <Text style={styles.emptySubtitle}>커뮤니티에서 다른 사용자와 채팅을 시작해보세요</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {rooms.map((room) => (
            <TouchableOpacity
              key={room.id}
              style={styles.roomCard}
              onPress={() => router.push({ pathname: '/chat/[roomId]' as any, params: { roomId: room.id } })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(getPartnerName(room) || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.roomInfo}>
                <View style={styles.roomTop}>
                  <Text style={styles.partnerName}>{getPartnerName(room) || '알 수 없음'}</Text>
                  <Text style={styles.timeText}>{formatTime(room.last_message_at)}</Text>
                </View>
                <View style={styles.roomBottom}>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {room.last_message || '메시지 없음'}
                  </Text>
                  {(room.unread_count ?? 0) > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{room.unread_count}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070d' },
  header: { paddingHorizontal: 20, paddingTop: 55, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '900', color: '#a78bfa' },
  subtitle: { fontSize: 12, color: '#555', marginTop: 3 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#eee' },
  emptySubtitle: { fontSize: 13, color: '#666', textAlign: 'center', paddingHorizontal: 40 },

  content: { flex: 1 },
  roomCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#13131a',
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#7c6fff22', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#7c6fff44',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#7c6fff' },
  roomInfo: { flex: 1 },
  roomTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  partnerName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#eee' },
  timeText: { fontSize: 11, color: '#555' },
  roomBottom: { flexDirection: 'row', alignItems: 'center' },
  lastMessage: { flex: 1, fontSize: 13, color: '#777' },
  unreadBadge: {
    backgroundColor: '#7c6fff', borderRadius: 10,
    minWidth: 20, height: 20,
    paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center',
  },
  unreadText: { fontSize: 11, color: '#fff', fontWeight: '700' },
});
