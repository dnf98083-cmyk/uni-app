import * as ImagePicker from 'expo-image-picker';
import { geminiVision } from '@/lib/gemini';
import { useState } from 'react';
import { useTheme } from '@/lib/ThemeContext';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DAYS = ['월', '화', '수', '목', '금'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 9);
const CLASS_COLORS = ['#7c6fff', '#3eeea0', '#ff6b6b', '#f59e0b', '#06b6d4', '#ff6b8a', '#a78bfa'];
const CELL_HEIGHT = 56;
const TIME_WIDTH = 44;

// "09:30" 형식 유효성: HH:MM, 5분 단위
const isValidTimeStr = (t: string) => {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 55 && m % 5 === 0;
};

// 숫자 4자리 입력 → "09:30" 자동 포맷
const formatTimeInput = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ':' + digits.slice(2);
};

type ClassItem = {
  name: string;
  room: string;
  color: string;
  day: number;
  startTime: string; // "09:30"
  endTime: string;   // "11:00"
};

// "09:30" → 9.5
const toDecimal = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
};

const toTimeStr = (h: number, m: number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

export default function TimetableScreen() {
  const { colors } = useTheme();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  const [form, setForm] = useState({
    name: '', room: '', day: 0,
    startTime: '09:00',
    endTime: '10:30',
  });

  const today = new Date().getDay();
  const todayIdx = today >= 1 && today <= 5 ? today - 1 : -1;
  const todayClasses = classes
    .filter(c => c.day === todayIdx)
    .sort((a, b) => toDecimal(a.startTime) - toDecimal(b.startTime));

  const startOk = isValidTimeStr(form.startTime);
  const endOk = isValidTimeStr(form.endTime);
  const timeOrderOk = startOk && endOk && toDecimal(form.endTime) > toDecimal(form.startTime);
  const canAdd = form.name.trim() && timeOrderOk;

  const addManual = () => {
    if (!canAdd) return;
    const color = CLASS_COLORS[classes.length % CLASS_COLORS.length];
    setClasses(prev => [...prev, {
      name: form.name,
      room: form.room,
      day: form.day,
      startTime: form.startTime,
      endTime: form.endTime,
      color,
    }]);
    setForm({ name: '', room: '', day: 0, startTime: '09:00', endTime: '10:30' });
    setAddModal(false);
  };

  const analyzePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const base64 = result.assets[0].base64;
      const prompt = `이 시간표 이미지를 분석해서 수업 목록을 JSON 배열로만 반환해줘.
각 항목 형식: {"name":"수업명","room":"강의실","day":요일숫자(월=0,화=1,수=2,목=3,금=4),"startTime":"HH:MM","endTime":"HH:MM"}
강의실 없으면 빈 문자열. 반드시 JSON 배열만 반환하고 설명 없이.`;

      const res = await geminiVision.generateContent([
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: prompt },
      ]);
      const text = res.response.text().trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text);
      setClasses(parsed.map((c: any, i: number) => ({
        ...c,
        color: CLASS_COLORS[i % CLASS_COLORS.length],
      })));
    } catch {
      setAnalyzeError('분석 중 오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.accent }]}>시간표 📅</Text>
          {classes.length > 0 && (
            <Text style={[styles.subtitle, { color: colors.subText }]}>{classes.length}개 수업 등록됨</Text>
          )}
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.photoBtn} onPress={analyzePhoto} disabled={analyzing}>
            {analyzing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.photoBtnText}>📸 사진 등록</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)}>
            <Text style={styles.addBtnText}>+ 추가</Text>
          </TouchableOpacity>
        </View>
      </View>

      {analyzeError ? <Text style={styles.analyzeError}>{analyzeError}</Text> : null}

      {classes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>시간표가 비어있어요</Text>
          <Text style={[styles.emptySub, { color: colors.subText }]}>사진을 찍거나 직접 추가해보세요</Text>
          <View style={styles.emptyBtns}>
            <TouchableOpacity style={styles.emptyPhotoBtn} onPress={analyzePhoto} disabled={analyzing}>
              {analyzing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.emptyPhotoBtnText}>📸 사진으로 등록</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setAddModal(true)}>
              <Text style={styles.emptyAddBtnText}>✏️ 직접 추가하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {todayClasses.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={styles.todayScroll}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              <View style={styles.todayLabel}>
                <Text style={styles.todayLabelText}>오늘</Text>
              </View>
              {todayClasses.map((c, i) => (
                <View key={i} style={[styles.todayCard, { borderLeftColor: c.color }]}>
                  <Text style={styles.todayCardName}>{c.name}</Text>
                  <Text style={styles.todayCardTime}>{c.startTime}~{c.endTime} · {c.room}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <ScrollView style={styles.grid} showsVerticalScrollIndicator={false}>
            <View style={styles.dayHeader}>
              <View style={{ width: TIME_WIDTH }} />
              {DAYS.map((day, i) => (
                <View key={i} style={[styles.dayCell, i === todayIdx && styles.dayCellToday]}>
                  <Text style={[styles.dayText, i === todayIdx && styles.dayTextToday]}>{day}</Text>
                </View>
              ))}
            </View>
            <View style={styles.gridBody}>
              <View style={{ width: TIME_WIDTH }}>
                {HOURS.map(h => (
                  <View key={h} style={styles.timeCell}>
                    <Text style={styles.timeText}>{h}</Text>
                  </View>
                ))}
              </View>
              {DAYS.map((_, dayIdx) => (
                <View key={dayIdx} style={styles.dayColumn}>
                  {HOURS.map(h => <View key={h} style={styles.gridCell} />)}
                  {classes.filter(c => c.day === dayIdx).map((c, i) => {
                    const start = toDecimal(c.startTime);
                    const end = toDecimal(c.endTime);
                    return (
                      <View key={i} style={[styles.classBlock, {
                        backgroundColor: c.color + '22',
                        borderLeftColor: c.color,
                        top: (start - 9) * CELL_HEIGHT,
                        height: (end - start) * CELL_HEIGHT - 2,
                      }]}>
                        <Text style={[styles.className, { color: c.color }]} numberOfLines={2}>{c.name}</Text>
                        <Text style={styles.classRoom} numberOfLines={1}>{c.startTime}~{c.endTime}</Text>
                        {c.room ? <Text style={styles.classRoom} numberOfLines={1}>{c.room}</Text> : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      {/* 수동 추가 모달 */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>수업 추가</Text>

              <Text style={styles.modalLabel}>수업명 *</Text>
              <TextInput style={styles.modalInput} placeholder="예: 자료구조" placeholderTextColor="#44445a"
                value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} />

              <Text style={styles.modalLabel}>강의실</Text>
              <TextInput style={styles.modalInput} placeholder="예: 공학관 301" placeholderTextColor="#44445a"
                value={form.room} onChangeText={v => setForm(p => ({ ...p, room: v }))} />

              <Text style={styles.modalLabel}>요일</Text>
              <View style={styles.pillRow}>
                {DAYS.map((d, i) => (
                  <TouchableOpacity key={i} style={[styles.pill, form.day === i && styles.pillActive]}
                    onPress={() => setForm(p => ({ ...p, day: i }))}>
                    <Text style={[styles.pillText, form.day === i && styles.pillTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 시간 입력 */}
              <View style={styles.timeInputRow}>
                <View style={styles.timeInputBlock}>
                  <Text style={styles.modalLabel}>시작 시간</Text>
                  <TextInput
                    style={[styles.timeInput, !startOk && form.startTime.length === 5 && styles.timeInputError]}
                    value={form.startTime}
                    onChangeText={v => setForm(p => ({ ...p, startTime: formatTimeInput(v) }))}
                    placeholder="09:00"
                    placeholderTextColor="#44445a"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
                <Text style={styles.timeSeparator}>~</Text>
                <View style={styles.timeInputBlock}>
                  <Text style={styles.modalLabel}>종료 시간</Text>
                  <TextInput
                    style={[styles.timeInput, !endOk && form.endTime.length === 5 && styles.timeInputError]}
                    value={form.endTime}
                    onChangeText={v => setForm(p => ({ ...p, endTime: formatTimeInput(v) }))}
                    placeholder="10:30"
                    placeholderTextColor="#44445a"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>
              <Text style={styles.timeHint}>5분 단위로 입력해주세요 (예: 09:00, 10:30)</Text>
              {form.startTime.length === 5 && form.endTime.length === 5 && !timeOrderOk && (
                <Text style={styles.timeError}>
                  {!startOk || !endOk ? '올바른 시간 형식이 아니에요' : '종료 시간이 시작 시간보다 늦어야 해요'}
                </Text>
              )}

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setAddModal(false)}>
                  <Text style={styles.modalCancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirm, !canAdd && styles.modalConfirmDisabled]}
                  onPress={addManual} disabled={!canAdd}>
                  <Text style={styles.modalConfirmText}>추가하기</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 3 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  photoBtn: {
    backgroundColor: '#2a2a40', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7, minWidth: 90, alignItems: 'center',
  },
  photoBtnText: { fontSize: 12, color: '#eee', fontWeight: '600' },
  addBtn: { backgroundColor: '#7c6fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  analyzeError: { color: '#ff6b6b', fontSize: 12, textAlign: 'center', marginBottom: 8 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySub: { fontSize: 14, marginBottom: 32 },
  emptyBtns: { width: '100%', gap: 12 },
  emptyPhotoBtn: {
    backgroundColor: '#7c6fff', borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7c6fff', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  emptyPhotoBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  emptyAddBtn: {
    backgroundColor: '#13131a', borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2a2a40',
  },
  emptyAddBtnText: { fontSize: 15, fontWeight: '700', color: '#aaa' },

  todayScroll: { flexGrow: 0, marginBottom: 12 },
  todayLabel: {
    backgroundColor: '#7c6fff', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center',
  },
  todayLabelText: { fontSize: 11, color: '#fff', fontWeight: '900' },
  todayCard: {
    backgroundColor: '#13131a', borderRadius: 10,
    borderLeftWidth: 3, paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'center',
  },
  todayCardName: { fontSize: 13, fontWeight: '700', color: '#eee' },
  todayCardTime: { fontSize: 10, color: '#888', marginTop: 2 },

  grid: { flex: 1 },
  dayHeader: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#2a2a40',
    paddingBottom: 8, marginHorizontal: 8,
  },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayCellToday: { backgroundColor: '#7c6fff', borderRadius: 10 },
  dayText: { fontSize: 13, fontWeight: '700', color: '#555' },
  dayTextToday: { color: '#fff' },
  gridBody: { flexDirection: 'row', marginHorizontal: 8, paddingTop: 4 },
  timeCell: { height: CELL_HEIGHT, justifyContent: 'flex-start', paddingTop: 2 },
  timeText: { fontSize: 10, color: '#44445a', textAlign: 'right', paddingRight: 8 },
  dayColumn: { flex: 1, position: 'relative' },
  gridCell: { height: CELL_HEIGHT, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  classBlock: {
    position: 'absolute', left: 2, right: 2,
    borderLeftWidth: 3, borderRadius: 6, padding: 4, overflow: 'hidden',
  },
  className: { fontSize: 10, fontWeight: '700', lineHeight: 14 },
  classRoom: { fontSize: 9, color: '#888', marginTop: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#13131a', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 48,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 20 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8, marginTop: 4 },
  modalInput: {
    backgroundColor: '#0d0d16', borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 14, paddingVertical: 12,
    color: '#eee', fontSize: 14, marginBottom: 16,
  },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  pill: { backgroundColor: '#2a2a40', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  pillActive: { backgroundColor: '#7c6fff' },
  pillText: { fontSize: 13, color: '#888', fontWeight: '600' },
  pillTextActive: { color: '#fff' },

  timeInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  timeInputBlock: { flex: 1 },
  timeInput: {
    backgroundColor: '#0d0d16', borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 14, paddingVertical: 14,
    color: '#eee', fontSize: 20, fontWeight: '700',
    textAlign: 'center', letterSpacing: 2,
  },
  timeInputError: { borderColor: '#ff6b6b' },
  timeSeparator: { fontSize: 20, color: '#555', fontWeight: '700', paddingBottom: 14 },
  timeHint: { fontSize: 11, color: '#444', marginBottom: 8, marginTop: 4 },
  timeError: { fontSize: 12, color: '#ff6b6b', marginBottom: 12 },

  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1, borderColor: '#2a2a40',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCancelText: { color: '#555', fontSize: 15, fontWeight: '600' },
  modalConfirm: {
    flex: 1, height: 50, borderRadius: 14, backgroundColor: '#7c6fff',
    alignItems: 'center', justifyContent: 'center',
  },
  modalConfirmDisabled: { backgroundColor: '#2a2a40' },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
