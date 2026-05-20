import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type Profile = {
  id: string;
  nickname: string;
  email: string;
  school: string;
  is_admin: boolean;
  created_at: string;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, nickname, email, school, is_admin, created_at')
      .order('created_at', { ascending: false });
    setUsers(data ?? []);
    setLoading(false);
  };

  const toggleAdmin = async (user: Profile) => {
    const action = user.is_admin ? '관리자 권한 해제' : '관리자 권한 부여';
    Alert.alert(
      action,
      `${user.nickname || user.email}의 ${action}하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .update({ is_admin: !user.is_admin })
              .eq('id', user.id);
            if (!error) loadUsers();
          },
        },
      ]
    );
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>사용자 관리</Text>
        <Text style={styles.count}>{users.length}명</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#7c6fff" />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(user.nickname || user.email || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.nickname}>{user.nickname || '(닉네임 없음)'}</Text>
                    {user.is_admin && (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>ADMIN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.email}>{user.email}</Text>
                  <Text style={styles.school}>{user.school || '학교 미설정'} · {formatDate(user.created_at)}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.adminToggleBtn, user.is_admin && styles.adminToggleBtnActive]}
                onPress={() => toggleAdmin(user)}
              >
                <Text style={[styles.adminToggleText, user.is_admin && styles.adminToggleTextActive]}>
                  {user.is_admin ? '관리자 해제' : '관리자 지정'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070d' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 55, paddingBottom: 16,
  },
  backBtn: { paddingRight: 8 },
  backText: { color: '#7c6fff', fontSize: 14 },
  title: { flex: 1, fontSize: 20, fontWeight: '900', color: '#eee' },
  count: { fontSize: 14, color: '#666' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  content: { flex: 1, paddingHorizontal: 16 },
  userCard: {
    backgroundColor: '#13131a', borderRadius: 16,
    borderWidth: 1, borderColor: '#1e1e30',
    padding: 14, marginBottom: 10,
  },
  userTop: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#7c6fff33', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#7c6fff' },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  nickname: { fontSize: 15, fontWeight: '700', color: '#eee' },
  adminBadge: {
    backgroundColor: '#7c6fff22', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#7c6fff',
  },
  adminBadgeText: { fontSize: 9, color: '#7c6fff', fontWeight: '900' },
  email: { fontSize: 12, color: '#888', marginBottom: 2 },
  school: { fontSize: 11, color: '#555' },

  adminToggleBtn: {
    borderRadius: 10, paddingVertical: 8, alignItems: 'center',
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a40',
  },
  adminToggleBtnActive: { backgroundColor: '#7c6fff22', borderColor: '#7c6fff' },
  adminToggleText: { fontSize: 13, color: '#888', fontWeight: '600' },
  adminToggleTextActive: { color: '#7c6fff' },
});
