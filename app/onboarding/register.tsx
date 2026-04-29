import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';

export default function RegisterScreen() {
  const [mode, setMode] = useState<'select' | 'register' | 'login' | 'forgot' | 'otp'>('select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const clearMessages = () => { setErrorMsg(''); setSuccessMsg(''); };

  const handleRegister = async () => {
    clearMessages();
    if (!email || !password || !nickname) {
      setErrorMsg('모든 항목을 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { nickname } },
      });
      if (error) {
        setErrorMsg(
          error.message.includes('already registered') ? '이미 가입된 이메일이에요. 로그인해주세요'
          : error.message.includes('Password should be at least') ? '비밀번호는 6자 이상이어야 해요'
          : error.message.includes('Invalid email') ? '올바른 이메일 형식으로 입력해주세요'
          : error.message || '회원가입 중 오류가 발생했어요'
        );
      } else if (data?.user?.identities?.length === 0) {
        setErrorMsg('이미 가입된 이메일이에요. 로그인해주세요');
      } else {
        setSuccessMsg(`${nickname}님, 환영해요! 🎉`);
        setTimeout(() => router.replace('/onboarding/school'), 1500);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || '네트워크 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    clearMessages();
    if (!email || !password) {
      setErrorMsg('이메일과 비밀번호를 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMsg(
          error.message.includes('Invalid login credentials') ? '이메일 또는 비밀번호가 틀렸어요'
          : error.message.includes('Email not confirmed') ? '이메일 인증이 필요해요. 메일함을 확인해주세요'
          : error.message || '로그인 중 오류가 발생했어요'
        );
      } else {
        const name = data.user?.user_metadata?.nickname ?? '';
        setSuccessMsg(name ? `${name}님, 돌아오셨군요! 👋` : '환영해요! 👋');
        setTimeout(() => router.replace('/(tabs)'), 800);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || '네트워크 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    clearMessages();
    if (!email) { setErrorMsg('이메일을 입력해주세요'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) {
        setErrorMsg(error.message || '인증코드 발송에 실패했어요');
      } else {
        setOtpCode('');
        setMode('otp');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || '네트워크 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    clearMessages();
    if (otpCode.length !== 6) { setErrorMsg('6자리 코드를 입력해주세요'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email, token: otpCode, type: 'email',
      });
      if (error) {
        setErrorMsg('코드가 틀렸거나 만료됐어요. 다시 시도해주세요');
      } else {
        router.replace('/reset-password');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || '네트워크 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  };

  // 비밀번호 찾기 - 이메일
  if (mode === 'forgot') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.back} onPress={() => { setMode('login'); clearMessages(); }}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>비밀번호 찾기</Text>
        <Text style={styles.sub}>가입한 이메일로 6자리 인증코드를 보내드려요</Text>
        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={styles.input}
              placeholder="가입한 이메일 입력"
              placeholderTextColor="#555"
              value={email}
              onChangeText={v => { setEmail(v); clearMessages(); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        <TouchableOpacity
          style={[styles.registerBtn, loading && { opacity: 0.6 }]}
          onPress={handleForgotPassword}
          disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerText}>인증코드 받기 →</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  // 비밀번호 찾기 - OTP
  if (mode === 'otp') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.back} onPress={() => { setMode('forgot'); clearMessages(); }}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>인증코드 입력</Text>
        <Text style={styles.sub}>{email}{'\n'}으로 보낸 6자리 코드를 입력해주세요</Text>
        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <Text style={styles.label}>인증코드</Text>
            <TextInput
              style={[styles.input, { letterSpacing: 8, fontSize: 26, textAlign: 'center' }]}
              placeholder="000000"
              placeholderTextColor="#333"
              value={otpCode}
              onChangeText={v => { setOtpCode(v.replace(/\D/g, '').slice(0, 6)); clearMessages(); }}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
        </View>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        <TouchableOpacity
          style={[styles.registerBtn, loading && { opacity: 0.6 }]}
          onPress={handleVerifyOtp}
          disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerText}>확인 →</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
          <Text style={styles.forgotText}>코드 재발송</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  // 첫 화면
  if (mode === 'select') {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.logo}>Uni ✦</Text>
          <Text style={styles.title}>시작해볼까요?</Text>
          <Text style={styles.sub}>신구대학교 학생 전용 커뮤니티</Text>
        </View>
        <View style={styles.btnGroup}>
          <TouchableOpacity style={styles.registerBtn} onPress={() => { setMode('register'); clearMessages(); }}>
            <Text style={styles.registerText}>회원가입하기 →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.loginBtn} onPress={() => { setMode('login'); clearMessages(); }}>
            <Text style={styles.loginText}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 회원가입 / 로그인 폼
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity style={styles.back} onPress={() => { setMode('select'); clearMessages(); }}>
        <Text style={styles.backText}>← 뒤로</Text>
      </TouchableOpacity>
      <Text style={styles.title}>
        {mode === 'register' ? '계정을 만들어요' : '다시 만나서 반가워요'}
      </Text>
      <Text style={styles.sub}>
        {mode === 'register' ? '이메일로 가입해주세요' : '이메일로 로그인해주세요'}
      </Text>
      <View style={styles.form}>
        {mode === 'register' && (
          <View style={styles.inputWrap}>
            <Text style={styles.label}>닉네임</Text>
            <TextInput
              style={styles.input}
              placeholder="사용할 닉네임 입력"
              placeholderTextColor="#555"
              value={nickname}
              onChangeText={v => { setNickname(v); clearMessages(); }}
            />
          </View>
        )}
        <View style={styles.inputWrap}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={styles.input}
            placeholder="이메일 주소 입력"
            placeholderTextColor="#555"
            value={email}
            onChangeText={v => { setEmail(v); clearMessages(); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <View style={styles.inputWrap}>
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            placeholder="비밀번호 입력 (6자 이상)"
            placeholderTextColor="#555"
            value={password}
            onChangeText={v => { setPassword(v); clearMessages(); }}
            secureTextEntry
          />
        </View>
      </View>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
      {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

      <TouchableOpacity
        style={[styles.registerBtn, loading && { opacity: 0.6 }]}
        onPress={mode === 'register' ? handleRegister : handleLogin}
        disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.registerText}>{mode === 'register' ? '가입하기 →' : '로그인 →'}</Text>
        }
      </TouchableOpacity>
      {mode === 'login' && (
        <TouchableOpacity style={styles.forgotBtn} onPress={() => { setMode('forgot'); clearMessages(); }}>
          <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#07070d',
    paddingHorizontal: 24, paddingTop: 60,
    justifyContent: 'center',
  },
  center: { alignItems: 'center', marginBottom: 60 },
  logo: { fontSize: 32, fontWeight: '900', color: '#7c6fff', marginBottom: 16 },
  back: { position: 'absolute', top: 60, left: 24 },
  backText: { color: '#888', fontSize: 14 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, color: '#888', marginBottom: 40, textAlign: 'center' },
  form: { gap: 16, marginBottom: 16 },
  inputWrap: { gap: 8 },
  label: { fontSize: 13, color: '#888', fontWeight: '600' },
  input: {
    backgroundColor: '#13131a', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a40',
  },
  btnGroup: { gap: 12 },
  registerBtn: {
    backgroundColor: '#7c6fff', borderRadius: 28,
    height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  registerText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  loginBtn: {
    backgroundColor: '#13131a', borderRadius: 28,
    height: 56, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2a2a40',
  },
  loginText: { color: '#aaa', fontSize: 16, fontWeight: '700' },
  forgotBtn: { alignItems: 'center', marginTop: 16 },
  forgotText: { color: '#7c6fff', fontSize: 13 },
  errorText: { fontSize: 13, color: '#ff6b6b', textAlign: 'center', marginBottom: 8 },
  successText: { fontSize: 15, color: '#3eeea0', textAlign: 'center', fontWeight: '700', marginBottom: 8 },
});
