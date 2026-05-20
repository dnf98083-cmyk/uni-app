# Uni ✦ — 신구대학교 AI 커뮤니티 앱

대학생을 위한 AI 기반 캠퍼스 커뮤니티 앱. 게시글·댓글·실시간 채팅·AI 검색·시간표·맛집 지도를 하나의 앱에서 제공합니다.

---

## 기술 스택

### 프론트엔드
| 기술 | 버전 | 용도 |
|---|---|---|
| React Native | 0.79 | iOS / Android / Web 크로스플랫폼 |
| Expo | ~54.0.33 | 빌드 툴체인, 네이티브 API |
| expo-router | ~4.x | 파일 기반 라우팅 (타입드 라우트) |
| TypeScript | 5.x | 타입 안전성 |
| react-native-web | ~0.21 | 웹 브라우저 지원 |
| react-native-reanimated | ~4.x | 애니메이션 |

### 백엔드 / 데이터베이스
| 기술 | 용도 |
|---|---|
| Supabase (PostgreSQL) | 메인 DB — 게시글, 댓글, 프로필, 채팅, 친구 |
| Supabase Auth | 이메일 / 아이디 로그인, 세션 관리 |
| Supabase Realtime | 채팅 메시지 실시간 구독 (WebSocket) |
| Supabase RLS | 테이블별 행 수준 보안 정책 |
| pgvector (extension) | 768차원 벡터 저장 (AI 유사도 검색) |

### AI
| 기술 | 용도 |
|---|---|
| Google Gemini 2.5 Flash Lite | AI 챗봇, 시간표 자동 파싱 |
| Google text-embedding-004 | 게시글 임베딩 벡터 생성 |
| RAG (Retrieval-Augmented Generation) | 커뮤니티 게시글 AI 의미 기반 검색 |

### 지도 / 외부 API
| 기술 | 용도 |
|---|---|
| Kakao Map SDK | 학교 주변 맛집 지도 렌더링 |
| Kakao Local API | 장소 검색 |

### 배포
| 기술 | 용도 |
|---|---|
| Netlify | GitHub 연동 자동 배포 (main 브랜치 푸시 시 자동 업데이트) |
| expo export --platform web | 정적 웹 빌드 (`dist/` 생성) |

---

## 주요 기능

- **커뮤니티** — 탭별 게시판 (자유/질문/정보/익명), 댓글·대댓글, 좋아요
- **AI 검색** — pgvector 벡터 유사도 검색 + Supabase ilike 폴백
- **실시간 채팅** — 1:1 채팅방, 읽음 표시, Supabase Realtime 구독
- **친구 시스템** — 친구 요청/수락/거절, 게시글 작성자 프로필 모달
- **시간표** — Gemini AI 자동 파싱, 드래그 편집
- **맛집 지도** — Kakao Map 기반 학교 주변 맛집 등록·리뷰
- **관리자 페이지** — 게시글·댓글·사용자 관리, 계정 정지/해제, 통계 대시보드

---

## 환경 변수

