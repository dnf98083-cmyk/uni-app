import * as ImagePicker from 'expo-image-picker';
import { geminiVision } from '@/lib/gemini';
import { useState, useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

const DAYS = ['월', '화', '수', '목', '금'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 9);
const CLASS_COLORS = ['#7c6fff', '#ff6b6b', '#3eeea0', '#f59e0b', '#06b6d4', '#ff6b8a', '#a78bfa', '#34d399'];
const TIME_WIDTH = 32;

const isValidTimeStr = (t: string) => {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 55 && m % 5 === 0;
};

const formatTimeInput = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ':' + digits.slice(2);
};

type ClassItem = {
  name: string;
  room: string;
  professor: string;
  color: string;
  day: number;
  startTime: string;
  endTime: string;
};

type EditSlot = { day: number; startTime: string; endTime: string };
type EditForm = { name: string; room: string; professor: string; slots: EditSlot[] };

const toDecimal = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
};

const getColorForName = (name: string, existing: ClassItem[]): string => {
  const match = existing.find(c => c.name === name);
  if (match) return match.color;
  const usedColors = [...new Set(existing.map(c => c.color))];
  const next = CLASS_COLORS.find(c => !usedColors.includes(c));
  return next ?? CLASS_COLORS[existing.length % CLASS_COLORS.length];
};

const mergeBlocks = (dayClasses: ClassItem[]) => {
  const sorted = [...dayClasses].sort((a, b) => toDecimal(a.startTime) - toDecimal(b.startTime));
  const result: (ClassItem & { mergedEnd: string })[] = [];
  for (const c of sorted) {
    const last = result[result.length - 1];
    if (last && last.name === c.name && toDecimal(c.startTime) - toDecimal(last.mergedEnd) <= 10 / 60) {
      last.mergedEnd = c.endTime;
    } else {
      result.push({ ...c, mergedEnd: c.endTime });
    }
  }
  return result;
};

const assignColorsByName = (items: ClassItem[]): ClassItem[] => {
  const map: Record<string, string> = {};
  let idx = 0;
  return items.map(c => {
    if (!map[c.name]) {
      map[c.name] = CLASS_COLORS[idx % CLASS_COLORS.length];
      idx++;
    }
    return { ...c, color: map[c.name] };
  });
};

// 수업명 기준으로 요일별 머지 슬롯 추출
const getClassSlots = (name: string, allClasses: ClassItem[]) =>
  Object.values(
    allClasses
      .filter(c => c.name === name)
      .sort((a, b) => a.day !== b.day ? a.day - b.day : toDecimal(a.startTime) - toDecimal(b.startTime))
      .reduce((acc, c) => {
        if (!acc[c.day]) acc[c.day] = { day: c.day, slots: [] };
        acc[c.day].slots.push({ startTime: c.startTime, endTime: c.endTime });
        return acc;
      }, {} as Record<number, { day: number; slots: { startTime: string; endTime: string }[] }>)
  ).map(d => ({
    day: d.day,
    startTime: d.slots[0].startTime,
    endTime: d.slots[d.slots.length - 1].endTime,
  }));

