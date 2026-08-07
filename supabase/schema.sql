-- AndysEng: 학습 기록 저장용 스키마.
-- Supabase 대시보드 SQL Editor에 붙여넣어 1회 실행한다. (public/js/shared/supabase.js가 이 테이블을 사용한다)

create table if not exists public.andyseng_data (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.andyseng_data enable row level security;

create policy "select own data" on public.andyseng_data
  for select using (auth.uid() = user_id);

create policy "insert own data" on public.andyseng_data
  for insert with check (auth.uid() = user_id);

create policy "update own data" on public.andyseng_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 모든 유저에게 동일한 생성 콘텐츠(리딩 문제 세트·6min 문제 세트·사전 조회)의 공용 캐시.
-- 읽기는 완전히 공개하고(로그인 전에도 조회 가능), 쓰기는 로그인한 유저의 insert만 허용한다.
-- UPDATE/DELETE 정책을 두지 않는다 — 한 번 채워진 행은 누구도 고칠 수 없다(첫 생성자 승).
-- 이렇게 하면 캐시가 틀린 값으로 오염되거나 악의적으로 지워질 여지가 없다.
create table if not exists public.shared_sets (
  kind text not null,
  key text not null,
  payload jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (kind, key)
);

alter table public.shared_sets enable row level security;

create policy "read shared sets" on public.shared_sets
  for select to anon, authenticated using (true);

create policy "insert shared sets" on public.shared_sets
  for insert to authenticated with check (auth.uid() = created_by);
