-- Fana Cafe — core schema (Phases 1–4 slice). Run in Supabase SQL editor or `supabase db push`.
-- Money = numeric(12,2). Stock quantities = numeric(12,3). Timestamps = timestamptz (UTC).

create type user_role      as enum ('CUSTOMER','OWNER','MANAGER','KITCHEN');
create type account_status as enum ('PENDING','ACTIVE','SUSPENDED');
create type order_status   as enum ('PENDING_ACCEPTANCE','ACCEPTED','AWAITING_PAYMENT','PREPARING','READY',
                                    'OUT_FOR_DELIVERY','DELIVERED','REJECTED','CANCELLED','EXPIRED');
create type payment_status as enum ('PENDING','SUCCESS','FAILED','EXPIRED','REFUND_PENDING','REFUNDED');
create type reservation_status as enum ('RESERVED','CONSUMED','RELEASED');
create type movement_type  as enum ('PURCHASE','CONSUMPTION','WASTAGE','ADJUSTMENT_IN','ADJUSTMENT_OUT','RETURN');
create type base_unit      as enum ('GRAM','MILLILITRE','PIECE');

-- ───────── People ─────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text unique,
  role user_role not null default 'CUSTOMER',
  account_status account_status not null default 'PENDING',
  floor int check (floor between 4 and 10),
  apartment_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone, floor, apartment_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'floor', '')::int,
    nullif(new.raw_user_meta_data->>'apartment', '')
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
    where id = auth.uid() and role in ('OWNER','MANAGER','KITCHEN') and account_status = 'ACTIVE');
$$;

-- ───────── Menu & recipes ─────────
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_unit base_unit not null,
  on_hand_quantity numeric(12,3) not null default 0 check (on_hand_quantity >= 0),
  minimum_stock_quantity numeric(12,3) not null default 0 check (minimum_stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table meals (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  name text not null,
  slug text not null unique,
  description text,
  base_price numeric(12,2) not null check (base_price > 0),
  image_url text,
  is_available boolean not null default true,
  preparation_minutes int,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  quantity_per_serving numeric(12,3) not null check (quantity_per_serving > 0),
  is_removable boolean not null default false,
  unique (meal_id, ingredient_id)
);

create table meal_addons (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals(id) on delete cascade,
  name text not null,
  additional_price numeric(12,2) not null check (additional_price >= 0),
  ingredient_id uuid references ingredients(id),
  quantity numeric(12,3) check (quantity > 0),
  is_available boolean not null default true
);

-- ───────── Orders ─────────
create sequence order_seq;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    default 'FANA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_seq')::text, 6, '0'),
  customer_id uuid not null references profiles(id),
  status order_status not null default 'PENDING_ACCEPTANCE',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  currency text not null default 'ETB',
  customer_name_snapshot text not null,
  phone_snapshot text,
  floor_snapshot int not null check (floor_snapshot between 4 and 10),
  apartment_snapshot text not null,
  note text,
  accepted_by uuid references profiles(id),
  accepted_at timestamptz,
  reservation_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_created on orders (status, created_at);
create index orders_customer_created on orders (customer_id, created_at);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  meal_id uuid references meals(id),
  meal_name_snapshot text not null,
  unit_price_snapshot numeric(12,2) not null,
  quantity int not null check (quantity > 0),
  line_total numeric(12,2) not null,
  note text
);

create table order_item_ingredients (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id),
  ingredient_id uuid references ingredients(id),
  ingredient_name_snapshot text not null,
  quantity_per_serving_snapshot numeric(12,3) not null,
  total_quantity numeric(12,3) not null,
  was_removed boolean not null default false,
  source_type text not null check (source_type in ('RECIPE','ADDON'))
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  from_status order_status,
  to_status order_status not null,
  reason text,
  changed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  provider text not null default 'TELEBIRR',
  merchant_order_id text not null unique,
  transaction_id text unique,
  amount numeric(12,2) not null,
  currency text not null default 'ETB',
  status payment_status not null default 'PENDING',
  signature_verified boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_order_status on payments (order_id, status);

-- ───────── Inventory ─────────
create table inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  ingredient_id uuid not null references ingredients(id),
  quantity numeric(12,3) not null check (quantity > 0),
  status reservation_status not null default 'RESERVED',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, ingredient_id)
);
create index reservations_status_expiry on inventory_reservations (status, expires_at);

-- Append-only ledger: no update/delete policies exist and the trigger below blocks them.
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id),
  movement_type movement_type not null,
  quantity numeric(12,3) not null check (quantity > 0),
  direction text not null check (direction in ('IN','OUT')),
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index movements_ingredient_created on inventory_movements (ingredient_id, created_at);

