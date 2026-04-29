import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export default function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 1000, useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1, tension: 50, friction: 7, useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      router.replace('/onboarding/register');
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.glow} />
      <Animated.View style={[styles.center, { opacity, transform: [{ scale }] }]}>
        <View style={styles.orb}>
          <Text style={styles.orbSymbol}>✦</Text>
        </View>
        <Text style={styles.logo}>Uni</Text>
        <Text style={styles.logoStar}>✦</Text>
        <Text style={styles.tagline}>대학교 AI 커뮤니티</Text>
      </Animated.View>
      <Text style={styles.bottom}>powered by Claude AI</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#07070d',
    alignItems: 'center', justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(124,111,255,0.12)',
    top: '30%',
  },
  center: { alignItems: 'center' },
  orb: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#7c6fff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#7c6fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 30, elevation: 20,
  },
  orbSymbol: { fontSize: 36, color: '#fff' },
  logo: { fontSize: 52, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  logoStar: { fontSize: 20, color: '#7c6fff', marginTop: -8, marginBottom: 12 },
  tagline: { fontSize: 16, color: '#888', letterSpacing: 1 },
  bottom: { position: 'absolute', bottom: 40, fontSize: 12, color: '#333' },
});