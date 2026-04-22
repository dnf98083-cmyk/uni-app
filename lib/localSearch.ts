// 앱 내 로컬 데이터 검색 모듈
// 학교 공통 팁만 포함 — 학교별 맛집/위치는 Gemini Google Search가 처리

type LocalEntry = {
  keywords: string[];
  category: string;
  content: string;
};

const APP_DATA: LocalEntry[] = [
  // ── 수강신청 ──────────────────────────────────────────────
  {
    keywords: ['수강신청', '수강', '강의', '시간표', '수강 신청', '장바구니'],
    category: '수강신청 꿀팁',
    content: `
수강신청 공통 꿀팁:
- 수강신청 전날 미리 장바구니에 담아두기
- 인기 강의는 열리자마자 마감 → 자정 or 개시 시간에 바로 접속
- 수강 정정 기간(개강 후 1~2주) 활용하기
- 학점 계획: 전공/교양 밸런스, 졸업 요건 미리 확인
- 강의평가 사이트(에브리타임 등)에서 교수님 미리 확인
`.trim(),
  },

  // ── 장학금 ────────────────────────────────────────────────
  {
    keywords: ['장학금', '장학', '등록금', '지원금', '국가장학금'],
    category: '장학금',
    content: `
장학금 종류 및 신청 팁:
- 국가장학금(한국장학재단): 매 학기 신청 필수 → www.kosaf.go.kr
  · 1~2구간 전액 or 일부 지원, 소득분위 기준
  · 신청 기간 놓치면 다음 학기까지 못 받으니 꼭 챙기기
- 성적우수 장학금: 직전 학기 성적 기준 (학교마다 다름)
- 근로장학금: 교내 근무 (학교 홈페이지 공고 확인)
- 외부 장학금: 각 학과 공지사항, 장학재단 사이트 수시 확인
- 신청 방법: 학교 포털 → 장학 메뉴
`.trim(),
  },

  // ── 공결 처리 ──────────────────────────────────────────────
  {
    keywords: ['공결', '출석', '결석', '병가', '공가', '출결'],
    category: '공결 처리',
    content: `
공결 처리 일반 절차:
- 공결 신청: 학교 포털 → 학생서비스 → 출결관리
- 증빙서류 필요: 진단서, 훈련확인서, 면접확인서 등
- 신청 기한: 사유 발생 후 보통 7일 이내
- 인정 사유: 군 훈련, 취업 면접, 질병, 천재지변 등
- 담당 교수님께 미리 알리는 것이 예의
`.trim(),
  },

  // ── 졸업 ──────────────────────────────────────────────────
  {
    keywords: ['졸업', '졸업요건', '졸업학점', '졸업시험', '졸업작품'],
    category: '졸업 요건',
    content: `
졸업 요건 체크리스트 (학과마다 다를 수 있음):
- 최소 이수 학점 충족 (전공/교양/일반 구분)
- 졸업시험 or 졸업작품 필요 여부 확인
- 영어 졸업 인증 (TOEIC 등) 요구 학과 있음
- 봉사시간 요구 학교 있음
- 정확한 요건: 학과 사무실 or 포털 학사정보 필수 확인
`.trim(),
  },

  // ── 취업/진로 ──────────────────────────────────────────────
  {
    keywords: ['취업', '인턴', '진로', '자소서', '면접', '이력서', '취준'],
    category: '취업/진로',
    content: `
취업 준비 팁:
- 학교 취업지원센터 적극 활용 (이력서·자소서 첨삭 무료)
- 교내 채용박람회: 학기 중 정기 개최
- 국가근로장학금으로 경력 쌓기 가능
- 에브리타임, 링크드인, 잡코리아, 사람인 수시 확인
- 면접 전 학교 유튜브/블로그에서 선배 후기 찾아보기
- 현장실습(인턴) 학점 인정 여부 학과 확인
`.trim(),
  },

  // ── 동아리/학생활동 ────────────────────────────────────────
  {
    keywords: ['동아리', '학생회', '클럽', '소모임', '과잠', '학생활동'],
    category: '동아리/학생활동',
    content: `
동아리 활동 팁:
- 가입 시기: 학기 초 동아리 박람회 (보통 3월, 9월)
- 종류: 운동, 음악, 봉사, 전공 관련, 게임, 여행 등 다양
- 동아리 활동은 자소서 소재로 활용 가능
- 학생회 활동으로 리더십 경험 쌓기
- 에브리타임 앱에서 학교별 동아리 정보 확인
`.trim(),
  },

  // ── 알바 ──────────────────────────────────────────────────
  {
    keywords: ['알바', '아르바이트', '알바비', '시급', '알바 구하기'],
    category: '알바',
    content: `
대학생 알바 팁:
- 구인 플랫폼: 알바천국, 알바몬, 당근마켓
- 학교 근처 알바 → 통학 동선에 맞춰 구하기
- 2025년 최저시급: 10,030원
- 주 15시간 이상 → 주휴수당 발생 (꼭 챙기기)
- 근로계약서 반드시 작성 (미작성 시 신고 가능)
- 학교 근로장학금이 일반 알바보다 조건 좋은 경우 많음
`.trim(),
  },

  // ── 대학생 꿀팁 ────────────────────────────────────────────
  {
    keywords: ['혜택', '할인', '대학생', '학생증', '복지'],
    category: '대학생 혜택',
    content: `
대학생 혜택 모음:
- 교통: 청소년/대학생 할인 교통카드
- 문화: 영화관 학생 할인, 국공립 박물관 무료
- 소프트웨어: 어도비, MS Office 학생 요금제
- 쇼핑: 유니클로, 무신사 학생 할인
- 통신: 학생 요금제 (SKT, KT, LG U+)
- 은행: 대학생 전용 통장 (수수료 면제 등)
- 헬스장: 학교 체육시설 저렴하게 이용
`.trim(),
  },
];