create function forbid_ledger_change() returns trigger language plpgsql as $$
begin raise exception 'inventory_movements is append-only'; end $$;
create trigger movements_append_only before update or delete on inventory_movements
  for each row execute function forbid_ledger_change();

create view ingredient_stock with (security_invoker = true) as
select i.*,
  coalesce(r.reserved, 0) as reserved_quantity,
  i.on_hand_quantity - coalesce(r.reserved, 0) as available_quantity
from ingredients i
left join (
  select ingredient_id, sum(quantity) as reserved
  from inventory_reservations where status = 'RESERVED' group by ingredient_id
) r on r.ingredient_id = i.id;

-- ───────── Business functions (called only from the server with the service role) ─────────

-- Creates the order and every snapshot row in one transaction. Prices are computed by the app server.
create function create_order(p_customer uuid, p_order jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order uuid; v_item uuid; it jsonb; ing jsonb; p profiles;
begin
  select * into p from profiles where id = p_customer;
  if p.id is null or p.role <> 'CUSTOMER' or p.account_status <> 'ACTIVE' then
    raise exception 'ACCOUNT_NOT_APPROVED';
  end if;

  insert into orders (customer_id, subtotal, delivery_fee, total_amount, customer_name_snapshot,
                      phone_snapshot, floor_snapshot, apartment_snapshot, note)
  values (p_customer, (p_order->>'subtotal')::numeric, (p_order->>'delivery_fee')::numeric,
          (p_order->>'total')::numeric, p.full_name, p.phone,
          (p_order->>'floor')::int, p_order->>'apartment', nullif(p_order->>'note', ''))
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_order->'items') loop
    insert into order_items (order_id, meal_id, meal_name_snapshot, unit_price_snapshot, quantity, line_total, note)
    values (v_order, (it->>'meal_id')::uuid, it->>'meal_name', (it->>'unit_price')::numeric,
            (it->>'quantity')::int, (it->>'line_total')::numeric, nullif(it->>'note', ''))
    returning id into v_item;

    for ing in select * from jsonb_array_elements(it->'ingredients') loop
      insert into order_item_ingredients (order_item_id, ingredient_id, ingredient_name_snapshot,
        quantity_per_serving_snapshot, total_quantity, was_removed, source_type)
      values (v_item, (ing->>'ingredient_id')::uuid, ing->>'name', (ing->>'per_serving')::numeric,
              (ing->>'total')::numeric, (ing->>'removed')::boolean, ing->>'source');
    end loop;
  end loop;

  insert into order_status_history (order_id, to_status, changed_by) values (v_order, 'PENDING_ACCEPTANCE', p_customer);
  return v_order;
end $$;

-- Reserve stock atomically. Ingredients are locked in id order so concurrent accepts cannot deadlock or oversell.
create function accept_order(p_order uuid, p_actor uuid, p_hold_minutes int default 30) returns void
language plpgsql security definer set search_path = public as $$
declare o orders; need record; avail numeric; v_expiry timestamptz := now() + make_interval(mins => p_hold_minutes);
begin
  select * into o from orders where id = p_order for update;
  if o.status <> 'PENDING_ACCEPTANCE' then raise exception 'ORDER_NOT_PENDING'; end if;

  for need in
    select oii.ingredient_id, sum(oii.total_quantity) as qty
    from order_item_ingredients oii join order_items oi on oi.id = oii.order_item_id
    where oi.order_id = p_order and not oii.was_removed and oii.ingredient_id is not null
    group by oii.ingredient_id order by oii.ingredient_id
  loop
    perform 1 from ingredients where id = need.ingredient_id for update;
    select s.available_quantity into avail from ingredient_stock s where s.id = need.ingredient_id;
    if avail < need.qty then
      raise exception 'INSUFFICIENT_STOCK: % (need %, have %)',
        (select name from ingredients where id = need.ingredient_id), need.qty, avail;
    end if;
    insert into inventory_reservations (order_id, ingredient_id, quantity, expires_at)
    values (p_order, need.ingredient_id, need.qty, v_expiry);
  end loop;

  update orders set status = 'AWAITING_PAYMENT', accepted_by = p_actor, accepted_at = now(),
         reservation_expires_at = v_expiry, updated_at = now() where id = p_order;
  insert into order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order, 'PENDING_ACCEPTANCE', 'AWAITING_PAYMENT', p_actor);
