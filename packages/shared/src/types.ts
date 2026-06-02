import { z } from 'zod'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const UserRole = z.enum(['owner', 'assistant'])
export type UserRole = z.infer<typeof UserRole>

export const AccountType = z.enum([
  'direct_customer',
  'subsidiary',
  'distributor',
  'representative',
  'partner',
])
export type AccountType = z.infer<typeof AccountType>

export const QuoteType = z.enum(['competitive', 'reposition'])
export type QuoteType = z.infer<typeof QuoteType>

export const QuoteStage = z.enum([
  'received',
  'in_analysis',
  'sent',
  'negotiation',
  'won',
  'lost',
  'expired',
  'stalled',
])
export type QuoteStage = z.infer<typeof QuoteStage>

export const ProductGroup = z.enum([
  'preformados',
  'cadeias',
  'svd_amortecedor',
  'opgw_fibra',
  'cruzeta',
  'ferragens',
  'isoladores',
  'conectores',
  'outros',
])
export type ProductGroup = z.infer<typeof ProductGroup>

export const LossReason = z.enum([
  'price',
  'lead_time',
  'competitor',
  'specification',
  'no_response',
  'customer_canceled',
  'other',
])
export type LossReason = z.infer<typeof LossReason>

export const OrderStatus = z.enum([
  'received',
  'in_production',
  'shipped',
  'delivered',
  'canceled',
])
export type OrderStatus = z.infer<typeof OrderStatus>

export const ActivityKind = z.enum([
  'call',
  'email_sent',
  'email_received',
  'meeting',
  'note',
  'task',
  'system_event',
])
export type ActivityKind = z.infer<typeof ActivityKind>

export const AlertType = z.enum([
  'cooling_quote',
  'stalled_high_value',
  'pattern_anomaly',
  'opportunity',
  'deadline_risk',
  'unusual_drop',
])
export type AlertType = z.infer<typeof AlertType>

export const AlertSeverity = z.enum(['info', 'warning', 'critical'])
export type AlertSeverity = z.infer<typeof AlertSeverity>

// ─── Entity schemas ───────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: UserRole,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})
export type User = z.infer<typeof UserSchema>

export const AccountSchema = z.object({
  id: z.string().uuid(),
  legal_name: z.string().min(1),
  country: z.string().min(1),
  country_iso2: z.string().length(2).nullable(),
  account_type: AccountType,
  currency_default: z.string().default('USD'),
  parent_account_id: z.string().uuid().nullable(),
  segment: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})
export type Account = z.infer<typeof AccountSchema>

export const ContactSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  name: z.string().min(1),
  role: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  language: z.string().default('es'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})
export type Contact = z.infer<typeof ContactSchema>

export const QuoteItemSchema = z.object({
  id: z.string().uuid(),
  quote_id: z.string().uuid(),
  product_code: z.string().nullable(),
  description: z.string().nullable(),
  quantity: z.number().nullable(),
  unit_price: z.number().nullable(),
  total: z.number().nullable(),
})
export type QuoteItem = z.infer<typeof QuoteItemSchema>

export const QuoteSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  assistant_id: z.string().uuid().nullable(),
  quote_number: z.string().min(1),
  quote_type: QuoteType,
  stage: QuoteStage,
  total_value: z.number().nullable(),
  currency: z.string().default('USD'),
  fx_to_brl: z.number().nullable(),
  probability: z.number().int().min(0).max(100).nullable(),
  product_group: ProductGroup.nullable(),
  product_description: z.string().nullable(),
  received_at: z.string().datetime(),
  sent_at: z.string().datetime().nullable(),
  expected_close_at: z.string().nullable(),
  decided_at: z.string().datetime().nullable(),
  loss_reason: LossReason.nullable(),
  loss_competitor: z.string().nullable(),
  loss_notes: z.string().nullable(),
  commission_pct_ds: z.number().default(0),
  commission_pct_dfj: z.number().default(0),
  commission_pct_other: z.number().default(0),
  commission_other_label: z.string().nullable(),
  last_activity_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})
export type Quote = z.infer<typeof QuoteSchema>

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  product_code: z.string().nullable(),
  description: z.string().nullable(),
  quantity: z.number().nullable(),
  unit_price: z.number().nullable(),
  total: z.number().nullable(),
})
export type OrderItem = z.infer<typeof OrderItemSchema>

export const OrderSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  quote_id: z.string().uuid().nullable(),
  po_number: z.string().nullable(),
  internal_number: z.string().nullable(),
  status: OrderStatus,
  total_value: z.number(),
  currency: z.string(),
  fx_to_brl: z.number(),
  received_at: z.string().datetime(),
  promised_delivery_at: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})
