
-- ═════════════════════════════════════════════════════════════
-- STEP 4: FIX ACCOUNTS (edit the two emails below, then run)
-- ═════════════════════════════════════════════════════════════

-- 4a. Recreate a profile row for every existing sign-in account that lacks one
insert into profiles (id, full_name, phone, floor, apartment_number)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
       nullif(u.raw_user_meta_data->>'phone', ''),
       case when (u.raw_user_meta_data->>'floor') ~ '^(4|5|6|7|8|9|10)$'
            then (u.raw_user_meta_data->>'floor')::int end,
       nullif(u.raw_user_meta_data->>'apartment', '')
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

-- 4b. Make this email the OWNER / admin  (CHANGE THE EMAIL)
update profiles set role = 'OWNER', account_status = 'ACTIVE'
where id = (select id from auth.users where email = 'owner@gmail.com');

-- 4c. Approve this email as a RESIDENT  (CHANGE THE EMAIL, floor and apartment)
update profiles
set account_status = 'ACTIVE',
    floor = coalesce(floor, 6),
    apartment_number = coalesce(apartment_number, '604')
where id = (select id from auth.users where email = 'resident@gmail.com');

-- Check the result:
select u.email, p.role, p.account_status, p.floor, p.apartment_number
from profiles p join auth.users u on u.id = p.id;
