import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.glowCircle} />

        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>회원가입 완료!</Text>
        <Text style={styles.subtitle}>환영합니다</Text>
        <Text style={styles.desc}>
          이제 Uni와 함께{'\n'}대학 생활을 시작해봐요
        </Text>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.btn} onPress={() => router.push('/onboarding/school')}>
          <Text style={styles.btnText}>시작하기 →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  glowCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#7c6fff',
    opacity: 0.07,
    top: -80,
  },
  emoji: {
    fontSize: 72,
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#a78bfa',
    marginBottom: 20,
  },
  desc: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },
  divider: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#7c6fff',
    marginBottom: 40,
    opacity: 0.5,
  },
  btn: {
    backgroundColor: '#7c6fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
    shadowColor: '#7c6fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
