import * as ImagePicker from 'expo-image-picker';
import { geminiVision } from '@/lib/gemini';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type ParsedClass = {
  name: string;
  day: string;
  time: string;
  room: string;
  color: string;
};

const CLASS_COLORS = ['#7c6fff', '#3eeea0', '#ff6b6b', '#f59e0b', '#06b6d4', '#ff6b8a', '#a78bfa'];

export default function TimetableOnboardingScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedClass[] | null>(null);
  const [error, setError] = useState('');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('사진 접근 권한이 필요해요');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
      setParsed(null);
      setError('');
    }
  };

  const analyzeWithGemini = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setError('');

    try {
      const base64 = imageBase64;

      const prompt = `이 시간표 이미지를 분석해서 수업 목록을 JSON 배열로 반환해줘.
각 수업은 다음 형식으로 반환해: {"name": "수업명", "day": "요일(예: 월/수)", "time": "시작~종료(예: 09:00~10:30)", "room": "강의실"}
강의실 정보가 없으면 빈 문자열로 해줘.
반드시 JSON 배열만 반환하고, 다른 설명은 하지 마.`;

      const result = await geminiVision.generateContent([
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: prompt },
      ]);

      const text = result.response.text().trim();
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const classes = JSON.parse(jsonStr);

      setParsed(classes.map((cls: any, i: number) => ({
        ...cls,
        color: CLASS_COLORS[i % CLASS_COLORS.length],
      })));
    } catch {
      setError('분석 중 오류가 발생했어요. 사진을 다시 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 뒤로가기 */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>

        {/* 단계 표시 */}
        <View style={styles.stepRow}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={[styles.stepDot, s <= 3 && styles.stepDotActive]} />
          ))}
        </View>

        <Text style={styles.title}>시간표를 등록해요</Text>
        <Text style={styles.sub}>
          학교 시간표 캡처 사진을 올리면{'\n'}
          Gemini AI가 자동으로 분석해드려요 ✦
        </Text>

        {/* 업로드 영역 */}
        <TouchableOpacity
          style={[styles.uploadArea, image && styles.uploadAreaFilled]}
          onPress={pickImage}
        >
          {image ? (
            <Image source={{ uri: image }} style={styles.uploadedImage} resizeMode="contain" />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadIcon}>📸</Text>
              <Text style={styles.uploadText}>사진 선택하기</Text>
              <Text style={styles.uploadSub}>시간표 캡처 이미지를 선택해주세요</Text>
            </View>
          )}
        </TouchableOpacity>

        {image && !parsed && (
          <TouchableOpacity
            style={[styles.analyzeBtn, loading && styles.analyzeBtnLoading]}
            onPress={analyzeWithGemini}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.analyzeBtnText}>Gemini AI 분석 중...</Text>
              </View>
            ) : (
              <Text style={styles.analyzeBtnText}>✦ Gemini AI로 분석하기</Text>
            )}
          </TouchableOpacity>
        )}

        {error !== '' && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {/* 파싱 결과 */}
        {parsed && (
          <View style={styles.resultArea}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>✦ 분석 완료!</Text>
              <TouchableOpacity onPress={() => { setParsed(null); setImage(null); }}>
                <Text style={styles.resultRetry}>다시 업로드</Text>
              </TouchableOpacity>
            </View>

            {parsed.map((cls, i) => (
              <View key={i} style={[styles.classCard, { borderLeftColor: cls.color }]}>
                <View style={styles.classLeft}>
                  <View style={[styles.classColorDot, { backgroundColor: cls.color }]} />
                  <View>
                    <Text style={styles.className}>{cls.name}</Text>
                    <Text style={styles.classDetail}>{cls.day} · {cls.time}</Text>
                    <Text style={styles.classRoom}>📍 {cls.room}</Text>
                  </View>
                </View>
              </View>
            ))}

            <Text style={styles.resultNote}>
              * 잘못 인식된 수업이 있으면 앱 진입 후 수정할 수 있어요
            </Text>
          </View>
        )}

        {/* 건너뛰기 / 다음 */}
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.skipBtnText}>나중에 등록하기</Text>
          </TouchableOpacity>

          {parsed && (
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => router.push('/(tabs)')}
            >
              <Text style={styles.nextBtnText}>다음 →</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070d' },
  content: { paddingHorizontal: 24, paddingTop: 55, paddingBottom: 40 },

  backBtn: { marginBottom: 20 },
  backText: { color: '#555', fontSize: 14 },

  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#2a2a40' },
  stepDotActive: { backgroundColor: '#7c6fff' },

  title: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 8 },
  sub: { fontSize: 14, color: '#888', lineHeight: 22, marginBottom: 24 },

  uploadArea: {
    height: 200, borderRadius: 16,
    borderWidth: 2, borderColor: '#2a2a40', borderStyle: 'dashed',
    backgroundColor: '#13131a',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, overflow: 'hidden',
  },
  uploadAreaFilled: { borderStyle: 'solid', borderColor: '#7c6fff' },
  uploadedImage: { width: '100%', height: '100%' },
  uploadPlaceholder: { alignItems: 'center' },
  uploadIcon: { fontSize: 40, marginBottom: 12 },
  uploadText: { fontSize: 16, fontWeight: '700', color: '#eee', marginBottom: 6 },
  uploadSub: { fontSize: 12, color: '#555' },

  analyzeBtn: {
    backgroundColor: '#7c6fff', borderRadius: 14,
    height: 50, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#7c6fff', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  analyzeBtnLoading: { opacity: 0.8 },
  analyzeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', marginLeft: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  errorText: { color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginBottom: 12 },

  resultArea: { marginBottom: 20 },
  resultHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: { fontSize: 15, fontWeight: '800', color: '#3eeea0' },
  resultRetry: { fontSize: 12, color: '#7c6fff' },

  classCard: {
    backgroundColor: '#13131a', borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a40', borderLeftWidth: 4,
    padding: 14, marginBottom: 8,
  },
  classLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  classColorDot: { width: 10, height: 10, borderRadius: 5 },
  className: { fontSize: 14, fontWeight: '700', color: '#eee', marginBottom: 3 },
  classDetail: { fontSize: 12, color: '#888' },
  classRoom: { fontSize: 11, color: '#555', marginTop: 2 },

  resultNote: { fontSize: 11, color: '#444', marginTop: 8, lineHeight: 16 },

  bottomRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  skipBtn: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1, borderColor: '#2a2a40',
    alignItems: 'center', justifyContent: 'center',
  },
  skipBtnText: { color: '#555', fontSize: 14, fontWeight: '600' },
  nextBtn: {
    flex: 1, height: 50, borderRadius: 14,
    backgroundColor: '#7c6fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7c6fff', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
