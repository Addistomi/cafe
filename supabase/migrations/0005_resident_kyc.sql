-- Resident KYC and private identity-document storage.
-- Apply after 0004_telebirr_receipt_verification.sql.

do $$ begin
  create type resident_kyc_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null;
end $$;

create table if not exists resident_kyc (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  email text not null,
  legal_name text not null,
  date_of_birth date not null,
  nationality text not null,
  resident_type text not null check (resident_type in ('OWNER', 'TENANT', 'FAMILY_MEMBER', 'EMPLOYEE')),
  id_document_type text not null check (id_document_type in ('FAYDA', 'KEBELE_ID', 'PASSPORT', 'DRIVER_LICENSE', 'OTHER')),
  id_document_last4 text not null check (id_document_last4 ~ '^[A-Za-z0-9]{2,4}$'),
  id_front_storage_path text not null,
  id_back_storage_path text,
  residence_proof_storage_path text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  status resident_kyc_status not null default 'PENDING',
  review_note text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resident_kyc_status_created on resident_kyc(status, created_at desc);

create or replace function is_manager() returns boolean
language sql stable security definer set search_path = public as $manager$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('OWNER', 'MANAGER') and account_status = 'ACTIVE'
  );
$manager$;

revoke all on function is_manager() from public, anon;
grant execute on function is_manager() to authenticated;

alter table resident_kyc enable row level security;
drop policy if exists "resident reads own kyc or staff" on resident_kyc;
drop policy if exists "resident reads own kyc or managers" on resident_kyc;
create policy "resident reads own kyc or managers" on resident_kyc
  for select to authenticated using (user_id = auth.uid() or is_manager());

revoke all on table resident_kyc from public, anon, authenticated;
grant select on table resident_kyc to authenticated;
grant all privileges on table resident_kyc to service_role;

-- Identity documents are private. All uploads and signed-link generation happen
-- in server actions/pages after checking the signed-in user's role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resident-kyc',
  'resident-kyc',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf'];

create or replace function review_resident_kyc(
  p_user_id uuid,
  p_decision text,
  p_reason text,
  p_actor uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status resident_kyc_status;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'INVALID_KYC_DECISION';
  end if;

  if not exists (
    select 1 from profiles
    where id = p_actor and role in ('OWNER', 'MANAGER') and account_status = 'ACTIVE'
  ) then
    raise exception 'MANAGER_REQUIRED';
  end if;

  if p_decision = 'REJECTED' and coalesce(trim(p_reason), '') = '' then
    raise exception 'REJECTION_REASON_REQUIRED';
  end if;

  select status into v_status
  from resident_kyc
  where user_id = p_user_id
  for update;

  if not found then raise exception 'KYC_APPLICATION_NOT_FOUND'; end if;
  if v_status <> 'PENDING' then raise exception 'KYC_APPLICATION_NOT_PENDING'; end if;

  update resident_kyc
  set status = p_decision::resident_kyc_status,
      review_note = case when p_decision = 'REJECTED' then trim(p_reason) else null end,
      reviewed_by = p_actor,
      reviewed_at = now(),
      updated_at = now()
  where user_id = p_user_id;

  update profiles
  set account_status = case when p_decision = 'APPROVED' then 'ACTIVE'::account_status else 'PENDING'::account_status end,
      updated_at = now()
  where id = p_user_id and role = 'CUSTOMER';

  if not found then raise exception 'RESIDENT_PROFILE_NOT_FOUND'; end if;
end;
$$;

revoke execute on function review_resident_kyc(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function review_resident_kyc(uuid, text, text, uuid) to service_role;