export default function TimetableScreen() {
  const { colors } = useTheme();
  const { height: winH } = useWindowDimensions();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [detailName, setDetailName] = useState<string | null>(null);

  // 편집 상태
  const [editModal, setEditModal] = useState(false);
  const [editOrigName, setEditOrigName] = useState('');
  const [editForm, setEditForm] = useState<EditForm>({
    name: '', room: '', professor: '', slots: [],
  });
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: row } = await supabase
          .from('user_timetables')
          .select('classes')
          .eq('user_id', uid)
          .single();
        if (row?.classes) {
          const parsed = (row.classes as ClassItem[]).map(c => ({ professor: '', ...c }));
          setClasses(assignColorsByName(parsed));
        }
        setStorageLoaded(true);
      } else {
        setStorageLoaded(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!storageLoaded || !userId) return;
    supabase.from('user_timetables').upsert(
      { user_id: userId, classes, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  }, [classes, storageLoaded, userId]);

  const [form, setForm] = useState({
    name: '', room: '', professor: '', day: 0,
    startTime: '09:00', endTime: '10:30',
  });

  const today = new Date().getDay();
  const todayIdx = today >= 1 && today <= 5 ? today - 1 : -1;

  const todayGrouped = Object.values(
    classes
      .filter(c => c.day === todayIdx)
      .sort((a, b) => toDecimal(a.startTime) - toDecimal(b.startTime))
      .reduce((acc, c) => {
        if (!acc[c.name]) acc[c.name] = { ...c, slots: [] };
        acc[c.name].slots.push({ startTime: c.startTime, endTime: c.endTime });
        return acc;
      }, {} as Record<string, ClassItem & { slots: { startTime: string; endTime: string }[] }>)
  ).map(g => ({
    ...g,
    mergedStart: g.slots[0].startTime,
    mergedEnd: g.slots[g.slots.length - 1].endTime,
  }));

  // 헤더(62) + 탭바(60) + 요일헤더(36) + 마진(20) + 오늘띠(todayGrouped가 있으면 52)
  const overhead = 62 + 60 + 36 + 20 + (todayGrouped.length > 0 ? 52 : 0);
  const cellH = Math.max(28, Math.floor((winH - overhead) / HOURS.length));

  const startOk = isValidTimeStr(form.startTime);
  const endOk = isValidTimeStr(form.endTime);
  const timeOrderOk = startOk && endOk && toDecimal(form.endTime) > toDecimal(form.startTime);
  const canAdd = form.name.trim() && timeOrderOk;

  const addManual = () => {
    if (!canAdd) return;
    const color = getColorForName(form.name.trim(), classes);
    setClasses(prev => [...prev, {
      name: form.name.trim(), room: form.room, professor: form.professor.trim(),
      day: form.day, startTime: form.startTime, endTime: form.endTime, color,
    }]);
    setForm({ name: '', room: '', professor: '', day: 0, startTime: '09:00', endTime: '10:30' });
    setAddModal(false);
  };

  const openEdit = (name: string) => {
    const room = classes.find(c => c.name === name)?.room ?? '';
    const professor = classes.find(c => c.name === name)?.professor ?? '';
    const slots = getClassSlots(name, classes);
    setEditOrigName(name);
    setEditForm({ name, room, professor, slots });
    setEditModal(true);
  };

  const saveEdit = () => {
    const color = classes.find(c => c.name === editOrigName)?.color
      ?? getColorForName(editForm.name, classes.filter(c => c.name !== editOrigName));
    const remaining = classes.filter(c => c.name !== editOrigName);
    const added: ClassItem[] = editForm.slots
      .filter(s => isValidTimeStr(s.startTime) && isValidTimeStr(s.endTime) && toDecimal(s.endTime) > toDecimal(s.startTime))
      .map(s => ({ name: editForm.name.trim(), room: editForm.room, professor: editForm.professor.trim(), color, day: s.day, startTime: s.startTime, endTime: s.endTime }));
    setClasses(assignColorsByName([...remaining, ...added]));
    setDetailName(editForm.name.trim());
    setEditModal(false);
  };

  const deleteClass = (name: string) => {
    setClasses(prev => prev.filter(c => c.name !== name));
    setDetailName(null);
  };

  const runAnalyze = async (base64: string) => {
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const prompt = `이 이미지는 한국 대학교 시간표야. 이미지에서 수업 정보를 읽어서 JSON 배열로만 반환해줘.

**규칙:**
- 각 항목 형식: {"name":"수업명","room":"강의실","professor":"교수명","day":요일숫자,"startTime":"HH:MM","endTime":"HH:MM"}
- day: 월=0, 화=1, 수=2, 목=3, 금=4
- 같은 수업이 여러 요일에 있으면 요일마다 별도 항목으로 넣어줘
- 시간이 교시(1교시, 2교시...)로 표시된 경우 변환: 1교시=09:00, 2교시=10:00, 3교시=11:00, 4교시=12:00, 5교시=13:00, 6교시=14:00, 7교시=15:00, 8교시=16:00, 9교시=17:00
- 강의실은 건물명과 호수만 간결하게 (예: "공학관 301"). 없으면 빈 문자열
- 교수명은 성함만 (예: "홍길동"). 없으면 빈 문자열
- 교수명, 학점 등은 name에 포함하지 마
- JSON 배열만 반환, 설명/마크다운 없이

예시 출력: [{"name":"자료구조","room":"공학관 301","professor":"홍길동","day":0,"startTime":"09:00","endTime":"10:30"},{"name":"자료구조","room":"공학관 301","professor":"홍길동","day":2,"startTime":"09:00","endTime":"10:30"}]`;

      const res = await geminiVision.generateContent([
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: prompt },
      ]);
      const raw = res.response.text().trim();
      // JSON 배열 추출 (앞뒤 마크다운 블록 제거)
      const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const match = clean.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('시간표를 인식하지 못했어요. 더 선명한 사진으로 다시 시도해보세요.');
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('수업 정보를 찾지 못했어요. 시간표 사진인지 확인해주세요.');
      setClasses(assignColorsByName(parsed));
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : '분석 중 오류가 발생했어요.');
    } finally {
      setAnalyzing(false);
      setPendingBase64(null);
    }
  };

  const analyzePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
    if (result.canceled || !result.assets[0]?.base64) return;
    const base64 = result.assets[0].base64!;
    if (classes.length > 0) {
      setPendingBase64(base64);
      setReplaceConfirm(true);
    } else {
      runAnalyze(base64);
    }
  };

  // 편집 모달 유효성
  const editSlotValid = (s: EditSlot) =>
    isValidTimeStr(s.startTime) && isValidTimeStr(s.endTime) && toDecimal(s.endTime) > toDecimal(s.startTime);
  const canSaveEdit = editForm.name.trim() && editForm.slots.length > 0 && editForm.slots.every(editSlotValid);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.accent }]}>시간표</Text>
          {classes.length > 0 && (
            <Text style={[styles.subtitle, { color: colors.subText }]}>{classes.length}개 수업</Text>
          )}
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={analyzePhoto} disabled={analyzing}>
            {analyzing ? <ActivityIndicator color="#7c6fff" size="small" /> : <Text style={[styles.photoBtnText, { color: colors.text }]}>📸 사진 등록</Text>}
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
              {analyzing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.emptyPhotoBtnText}>📸 사진으로 등록</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.emptyAddBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setAddModal(true)}>
              <Text style={[styles.emptyAddBtnText, { color: colors.subText }]}>✏️ 직접 추가하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {/* 오늘 수업 띠 */}
          {todayGrouped.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={styles.todayScroll}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
              <View style={styles.todayLabel}>
                <Text style={styles.todayLabelText}>오늘</Text>
              </View>
              {todayGrouped.map((c, i) => (
                <View key={i} style={[styles.todayCard, { backgroundColor: colors.card, borderLeftColor: c.color }]}>
                  <View style={[styles.todayDot, { backgroundColor: c.color }]} />
                  <View>
                    <Text style={[styles.todayCardName, { color: colors.text }]}>{c.name}</Text>
                    <Text style={[styles.todayCardTime, { color: colors.subText }]}>
                      {c.mergedStart}–{c.mergedEnd}{c.room ? ` · ${c.room}` : ''}{c.professor ? ` · ${c.professor}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* 시간표 그리드 */}
          <View style={styles.grid}>
            <View style={[styles.dayHeader, { borderBottomColor: colors.border }]}>
              <View style={{ width: TIME_WIDTH }} />
              {DAYS.map((day, i) => (
                <View key={i} style={[styles.dayCell, i === todayIdx && { backgroundColor: '#7c6fff' }]}>
                  <Text style={[styles.dayText, { color: i === todayIdx ? '#fff' : colors.subText }]}>{day}</Text>
                </View>
              ))}
            </View>
            <View style={styles.gridBody}>
              <View style={{ width: TIME_WIDTH }}>
                {HOURS.map(h => (
                  <View key={h} style={{ height: cellH, justifyContent: 'flex-start', paddingTop: 2 }}>
                    <Text style={[styles.timeText, { color: colors.subText }]}>{h}</Text>
                  </View>
                ))}
              </View>
              {DAYS.map((_, dayIdx) => (
                <View key={dayIdx} style={[
                  styles.dayColumn, { borderLeftColor: colors.border },
                  dayIdx === todayIdx && { backgroundColor: '#7c6fff08' },
                ]}>
                  {HOURS.map(h => <View key={h} style={{ height: cellH, borderBottomWidth: 1, borderBottomColor: colors.border }} />)}
                  {mergeBlocks(classes.filter(c => c.day === dayIdx)).map((c, i) => {
                    const start = toDecimal(c.startTime);
                    const end = toDecimal(c.mergedEnd);
                    const blockH = (end - start) * cellH - 2;
                    const tiny = blockH < 26;
                    const small = blockH >= 26 && blockH < 44;
                    return (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.75}
                        onPress={() => setDetailName(c.name)}
                        style={[styles.classBlock, {
                          backgroundColor: c.color + '30',
                          borderLeftColor: c.color,
                          top: (start - 9) * cellH,
                          height: blockH,
                        }]}>
                        <Text style={[styles.className, { color: c.color, fontSize: tiny ? 8 : small ? 9 : 10 }]} numberOfLines={small ? 1 : 2}>
                          {c.name}
                        </Text>
                        {!tiny && (
                          <Text style={[styles.classTime, { color: c.color + 'bb', fontSize: small ? 7 : 9 }]} numberOfLines={1}>
                            {c.startTime}–{c.mergedEnd}
                          </Text>
                        )}
                        {!tiny && !small && c.room ? (
                          <Text style={[styles.classRoom, { color: colors.subText }]} numberOfLines={1}>{c.room}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {/* 수동 추가 모달 */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>수업 추가</Text>
              <Text style={[styles.modalLabel, { color: colors.subText }]}>수업명 *</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="예: 자료구조" placeholderTextColor={colors.subText}
                value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} />
              <Text style={[styles.modalLabel, { color: colors.subText }]}>강의실</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="예: 공학관 301" placeholderTextColor={colors.subText}
                value={form.room} onChangeText={v => setForm(p => ({ ...p, room: v }))} />
              <Text style={[styles.modalLabel, { color: colors.subText }]}>교수님</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="예: 홍길동" placeholderTextColor={colors.subText}
                value={form.professor} onChangeText={v => setForm(p => ({ ...p, professor: v }))} />
              <Text style={[styles.modalLabel, { color: colors.subText }]}>요일</Text>
              <View style={styles.pillRow}>
                {DAYS.map((d, i) => (
                  <TouchableOpacity key={i} style={[styles.pill, { backgroundColor: colors.bg, borderColor: colors.border }, form.day === i && styles.pillActive]}
                    onPress={() => setForm(p => ({ ...p, day: i }))}>
                    <Text style={[styles.pillText, { color: colors.subText }, form.day === i && styles.pillTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.timeInputRow}>
                <View style={styles.timeInputBlock}>
                  <Text style={[styles.modalLabel, { color: colors.subText }]}>시작</Text>
                  <TextInput style={[styles.timeInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }, !startOk && form.startTime.length === 5 && styles.timeInputError]}
                    value={form.startTime} onChangeText={v => setForm(p => ({ ...p, startTime: formatTimeInput(v) }))}
                    placeholder="09:00" placeholderTextColor={colors.subText} keyboardType="numeric" maxLength={5} />
                </View>
                <Text style={[styles.timeSeparator, { color: colors.subText }]}>–</Text>
                <View style={styles.timeInputBlock}>
                  <Text style={[styles.modalLabel, { color: colors.subText }]}>종료</Text>
                  <TextInput style={[styles.timeInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }, !endOk && form.endTime.length === 5 && styles.timeInputError]}
                    value={form.endTime} onChangeText={v => setForm(p => ({ ...p, endTime: formatTimeInput(v) }))}
                    placeholder="10:30" placeholderTextColor={colors.subText} keyboardType="numeric" maxLength={5} />
                </View>
              </View>
              {form.startTime.length === 5 && form.endTime.length === 5 && !timeOrderOk && (
                <Text style={styles.timeError}>{!startOk || !endOk ? '올바른 시간 형식이 아니에요' : '종료 시간이 시작 시간보다 늦어야 해요'}</Text>
              )}
              {form.name.trim() ? (
                <View style={[styles.colorPreview, { backgroundColor: getColorForName(form.name.trim(), classes) + '22', borderColor: getColorForName(form.name.trim(), classes) }]}>
                  <View style={[styles.colorDot, { backgroundColor: getColorForName(form.name.trim(), classes) }]} />
                  <Text style={[styles.colorPreviewText, { color: getColorForName(form.name.trim(), classes) }]}>
                    {classes.find(c => c.name === form.name.trim()) ? '기존 수업과 같은 색으로 추가돼요' : '새 색상이 배정돼요'}
                  </Text>
                </View>
              ) : null}
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={() => setAddModal(false)}>
                  <Text style={[styles.modalCancelText, { color: colors.subText }]}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalConfirm, !canAdd && styles.modalConfirmDisabled]} onPress={addManual} disabled={!canAdd}>
                  <Text style={styles.modalConfirmText}>추가하기</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* 수업 상세 시트 */}
      <Modal visible={!!detailName} transparent animationType="slide" onRequestClose={() => setDetailName(null)}>
        <TouchableWithoutFeedback onPress={() => setDetailName(null)}>
          <View style={styles.detailBackdrop} />
        </TouchableWithoutFeedback>
        <View style={[styles.detailSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.detailHandle, { backgroundColor: colors.border }]} />
          {detailName && (() => {
            const color = classes.find(c => c.name === detailName)?.color ?? '#7c6fff';
            const room = classes.find(c => c.name === detailName)?.room ?? '';
            const professor = classes.find(c => c.name === detailName)?.professor ?? '';
            const slots = getClassSlots(detailName, classes);
            return (
              <>
                <View style={styles.detailHeader}>
                  <View style={[styles.detailColorBar, { backgroundColor: color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailName, { color: colors.text }]}>{detailName}</Text>
                    {room ? <Text style={[styles.detailRoom, { color: colors.subText }]}>📍 {room}</Text> : null}
                    {professor ? <Text style={[styles.detailRoom, { color: colors.subText }]}>👤 {professor} 교수님</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => setDetailName(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 18, color: colors.subText }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailSlots}>
                  {slots.map((s, i) => (
                    <View key={i} style={[styles.detailSlotRow, { backgroundColor: color + '18', borderColor: color + '44' }]}>
                      <Text style={[styles.detailSlotDay, { color }]}>{DAYS[s.day]}요일</Text>
                      <Text style={[styles.detailSlotTime, { color: colors.text }]}>{s.startTime} – {s.endTime}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.detailBtns}>
                  <TouchableOpacity style={[styles.editBtn, { borderColor: colors.border }]}
                    onPress={() => { openEdit(detailName); }}>
                    <Text style={[styles.editBtnText, { color: colors.text }]}>✏️ 편집</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteClass(detailName)}>
                    <Text style={styles.deleteBtnText}>🗑 삭제</Text>
                  </TouchableOpacity>
                </View>
              </>
            );
          })()}
        </View>
      </Modal>

      {/* 편집 모달 */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>수업 편집</Text>

              <Text style={[styles.modalLabel, { color: colors.subText }]}>수업명 *</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="수업명" placeholderTextColor={colors.subText}
                value={editForm.name} onChangeText={v => setEditForm(p => ({ ...p, name: v }))} />

              <Text style={[styles.modalLabel, { color: colors.subText }]}>강의실</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="강의실" placeholderTextColor={colors.subText}
                value={editForm.room} onChangeText={v => setEditForm(p => ({ ...p, room: v }))} />

              <Text style={[styles.modalLabel, { color: colors.subText }]}>교수님</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="예: 홍길동" placeholderTextColor={colors.subText}
                value={editForm.professor} onChangeText={v => setEditForm(p => ({ ...p, professor: v }))} />

              <Text style={[styles.modalLabel, { color: colors.subText }]}>요일별 시간</Text>
              {editForm.slots.map((s, i) => {
                const sOk = isValidTimeStr(s.startTime);
                const eOk = isValidTimeStr(s.endTime);
                const orderOk = sOk && eOk && toDecimal(s.endTime) > toDecimal(s.startTime);
                return (
                  <View key={i} style={[styles.editSlotRow, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <View style={styles.editSlotDayWrap}>
                      {DAYS.map((d, di) => (
                        <TouchableOpacity key={di}
                          style={[styles.editDayPill, { borderColor: colors.border },
                            s.day === di && { backgroundColor: editForm.slots[0] ? classes.find(c => c.name === editOrigName)?.color ?? '#7c6fff' : '#7c6fff', borderColor: 'transparent' }]}
                          onPress={() => setEditForm(p => ({ ...p, slots: p.slots.map((sl, si) => si === i ? { ...sl, day: di } : sl) }))}>
                          <Text style={[styles.editDayPillText, { color: s.day === di ? '#fff' : colors.subText }]}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.editSlotTimeRow}>
                      <TextInput
                        style={[styles.editTimeInput, { backgroundColor: colors.card, borderColor: sOk || s.startTime.length < 5 ? colors.border : '#ff6b6b', color: colors.text }]}
                        value={s.startTime}
                        onChangeText={v => setEditForm(p => ({ ...p, slots: p.slots.map((sl, si) => si === i ? { ...sl, startTime: formatTimeInput(v) } : sl) }))}
                        keyboardType="numeric" maxLength={5} placeholder="09:00" placeholderTextColor={colors.subText} />
                      <Text style={{ color: colors.subText, fontWeight: '700' }}>–</Text>
                      <TextInput
                        style={[styles.editTimeInput, { backgroundColor: colors.card, borderColor: eOk && orderOk || s.endTime.length < 5 ? colors.border : '#ff6b6b', color: colors.text }]}
                        value={s.endTime}
                        onChangeText={v => setEditForm(p => ({ ...p, slots: p.slots.map((sl, si) => si === i ? { ...sl, endTime: formatTimeInput(v) } : sl) }))}
                        keyboardType="numeric" maxLength={5} placeholder="10:30" placeholderTextColor={colors.subText} />
                      <TouchableOpacity onPress={() => setEditForm(p => ({ ...p, slots: p.slots.filter((_, si) => si !== i) }))}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ color: '#ff6b6b', fontSize: 16, fontWeight: '700' }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity style={[styles.addSlotBtn, { borderColor: colors.border }]}
                onPress={() => setEditForm(p => ({ ...p, slots: [...p.slots, { day: 0, startTime: '09:00', endTime: '10:30' }] }))}>
                <Text style={[styles.addSlotBtnText, { color: colors.subText }]}>+ 요일 추가</Text>
              </TouchableOpacity>

              <View style={[styles.modalBtns, { marginTop: 16 }]}>
                <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={() => setEditModal(false)}>
                  <Text style={[styles.modalCancelText, { color: colors.subText }]}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalConfirm, !canSaveEdit && styles.modalConfirmDisabled]} onPress={saveEdit} disabled={!canSaveEdit}>
                  <Text style={styles.modalConfirmText}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* 기존 시간표 교체 확인 모달 */}
      <Modal visible={replaceConfirm} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => { setReplaceConfirm(false); setPendingBase64(null); }}>
          <View style={styles.confirmBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.confirmWrap} pointerEvents="box-none">
          <View style={[styles.confirmCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>시간표를 교체할까요?</Text>
            <Text style={[styles.confirmSub, { color: colors.subText }]}>
              현재 등록된 시간표가 삭제되고{'\n'}사진의 시간표로 새로 등록돼요.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={[styles.confirmCancel, { borderColor: colors.border }]}
                onPress={() => { setReplaceConfirm(false); setPendingBase64(null); }}>
                <Text style={[styles.confirmCancelText, { color: colors.subText }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmOk}
                onPress={() => {
                  setReplaceConfirm(false);
                  if (pendingBase64) runAnalyze(pendingBase64);
                }}>
                <Text style={styles.confirmOkText}>교체하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  photoBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, minWidth: 90, alignItems: 'center' },
  photoBtnText: { fontSize: 12, fontWeight: '600' },
  addBtn: { backgroundColor: '#7c6fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  analyzeError: { color: '#ff6b6b', fontSize: 12, textAlign: 'center', marginVertical: 6 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySub: { fontSize: 14, marginBottom: 32 },
  emptyBtns: { width: '100%', gap: 12 },
  emptyPhotoBtn: { backgroundColor: '#7c6fff', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' },
  emptyPhotoBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  emptyAddBtn: { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emptyAddBtnText: { fontSize: 15, fontWeight: '700' },

  todayScroll: { flexGrow: 0, marginBottom: 8 },
  todayLabel: { backgroundColor: '#7c6fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  todayLabelText: { fontSize: 11, color: '#fff', fontWeight: '900' },
  todayCard: { borderRadius: 10, borderLeftWidth: 3, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  todayDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  todayCardName: { fontSize: 13, fontWeight: '700' },
  todayCardTime: { fontSize: 10, marginTop: 2 },

  grid: { flex: 1 },
  dayHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 6, marginHorizontal: 8 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 8, marginHorizontal: 1 },
  dayText: { fontSize: 12, fontWeight: '700' },
  gridBody: { flexDirection: 'row', marginHorizontal: 8 },
  timeText: { fontSize: 10, textAlign: 'right', paddingRight: 6 },
  dayColumn: { flex: 1, position: 'relative', borderLeftWidth: 1 },
  classBlock: {
    position: 'absolute', left: 2, right: 2,
    borderLeftWidth: 3, borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 4,
    overflow: 'hidden', gap: 2,
  },
  className: { fontWeight: '800', lineHeight: 14 },
  classTime: { fontWeight: '600', lineHeight: 13 },
  classRoom: { fontSize: 9, lineHeight: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 20 },
  modalLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  modalInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 14 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  pill: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  pillActive: { backgroundColor: '#7c6fff', borderColor: '#7c6fff' },
  pillText: { fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  timeInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  timeInputBlock: { flex: 1 },
  timeInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: 2 },
  timeInputError: { borderColor: '#ff6b6b' },
  timeSeparator: { fontSize: 20, fontWeight: '700', paddingBottom: 14 },
  timeHint: { fontSize: 11, marginBottom: 6, marginTop: 4 },
  timeError: { fontSize: 12, color: '#ff6b6b', marginBottom: 10 },
  colorPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  colorPreviewText: { fontSize: 12, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600' },
  modalConfirm: { flex: 1, height: 50, borderRadius: 14, backgroundColor: '#7c6fff', alignItems: 'center', justifyContent: 'center' },
  modalConfirmDisabled: { backgroundColor: '#7c6fff44' },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  detailBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  detailSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  detailHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  detailColorBar: { width: 5, borderRadius: 3, alignSelf: 'stretch', minHeight: 40 },
  detailName: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  detailRoom: { fontSize: 13 },
  detailSlots: { gap: 8, marginBottom: 20 },
  detailSlotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  detailSlotDay: { fontSize: 14, fontWeight: '800' },
  detailSlotTime: { fontSize: 14, fontWeight: '600' },
  detailBtns: { flexDirection: 'row', gap: 10 },
  editBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 15, fontWeight: '700' },
  deleteBtn: { flex: 1, height: 50, borderRadius: 14, backgroundColor: '#ff6b6b18', borderWidth: 1, borderColor: '#ff6b6b55', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#ff6b6b', fontSize: 15, fontWeight: '700' },

  editSlotRow: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10, gap: 8 },
  editSlotDayWrap: { flexDirection: 'row', gap: 6 },
  editDayPill: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  editDayPillText: { fontSize: 12, fontWeight: '700' },
  editSlotTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editTimeInput: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  addSlotBtn: { borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  addSlotBtnText: { fontSize: 13, fontWeight: '600' },

  confirmBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  confirmWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  confirmCard: { width: '100%', borderRadius: 20, padding: 24, gap: 4 },
  confirmTitle: { fontSize: 17, fontWeight: '900', marginBottom: 6 },
  confirmSub: { fontSize: 13, lineHeight: 20, marginBottom: 20 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmCancel: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { fontSize: 14, fontWeight: '600' },
  confirmOk: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#7c6fff', alignItems: 'center', justifyContent: 'center' },
  confirmOkText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
