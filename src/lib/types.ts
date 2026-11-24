export type Role = 'CUSTOMER' | 'OWNER' | 'MANAGER' | 'KITCHEN';
export type AccountStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type OrderStatus =
  | 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'AWAITING_PAYMENT' | 'PREPARING' | 'READY'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  account_status: AccountStatus;
  floor: number | null;
  apartment_number: string | null;
}

export interface Meal {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  is_available: boolean;
  preparation_minutes: number | null;
  categories?: { name: string } | null;
}

export interface RecipeRow {
  ingredient_id: string;
  quantity_per_serving: number;
  is_removable: boolean;
  ingredients: { name: string };
}

export interface AddonRow {
  id: string;
  name: string;
  additional_price: number;
  ingredient_id: string | null;
  quantity: number | null;
  is_available: boolean;
  ingredients: { name: string } | null;
}

export interface CatalogMeal extends Meal {
  recipe_ingredients: RecipeRow[];
  meal_addons: AddonRow[];
}

export interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  customer_name_snapshot: string;
  floor_snapshot: number;
  apartment_snapshot: string;
  note: string | null;
  created_at: string;
  reservation_expires_at: string | null;
  order_items?: OrderItemRow[];
  payments?: { status: string; signature_verified: boolean }[];
}

export interface OrderItemRow {
  id: string;
  meal_name_snapshot: string;
  quantity: number;
  line_total: number;
  note: string | null;
  order_item_ingredients: { ingredient_name_snapshot: string; was_removed: boolean; source_type: 'RECIPE' | 'ADDON' }[];
}
