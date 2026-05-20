import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { startOrOpenChat } from '../../lib/chat';

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

type Friend = {
  id: string;
  partner_id: string;
  partner_nickname: string;
  partner_school: string;
  status: string;
  requester_id: string;
};

type SearchProfile = {
  id: string;
  nickname: string;
  school: string;
};

type Tab = '채팅방' | '친구';

export default function ChatListScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('채팅방');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReceived, setPendingReceived] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [myNickname, setMyNickname] = useState('');

  const [searchModal, setSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);
      const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', user.id).single();
      setMyNickname(profile?.nickname ?? user.user_metadata?.nickname ?? '나');
      await Promise.all([loadRooms(user.id), loadFriends(user.id)]);
      subscribeToRooms(user.id);
    })();
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  const loadRooms = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('chat_rooms').select('*')
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .order('last_message_at', { ascending: false });

    if (data) {
      const withUnread = await Promise.all(data.map(async (room) => {
        const { count } = await supabase.from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', room.id).eq('is_read', false).neq('sender_id', uid);
        return { ...room, unread_count: count ?? 0 };
      }));
      setRooms(withUnread);
    }
    setLoading(false);
  };

  const loadFriends = async (uid: string) => {
    const { data } = await supabase
      .from('friends')
      .select('id, requester_id, addressee_id, status, profiles!friends_addressee_id_fkey(nickname, school), profiles!friends_requester_id_fkey(nickname, school)')
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);

    if (!data) return;

    const accepted: Friend[] = [];
    const pending: Friend[] = [];

    for (const row of data as any[]) {
      const isRequester = row.requester_id === uid;
      const partnerId = isRequester ? row.addressee_id : row.requester_id;
      const partnerProfile = isRequester
        ? row['profiles!friends_addressee_id_fkey']
        : row['profiles!friends_requester_id_fkey'];

      const entry: Friend = {
        id: row.id,
        partner_id: partnerId,
        partner_nickname: partnerProfile?.nickname ?? '알 수 없음',
        partner_school: partnerProfile?.school ?? '',
        status: row.status,
        requester_id: row.requester_id,
      };

      if (row.status === 'accepted') accepted.push(entry);
      else if (row.status === 'pending' && !isRequester) pending.push(entry);
    }

    setFriends(accepted);
    setPendingReceived(pending);
  };

  const subscribeToRooms = (uid: string) => {
    channelRef.current = supabase.channel('chat_rooms_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => loadRooms(uid))
      .subscribe();
  };

  const acceptFriend = async (friend: Friend) => {
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', friend.id);
    if (myId) loadFriends(myId);
  };

  const declineFriend = async (friend: Friend) => {
    await supabase.from('friends').delete().eq('id', friend.id);
    if (myId) loadFriends(myId);
  };

  const chatWithFriend = async (friend: Friend) => {
    if (!myId) return;
    await startOrOpenChat(myId, myNickname, friend.partner_id, friend.partner_nickname);
  };

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, nickname, school')
      .ilike('nickname', `%${q.trim()}%`)
      .neq('id', myId ?? '')
      .limit(10);
    setSearchResults((data as SearchProfile[]) ?? []);
    setSearching(false);
  };

  const startChatFromSearch = async (profile: SearchProfile) => {
    if (!myId) return;
    setSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
    await startOrOpenChat(myId, myNickname, profile.id, profile.nickname);
  };

  const getPartnerName = (room: Room) =>
    myId === room.user1_id ? room.user2_nickname : room.user1_nickname;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return '방금';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>채팅 ✦</Text>
          <Text style={styles.subtitle}>친구와 1:1 대화</Text>
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={() => setSearchModal(true)}>
          <Text style={styles.searchBtnText}>🔍 사용자 찾기</Text>
        </TouchableOpacity>
      </View>

      {/* 탭 */}
      <View style={styles.tabRow}>
        {(['채팅방', '친구'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
              {tab === '친구' && pendingReceived.length > 0
                ? ` (${pendingReceived.length})`
                : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#7c6fff" /></View>
      ) : activeTab === '채팅방' ? (
        // ── 채팅방 목록 ──
        rooms.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>채팅이 없어요</Text>
            <Text style={styles.emptySubtitle}>커뮤니티에서 작성자 프로필을 눌러 채팅을 시작하세요</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {rooms.map((room) => (
              <TouchableOpacity
                key={room.id}
                style={styles.roomCard}
                onPress={() => router.push({ pathname: '/chat/[roomId]' as any, params: { roomId: room.id } })}>
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
        )
      ) : (
        // ── 친구 목록 ──
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 대기 중인 친구 요청 */}
          {pendingReceived.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>친구 요청 {pendingReceived.length}개</Text>
              {pendingReceived.map(f => (
                <View key={f.id} style={styles.friendCard}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.avatarText}>{f.partner_nickname[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{f.partner_nickname}</Text>
                    {f.partner_school ? <Text style={styles.friendSchool}>{f.partner_school}</Text> : null}
                  </View>
                  <View style={styles.requestBtns}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptFriend(f)}>
                      <Text style={styles.acceptBtnText}>수락</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.declineBtn} onPress={() => declineFriend(f)}>
                      <Text style={styles.declineBtnText}>거절</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 친구 목록 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>친구 {friends.length}명</Text>
            {friends.length === 0 ? (
              <View style={styles.emptyFriends}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>아직 친구가 없어요</Text>
                <Text style={styles.emptySubtitle}>커뮤니티에서 작성자 프로필을 눌러 친구 추가하세요</Text>
              </View>
            ) : (
              friends.map(f => (
                <View key={f.id} style={styles.friendCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{f.partner_nickname[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{f.partner_nickname}</Text>
                    {f.partner_school ? <Text style={styles.friendSchool}>{f.partner_school}</Text> : null}
                  </View>
                  <TouchableOpacity style={styles.chatFriendBtn} onPress={() => chatWithFriend(f)}>
                    <Text style={styles.chatFriendBtnText}>채팅</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* 사용자 검색 모달 */}
      <Modal visible={searchModal} transparent animationType="slide" onRequestClose={() => setSearchModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>사용자 찾기</Text>
              <TouchableOpacity onPress={() => { setSearchModal(false); setSearchQuery(''); setSearchResults([]); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchBox}>
              <Text style={{ fontSize: 15, marginRight: 8 }}>🔍</Text>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="닉네임으로 검색..."
                placeholderTextColor="#44445a"
                value={searchQuery}
                onChangeText={q => { setSearchQuery(q); searchUsers(q); }}
                autoFocus
              />
            </View>
            {searching ? (
              <ActivityIndicator color="#7c6fff" style={{ marginTop: 24 }} />
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {searchResults.map(p => (
                  <TouchableOpacity key={p.id} style={styles.searchResultItem} onPress={() => startChatFromSearch(p)}>
                    <View style={styles.friendAvatar}>
                      <Text style={styles.avatarText}>{p.nickname[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{p.nickname}</Text>
                      {p.school ? <Text style={styles.friendSchool}>{p.school}</Text> : null}
                    </View>
                    <Text style={styles.chatFriendBtnText}>채팅 →</Text>
                  </TouchableOpacity>
                ))}
                {!searching && searchQuery.trim() && searchResults.length === 0 && (
                  <Text style={styles.noResult}>"{searchQuery}" 닉네임 사용자가 없어요</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070d' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 55, paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '900', color: '#a78bfa' },
  subtitle: { fontSize: 12, color: '#555', marginTop: 3 },
  searchBtn: {
    backgroundColor: '#13131a', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2a2a40',
  },
  searchBtnText: { fontSize: 12, color: '#7c6fff', fontWeight: '700' },

  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a2e', marginHorizontal: 20 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#7c6fff' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#555' },
  tabTextActive: { color: '#a78bfa' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#eee' },
  emptySubtitle: { fontSize: 13, color: '#666', textAlign: 'center' },
  emptyFriends: { alignItems: 'center', paddingVertical: 40, gap: 12 },

  content: { flex: 1 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },

  roomCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#13131a',
  },
  friendCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#13131a',
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#7c6fff22', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#7c6fff44',
  },
  friendAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#7c6fff22', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#7c6fff44',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#7c6fff' },
  roomInfo: { flex: 1 },
  friendInfo: { flex: 1 },
  roomTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  partnerName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#eee' },
  friendName: { fontSize: 15, fontWeight: '700', color: '#eee', marginBottom: 2 },
  friendSchool: { fontSize: 11, color: '#666' },
  timeText: { fontSize: 11, color: '#555' },
  roomBottom: { flexDirection: 'row', alignItems: 'center' },
  lastMessage: { flex: 1, fontSize: 13, color: '#777' },
  unreadBadge: {
    backgroundColor: '#7c6fff', borderRadius: 10,
    minWidth: 20, height: 20,
    paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center',
  },
  unreadText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  requestBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    backgroundColor: '#7c6fff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  acceptBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  declineBtn: {
    backgroundColor: '#1a1a2e', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#2a2a40',
  },
  declineBtnText: { fontSize: 12, color: '#888', fontWeight: '700' },
  chatFriendBtn: {
    backgroundColor: '#1a1a2e', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#7c6fff44',
  },
  chatFriendBtnText: { fontSize: 12, color: '#7c6fff', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#13131a', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#eee' },
  modalClose: { fontSize: 18, color: '#666' },
  modalSearchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0d0d16', borderRadius: 14,
    borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  modalSearchInput: { flex: 1, color: '#eee', fontSize: 14 },
  searchResultItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  noResult: { textAlign: 'center', color: '#555', paddingVertical: 24, fontSize: 13 },
});
