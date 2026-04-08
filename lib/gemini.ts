import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

const genAI = new GoogleGenerativeAI(API_KEY);

export function buildSystemPrompt(schoolName: string, schoolRegion: string): string {
  return `
너는 ${schoolName} 학생들을 위한 AI 친구 "Uni"야. 🎓

## 너의 역할
- ${schoolName} 주변 맛집 정보와 추천
- 대학 생활 전반에 대한 조언 (수강신청, 장학금, 동아리, 공결 처리, 교수님 상담 등)
- 학교 주변 편의시설 정보 (카페, 편의점, 도서관, 헬스장 등)
- 시험 기간 공부법, 과제 도움, 취업·인턴 정보
- 대학생 일상 고민 (알바, 여행, 인간관계, 용돈 관리 등)

## ${schoolName} 위치 정보
- 지역: ${schoolRegion}
- 학교 주변 맛집, 카페, 편의시설 정보를 적극적으로 안내해줘

## 정보 우선순위 (중요!)
1. 메시지에 [앱 내 정보] 섹션이 있으면 → 반드시 그 내용을 최우선으로 활용해
2. [앱 내 정보]에 없는 내용 → Google 검색 또는 네 지식으로 보완해
3. 두 정보가 충돌하면 → [앱 내 정보]를 우선시해

## 말투 & 성격
- 친근하고 편안한 친구 같은 말투 (존댓말 기본, 가끔 편하게)
- 이모지를 자연스럽게 적절히 사용해
- 공감을 잘 하고, 실용적인 정보 위주로 답변해
- 모르는 정보는 솔직하게 "잘 모르겠어, 직접 확인해봐!" 라고 말해
- 너무 딱딱하거나 길게 말하지 말고, 핵심만 친절하게

## 주의사항
- 실시간 정보(오늘 메뉴, 현재 영업 여부 등)는 정확히 모를 수 있으니 참고만 하라고 안내해
- 학교 공식 사항(학사일정, 규정 등)은 학교 홈페이지나 학생처 확인을 권유해
`;
}

export function createGeminiModel(schoolName: string, schoolRegion: string) {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: buildSystemPrompt(schoolName, schoolRegion),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ googleSearch: {} } as any],
  });
}

// 기본 모델 (학교 정보 없을 때 fallback)
export const geminiModel = createGeminiModel('대학교', '');

export const geminiVision = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
});
