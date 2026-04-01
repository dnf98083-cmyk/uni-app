import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ClaudeKeyScreen() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const isValidKey = apiKey.startsWith('sk-ant-') && apiKey.length > 20;

  const handleSave = () => {
    if (!isValidKey) return;
    // TODO: AsyncStorage 또는 SecureStore에 저장
    setSaved(true);
  };

  const handleComplete = () => {
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 뒤로가기 */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>

        {/* 단계 표시 */}
        <View style={styles.stepRow}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={[styles.stepDot, styles.stepDotActive]} />
          ))}
        </View>

        {/* 아이콘 */}
        <View style={styles.iconWrap}>
          <View style={styles.iconOrb}>
            <Text style={styles.iconText}>✦</Text>
          </View>
        </View>

        <Text style={styles.title}>Claude AI 연결하기</Text>
        <Text style={styles.sub}>
          Anthropic의 Claude API를 연결하면{'\n'}
          AI 채팅, 시간표 분석, 맛집 추천 등 모든 AI 기능을 사용할 수 있어요
        </Text>

        {/* 안내 카드 */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🔑 API Key 발급 방법</Text>
          <View style={styles.infoSteps}>
            {[
              'Anthropic Console 접속',
              '로그인 또는 회원가입',
              'API Keys 메뉴 → Create Key',
              '생성된 키를 아래에 붙여넣기',
            ].map((step, i) => (
              <View key={i} style={styles.infoStep}>
                <View style={styles.infoStepNum}>
                  <Text style={styles.infoStepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.infoStepText}>{step}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={styles.consoleBtn}
            onPress={() => Linking.openURL('https://console.anthropic.com')}
          >
            <Text style={styles.consoleBtnText}>🌐 Anthropic Console 열기</Text>
          </TouchableOpacity>
        </View>

        {/* API Key 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Claude API Key</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="sk-ant-api03-..."
              placeholderTextColor="#44445a"
              value={apiKey}
              onChangeText={(v) => { setApiKey(v); setSaved(false); }}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowKey(!showKey)}>
              <Text style={styles.eyeText}>{showKey ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {apiKey.length > 0 && !isValidKey && (
            <Text style={styles.errorText}>
              올바른 API Key 형식이 아니에요 (sk-ant-로 시작해야 해요)
            </Text>
          )}
          {isValidKey && !saved && (
            <Text style={styles.validText}>✓ 올바른 형식이에요</Text>
          )}
        </View>

        {/* 보안 안내 */}
        <View style={styles.securityCard}>
          <Text style={styles.securityTitle}>🔒 보안 안내</Text>
          <Text style={styles.securityText}>
            API Key는 기기 내에만 안전하게 저장되며, 외부 서버로 전송되지 않아요.
            언제든지 설정에서 변경하거나 삭제할 수 있어요.
          </Text>
        </View>

        {/* 버튼 */}
        {!saved ? (
          <TouchableOpacity
            style={[styles.saveBtn, !isValidKey && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isValidKey}
          >
            <Text style={styles.saveBtnText}>API Key 저장하기</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View style={styles.savedBadge}>
              <Text style={styles.savedText}>✦ Claude AI 연결 완료!</Text>
            </View>
            <TouchableOpacity style={styles.startBtn} onPress={handleComplete}>
              <Text style={styles.startBtnText}>Uni 시작하기 🚀</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleComplete}
        >
          <Text style={styles.skipBtnText}>
            {saved ? '' : '나중에 연결하기 (일부 기능 제한)'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070d' },
  content: { paddingHorizontal: 24, paddingTop: 55, paddingBottom: 40 },

  backBtn: { marginBottom: 20 },
  backText: { color: '#555', fontSize: 14 },

  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#2a2a40' },
  stepDotActive: { backgroundColor: '#7c6fff' },

  iconWrap: { alignItems: 'center', marginBottom: 20 },
  iconOrb: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#7c6fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7c6fff', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 20, elevation: 15,
  },
  iconText: { fontSize: 30, color: '#fff' },

  title: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, color: '#888', lineHeight: 22, marginBottom: 24, textAlign: 'center' },

  infoCard: {
    backgroundColor: '#13131a', borderRadius: 16,
    borderWidth: 1, borderColor: '#2a2a40',
    padding: 18, marginBottom: 20,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#eee', marginBottom: 14 },
  infoSteps: { gap: 10, marginBottom: 14 },
  infoStep: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoStepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#7c6fff',
    alignItems: 'center', justifyContent: 'center',
  },
  infoStepNumText: { fontSize: 11, color: '#fff', fontWeight: '900' },
  infoStepText: { fontSize: 13, color: '#ccc' },
  consoleBtn: {
    backgroundColor: '#1a1a2e', borderRadius: 10,
    borderWidth: 1, borderColor: '#2a2a40',
    paddingVertical: 10, alignItems: 'center',
  },
  consoleBtnText: { fontSize: 13, color: '#a78bfa', fontWeight: '600' },

  inputSection: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#13131a', borderRadius: 14,
    borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 16,
  },
  input: { flex: 1, color: '#eee', fontSize: 13, paddingVertical: 14 },
  eyeBtn: { padding: 4 },
  eyeText: { fontSize: 18 },
  errorText: { fontSize: 11, color: '#ff6b6b', marginTop: 6 },
  validText: { fontSize: 11, color: '#3eeea0', marginTop: 6 },

  securityCard: {
    backgroundColor: 'rgba(62,238,160,0.05)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(62,238,160,0.15)',
    padding: 14, marginBottom: 24,
  },
  securityTitle: { fontSize: 12, fontWeight: '700', color: '#3eeea0', marginBottom: 6 },
  securityText: { fontSize: 12, color: '#666', lineHeight: 18 },

  saveBtn: {
    backgroundColor: '#7c6fff', borderRadius: 16,
    height: 54, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7c6fff', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    marginBottom: 12,
  },
  saveBtnDisabled: { backgroundColor: '#2a2a40', shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  savedBadge: {
    backgroundColor: 'rgba(62,238,160,0.1)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(62,238,160,0.3)',
    paddingVertical: 12, alignItems: 'center', marginBottom: 12,
  },
  savedText: { fontSize: 15, fontWeight: '800', color: '#3eeea0' },

  startBtn: {
    backgroundColor: '#7c6fff', borderRadius: 16,
    height: 54, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7c6fff', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    marginBottom: 12,
  },
  startBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipBtnText: { color: '#444', fontSize: 13 },
});
