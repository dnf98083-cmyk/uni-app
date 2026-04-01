import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';

const PANEL_W = Math.min(Dimensions.get('window').width * 0.72, 290);

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const { colors, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(PANEL_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setNickname(data.user.user_metadata?.nickname ?? '학생');
        setEmail(data.user.email ?? '');
      }
    });
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 200,
          mass: 0.8,
        }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: PANEL_W, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    await supabase.auth.signOut();
    onClose();
    setTimeout(() => router.replace('/onboarding/register'), 280);
  };

  const initials = nickname ? nickname[0].toUpperCase() : '?';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFillObject}>
        {/* 딤 오버레이 */}
        <Animated.View
          style={[StyleSheet.absoluteFillObject, styles.overlay, { opacity: fadeAnim }]}
        />
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />

        {/* 패널 */}
        <Animated.View style={[
          styles.panel,
          {
            backgroundColor: colors.sidebarBg,
            borderLeftColor: colors.border,
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 24,
          },
        ]}>
          {/* 닫기 버튼 */}
          <TouchableOpacity onPress={onClose} style={styles.closeRow}>
            <Text style={[styles.closeIcon, { color: colors.subText }]}>✕</Text>
          </TouchableOpacity>

          {/* 유저 정보 */}
          <View style={[styles.userBlock, { borderBottomColor: colors.border }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={[styles.userName, { color: colors.text }]}>{nickname || '...'}</Text>
            <Text style={[styles.userEmail, { color: colors.subText }]}>{email || '...'}</Text>
            <View style={[styles.schoolBadge, { backgroundColor: colors.accent + '1a' }]}>
              <Text style={[styles.schoolBadgeText, { color: colors.accent }]}>🏫 신구대학교</Text>
            </View>
          </View>

          {/* 테마 선택 */}
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.subText }]}>화면 테마</Text>
            <View style={styles.themeRow}>
              <TouchableOpacity
                style={[
                  styles.themeBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  mode === 'dark' && { backgroundColor: '#7c6fff', borderColor: '#7c6fff' },
                ]}
                onPress={() => setMode('dark')}
                activeOpacity={0.75}>
                <Text style={{ fontSize: 16 }}>🌙</Text>
                <Text style={[styles.themeBtnLabel, { color: mode === 'dark' ? '#fff' : colors.subText }]}>
                  다크
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  mode === 'light' && { backgroundColor: '#7c6fff', borderColor: '#7c6fff' },
                ]}
                onPress={() => setMode('light')}
                activeOpacity={0.75}>
                <Text style={{ fontSize: 16 }}>☀️</Text>
                <Text style={[styles.themeBtnLabel, { color: mode === 'light' ? '#fff' : colors.subText }]}>
                  라이트
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          {/* 버전 */}
          <Text style={[styles.version, { color: colors.subText }]}>Uni v1.0.0 · 신구대학교 전용</Text>

          {/* 로그아웃 */}
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: '#ff4d6d44' }]}
            onPress={handleLogout}
            disabled={logoutLoading}
            activeOpacity={0.75}>
            <Text style={styles.logoutText}>
              {logoutLoading ? '로그아웃 중...' : '🚪  로그아웃'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(0,0,0,0.48)' },
  panel: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: PANEL_W,
    paddingHorizontal: 22,
    borderLeftWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 20,
  },
  closeRow: { alignItems: 'flex-end', marginBottom: 18 },
  closeIcon: { fontSize: 17, padding: 4 },
  userBlock: {
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    marginBottom: 18,
  },
  avatar: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#7c6fff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#7c6fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarText: { fontSize: 22, fontWeight: '900', color: '#fff' },
  userName: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
  userEmail: { fontSize: 11, marginBottom: 10 },
  schoolBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  schoolBadgeText: { fontSize: 11, fontWeight: '700' },
  section: { borderBottomWidth: 1, paddingBottom: 16, marginBottom: 16 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700',
    letterSpacing: 1.1, textTransform: 'uppercase',
    marginBottom: 10,
  },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: {
    flex: 1, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', gap: 4,
  },
  themeBtnLabel: { fontSize: 12, fontWeight: '700' },
  version: { fontSize: 11, textAlign: 'center', marginBottom: 12 },
  logoutBtn: {
    borderWidth: 1, borderRadius: 14,
    height: 48, alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { color: '#ff4d6d', fontSize: 14, fontWeight: '700' },
});
