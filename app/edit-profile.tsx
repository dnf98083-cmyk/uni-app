import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';

const SCHOOLS = [
  { name: '서울대학교', region: '서울', emoji: '🏫' },
  { name: '연세대학교', region: '서울', emoji: '🏛️' },
  { name: '고려대학교', region: '서울', emoji: '🎓' },
  { name: '서강대학교', region: '서울', emoji: '🏫' },
  { name: '성균관대학교', region: '서울/수원', emoji: '🔬' },
  { name: '한양대학교', region: '서울', emoji: '🏫' },
  { name: '중앙대학교', region: '서울', emoji: '🏛️' },
  { name: '경희대학교', region: '서울/수원', emoji: '🎓' },
  { name: '한국외국어대학교', region: '서울', emoji: '🌍' },
  { name: '이화여자대학교', region: '서울', emoji: '🌸' },
  { name: '동국대학교', region: '서울', emoji: '🏛️' },
  { name: '건국대학교', region: '서울', emoji: '🐮' },
  { name: '홍익대학교', region: '서울', emoji: '🎨' },
  { name: '숙명여자대학교', region: '서울', emoji: '🌺' },
  { name: '숭실대학교', region: '서울', emoji: '🏫' },
  { name: '세종대학교', region: '서울', emoji: '🎓' },
  { name: '국민대학교', region: '서울', emoji: '🏫' },
  { name: '서울시립대학교', region: '서울', emoji: '🏙️' },
  { name: '서울과학기술대학교', region: '서울', emoji: '🔬' },
  { name: '광운대학교', region: '서울', emoji: '📡' },
  { name: '한성대학교', region: '서울', emoji: '🏫' },
  { name: '덕성여자대학교', region: '서울', emoji: '🌷' },
  { name: '동덕여자대학교', region: '서울', emoji: '🌼' },
  { name: '성신여자대학교', region: '서울', emoji: '🌻' },
  { name: '삼육대학교', region: '서울', emoji: '🏫' },
  { name: '명지대학교', region: '서울/용인', emoji: '🎓' },
  { name: '상명대학교', region: '서울/천안', emoji: '🏫' },
  { name: '신구대학교', region: '성남', emoji: '🏫' },
  { name: '인하대학교', region: '인천', emoji: '✈️' },
  { name: '인천대학교', region: '인천', emoji: '🌊' },
  { name: '가천대학교', region: '성남/인천', emoji: '🎓' },
  { name: '아주대학교', region: '수원', emoji: '🏫' },
  { name: '경기대학교', region: '수원', emoji: '🎓' },
  { name: '단국대학교', region: '용인/천안', emoji: '🏛️' },
  { name: '한국항공대학교', region: '고양', emoji: '✈️' },
  { name: '강원대학교', region: '춘천', emoji: '🏔️' },
  { name: '한림대학교', region: '춘천', emoji: '🎓' },
  { name: '카이스트(KAIST)', region: '대전', emoji: '🚀' },
  { name: '충남대학교', region: '대전', emoji: '🎓' },
  { name: '충북대학교', region: '청주', emoji: '🏛️' },
  { name: '경북대학교', region: '대구', emoji: '🏛️' },
  { name: '계명대학교', region: '대구', emoji: '🎓' },
  { name: '영남대학교', region: '경산', emoji: '🏫' },
  { name: '부산대학교', region: '부산', emoji: '🌊' },
  { name: '동아대학교', region: '부산', emoji: '🎓' },
  { name: '부경대학교', region: '부산', emoji: '🐟' },
  { name: '창원대학교', region: '창원', emoji: '🎓' },
  { name: '전남대학교', region: '광주', emoji: '🏛️' },
  { name: '조선대학교', region: '광주', emoji: '🎓' },
  { name: '광주과학기술원(GIST)', region: '광주', emoji: '🔬' },
  { name: '전북대학교', region: '전주', emoji: '🏫' },
  { name: '원광대학교', region: '익산', emoji: '☯️' },
  { name: '제주대학교', region: '제주', emoji: '🍊' },
];

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const [nickname, setNickname] = useState('');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<{ name: string; region: string; emoji: string } | null>(null);
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data?.user?.user_metadata ?? {};
      setNickname(meta.nickname ?? '');
      if (meta.school_name) {
        setSelectedSchool({
          name: meta.school_name,
          region: meta.school_region ?? '',
          emoji: meta.school_emoji ?? '🏫',
        });
      }
    });
  }, []);

  const filteredSchools = schoolQuery
    ? SCHOOLS.filter(s => s.name.includes(schoolQuery) || s.region.includes(schoolQuery))
    : SCHOOLS;

  const noResults = schoolQuery.trim().length > 0 && filteredSchools.length === 0;

  const handleSave = async () => {
    if (!nickname.trim()) { setErrorMsg('닉네임을 입력해주세요'); return; }
    setLoading(true);
    setErrorMsg('');
    try {
      const updateData: Record<string, string> = { nickname: nickname.trim() };
      if (selectedSchool) {
        updateData.school_name = selectedSchool.name;
        updateData.school_region = selectedSchool.region;
        updateData.school_emoji = selectedSchool.emoji;
      }
      const { error } = await supabase.auth.updateUser({ data: updateData });
      if (error) {
        setErrorMsg('저장 중 오류가 발생했어요');
      } else {
        setSuccessMsg('저장됐어요!');
        setTimeout(() => router.back(), 1200);
      }
    } catch {
      setErrorMsg('네트워크 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backBtn, { color: colors.subText }]}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>프로필 편집</Text>
        </View>

        {/* 닉네임 */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.subText }]}>닉네임</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={nickname}
            onChangeText={v => { setNickname(v); setErrorMsg(''); setSuccessMsg(''); }}
            placeholder="닉네임 입력"
            placeholderTextColor={colors.subText}
          />
        </View>

        {/* 학교 */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.subText }]}>학교</Text>

          {/* 현재 선택 학교 */}
          {selectedSchool && !showSchoolPicker && (
            <View style={[styles.selectedCard, { backgroundColor: colors.card, borderColor: '#7c6fff' }]}>
              <Text style={styles.selectedEmoji}>{selectedSchool.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectedName, { color: colors.text }]}>{selectedSchool.name}</Text>
                <Text style={[styles.selectedRegion, { color: colors.subText }]}>📍 {selectedSchool.region}</Text>
              </View>
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={() => { setShowSchoolPicker(true); setSchoolQuery(''); }}>
                <Text style={styles.changeBtnText}>변경</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 학교 미선택 시 선택 버튼 */}
          {!selectedSchool && !showSchoolPicker && (
            <TouchableOpacity
              style={[styles.selectBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowSchoolPicker(true)}>
              <Text style={[styles.selectBtnText, { color: colors.subText }]}>🏫 학교 선택하기</Text>
            </TouchableOpacity>
          )}

          {/* 학교 검색 피커 */}
          {showSchoolPicker && (
            <View style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.searchBox, { borderColor: colors.border }]}>
                <Text>🔍 </Text>
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="학교 이름 또는 지역 검색"
                  placeholderTextColor={colors.subText}
                  value={schoolQuery}
                  onChangeText={setSchoolQuery}
                  autoFocus
                />
              </View>
              <ScrollView style={styles.schoolList} nestedScrollEnabled>
                {filteredSchools.map((school, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.schoolItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setSelectedSchool(school);
                      setShowSchoolPicker(false);
                      setSchoolQuery('');
                    }}>
                    <Text style={styles.schoolEmoji}>{school.emoji}</Text>
                    <View>
                      <Text style={[styles.schoolItemName, { color: colors.text }]}>{school.name}</Text>
                      <Text style={[styles.schoolItemRegion, { color: colors.subText }]}>📍 {school.region}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {noResults && (
                  <TouchableOpacity
                    style={[styles.schoolItem, styles.customItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setSelectedSchool({ name: schoolQuery.trim(), region: '직접 입력', emoji: '🏫' });
                      setShowSchoolPicker(false);
                      setSchoolQuery('');
                    }}>
                    <Text style={styles.schoolEmoji}>🏫</Text>
                    <View>
                      <Text style={styles.customName}>"{schoolQuery.trim()}" 직접 입력</Text>
                      <Text style={[styles.schoolItemRegion, { color: colors.subText }]}>목록에 없는 학교도 사용할 수 있어요</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </ScrollView>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowSchoolPicker(false); setSchoolQuery(''); }}>
                <Text style={[styles.cancelBtnText, { color: colors.subText }]}>취소</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

        {!showSchoolPicker && (
          <TouchableOpacity
            style={[styles.saveBtn, loading && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>저장하기</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 55, paddingBottom: 20 },
  backBtn: { fontSize: 14, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '900' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1,
  },
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  selectedEmoji: { fontSize: 26 },
  selectedName: { fontSize: 15, fontWeight: '700' },
  selectedRegion: { fontSize: 12, marginTop: 2 },
  changeBtn: {
    backgroundColor: '#2a2a40', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  changeBtnText: { fontSize: 12, color: '#aaa', fontWeight: '600' },
  selectBtn: {
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14,
    alignItems: 'center',
  },
  selectBtnText: { fontSize: 14 },
  picker: {
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  schoolList: { maxHeight: 260 },
  schoolItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  customItem: {},
  schoolEmoji: { fontSize: 22 },
  schoolItemName: { fontSize: 14, fontWeight: '600' },
  schoolItemRegion: { fontSize: 11, marginTop: 2 },
  customName: { fontSize: 14, fontWeight: '700', color: '#3eeea0' },
  cancelBtn: { padding: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14 },
  errorText: { fontSize: 13, color: '#ff6b6b', textAlign: 'center', marginBottom: 8, marginHorizontal: 20 },
  successText: { fontSize: 14, color: '#3eeea0', textAlign: 'center', fontWeight: '700', marginBottom: 8 },
  saveBtn: {
    backgroundColor: '#7c6fff', borderRadius: 28,
    height: 56, alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
