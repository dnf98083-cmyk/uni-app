import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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

export default function ChatListScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReceived, setPendingReceived] = useState<Friend[]>([]);
  const [pendingSent, setPendingSent] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [myNickname, setMyNickname] = useState('');

  const [searchModal, setSearchModal] = useState(false);
  const [friendModal, setFriendModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendStatuses, setFriendStatuses] = useState<Record<string, 'none' | 'pending_sent' | 'accepted'>>({});

  const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const friendChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myIdRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);
      myIdRef.current = user.id;
      const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', user.id).single();
      setMyNickname(profile?.nickname ?? user.user_metadata?.nickname ?? '나');
      await Promise.all([loadRooms(user.id), loadFriends(user.id)]);
      subscribeToRooms(user.id);
      subscribeToFriends(user.id);
    })();
    return () => {
      roomChannelRef.current?.unsubscribe();
      friendChannelRef.current?.unsubscribe();
    };
  }, []);

  // 탭 포커스 시 데이터 새로고침 (앱 전환 후 돌아왔을 때 대비)
  useFocusEffect(useCallback(() => {
    const uid = myIdRef.current;
    if (!uid) return;
    loadRooms(uid);
    loadFriends(uid);
  }, []));

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
    const { data, error } = await supabase
      .from('friends')
      .select('id, requester_id, addressee_id, status')
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);

    if (error || !data) return;

    // 파트너 ID 목록으로 프로필 별도 조회 (FK join명 의존 방지)
    const partnerIds = data.map(row =>
      row.requester_id === uid ? row.addressee_id : row.requester_id
    );
    const { data: profileRows } = partnerIds.length
      ? await supabase.from('profiles').select('id, nickname, school').in('id', partnerIds)
      : { data: [] };
    const profileMap: Record<string, { nickname: string; school: string }> =
      Object.fromEntries((profileRows ?? []).map((p: any) => [p.id, p]));

    const accepted: Friend[] = [];
    const received: Friend[] = [];
    const sent: Friend[] = [];

    for (const row of data) {
      const isRequester = row.requester_id === uid;
      const partnerId = isRequester ? row.addressee_id : row.requester_id;
      const partnerProfile = profileMap[partnerId];

      const entry: Friend = {
        id: row.id,
        partner_id: partnerId,
        partner_nickname: partnerProfile?.nickname ?? '알 수 없음',
        partner_school: partnerProfile?.school ?? '',
        status: row.status,
        requester_id: row.requester_id,
      };

      if (row.status === 'accepted') accepted.push(entry);
      else if (row.status === 'pending' && !isRequester) received.push(entry);
      else if (row.status === 'pending' && isRequester) sent.push(entry);
    }

    setFriends(accepted);
    setPendingReceived(received);
    setPendingSent(sent);
  };

  const subscribeToRooms = (uid: string) => {
    roomChannelRef.current = supabase.channel('chat_rooms_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => loadRooms(uid))
      .subscribe();
  };

  const subscribeToFriends = (uid: string) => {
    friendChannelRef.current = supabase.channel('friends_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends',
        filter: `addressee_id=eq.${uid}` }, () => loadFriends(uid))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends',
        filter: `requester_id=eq.${uid}` }, () => loadFriends(uid))
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

  const cancelFriendRequest = async (friend: Friend) => {
    await supabase.from('friends').delete().eq('id', friend.id);
    if (myId) loadFriends(myId);
  };

  const chatWithFriend = async (friend: Friend) => {
    if (!myId) return;
    setFriendModal(false);
    try {
      await startOrOpenChat(myId, myNickname, friend.partner_id, friend.partner_nickname);
    } catch (e: any) {
      alert('채팅 시작 실패: ' + (e?.message ?? '알 수 없는 오류'));
    }
  };

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setFriendStatuses({}); return; }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, nickname, school')
      .ilike('nickname', `%${q.trim()}%`)
      .neq('id', myId ?? '')
      .limit(10);
    const profiles = (data as SearchProfile[]) ?? [];
    setSearchResults(profiles);
    setSearching(false);

    if (profiles.length && myId) {
      const orFilter = profiles.map(p =>
        `and(requester_id.eq.${myId},addressee_id.eq.${p.id}),and(requester_id.eq.${p.id},addressee_id.eq.${myId})`
      ).join(',');
      const { data: frows } = await supabase.from('friends').select('requester_id, addressee_id, status').or(orFilter);
      const statuses: Record<string, 'none' | 'pending_sent' | 'accepted'> = {};
      for (const p of profiles) statuses[p.id] = 'none';
      for (const row of frows ?? []) {
        const pid = row.requester_id === myId ? row.addressee_id : row.requester_id;
        statuses[pid] = row.status === 'accepted' ? 'accepted' : (row.requester_id === myId ? 'pending_sent' : 'none');
      }
      setFriendStatuses(statuses);
    }
  };

  const sendFriendRequest = async (profileId: string) => {
    if (!myId) return;
    const { error } = await supabase
      .from('friends')
      .insert({ requester_id: myId, addressee_id: profileId, status: 'pending' });
    if (error) {
      alert('친구 요청 실패: ' + error.message);
      return;
    }
    setFriendStatuses(prev => ({ ...prev, [profileId]: 'pending_sent' }));
    if (myId) loadFriends(myId);
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

  const totalPending = pendingReceived.length;

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>채팅 ✦</Text>
          <Text style={styles.subtitle}>친구와 1:1 대화</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setSearchModal(true)}>
            <Text style={styles.headerBtnText}>🔍 찾기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setFriendModal(true)}>
            <Text style={styles.headerBtnText}>👥 친구</Text>
            {totalPending > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{totalPending}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 채팅방 목록 */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#7c6fff" /></View>
      ) : rooms.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>채팅이 없어요</Text>
          <Text style={styles.emptySubtitle}>🔍 찾기로 사용자를 검색하거나{'\n'}커뮤니티에서 프로필을 눌러 채팅을 시작하세요</Text>
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
      )}

      {/* 친구 목록 모달 */}
      <Modal visible={friendModal} transparent animationType="slide" onRequestClose={() => setFriendModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>친구 목록</Text>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => myId && loadFriends(myId)}>
                  <Text style={{ fontSize: 16, color: '#7c6fff' }}>↻</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFriendModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 받은 친구 요청 */}
              {pendingReceived.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>받은 요청 {pendingReceived.length}개</Text>
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

              {/* 보낸 친구 요청 */}
              {pendingSent.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>보낸 요청 {pendingSent.length}개</Text>
                  {pendingSent.map(f => (
                    <View key={f.id} style={styles.friendCard}>
                      <View style={styles.friendAvatar}>
                        <Text style={styles.avatarText}>{f.partner_nickname[0]?.toUpperCase()}</Text>
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{f.partner_nickname}</Text>
                        {f.partner_school ? <Text style={styles.friendSchool}>{f.partner_school}</Text> : null}
                      </View>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelFriendRequest(f)}>
                        <Text style={styles.cancelBtnText}>취소</Text>
                      </TouchableOpacity>
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
                    <Text style={styles.emptySubtitle}>🔍 찾기로 사용자를 검색해 친구 추가하세요</Text>
                  </View>
                ) : (
                  friends.map(f => (
                    <View key={f.id} style={styles.friendCard}>
                      <View style={styles.friendAvatar}>
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
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                  <View key={p.id} style={styles.searchResultItem}>
                    <View style={styles.friendAvatar}>
                      <Text style={styles.avatarText}>{p.nickname[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{p.nickname}</Text>
                      {p.school ? <Text style={styles.friendSchool}>{p.school}</Text> : null}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {friendStatuses[p.id] === 'accepted' ? (
                        <View style={[styles.tagBtn, { borderColor: '#3eeea0' }]}>
                          <Text style={[styles.tagBtnText, { color: '#3eeea0' }]}>✓ 친구</Text>
                        </View>
                      ) : friendStatuses[p.id] === 'pending_sent' ? (
                        <View style={[styles.tagBtn, { borderColor: '#666' }]}>
                          <Text style={[styles.tagBtnText, { color: '#888' }]}>요청 중</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.tagBtn} onPress={() => sendFriendRequest(p.id)}>
                          <Text style={styles.tagBtnText}>👤+ 친구</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.tagBtn} onPress={() => startChatFromSearch(p)}>
                        <Text style={styles.tagBtnText}>채팅</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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
  headerBtns: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    backgroundColor: '#13131a', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2a2a40',
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  headerBtnText: { fontSize: 12, color: '#7c6fff', fontWeight: '700' },
  badge: {
    backgroundColor: '#7c6fff', borderRadius: 8,
    minWidth: 16, height: 16,
    paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#eee' },
  emptySubtitle: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20 },
  emptyFriends: { alignItems: 'center', paddingVertical: 32, gap: 10 },

  content: { flex: 1 },
  section: { paddingHorizontal: 4, paddingTop: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#666', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },

  roomCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#13131a',
  },
  friendCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#7c6fff22', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#7c6fff44',
  },
  friendAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#7c6fff22', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#7c6fff44',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#7c6fff' },
  roomInfo: { flex: 1 },
  friendInfo: { flex: 1 },
  roomTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  partnerName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#eee' },
  friendName: { fontSize: 14, fontWeight: '700', color: '#eee', marginBottom: 2 },
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

  requestBtns: { flexDirection: 'row', gap: 6 },
  acceptBtn: {
    backgroundColor: '#7c6fff', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  acceptBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  declineBtn: {
    backgroundColor: '#1a1a2e', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2a2a40',
  },
  declineBtnText: { fontSize: 12, color: '#888', fontWeight: '700' },
  cancelBtn: {
    backgroundColor: '#1a1a2e', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#444',
  },
  cancelBtnText: { fontSize: 12, color: '#888', fontWeight: '700' },
  chatFriendBtn: {
    backgroundColor: '#1a1a2e', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
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
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  noResult: { textAlign: 'center', color: '#555', paddingVertical: 24, fontSize: 13 },
  tagBtn: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#7c6fff44', backgroundColor: '#1a1a2e',
  },
  tagBtnText: { fontSize: 11, color: '#7c6fff', fontWeight: '700' },
});