export type Order = z.infer<typeof OrderSchema>

export const ActivitySchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid().nullable(),
  quote_id: z.string().uuid().nullable(),
  order_id: z.string().uuid().nullable(),
  contact_id: z.string().uuid().nullable(),
  user_id: z.string().uuid(),
  kind: ActivityKind,
  title: z.string().nullable(),
  body: z.string().nullable(),
  due_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  occurred_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})
export type Activity = z.infer<typeof ActivitySchema>

export const BrainAlertSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid().nullable(),
  quote_id: z.string().uuid().nullable(),
  alert_type: AlertType,
  severity: AlertSeverity,
  title: z.string(),
  body: z.string(),
  suggested_action: z.string().nullable(),
  suggested_prompt: z.string().nullable(),
  dismissed: z.boolean().default(false),
  dismissed_at: z.string().datetime().nullable(),
  expires_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})
export type BrainAlert = z.infer<typeof BrainAlertSchema>

export const MonthlyReportSchema = z.object({
  id: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  slug: z.string().min(1),
  title: z.string().min(1),
  narrative: z.string().nullable(),
  published: z.boolean().default(false),
  published_at: z.string().datetime().nullable(),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})
export type MonthlyReport = z.infer<typeof MonthlyReportSchema>

export const FxRateSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  currency: z.string(),
  rate_to_brl: z.number(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})
export type FxRate = z.infer<typeof FxRateSchema>

// ─── Form schemas (without auto-fields) ──────────────────────────────────────

export const CreateQuoteSchema = z.object({
  account_id: z.string().uuid('Selecione uma conta'),
  quote_number: z.string().min(1, 'Número da proposta obrigatório'),
  quote_type: QuoteType,
  stage: QuoteStage.default('received'),
  total_value: z.number().positive('Valor deve ser positivo').nullable(),
  currency: z.string().default('USD'),
  fx_to_brl: z.number().positive().nullable().optional(),
  product_group: ProductGroup.nullable(),
  product_description: z.string().nullable(),
  received_at: z.string().min(1, 'Data de recebimento obrigatória'),
  expected_close_at: z.string().nullable(),
  commission_pct_ds: z.number().min(0).max(1).default(0),
  commission_pct_dfj: z.number().min(0).max(1).default(0),
  commission_pct_other: z.number().min(0).max(1).default(0),
  commission_other_label: z.string().nullable(),
})
export type CreateQuote = z.infer<typeof CreateQuoteSchema>

export const CreateActivitySchema = z.object({
  kind: ActivityKind,
  title: z.string().nullable(),
  body: z.string().nullable(),
  quote_id: z.string().uuid().nullable(),
  order_id: z.string().uuid().nullable(),
  contact_id: z.string().uuid().nullable(),
  due_at: z.string().nullable(),
  occurred_at: z.string().min(1),
})
export type CreateActivity = z.infer<typeof CreateActivitySchema>

export const CreateOrderSchema = z.object({
  account_id: z.string().uuid(),
  quote_id: z.string().uuid().nullable(),
  po_number: z.string().nullable(),
  internal_number: z.string().nullable(),
  status: OrderStatus.default('received'),
  total_value: z.number().positive(),
  currency: z.string().default('USD'),
  fx_to_brl: z.number().positive(),
  received_at: z.string().min(1),
  promised_delivery_at: z.string().nullable(),
})
export type CreateOrder = z.infer<typeof CreateOrderSchema>

// ─── View types ───────────────────────────────────────────────────────────────

export interface PipelineQuote extends Quote {
  account_name: string
  country: string
  country_iso2: string | null
  days_in_stage: number
  total_value_brl: number | null
  has_active_alert: boolean
  alert_severity: AlertSeverity | null
  alert_title: string | null
}

export interface AccountHealth {
  account_id: string
  legal_name: string
  country: string
  country_iso2: string | null
  last_activity_at: string | null
  pipeline_value_usd: number
  hit_rate: number
  open_quotes: number
  won_quotes: number
  total_quotes: number
}

export interface CountryMetrics {
  country: string
  country_iso2: string
  quoted_value_usd: number
  orders_value_usd: number
  hit_rate: number
  quote_count: number
  order_count: number
}

export interface MonthlyKpi {
  month: string
  quotes_received: number
  quotes_sent: number
  orders_received: number
  total_quoted_usd: number
  total_ordered_usd: number
}

// ─── Report snapshot payloads ─────────────────────────────────────────────────
// Contrato dos JSONBs gravados em report_snapshots pela Edge Function close-month.

export interface ReportKpis {
  quotes_received: number
  quotes_sent: number
  orders_received: number
  total_quoted_brl: number
  total_orders_brl: number
}
