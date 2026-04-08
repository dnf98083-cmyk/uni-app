import { router } from 'expo-router';
import { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

const slides = [
  {
    emoji: '🤖',
    title: 'AI가 대신 찾아줘요',
    desc: '교수님 평가, 맛집, 여행 계획\n자연어로 물어보면 AI가 바로 답변해요',
    color: '#7c6fff',
  },
  {
    emoji: '🗺️',
    title: '학생 맛집 지도',
    desc: '커뮤니티 게시글에서 AI가 자동으로\n맛집 정보를 수집해서 지도에 추가해요',
    color: '#3eeea0',
  },
  {
    emoji: '💬',
    title: '우리 학교 커뮤니티',
    desc: '익명 게시판, 강의평가, 중고거래\n우리 학교 학생들끼리만 소통해요',
    color: '#ff6b8a',
  },
];

export default function OnboardingScreen() {
  const [current, setCurrent] = useState(0);

  const next = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      router.replace('/onboarding/profile');
    }
  };

  const slide = slides[current];

  return (
    <View style={styles.container}>
      {/* 건너뛰기 */}
      <TouchableOpacity style={styles.skip}
        onPress={() => router.replace('/onboarding/profile')}>
        <Text style={styles.skipText}>건너뛰기</Text>
      </TouchableOpacity>

      {/* 슬라이드 내용 */}
      <View style={styles.content}>
        <View style={[styles.emojiWrap, { shadowColor: slide.color }]}>
          <Text style={styles.emoji}>{slide.emoji}</Text>
        </View>
        <Text style={[styles.title, { color: slide.color }]}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>
      </View>

      {/* 점 인디케이터 */}
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[
            styles.dot,
            { backgroundColor: i === current ? slide.color : '#333',
              width: i === current ? 24 : 8 }
          ]} />
        ))}
      </View>

      {/* 다음 버튼 */}
      <TouchableOpacity
        style={[styles.nextBtn, { backgroundColor: slide.color }]}
        onPress={next}>
        <Text style={styles.nextText}>
          {current === slides.length - 1 ? '시작하기 🚀' : '다음 →'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#07070d',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 30,
  },
  skip: { position: 'absolute', top: 55, right: 24 },
  skipText: { color: '#555', fontSize: 14 },
  content: { alignItems: 'center', marginBottom: 50 },
  emojiWrap: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#13131a',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 36,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 30, elevation: 15,
  },
  emoji: { fontSize: 52 },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 16, textAlign: 'center' },
  desc: { fontSize: 16, color: '#888', textAlign: 'center', lineHeight: 26 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 40 },
  dot: { height: 8, borderRadius: 4 },
  nextBtn: {
    width: width - 60, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});