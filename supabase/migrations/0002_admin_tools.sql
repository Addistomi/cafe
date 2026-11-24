-- Fana Cafe management tools.
-- Apply after 0001_schema.sql. Privileged functions are callable only by the server service-role client.

create or replace function upsert_meal(
  p_meal_id uuid, p_name text, p_slug text, p_category_id uuid, p_description text,
  p_base_price numeric, p_preparation_minutes int, p_image_url text, p_is_available boolean, p_recipe jsonb
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
  if not exists (select 1 from categories where id = p_category_id and is_active) then
    raise exception 'MEAL_CATEGORY_INVALID';
  end if;

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
    where id = p_meal_id and archived_at is null
    returning id into v_meal;
    if v_meal is null then raise exception 'MEAL_NOT_FOUND'; end if;
  end if;

  delete from recipe_ingredients where meal_id = v_meal;
  for v_row in select * from jsonb_array_elements(p_recipe) loop
    if (v_row->>'quantity_per_serving') is null or (v_row->>'quantity_per_serving')::numeric <= 0 then
      raise exception 'RECIPE_QUANTITY_INVALID';
    end if;
    insert into recipe_ingredients (meal_id, ingredient_id, quantity_per_serving, is_removable)
    select v_meal, i.id, (v_row->>'quantity_per_serving')::numeric,
      coalesce((v_row->>'is_removable')::boolean, false)
    from ingredients i where i.id = (v_row->>'ingredient_id')::uuid and i.is_active;
    if not found then raise exception 'RECIPE_INGREDIENT_INVALID'; end if;
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

  select on_hand_quantity into v_current from ingredients
    where id = p_ingredient_id and is_active for update;
  if not found then raise exception 'INGREDIENT_NOT_FOUND'; end if;

  select coalesce(sum(quantity), 0) into v_reserved from inventory_reservations
    where ingredient_id = p_ingredient_id and status = 'RESERVED';
  -- Manual stock removal must not consume quantities already reserved for accepted orders.
  if p_direction = 'OUT' and (v_current - p_quantity) < v_reserved then
    raise exception 'INSUFFICIENT_AVAILABLE_STOCK';
  end if;

  update ingredients set on_hand_quantity = case
    when p_direction = 'IN' then on_hand_quantity + p_quantity
    else on_hand_quantity - p_quantity end
  where id = p_ingredient_id;

  v_type := case when p_direction = 'IN' then 'PURCHASE'::movement_type else 'ADJUSTMENT_OUT'::movement_type end;
  insert into inventory_movements (ingredient_id, movement_type, quantity, direction, reference_type, note, created_by)
  values (p_ingredient_id, v_type, p_quantity, p_direction, 'MANUAL_ADJUSTMENT',
          nullif(trim(coalesce(p_note, '')), ''), p_actor);
end;
$$;

-- A payment provider may notify the server more than once; an order can only have one successful payment.
create unique index if not exists payments_one_success_per_order
  on payments(order_id) where status = 'SUCCESS';

revoke execute on function upsert_meal(uuid,text,text,uuid,text,numeric,int,text,boolean,jsonb) from public, anon, authenticated;
revoke execute on function adjust_ingredient_stock(uuid,numeric,text,text,uuid) from public, anon, authenticated;
grant execute on function upsert_meal(uuid,text,text,uuid,text,numeric,int,text,boolean,jsonb) to service_role;
grant execute on function adjust_ingredient_stock(uuid,numeric,text,text,uuid) to service_role;
