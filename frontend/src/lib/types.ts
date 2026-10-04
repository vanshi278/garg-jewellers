// TypeScript shapes mirroring the FastAPI response schemas.

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  image_url: string | null;
  sort_order: number;
}

export interface Variant {
  id: number;
  label: string;
  sku: string;
  weight_grams: string | null;
  price: string;
  stock_qty: number;
}

export interface ProductCard {
  id: number;
  name: string;
  slug: string;
  metal: string;
  base_price: string;
  images: string[];
  in_stock: boolean;
  tryon_size_mm: string | null;
}

export interface ProductDetail extends ProductCard {
  description: string | null;
  category: Category;
  variants: Variant[];
}

export interface ProductList {
  items: ProductCard[];
  total: number;
  page: number;
  page_size: number;
}

export interface CartLine {
  item_id: number;
  variant_id: number;
  product_name: string;
  product_slug: string;
  variant_label: string;
  image: string | null;
  unit_price: string;
  qty: number;
  line_total: string;
  stock_qty: number;
  in_stock: boolean;
}

export interface Cart {
  token: string;
  lines: CartLine[];
  subtotal: string;
  item_count: number;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type Role = "customer" | "owner";

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
}

export interface PublicConfig {
  whatsapp_number: string;
  razorpay_key_id: string;
  currency: string;
  free_shipping_threshold: string;
}

export interface PaymentInit {
  order_number: string;
  provider_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  mock: boolean;
}

export interface OrderItem {
  product_name: string;
  variant_label: string;
  sku: string;
  unit_price: string;
  qty: number;
}

export interface Order {
  number: string;
  status: string;
  subtotal: string;
  shipping_fee: string;
  total: string;
  ship_name: string;
  ship_city: string;
  ship_state: string;
  ship_pincode: string;
  created_at: string;
  items: OrderItem[];
}

// ---- Admin ----
export interface DashboardStats {
  total_products: number;
  active_products: number;
  low_stock_variants: number;
  orders_pending: number;
  orders_paid: number;
  revenue_paid: string;
  unread_messages: number;
}

export interface AdminOrderRow {
  number: string;
  status: string;
  total: string;
  ship_name: string;
  ship_city: string;
  created_at: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  phone: string;
  channel: string;
  product_slug: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
] as const;

// ---- AI photoshoot ----
export interface GenCandidate {
  id: number;
  url: string;
  approved: boolean;
  comment: string | null;
}

export interface GenJob {
  id: number;
  product_id: number;
  preset: string;
  extra_prompt: string | null;
  feedback: string | null;
  reference_urls: string[];
  readiness_hint: string | null;
  status: string;
  created_at: string;
  candidates: GenCandidate[];
}

export const PHOTOSHOOT_PRESETS: { value: string; label: string }[] = [
  { value: "white_studio", label: "White studio" },
  { value: "dark_luxe", label: "Dark luxe" },
  { value: "on_model", label: "On model" },
  { value: "lifestyle", label: "Lifestyle" },
];
