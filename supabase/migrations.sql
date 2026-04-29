-- ================================================================
-- Uni App - DB 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ================================================================

-- 1. 게시글 테이블
create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  tab text not null default '자유',
  title text not null,
  body text not null,
  author_id uuid references auth.users(id) on delete set null,
  author_nickname text not null default '학생',
  is_anonymous boolean not null default false,
  likes integer not null default 0,
  created_at timestamptz default now()
);

alter table posts enable row level security;

create policy "Anyone can view posts"
  on posts for select using (true);

create policy "Authenticated users can insert posts"
  on posts for insert
  with check (auth.role() = 'authenticated');

create policy "Anyone can update post likes"
  on posts for update using (true);

-- ----------------------------------------------------------------

-- 2. 댓글 테이블
create table if not exists comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  author_id uuid references auth.users(id) on delete set null,
  author_nickname text not null default '학생',
  body text not null,
  created_at timestamptz default now()
);

alter table comments enable row level security;

create policy "Anyone can view comments"
  on comments for select using (true);

create policy "Authenticated users can insert comments"
  on comments for insert
  with check (auth.role() = 'authenticated');

-- 댓글 좋아요/답글 컬럼 추가 (이미 테이블 있으면 이 부분만 실행)
alter table comments add column if not exists likes integer not null default 0;
alter table comments add column if not exists parent_id uuid references comments(id) on delete cascade;

-- ----------------------------------------------------------------

-- 3. 댓글 좋아요 테이블
create table if not exists comment_likes (
  comment_id uuid references comments(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  primary key (comment_id, user_id)
);

alter table comment_likes enable row level security;

create policy "Authenticated users can view comment likes"
  on comment_likes for select
  using (auth.role() = 'authenticated');

create policy "Users can insert own comment likes"
  on comment_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own comment likes"
  on comment_likes for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------

-- 4. 게시글 좋아요 테이블
create table if not exists post_likes (
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

alter table post_likes enable row level security;

create policy "Authenticated users can view likes"
  on post_likes for select
  using (auth.role() = 'authenticated');

create policy "Users can insert own likes"
  on post_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own likes"
  on post_likes for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------

-- 2. 시간표 테이블
create table if not exists user_timetables (
  user_id uuid references auth.users(id) on delete cascade primary key,
  classes jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

alter table user_timetables enable row level security;

create policy "Users can manage own timetable"
  on user_timetables for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------

-- 3. 유저 프로필 테이블
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nickname text,
  school_name text,
  school_region text,
  school_emoji text default '🏫',
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Anyone can view profiles"
  on profiles for select
  using (true);

create policy "Users can manage own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 회원가입 시 자동으로 profiles 행 생성하는 트리거
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, new.raw_user_meta_data->>'nickname')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
