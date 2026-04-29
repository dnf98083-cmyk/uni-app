import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [schoolEmoji, setSchoolEmoji] = useState('🏫');
  const [loading, setLoading] = useState(true);
  const [logoutMsg, setLogoutMsg] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);

  // 프로필 편집 후 돌아왔을 때 최신 정보 반영
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      const loadProfile = async () => {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          setEmail(data.user.email ?? '');
          const { data: profile } = await supabase
            .from('profiles')
            .select('nickname, school_name, school_emoji')
            .eq('id', data.user.id)
            .single();
          const meta = data.user.user_metadata ?? {};
          setNickname(profile?.nickname ?? meta.nickname ?? '학생');
          setSchoolName(profile?.school_name ?? meta.school_name ?? '');
          setSchoolEmoji(profile?.school_emoji ?? meta.school_emoji ?? '🏫');
        }
        setLoading(false);
      };
      loadProfile();
    }, [])
  );

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await supabase.auth.signOut();
      setLogoutMsg('로그아웃 됐어요. 잠시 후 이동합니다...');
      setTimeout(() => router.replace('/onboarding/register'), 1500);
    } catch {
      setLogoutMsg('로그아웃 중 오류가 발생했어요');
      setLogoutLoading(false);
    }
  };

  const initials = nickname ? nickname[0].toUpperCase() : '?';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>내 프로필</Text>

      {/* 아바타 + 이름 */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={[styles.nickname, { color: colors.text }]}>{loading ? '...' : nickname}</Text>
        {schoolName ? (
          <Text style={[styles.school, { color: colors.subText }]}>{schoolEmoji} {schoolName}</Text>
        ) : (
          <Text style={[styles.school, { color: colors.subText }]}>🏫 학교 미설정</Text>
        )}
      </View>

      {/* 계정 정보 */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.cardTitle }]}>계정 정보</Text>
        <InfoRow label="닉네임" value={loading ? '...' : nickname} colors={colors} />
        <InfoRow label="이메일" value={loading ? '...' : email} colors={colors} />
        <InfoRow label="학교" value={loading ? '...' : (schoolName || '미설정')} colors={colors} />
      </View>

      {/* 설정 */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.cardTitle }]}>설정</Text>
        <TouchableOpacity
          style={[styles.actionRow, { borderTopColor: colors.border }]}
          onPress={() => router.push('/edit-profile')}>
          <Text style={[styles.actionLabel, { color: colors.text }]}>프로필 편집</Text>
          <Text style={[styles.actionArrow, { color: colors.subText }]}>닉네임 · 학교 변경 ›</Text>
        </TouchableOpacity>
      </View>

      {/* 앱 정보 */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.cardTitle }]}>앱 정보</Text>
        <InfoRow label="버전" value="1.0.0" colors={colors} />
        <InfoRow label="서비스" value="대학교 AI 커뮤니티" colors={colors} />
      </View>

      {/* 로그아웃 */}
      {logoutMsg ? (
        <Text style={styles.logoutMsg}>{logoutMsg}</Text>
      ) : (
        <TouchableOpacity
          style={[styles.logoutBtn, logoutLoading && { opacity: 0.5 }]}
          onPress={handleLogout}
          disabled={logoutLoading}>
          <Text style={styles.logoutText}>{logoutLoading ? '로그아웃 중...' : '로그아웃'}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[styles.row, { borderTopColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.rowLabel }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.rowValue }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  pageTitle: {
    fontSize: 22, fontWeight: '900',
    paddingTop: 10, paddingBottom: 24,
  },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#7c6fff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#7c6fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  avatarText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  nickname: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  school: { fontSize: 13 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 11, fontWeight: '700',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderTopWidth: 1,
  },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  actionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1,
  },
  actionLabel: { fontSize: 14, fontWeight: '600' },
  actionSub: { fontSize: 11, marginTop: 2 },
  actionArrow: { fontSize: 12 },
  logoutBtn: {
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ff4d6d33',
    marginTop: 8,
  },
  logoutText: { color: '#ff4d6d', fontSize: 15, fontWeight: '700' },
  logoutMsg: {
    textAlign: 'center', color: '#3eeea0',
    fontSize: 15, fontWeight: '700', marginTop: 8,
  },
});