`.env` 파일을 프로젝트 루트에 생성하세요:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-key
EXPO_PUBLIC_KAKAO_REST_API_KEY=your-kakao-rest-key
EXPO_PUBLIC_KAKAO_JS_KEY=your-kakao-js-key
```

> Netlify 배포 시 **Site configuration → Environment variables**에 동일하게 추가해야 합니다.

---

## Supabase 마이그레이션

`supabase_migrations.sql` 파일을 **Supabase 대시보드 → SQL Editor**에서 순서대로 실행하세요.

| 섹션 | 내용 |
|---|---|
| 1~3 | pgvector, post_embeddings 테이블, 벡터 검색 함수 |
| 4 | profiles.is_admin 컬럼 추가 |
| 5~8 | chat_rooms, chat_messages 테이블 + RLS |
| 9 | Realtime 활성화 (대시보드 수동 설정 필요) |
| 10 | friends 테이블 + RLS |
| 11 | is_admin() 헬퍼 함수 (security definer) |
| 12 | profiles.is_banned 컬럼 추가 |
| 13~15 | 관리자 RLS 우회 정책 (posts/comments/profiles 삭제·수정 권한) |

관리자 계정 설정:
```sql
update profiles set is_admin = true
where id = (select id from auth.users where email = '본인이메일@example.com');
```

---

## 로컬 실행

```bash
npm install
npx expo start            # 개발 서버 (QR 코드 → Expo Go 앱)
npx expo start --web      # 웹 브라우저 실행
npx expo export --platform web  # 웹 정적 빌드 (dist/ 생성)
```

---

## 트러블슈팅

### `supabaseUrl is required` 빌드 오류
**원인**: 빌드 환경에 `EXPO_PUBLIC_SUPABASE_URL`이 없음  
**해결**:
- 로컬: `.env` 파일 확인
- Netlify: Site configuration → Environment variables에 추가 후 재배포

---

### 관리자가 삭제해도 게시물이 유지됨
**원인**: Supabase RLS가 관리자 권한 없이 삭제를 차단 — 에러 없이 0건 처리  
**해결**: Supabase SQL Editor에서 실행:

```sql
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select is_admin from profiles where id = auth.uid()), false); $$;

drop policy if exists "posts_admin_delete" on posts;
create policy "posts_admin_delete" on posts for delete using (is_admin());

drop policy if exists "comments_admin_delete" on comments;
create policy "comments_admin_delete" on comments for delete using (is_admin());
```

---

### 아이디로 로그인이 안 됨
**원인**: `@` 없이 입력 시 자동으로 `@uni.app` 이 붙음  
**예시**: `dnf826` 입력 → 실제 이메일 `dnf826@uni.app`  
**해결**: 회원가입 시 사용한 형식과 동일하게 입력 (`dnf826` 또는 `dnf826@uni.app`)

---

### `ERR_NAME_NOT_RESOLVED` — Supabase 연결 불가
**원인**: Supabase 무료 플랜은 7일 미사용 시 프로젝트 자동 일시정지  
**해결**: Supabase 대시보드 → 프로젝트 선택 → **Restore** 버튼 클릭

---

### 사용자 목록이 비어 있음 (관리자 사용자 관리 페이지)
**원인**: `is_banned` 컬럼이 아직 DB에 없어 쿼리 실패 → 폴백 쿼리로 자동 처리됨  
**해결**: `supabase_migrations.sql` 12번 섹션 실행:

```sql
alter table profiles add column if not exists is_banned boolean default false;
```

---

### 웹에서 삭제 확인창이 안 뜸
**원인**: React Native Web에서 `Alert.alert` 중첩 불가  
**해결**: 코드에서 `Platform.OS === 'web'` 분기로 `window.confirm` 직접 호출 (이미 적용됨)

---

### Expo 타입드 라우트 에러 (`Route ... is not defined`)
**원인**: 새 파일 추가 후 expo-router 타입이 아직 자동 생성 안 됨  
**해결**: `npx expo start` 실행 후 타입 자동 재생성, 또는 라우트에 `as any` 캐스트 임시 사용

---

## 프로젝트 구조

```
app/
├── (tabs)/              # 메인 탭 (홈, 커뮤니티, 맛집, 검색, 채팅, 프로필)
├── admin/               # 관리자 (대시보드, 사용자, 게시글, 댓글)
├── chat/[roomId].tsx    # 1:1 채팅방
├── onboarding/          # 회원가입 플로우
└── login.tsx            # 로그인

lib/
├── supabase.ts          # Supabase 클라이언트
├── embedding.ts         # Gemini 임베딩 + pgvector 검색
└── chat.ts              # 채팅방 생성 유틸

components/
└── Sidebar.tsx          # 사이드바 네비게이션
```
