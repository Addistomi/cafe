-- Telebirr public receipt verification.
-- A decoded QR/OCR reference is never sufficient to mark a payment successful.
-- Only server code may set receipt_verified after the official receipt lookup succeeds.

alter table public.payments
  add column if not exists receipt_verified boolean not null default false,
  add column if not exists receipt_verified_at timestamptz,
  add column if not exists receipt_verification_message text,
  add column if not exists verified_recipient_name text,
  add column if not exists verified_settled_amount numeric(12,2);

-- Preserve the existing signature_verified path for signed merchant callbacks.
-- Direct-transfer receipt checks use receipt_verified instead.
create or replace function start_preparing(p_order uuid, p_actor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o orders; r record;
begin
  select * into o from orders where id = p_order for update;
  if o.status <> 'AWAITING_PAYMENT' then raise exception 'ORDER_NOT_READY_TO_PREPARE'; end if;
  if not exists (
    select 1 from payments
    where order_id = p_order
      and status = 'SUCCESS'
      and (signature_verified or receipt_verified)
  ) then
    raise exception 'PAYMENT_NOT_VERIFIED';
  end if;

  for r in
    select * from inventory_reservations
    where order_id = p_order and status = 'RESERVED'
    order by ingredient_id
  loop
    update ingredients set on_hand_quantity = on_hand_quantity - r.quantity where id = r.ingredient_id;
    insert into inventory_movements (ingredient_id, movement_type, quantity, direction, reference_type, reference_id, created_by)
    values (r.ingredient_id, 'CONSUMPTION', r.quantity, 'OUT', 'ORDER', p_order, p_actor);
    update inventory_reservations set status = 'CONSUMED' where id = r.id;
  end loop;

  update orders set status = 'PREPARING', updated_at = now() where id = p_order;
  insert into order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order, 'AWAITING_PAYMENT', 'PREPARING', p_actor);
end $$;

grant execute on function start_preparing(uuid,uuid) to service_role;
