-- AndysEng: 관리자 승인제 가입.
-- schema.sql은 그대로 두고 이 파일을 이어서 실행하는 마이그레이션이다.
-- SQL Editor에서 postgres 롤로, [1] → [2] → (검증 쿼리로 눈으로 확인) → [3] 순서로 나눠 실행할 것.
--
-- 전제: Supabase 대시보드 Authentication → Settings에서 "Confirm email"이 꺼져 있어야 한다.
-- 닉네임을 가짜 이메일(@andyseng.internal)로 쓰기 때문에 확인 메일은 영원히 도착하지 않는다 —
-- 켜져 있으면 /signup이 세션을 안 주고 이 파일의 profiles INSERT가 그 자리에서 401 난다.

-- ============================== [1] profiles ==============================

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  -- 닉네임은 신청자가 자유롭게 적는 값이 아니라 계정 이메일의 로컬파트다(아래 INSERT 정책이 강제).
  -- 자유 입력을 허용하면 신청자가 남의 닉네임을 적어 관리자를 속일 수 있다.
  nickname text not null unique check (char_length(nickname) between 1 and 64),
  note text check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.profiles enable row level security;
-- ⚠️ "alter table ... force row level security"는 절대 켜지 말 것 — 아래 SECURITY DEFINER
-- 함수가 테이블 소유자 권한으로 재귀를 끊는데, force를 켜면 소유자에게도 RLS가 걸려 도로 재귀한다.

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
revoke delete on public.profiles from authenticated;
-- DELETE를 허용하지 않는다 — 거절된 신청자가 자기 행을 지우고 다시 pending으로 재신청하는 길을 막는다.
-- 실제 삭제가 필요하면 service_role(scripts/db.js)로 한다.

-- profiles의 정책이 profiles를 다시 읽으면 "infinite recursion detected in policy for relation
-- profiles" 에러가 난다. SECURITY DEFINER 함수는 본문을 소유자(postgres) 권한으로 실행하고,
-- 테이블 소유자는 RLS를 우회하므로 이 고리가 끊긴다. search_path를 비워 모든 이름을 스키마까지
-- 붙여 쓰게 강제한다(함수 안에서 이름 충돌로 엉뚱한 오브젝트를 읽는 것을 막는다).
create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.status = 'approved'
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.status = 'approved' and p.is_admin
  );
$$;

alter function public.is_approved() owner to postgres;
alter function public.is_admin() owner to postgres;
revoke execute on function public.is_approved() from public;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_approved() to authenticated;
grant execute on function public.is_admin() to authenticated;
-- ↑ anon에는 EXECUTE를 안 줬으므로, 이 함수를 쓰는 정책은 반드시 `to authenticated`여야 한다.

-- 본인 행은 언제나 읽을 수 있어야 한다("승인 대기 중" 화면이 자기 status를 읽는다). 관리자는 전체를 읽는다.
create policy "read own or all if admin" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- 가입 신청. 자기 행만, 반드시 pending으로, 관리자 자칭 불가, 닉네임은 계정 이메일에서 파생된 값과 일치.
create policy "apply for own profile" on public.profiles
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and is_admin = false
    and reviewed_at is null
    and nickname = split_part((select auth.jwt() ->> 'email'), '@', 1)
  );

-- 심사는 관리자만. with check의 뒷부분은 관리자가 실수로 자기 행을 강등/거절해
-- 앱 안에서 복구 불가능하게 스스로를 잠가버리는 사고를 막는다.
create policy "admins review" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (
    public.is_admin()
    and (user_id <> (select auth.uid()) or (is_admin and status = 'approved'))
  );

-- ============================== [2] 백필 — [3] 전에 반드시 ==============================
-- scripts/db.js로는 못 한다 — PostgREST가 auth 스키마를 노출하지 않는다. SQL Editor를 쓴다.

insert into public.profiles (user_id, nickname, status, reviewed_at)
select u.id, split_part(u.email, '@', 1), 'approved', now()
from auth.users u
on conflict (user_id) do nothing;

update public.profiles set is_admin = true where nickname = 'andy';

-- 검증: users == approved 이고 admins == 1 이어야 [3]으로 넘어간다.
select
  (select count(*) from auth.users)                                as users,
  (select count(*) from public.profiles where status = 'approved') as approved,
  (select count(*) from public.profiles where is_admin)            as admins;

-- ============================== [3] 기존 테이블 조이기 ==============================
-- 기존 정책은 손대지 않는다. PERMISSIVE 정책끼리는 OR로 합쳐지므로, "승인된 경우만"을 새
-- PERMISSIVE 정책으로 추가하면 조여지기는커녕 오히려 넓어진다. RESTRICTIVE만 기존 정책과
-- AND로 묶인다. 되돌리기도 각각 `drop policy "approved users only" on ...;` 한 줄이라
-- 기존 정책을 rewrite하는 것보다 안전하다.

create policy "approved users only" on public.andyseng_data
  as restrictive for all to authenticated
  using (public.is_approved())
  with check (public.is_approved());

-- shared_sets는 로그인 전 anon 읽기가 공개다. for all로 걸면 그 공개 읽기까지 막히므로
-- INSERT에만 건다.
create policy "approved users only" on public.shared_sets
  as restrictive for insert to authenticated
  with check (public.is_approved());
