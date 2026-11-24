-- Fana Cafe management tools.
-- Apply after 0001_schema.sql. Privileged functions are callable only by the server service-role client.

create or replace function create_ingredient(
  p_name text, p_unit base_unit, p_initial_quantity numeric, p_minimum_quantity numeric, p_actor uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'INGREDIENT_NAME_REQUIRED'; end if;
  if p_initial_quantity is null or p_initial_quantity < 0 then raise exception 'STOCK_QUANTITY_INVALID'; end if;
  if p_minimum_quantity is null or p_minimum_quantity < 0 then raise exception 'MINIMUM_STOCK_INVALID'; end if;

  insert into ingredients (name, base_unit, on_hand_quantity, minimum_stock_quantity)
  values (trim(p_name), p_unit, p_initial_quantity, p_minimum_quantity)
  returning id into v_id;

  if p_initial_quantity > 0 then
    insert into inventory_movements (ingredient_id, movement_type, quantity, direction, reference_type, note, created_by)
    values (v_id, 'PURCHASE', p_initial_quantity, 'IN', 'INITIAL_STOCK', 'Opening stock', p_actor);
  end if;
  return v_id;
end;
$$;

drop function if exists upsert_meal(uuid,text,text,uuid,text,numeric,int,text,boolean,jsonb);
create or replace function upsert_meal(
  p_meal_id uuid, p_name text, p_slug text, p_category_id uuid, p_description text,
  p_base_price numeric, p_preparation_minutes int, p_image_url text, p_is_available boolean,
  p_recipe jsonb, p_addons jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_meal uuid;
  v_row jsonb;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'MEAL_NAME_REQUIRED'; end if;
  if coalesce(trim(p_slug), '') = '' then raise exception 'MEAL_SLUG_REQUIRED'; end if;
  if p_base_price is null or p_base_price <= 0 then raise exception 'MEAL_PRICE_INVALID'; end if;
  if p_recipe is null then raise exception 'MEAL_RECIPE_REQUIRED'; end if;
  if jsonb_typeof(p_recipe) <> 'array' then raise exception 'MEAL_RECIPE_INVALID'; end if;
  if jsonb_array_length(p_recipe) = 0 then raise exception 'MEAL_RECIPE_REQUIRED'; end if;
  if p_addons is null or jsonb_typeof(p_addons) <> 'array' then raise exception 'MEAL_ADDONS_INVALID'; end if;
  if not exists (select 1 from categories where id = p_category_id and is_active) then raise exception 'MEAL_CATEGORY_INVALID'; end if;

  if p_meal_id is null then
    insert into meals (category_id, name, slug, description, base_price, preparation_minutes, image_url, is_available)
    values (p_category_id, trim(p_name), trim(p_slug), nullif(trim(coalesce(p_description, '')), ''),
      p_base_price, p_preparation_minutes, nullif(trim(coalesce(p_image_url, '')), ''), coalesce(p_is_available, true))
    returning id into v_meal;
  else
    update meals set category_id = p_category_id, name = trim(p_name), slug = trim(p_slug),
      description = nullif(trim(coalesce(p_description, '')), ''), base_price = p_base_price,
      preparation_minutes = p_preparation_minutes, image_url = nullif(trim(coalesce(p_image_url, '')), ''),
      is_available = coalesce(p_is_available, true)
    where id = p_meal_id and archived_at is null returning id into v_meal;
    if v_meal is null then raise exception 'MEAL_NOT_FOUND'; end if;
  end if;

  delete from recipe_ingredients where meal_id = v_meal;
  for v_row in select * from jsonb_array_elements(p_recipe) loop
    if (v_row->>'quantity_per_serving') is null or (v_row->>'quantity_per_serving')::numeric <= 0 then
      raise exception 'RECIPE_QUANTITY_INVALID';
    end if;
    insert into recipe_ingredients (meal_id, ingredient_id, quantity_per_serving, is_removable)
    select v_meal, i.id, (v_row->>'quantity_per_serving')::numeric, coalesce((v_row->>'is_removable')::boolean, false)
    from ingredients i where i.id = (v_row->>'ingredient_id')::uuid and i.is_active;
    if not found then raise exception 'RECIPE_INGREDIENT_INVALID'; end if;
  end loop;

  delete from meal_addons where meal_id = v_meal;
  for v_row in select * from jsonb_array_elements(p_addons) loop
    if coalesce(trim(v_row->>'name'), '') = '' then raise exception 'ADDON_NAME_REQUIRED'; end if;
    if (v_row->>'additional_price') is null or (v_row->>'additional_price')::numeric < 0 then raise exception 'ADDON_PRICE_INVALID'; end if;
    if (v_row->>'quantity') is null or (v_row->>'quantity')::numeric <= 0 then raise exception 'ADDON_QUANTITY_INVALID'; end if;
    insert into meal_addons (meal_id, name, additional_price, ingredient_id, quantity, is_available)
    select v_meal, trim(v_row->>'name'), (v_row->>'additional_price')::numeric, i.id,
      (v_row->>'quantity')::numeric, coalesce((v_row->>'is_available')::boolean, true)
    from ingredients i where i.id = (v_row->>'ingredient_id')::uuid and i.is_active;
    if not found then raise exception 'ADDON_INGREDIENT_INVALID'; end if;
  end loop;
  return v_meal;
end;
$$;

create or replace function adjust_ingredient_stock(
  p_ingredient_id uuid, p_quantity numeric, p_direction text, p_note text, p_actor uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current numeric;
  v_reserved numeric;
  v_type movement_type;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'STOCK_QUANTITY_INVALID'; end if;
  if p_direction not in ('IN', 'OUT') then raise exception 'STOCK_DIRECTION_INVALID'; end if;
  if p_direction = 'OUT' and coalesce(trim(p_note), '') = '' then raise exception 'STOCK_REASON_REQUIRED'; end if;

  select on_hand_quantity into v_current from ingredients where id = p_ingredient_id and is_active for update;
  if not found then raise exception 'INGREDIENT_NOT_FOUND'; end if;
  select coalesce(sum(quantity), 0) into v_reserved from inventory_reservations
    where ingredient_id = p_ingredient_id and status = 'RESERVED';
  if p_direction = 'OUT' and (v_current - p_quantity) < v_reserved then raise exception 'INSUFFICIENT_AVAILABLE_STOCK'; end if;

  update ingredients set on_hand_quantity = case when p_direction = 'IN'
    then on_hand_quantity + p_quantity else on_hand_quantity - p_quantity end
  where id = p_ingredient_id;

  v_type := case when p_direction = 'IN' then 'PURCHASE'::movement_type else 'ADJUSTMENT_OUT'::movement_type end;
  insert into inventory_movements (ingredient_id, movement_type, quantity, direction, reference_type, note, created_by)
  values (p_ingredient_id, v_type, p_quantity, p_direction, 'MANUAL_ADJUSTMENT', nullif(trim(coalesce(p_note, '')), ''), p_actor);
end;
$$;

-- Serialize successful payment writes per order. This blocks duplicate success notifications
-- without requiring cleanup of any historical payment rows.
create or replace function prevent_duplicate_successful_payment() returns trigger
language plpgsql security definer set search_path = public as $func$
begin
  if new.status = 'SUCCESS' then
    perform pg_advisory_xact_lock(hashtextextended(new.order_id::text, 0));
    if exists (
      select 1 from payments p
      where p.order_id = new.order_id and p.status = 'SUCCESS' and p.id <> coalesce(new.id, gen_random_uuid())
    ) then
      raise exception 'ORDER_ALREADY_PAID';
    end if;
  end if;
  return new;
end;
$func$;
drop trigger if exists payments_one_success_per_order on payments;
create trigger payments_one_success_per_order
  before insert or update of status, order_id on payments
  for each row execute function prevent_duplicate_successful_payment();

revoke execute on function create_ingredient(text,base_unit,numeric,numeric,uuid) from public, anon, authenticated;
revoke execute on function upsert_meal(uuid,text,text,uuid,text,numeric,int,text,boolean,jsonb,jsonb) from public, anon, authenticated;
revoke execute on function adjust_ingredient_stock(uuid,numeric,text,text,uuid) from public, anon, authenticated;
grant execute on function create_ingredient(text,base_unit,numeric,numeric,uuid) to service_role;
grant execute on function upsert_meal(uuid,text,text,uuid,text,numeric,int,text,boolean,jsonb,jsonb) to service_role;
grant execute on function adjust_ingredient_stock(uuid,numeric,text,text,uuid) to service_role;
-- The first migration revokes these business RPCs from browser roles. Explicitly
-- grant them to the service role used by trusted server actions.
grant execute on function create_order(uuid,jsonb) to service_role;
grant execute on function accept_order(uuid,uuid,int) to service_role;
grant execute on function reject_order(uuid,uuid,text) to service_role;
grant execute on function start_preparing(uuid,uuid) to service_role;
grant execute on function transition_order(uuid,order_status,uuid,text) to service_role;
