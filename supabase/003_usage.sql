-- Claude API 키 중앙화(Edge Function claude-proxy)를 위한 유저별 하루 사용량 집계.
-- 002_approval.sql 다음에 SQL Editor에서 실행한다. schema.sql/002는 그대로 둔다.
--
-- 이 테이블에는 SELECT(본인 행만) 정책만 두고 INSERT/UPDATE 정책을 아예 만들지 않는다.
-- 즉 authenticated/anon 롤로는 절대 쓸 수 없고, service_role(Edge Function 안에서만 씀,
-- bypassrls)만 쓸 수 있다 — 클라이언트가 자기 사용량을 조작해 한도를 우회할 수 없게 하기 위해서다.
-- profiles/andyseng_data와 같은 "쓰기는 특권 롤만" 패턴.

create table public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  cost_usd numeric not null default 0,
  primary key (user_id, day)
);

alter table public.usage_daily enable row level security;

create policy "read own usage" on public.usage_daily
  for select to authenticated
  using (user_id = auth.uid());
