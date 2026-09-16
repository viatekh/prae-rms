export type ProjectStatus = 'draft' | 'sent' | 'confirmed' | 'invoiced' | 'completed'
export type LineType = 'rental' | 'service'

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface Item {
  id: string
  item_id: string
  name: string
  category_id: string
  category?: Category
  serial_number: string | null
  day_price: number
  week_price: number | null
  month_price: number | null
  purchase_price: number | null
  replacement_value: number | null
  out_of_service: boolean
  out_of_service_reason: string | null
  is_subhire: boolean
  subhire_owner: string | null
  notes: string | null
  created_at: string
  components?: ItemComponent[]
}

export interface ItemComponent {
  id: string
  item_id: string
  name: string
  quantity: number
}

export interface Package {
  id: string
  package_id: string
  name: string
  category_id: string
  category?: Category
  day_price: number
  week_price: number | null
  month_price: number | null
  notes: string | null
  created_at: string
  package_items?: PackageItem[]
}

export interface PackageItem {
  id: string
  package_id: string
  item_id: string
  item?: Item
  quantity: number
}

export interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  billing_address: string | null
  credit_terms: string | null
  default_discount_pct?: number | null
  notes: string | null
  created_at: string
}

export interface LogAuthor {
  full_name: string | null
  email: string
}

export interface ItemLog {
  id: string
  item_id: string
  note: string
  author_id: string | null
  author?: LogAuthor | null
  created_at: string
}

export interface ProjectLog {
  id: string
  project_id: string
  message: string
  author_id: string | null
  author?: LogAuthor | null
  created_at: string
}

export interface ProjectCrew {
  id: string
  project_id: string
  name: string
  role: string | null
  created_at: string
}

export interface Project {
  id: string
  project_number: string
  name: string
  client_id: string | null
  client?: Client
  status: ProjectStatus
  location: string | null
  delivery_address: string | null
  event_date: string | null
  delivery_date: string | null
  collection_date: string | null
  client_collects: boolean
  client_returns: boolean
  delivery_mode: string | null
  collection_mode: string | null
  delivery_notes: string | null
  collection_notes: string | null
  expiry_date: string | null
  po_number: string | null
  deposit_amount: number | null
  deposit_paid: boolean
  overall_discount_pct: number
  check_out_at: string | null
  check_in_at: string | null
  damage_notes: string | null
  notes: string | null
  client_notes: string | null
  created_at: string
  line_items?: ProjectLineItem[]
}

export interface ProjectLineItem {
  id: string
  project_id: string
  item_id: string | null
  item?: Item
  package_id: string | null
  package?: Package
  description: string
  line_type: LineType
  category: string
  quantity: number
  days: number
  /** Daily rate, snapshotted when the line was added. */
  unit_price: number
  /** Weekly / monthly rates snapshotted alongside unit_price, when the item has them. */
  week_price: number | null
  month_price: number | null
  discount_pct: number
  sort_order: number
  is_component: boolean
  parent_line_id: string | null
  children?: ProjectLineItem[]
}

export interface Settings {
  company_name: string
  company_address: string
  company_email: string
  company_phone: string
  company_website: string
  company_reg: string
  vat_enabled: boolean
  vat_rate: number
  quote_prefix: string
  quote_next_number: number
  payment_terms: string
  tc_text: string
}

/** A line item as held in local editing state, before it has a DB row. */
export type LineItemDraft = Omit<ProjectLineItem, 'id' | 'item' | 'package' | 'children'>

/** The subset of a line item that revenue maths needs. */
export interface PricedLine {
  unit_price: number
  week_price?: number | null
  month_price?: number | null
  quantity: number
  days: number
  discount_pct: number
  is_component: boolean
  description?: string
}

/** Shape returned by the dashboard/report aggregate queries. */
export interface ProjectRevenueRow {
  id: string
  name: string
  project_number: string
  status: ProjectStatus
  client_id: string | null
  client?: { name: string } | null
  event_date: string | null
  created_at: string
  overall_discount_pct: number | null
  line_items: PricedLine[]
}