/**
 * 사용자 쿼리에서 앱 내 관련 데이터를 검색합니다
 * @returns 관련 정보 문자열 또는 null (없을 경우)
 */
export function searchLocalData(query: string): string | null {
  const lower = query.toLowerCase().replace(/\s+/g, '');

  const matched = APP_DATA.filter(entry =>
    entry.keywords.some(k => lower.includes(k.replace(/\s+/g, '')))
  );

  if (matched.length === 0) return null;

  return matched
    .map(entry => `📌 [${entry.category}]\n${entry.content}`)
    .join('\n\n');
}

// ── 시간표 컨텍스트 ────────────────────────────────────────────
const DAYS_KR = ['월', '화', '수', '목', '금'];

const TIMETABLE_KEYWORDS = [
  '시간표', '수업시간', '오늘수업', '내수업', '강의시간',
  '몇시에', '수업있', '수업없', '강의실', '강의있', '요일수업',
];

export function isTimetableQuery(query: string): boolean {
  const lower = query.toLowerCase().replace(/\s+/g, '');
  return TIMETABLE_KEYWORDS.some(k => lower.includes(k));
}

export function formatTimetableContext(classesJson: string, query: string): string | null {
  try {
    const classes: Array<{
      name: string; room: string; professor: string;
      day: number; startTime: string; endTime: string;
    }> = JSON.parse(classesJson);
    if (!classes || classes.length === 0) return '📅 등록된 시간표가 없어요.';

    const lower = query.toLowerCase().replace(/\s+/g, '');
    const isToday = lower.includes('오늘') || lower.includes('today') || lower.includes('지금');
    const dayIdx = DAYS_KR.findIndex(d => lower.includes(d) && lower.includes('요일'));

    let targetDay: number | null = null;
    if (isToday) {
      const d = new Date().getDay(); // 1=월...5=금, 0=일, 6=토
      targetDay = d >= 1 && d <= 5 ? d - 1 : null;
    } else if (dayIdx !== -1) {
      targetDay = dayIdx;
    }

    const byDay: Record<number, typeof classes> = {};
    for (const c of classes) {
      if (!byDay[c.day]) byDay[c.day] = [];
      byDay[c.day].push(c);
    }

    const formatDay = (idx: number) => {
      const sorted = [...(byDay[idx] ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
      return sorted.map(c =>
        `  · ${c.startTime}~${c.endTime} ${c.name}` +
        (c.room ? ` (강의실: ${c.room})` : '') +
        (c.professor ? ` [${c.professor}교수]` : '')
      ).join('\n');
    };

    if (targetDay !== null) {
      const dayName = DAYS_KR[targetDay] ?? '';
      const list = byDay[targetDay] ?? [];
      if (list.length === 0) return `📅 ${dayName}요일은 수업이 없어요!`;
      return `📅 ${dayName}요일 수업:\n${formatDay(targetDay)}`;
    }

    const lines = [0, 1, 2, 3, 4]
      .filter(i => (byDay[i] ?? []).length > 0)
      .map(i => `${DAYS_KR[i]}요일:\n${formatDay(i)}`);
    return `📅 내 시간표 (전체):\n${lines.join('\n')}`;
  } catch {
    return null;
  }
}

// ── 커뮤니티 쿼리 감지 ────────────────────────────────────────
const COMMUNITY_KEYWORDS = [
  '커뮤니티', '게시글', '글있', '공지', '후기', '학우', '학생들', '게시판', '올라온', '올린글', '커뮤에',
];

export function isCommunityQuery(query: string): boolean {
  const lower = query.toLowerCase().replace(/\s+/g, '');
  return COMMUNITY_KEYWORDS.some(k => lower.includes(k));
}
