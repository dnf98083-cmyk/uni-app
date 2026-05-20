-- ================================================================
-- Uni App - Supabase SQL 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 순서대로 실행하세요
-- ================================================================

-- ── 1. pgvector 확장 활성화 ─────────────────────────────────────
create extension if not exists vector;

-- ── 2. 게시글 임베딩 테이블 ─────────────────────────────────────
create table if not exists post_embeddings (
  post_id uuid primary key references posts(id) on delete cascade,
  embedding vector(768),
  updated_at timestamptz default now()
);

-- ── 3. 벡터 유사도 검색 함수 ────────────────────────────────────
create or replace function search_posts_by_embedding(
  query_embedding vector(768),
  match_count int default 8
)
returns table (
  post_id uuid,
  similarity float
)
language sql stable
as $$
  select
    pe.post_id,
    1 - (pe.embedding <=> query_embedding) as similarity
  from post_embeddings pe
  order by pe.embedding <=> query_embedding
  limit match_count;
$$;

-- ── 4. 프로필 테이블에 관리자 컬럼 추가 ─────────────────────────
alter table profiles add column if not exists is_admin boolean default false;

-- 관리자 계정 설정 (본인 이메일로 변경하세요)
-- update profiles set is_admin = true
-- where id = (select id from auth.users where email = 'kimwoorim81@gmail.com');

-- ── 5. 채팅방 테이블 ────────────────────────────────────────────
create table if not exists chat_rooms (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid references auth.users(id) on delete cascade not null,
  user2_id uuid references auth.users(id) on delete cascade not null,
  user1_nickname text default '',
  user2_nickname text default '',
  last_message text default '',
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint no_self_chat check (user1_id <> user2_id)
);

-- ── 6. 채팅 메시지 테이블 ───────────────────────────────────────
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references chat_rooms(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ── 7. RLS 정책 ─────────────────────────────────────────────────
alter table chat_rooms enable row level security;

drop policy if exists "chat_rooms_select" on chat_rooms;
create policy "chat_rooms_select" on chat_rooms
  for select using (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "chat_rooms_insert" on chat_rooms;
create policy "chat_rooms_insert" on chat_rooms
  for insert with check (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "chat_rooms_update" on chat_rooms;
create policy "chat_rooms_update" on chat_rooms
  for update using (auth.uid() = user1_id or auth.uid() = user2_id);

alter table chat_messages enable row level security;

drop policy if exists "chat_messages_select" on chat_messages;
create policy "chat_messages_select" on chat_messages
  for select using (
    exists (
      select 1 from chat_rooms
      where chat_rooms.id = chat_messages.room_id
      and (chat_rooms.user1_id = auth.uid() or chat_rooms.user2_id = auth.uid())
    )
  );

drop policy if exists "chat_messages_insert" on chat_messages;
create policy "chat_messages_insert" on chat_messages
  for insert with check (auth.uid() = sender_id);

drop policy if exists "chat_messages_update" on chat_messages;
create policy "chat_messages_update" on chat_messages
  for update using (
    exists (
      select 1 from chat_rooms
      where chat_rooms.id = chat_messages.room_id
      and (chat_rooms.user1_id = auth.uid() or chat_rooms.user2_id = auth.uid())
    )
  );

-- ── 8. post_embeddings RLS ──────────────────────────────────────
alter table post_embeddings enable row level security;

drop policy if exists "embeddings_select" on post_embeddings;
create policy "embeddings_select" on post_embeddings
  for select using (true);

drop policy if exists "embeddings_insert" on post_embeddings;
create policy "embeddings_insert" on post_embeddings
  for insert with check (true);

drop policy if exists "embeddings_update" on post_embeddings;
create policy "embeddings_update" on post_embeddings
  for update using (true);

-- ── 9. 실시간 구독 활성화 ───────────────────────────────────────
-- Supabase 대시보드 > Database > Replication 에서
-- chat_messages, chat_rooms 테이블 활성화 필요

-- ── 10. 친구 테이블 ─────────────────────────────────────────────
create table if not exists friends (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) on delete cascade not null,
  addressee_id uuid references auth.users(id) on delete cascade not null,
  status text not null default 'pending', -- 'pending' | 'accepted'
  created_at timestamptz default now(),
  constraint no_self_friend check (requester_id <> addressee_id),
  constraint unique_friendship unique (requester_id, addressee_id)
);

alter table friends enable row level security;

drop policy if exists "friends_select" on friends;
create policy "friends_select" on friends
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friends_insert" on friends;
create policy "friends_insert" on friends
  for insert with check (auth.uid() = requester_id);

drop policy if exists "friends_update" on friends;
create policy "friends_update" on friends
  for update using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friends_delete" on friends;
create policy "friends_delete" on friends
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ── 완료 ────────────────────────────────────────────────────────
-- ※ 앱에서 아이디 'dnf826', 비밀번호 '0000' 으로 회원가입 후 아래 SQL 실행:
-- update profiles set is_admin = true
-- where id = (select id from auth.users where email = 'dnf826@uni.app');
--
-- ※ 일반 이메일로 가입한 경우:
-- update profiles set is_admin = true
-- where id = (select id from auth.users where email = '본인이메일@example.com');
