-- 004: 관리자 로그인 아이디를 admin으로 (2026-11-12)
-- 앱 로그인 화면은 '@'가 없는 아이디에 '@rumble-strip.test'를 붙여 로그인한다.
-- 그래서 로그인 이메일을 admin@rumble-strip.test로 바꾸면 아이디 칸에 admin만 쳐도 된다.
-- 비밀번호는 그대로다. .test 주소는 메일을 받을 수 없어 비밀번호 찾기 메일은 오지 않는다
-- (비밀번호를 잊으면 Supabase → Authentication → Users에서 직접 바꾼다).

-- 바꿀 계정의 지금 이메일이 'asd@asd.com'이 아니면 아래 두 곳을 고쳐서 실행한다.
update auth.users
set email = 'admin@rumble-strip.test', updated_at = now()
where email = 'asd@asd.com';

update auth.identities
set identity_data = jsonb_set(identity_data, '{email}', to_jsonb('admin@rumble-strip.test'::text)),
    updated_at = now()
where provider = 'email' and identity_data ->> 'email' = 'asd@asd.com';

-- 확인: admin@rumble-strip.test 한 줄이 나오고 is_admin이 true면 성공
select u.email, s.name, s.role, s.is_admin
from auth.users u left join public.staff s on s.id = u.id
where u.email = 'admin@rumble-strip.test';