end $$;

create function reject_order(p_order uuid, p_actor uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  select * into o from orders where id = p_order for update;
  if o.status <> 'PENDING_ACCEPTANCE' then raise exception 'ORDER_NOT_PENDING'; end if;
  update orders set status = 'REJECTED', updated_at = now() where id = p_order;
  insert into order_status_history (order_id, from_status, to_status, reason, changed_by)
  values (p_order, o.status, 'REJECTED', p_reason, p_actor);
end $$;

-- Turns reservations into real consumption exactly once, and only after verified payment.
create function start_preparing(p_order uuid, p_actor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o orders; r record;
begin
  select * into o from orders where id = p_order for update;
  if o.status <> 'AWAITING_PAYMENT' then raise exception 'ORDER_NOT_READY_TO_PREPARE'; end if;
  if not exists (select 1 from payments where order_id = p_order and status = 'SUCCESS' and signature_verified) then
    raise exception 'PAYMENT_NOT_VERIFIED';
  end if;

  for r in select * from inventory_reservations where order_id = p_order and status = 'RESERVED' order by ingredient_id loop
    update ingredients set on_hand_quantity = on_hand_quantity - r.quantity where id = r.ingredient_id;
    insert into inventory_movements (ingredient_id, movement_type, quantity, direction, reference_type, reference_id, created_by)
    values (r.ingredient_id, 'CONSUMPTION', r.quantity, 'OUT', 'ORDER', p_order, p_actor);
    update inventory_reservations set status = 'CONSUMED' where id = r.id;
  end loop;

  update orders set status = 'PREPARING', updated_at = now() where id = p_order;
  insert into order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order, 'AWAITING_PAYMENT', 'PREPARING', p_actor);
end $$;

-- Generic guarded transition for the remaining steps.
create function transition_order(p_order uuid, p_to order_status, p_actor uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o orders; ok boolean;
begin
  select * into o from orders where id = p_order for update;
  ok := (o.status, p_to) in (
    ('PREPARING','READY'), ('READY','OUT_FOR_DELIVERY'), ('READY','DELIVERED'), ('OUT_FOR_DELIVERY','DELIVERED'),
    ('PENDING_ACCEPTANCE','CANCELLED'), ('AWAITING_PAYMENT','CANCELLED')
  ) or false;
  if not ok then raise exception 'INVALID_TRANSITION: % -> %', o.status, p_to; end if;
  if p_to = 'CANCELLED' then
    if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
    update inventory_reservations set status = 'RELEASED' where order_id = p_order and status = 'RESERVED';
  end if;
  update orders set status = p_to, updated_at = now() where id = p_order;
  insert into order_status_history (order_id, from_status, to_status, reason, changed_by)
  values (p_order, o.status, p_to, p_reason, p_actor);
end $$;

-- Lock the business functions: only the service role (our server) may call them.
revoke execute on function create_order, accept_order, reject_order, start_preparing, transition_order
  from public, anon, authenticated;

-- ───────── Row Level Security ─────────
alter table profiles enable row level security;
alter table categories enable row level security;
alter table ingredients enable row level security;
alter table meals enable row level security;
alter table recipe_ingredients enable row level security;
alter table meal_addons enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_ingredients enable row level security;
alter table order_status_history enable row level security;
alter table payments enable row level security;
alter table inventory_reservations enable row level security;
alter table inventory_movements enable row level security;

create policy "own profile or staff" on profiles for select using (id = auth.uid() or is_staff());

create policy "public menu" on categories for select to anon, authenticated using (is_active);
create policy "public meals" on meals for select to anon, authenticated using (archived_at is null);
create policy "public recipes" on recipe_ingredients for select to anon, authenticated using (true);
create policy "public addons" on meal_addons for select to anon, authenticated using (is_available);
create policy "public ingredient names" on ingredients for select to anon, authenticated using (is_active);

create policy "own orders or staff" on orders for select using (customer_id = auth.uid() or is_staff());
create policy "own items or staff" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or is_staff())));
create policy "own item ingredients or staff" on order_item_ingredients for select
  using (exists (select 1 from order_items oi join orders o on o.id = oi.order_id
                 where oi.id = order_item_id and (o.customer_id = auth.uid() or is_staff())));
create policy "own history or staff" on order_status_history for select
  using (exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or is_staff())));
create policy "own payments or staff" on payments for select
  using (exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or is_staff())));
create policy "staff reservations" on inventory_reservations for select using (is_staff());
create policy "staff movements" on inventory_movements for select using (is_staff());
