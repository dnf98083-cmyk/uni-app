import { router } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/lib/ThemeContext';

export default function SettingsScreen() {
  const { mode, colors, setMode } = useTheme();

  const s = makeStyles(colors, mode);

  return (
    <ScrollView style={[s.container]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>설정</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>테마</Text>

        <TouchableOpacity
          style={[s.themeOption, mode === 'dark' && s.themeOptionActive]}
          onPress={() => setMode('dark')}
          activeOpacity={0.7}>
          <View style={s.themeRow}>
            <View style={[s.themePreview, { backgroundColor: '#07070d', borderColor: '#2a2a40' }]}>
              <Text style={{ fontSize: 18 }}>🌙</Text>
            </View>
            <View style={s.themeInfo}>
              <Text style={[s.themeLabel, { color: colors.text }]}>다크 모드</Text>
              <Text style={[s.themeSub, { color: colors.subText }]}>어두운 배경</Text>
            </View>
            {mode === 'dark' && (
              <View style={s.checkCircle}>
                <Text style={s.checkText}>✓</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.themeOption, mode === 'light' && s.themeOptionActive]}
          onPress={() => setMode('light')}
          activeOpacity={0.7}>
          <View style={s.themeRow}>
            <View style={[s.themePreview, { backgroundColor: '#f4f4fb', borderColor: '#e0e0f0' }]}>
              <Text style={{ fontSize: 18 }}>☀️</Text>
            </View>
            <View style={s.themeInfo}>
              <Text style={[s.themeLabel, { color: colors.text }]}>라이트 모드</Text>
              <Text style={[s.themeSub, { color: colors.subText }]}>밝은 배경</Text>
            </View>
            {mode === 'light' && (
              <View style={s.checkCircle}>
                <Text style={s.checkText}>✓</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>앱 정보</Text>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>버전</Text>
          <Text style={[s.infoValue, { color: colors.rowValue }]}>1.0.0</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>서비스</Text>
          <Text style={[s.infoValue, { color: colors.rowValue }]}>신구대학교 전용</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], mode: string) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
    header: { paddingTop: 55, paddingBottom: 24 },
    backBtn: { marginBottom: 12 },
    backText: { color: colors.subText, fontSize: 14 },
    pageTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      overflow: 'hidden',
    },
    cardTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.cardTitle,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 8,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    themeOption: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    themeOptionActive: {
      backgroundColor: mode === 'dark' ? '#1a1a2e' : '#ededff',
    },
    themeRow: { flexDirection: 'row', alignItems: 'center' },
    themePreview: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    themeInfo: { flex: 1 },
    themeLabel: { fontSize: 15, fontWeight: '700' },
    themeSub: { fontSize: 12, marginTop: 2 },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#7c6fff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkText: { color: '#fff', fontSize: 13, fontWeight: '900' },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    infoLabel: { fontSize: 14, color: colors.rowLabel },
    infoValue: { fontSize: 14, fontWeight: '600' },
  });
}
