-- Removes ONLY Fana Cafe objects (not your Supabase auth users). Deletes Fana data.
drop trigger if exists on_auth_user_created on auth.users;
drop view if exists ingredient_stock;
drop table if exists
  payments, order_status_history, order_item_ingredients, order_items,
  inventory_reservations, inventory_movements, orders,
  meal_addons, recipe_ingredients, meals, ingredients, categories, profiles
cascade;
drop sequence if exists order_seq;
drop function if exists
  handle_new_user(), is_staff(), forbid_ledger_change(),
  create_order(uuid, jsonb), accept_order(uuid, uuid, int),
  reject_order(uuid, uuid, text), start_preparing(uuid, uuid),
  transition_order(uuid, order_status, uuid, text)
cascade;
drop type if exists
  user_role, account_status, order_status, payment_status,
  reservation_status, movement_type, base_unit
cascade;

