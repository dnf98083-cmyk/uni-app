import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const mismatch = confirm.length > 0 && password !== confirm;
  const matched = confirm.length > 0 && password === confirm && password.length >= 6;

  const handleReset = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!password || !confirm) { setErrorMsg('모든 항목을 입력해주세요'); return; }
    if (password !== confirm) { setErrorMsg('비밀번호가 서로 달라요'); return; }
    if (password.length < 6) { setErrorMsg('비밀번호는 6자 이상이어야 해요'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message || '비밀번호 변경에 실패했어요');
      } else {
        supabase.auth.signOut();
        setSuccessMsg('비밀번호가 변경됐어요! 🎉\n로그인 화면으로 이동합니다...');
        setTimeout(() => router.replace('/onboarding/register'), 2000);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || '알 수 없는 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>새 비밀번호 설정</Text>
      <Text style={styles.sub}>새로 사용할 비밀번호를 입력해주세요</Text>

      <TextInput
        style={styles.input}
        placeholder="새 비밀번호 (6자 이상)"
        placeholderTextColor="#555"
        value={password}
        onChangeText={v => { setPassword(v); setErrorMsg(''); setSuccessMsg(''); }}
        secureTextEntry
      />
      <TextInput
        style={[styles.input, { marginTop: 12 }, mismatch && styles.inputError]}
        placeholder="비밀번호 확인"
        placeholderTextColor="#555"
        value={confirm}
        onChangeText={v => { setConfirm(v); setErrorMsg(''); setSuccessMsg(''); }}
        secureTextEntry
      />

      {mismatch && <Text style={styles.errorText}>비밀번호가 일치하지 않아요</Text>}
      {matched && !errorMsg && !successMsg && <Text style={styles.okText}>비밀번호가 일치해요 ✓</Text>}
      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
      {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, (loading || !!successMsg) && { opacity: 0.6 }]}
        onPress={handleReset}
        disabled={loading || !!successMsg}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>변경하기 →</Text>
        }
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#07070d',
    paddingHorizontal: 24, paddingTop: 80,
  },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 8 },
  sub: { fontSize: 14, color: '#888', marginBottom: 36 },
  input: {
    backgroundColor: '#13131a', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a40',
  },
  inputError: { borderColor: '#ff6b6b' },
  btn: {
    backgroundColor: '#7c6fff', borderRadius: 28,
    height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 28,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  errorText: { fontSize: 13, color: '#ff6b6b', marginTop: 8 },
  okText: { fontSize: 13, color: '#3eeea0', marginTop: 8 },
  successText: { fontSize: 15, color: '#3eeea0', fontWeight: '700', marginTop: 8, lineHeight: 24 },
});
