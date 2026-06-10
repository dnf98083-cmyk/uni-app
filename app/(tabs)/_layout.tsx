import { router, Tabs, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sidebar from '@/components/Sidebar';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

function HomeTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={{
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: focused ? '#7c6fff' : '#2a2a40',
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#7c6fff',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: focused ? 0.8 : 0,
      shadowRadius: 8,
      elevation: focused ? 6 : 0,
    }}>
      <Text style={{ fontSize: 15, color: focused ? '#fff' : '#7c6fff' }}>✦</Text>
    </View>
  );
}

const TAB_PATHS = [
  '/(tabs)/timetable',
  '/(tabs)/community',
  '/(tabs)',
  '/(tabs)/map',
  '/(tabs)/chat',
  '/(tabs)/profile',
] as const;

function getTabIndex(pathname: string) {
  if (pathname.includes('timetable')) return 0;
  if (pathname.includes('community')) return 1;
  if (pathname.includes('map')) return 3;
  if (pathname.includes('chat')) return 4;
  if (pathname.includes('profile')) return 5;
  return 2;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [schoolPopup, setSchoolPopup] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('school')
        .eq('id', user.id)
        .single();
      if (!data?.school) setSchoolPopup(true);
    })();
  }, []);

  const currentIndexRef = useRef(2);
  currentIndexRef.current = getTabIndex(pathname);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 18 && Math.abs(gs.dx) > Math.abs(gs.dy) * 3,
    onPanResponderRelease: (_, gs) => {
      const idx = currentIndexRef.current;
      if (gs.dx < -60 && idx < TAB_PATHS.length - 1) {
        router.navigate(TAB_PATHS[idx + 1] as any);
      } else if (gs.dx > 60 && idx > 0) {
        router.navigate(TAB_PATHS[idx - 1] as any);
      }
    },
  })).current;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} {...panResponder.panHandlers}>
      {/* 고정 헤더 바 */}
      <View style={[styles.topBar, {
        paddingTop: insets.top,
        backgroundColor: colors.tabBar,
        borderBottomColor: colors.tabBorder,
      }]}>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setSidebarOpen(true)}
          activeOpacity={0.7}>
          <Text style={[styles.menuIcon, { color: colors.text }]}>☰</Text>
        </TouchableOpacity>
      </View>

      <Tabs screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBorder,
          borderTopWidth: 1,
          height: 65 + insets.bottom,
          paddingBottom: 10 + insets.bottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#7c6fff',
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}>
        <Tabs.Screen name="timetable" options={{
          title: '시간표',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }} />
        <Tabs.Screen name="community" options={{
          title: '커뮤니티',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
        }} />
        <Tabs.Screen name="index" options={{
          title: 'AI홈',
          tabBarIcon: ({ focused }) => <HomeTabIcon focused={focused} />,
        }} />
        <Tabs.Screen name="map" options={{
          title: '맛집',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" focused={focused} />,
        }} />
        <Tabs.Screen name="chat" options={{
          title: '채팅',
          tabBarIcon: ({ focused }) => <TabIcon emoji="✉️" focused={focused} />,
        }} />
        <Tabs.Screen name="profile" options={{
          title: '프로필',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }} />
        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>

      <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {schoolPopup && (
        <View style={styles.popupOverlay}>
          <View style={styles.popup}>
            <Text style={styles.popupEmoji}>🏫</Text>
            <Text style={styles.popupTitle}>학교를 등록해주세요</Text>
            <Text style={styles.popupDesc}>학교 정보를 등록하면{'\n'}커뮤니티 맞춤 서비스를 이용할 수 있어요</Text>
            <TouchableOpacity
              style={styles.popupBtn}
              onPress={() => { setSchoolPopup(false); router.push('/onboarding/school' as any); }}>
              <Text style={styles.popupBtnText}>학교 등록하기</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSchoolPopup(false)}>
              <Text style={styles.popupSkip}>나중에 할게요</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 10,
  },
  menuIcon: { fontSize: 20, fontWeight: '600' },

  popupOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 999,
  },
  popup: {
    backgroundColor: '#13131a', borderRadius: 24,
    borderWidth: 1, borderColor: '#2a2a40',
    padding: 28, marginHorizontal: 32,
    alignItems: 'center', gap: 8,
  },
  popupEmoji: { fontSize: 48, marginBottom: 4 },
  popupTitle: { fontSize: 20, fontWeight: '900', color: '#eee', textAlign: 'center' },
  popupDesc: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  popupBtn: {
    backgroundColor: '#7c6fff', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
    width: '100%', alignItems: 'center',
    marginTop: 4,
  },
  popupBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  popupSkip: { color: '#555', fontSize: 13, marginTop: 8 },
});
