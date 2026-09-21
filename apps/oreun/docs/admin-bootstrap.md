# R1 첫 관리자 부트스트랩

이 절차는 **실제 사용자가 오름의 Google 로그인으로 계정을 만든 뒤, 만 14세 이상 확인을 완료한 경우에만** 사용한다. 기존 이메일 계정은 로그인 fallback으로만 유지한다.
관리자 계정, 이메일, 비밀번호를 임의로 만들지 않는다.

## 사전 조건

1. `auth.users`에 대상 사용자가 실제로 존재한다.
2. 가입 트리거가 `public.profiles`, `private.user_status`, `private.user_roles`를 생성했다.
3. `private.user_status.age_confirmed_14_plus = true`다.
4. 대상 UUID를 운영자가 직접 확인했다.
5. 기존 활성 admin이 있는 경우 자동 승격하지 않고 운영자가 명시적으로 결정한다.

## 확인 쿼리

```sql
select
  u.id,
  u.created_at,
  s.status,
  s.age_confirmed_14_plus,
  r.role
from auth.users u
left join private.user_status s on s.user_id = u.id
left join private.user_roles r on r.user_id = u.id
order by u.created_at asc;
```

## 첫 admin 승격

아래 `<USER_UUID>`는 위 확인 쿼리에서 운영자가 직접 확인한 UUID로만 교체한다.

```sql
begin;

do $$
declare
  v_user_id uuid := '<USER_UUID>'::uuid;
  v_active_admins integer;
begin
  if not exists (
    select 1 from auth.users where id = v_user_id
  ) then
    raise exception 'R1 admin bootstrap: auth user does not exist';
  end if;

  if not exists (
    select 1
    from private.user_status
    where user_id = v_user_id
      and status = 'active'
      and age_confirmed_14_plus = true
  ) then
    raise exception 'R1 admin bootstrap: user must be active and age-confirmed';
  end if;

  select count(*)
  into v_active_admins
  from private.user_roles r
  join private.user_status s using (user_id)
  where r.role = 'admin'
    and s.status = 'active'
    and r.user_id <> v_user_id;

  if v_active_admins > 0 then
    raise exception 'R1 admin bootstrap: another active admin already exists';
  end if;

  update private.user_roles
  set role = 'admin',
      updated_at = now()
  where user_id = v_user_id;

  if not found then
    raise exception 'R1 admin bootstrap: role row missing';
  end if;
end
$$;

commit;
```

## 검증

```sql
select
  r.user_id,
  r.role,
  s.status,
  s.age_confirmed_14_plus
from private.user_roles r
join private.user_status s using (user_id)
where r.role = 'admin'
  and s.status = 'active';
```

기대값은 첫 부트스트랩 시 정확히 1행이다.

이후 실제 브라우저에서 다음 순서를 검증한다.

1. 관리자 계정 로그인
2. `/me`에서 role이 admin으로 표시되는지 확인
3. `/admin/content` 접근
4. 공식 출처 1건 등록
5. 테스트 가이드 draft 저장
6. pending 검토 요청
7. approved 승인
8. published 공개
9. 내용 수정 시 review 상태가 다시 잠기는지 확인
10. 테스트 행은 검증 후 archive 처리

## 롤백

잘못된 계정을 승격한 경우 대상 UUID를 다시 확인한 뒤:

```sql
update private.user_roles
set role = 'user',
    updated_at = now()
where user_id = '<USER_UUID>'::uuid;
```

승격 과정에서 비밀번호, 세션 토큰, Roblox 자격증명은 다루지 않는다.
