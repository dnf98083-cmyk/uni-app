import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Tab = 'login' | 'signup';

export default function LoginScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // 로그인 폼 상태
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 회원가입 폼 상태
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      setLoginError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    try {
      setLoading(true);
      setLoginError('');
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      router.replace('/(tabs)');
    } catch {
      setLoginError('아이디 또는 비밀번호가 틀렸습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = () => {
    router.push('/onboarding/register');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 로고 영역 */}
        <View style={styles.logoArea}>
          <View style={styles.logoGlow} />
          <Text style={styles.logo}>Uni ✦</Text>
          <Text style={styles.logoSub}>대학생을 위한 AI 동반자</Text>
        </View>

        {/* 카드 */}
        <View style={styles.card}>
          {/* 탭 전환 */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'login' && styles.tabActive]}
              onPress={() => setActiveTab('login')}
            >
              <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>
                로그인
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'signup' && styles.tabActive]}
              onPress={() => router.push('/onboarding/register')}
            >
              <Text style={[styles.tabText, activeTab === 'signup' && styles.tabTextActive]}>
                회원가입
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'login' ? (
            /* 로그인 폼 */
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>이메일</Text>
                <TextInput
                  style={styles.input}
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                  placeholder="university@email.com"
                  placeholderTextColor="#44445a"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호</Text>
                <TextInput
                  style={styles.input}
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder="비밀번호를 입력하세요"
                  placeholderTextColor="#44445a"
                  secureTextEntry
                />
              </View>

              {loginError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>⚠️ {loginError}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>로그인</Text>
                }
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>또는</Text>
                <View style={styles.divider} />
              </View>

              <TouchableOpacity style={styles.socialBtn}>
                <Text style={styles.socialBtnText}>🎓  학교 계정으로 로그인</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* 회원가입 폼 */
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>이름</Text>
                <TextInput
                  style={styles.input}
                  value={signupName}
                  onChangeText={setSignupName}
                  placeholder="홍길동"
                  placeholderTextColor="#44445a"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>이메일</Text>
                <TextInput
                  style={styles.input}
                  value={signupEmail}
                  onChangeText={setSignupEmail}
                  placeholder="university@email.com"
                  placeholderTextColor="#44445a"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호</Text>
                <TextInput
                  style={styles.input}
                  value={signupPassword}
                  onChangeText={setSignupPassword}
                  placeholder="8자 이상 입력하세요"
                  placeholderTextColor="#44445a"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호 확인</Text>
                <TextInput
                  style={styles.input}
                  value={signupPasswordConfirm}
                  onChangeText={setSignupPasswordConfirm}
                  placeholder="비밀번호를 다시 입력하세요"
                  placeholderTextColor="#44445a"
                  secureTextEntry
                />
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleSignup}>
                <Text style={styles.primaryBtnText}>가입하기</Text>
              </TouchableOpacity>

              <Text style={styles.termsText}>
                가입하면{' '}
                <Text style={styles.termsLink}>이용약관</Text>
                {' '}및{' '}
                <Text style={styles.termsLink}>개인정보처리방침</Text>
                에 동의하는 것으로 간주됩니다.
              </Text>
            </View>
          )}
        </View>

        {/* 하단 장식 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>✦ Uni · 대학 생활의 모든 것</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070d',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 40,
  },

  /* 로고 */
  logoArea: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#7c6fff',
    opacity: 0.08,
    top: -20,
  },
  logo: {
    fontSize: 38,
    fontWeight: '900',
    color: '#a78bfa',
    letterSpacing: 1,
  },
  logoSub: {
    fontSize: 13,
    color: '#555',
    marginTop: 6,
    letterSpacing: 0.5,
  },

  /* 카드 */
  card: {
    backgroundColor: '#13131a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a40',
    overflow: 'hidden',
  },

  /* 탭 */
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a40',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#7c6fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#44445a',
  },
  tabTextActive: {
    color: '#a78bfa',
  },

  /* 에러 박스 */
  errorBox: {
    backgroundColor: 'rgba(255, 80, 80, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff5050',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorBoxText: {
    fontSize: 13,
    color: '#ff6b6b',
    fontWeight: '600',
  },

  /* 폼 */
  form: {
    padding: 24,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0d0d16',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a40',
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    color: '#eee',
  },

  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    fontSize: 12,
    color: '#7c6fff',
  },

  /* 주요 버튼 */
  primaryBtn: {
    backgroundColor: '#7c6fff',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#7c6fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  /* 구분선 */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a2a40',
  },
  dividerText: {
    fontSize: 12,
    color: '#44445a',
  },

  /* 소셜 로그인 */
  socialBtn: {
    backgroundColor: '#0d0d16',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a40',
    paddingVertical: 14,
    alignItems: 'center',
  },
  socialBtnText: {
    fontSize: 14,
    color: '#bbb',
    fontWeight: '600',
  },

  /* 약관 */
  termsText: {
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  termsLink: {
    color: '#7c6fff',
  },

  /* 푸터 */
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 11,
    color: '#333',
    letterSpacing: 0.5,
  },
});
