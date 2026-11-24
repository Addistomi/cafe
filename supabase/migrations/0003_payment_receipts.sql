-- Telebirr receipt submission (Phase: resident screenshot intake).
-- Screenshots are stored in a private bucket. Only trusted server code uses service_role
-- to upload and create signed links; residents cannot mark payments as successful.

alter table public.payments
  add column if not exists receipt_reference text,
  add column if not exists receipt_storage_path text;

create unique index if not exists payments_receipt_reference_unique
  on public.payments (lower(trim(receipt_reference)))
  where receipt_reference is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- No browser storage policies are added: uploads and signed reads happen on the
-- authenticated Next.js server after checking the resident/manager role.
