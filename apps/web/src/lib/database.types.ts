/**
 * Tipos do schema Postgres (Supabase) — espelham as migrations em
 * `supabase/migrations/`. Mesmo formato de `supabase gen types typescript`,
 * autorado à mão e verificado contra o SQL.
 *
 * Para regenerar a partir de um banco linkado:
 *   supabase gen types typescript --linked > apps/web/src/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          legal_name: string
          country: string
          country_iso2: string | null
          account_type: Database['public']['Enums']['account_type']
          currency_default: string
          parent_account_id: string | null
          segment: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          legal_name: string
          country: string
          country_iso2?: string | null
          account_type?: Database['public']['Enums']['account_type']
          currency_default?: string
          parent_account_id?: string | null
          segment?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          legal_name?: string
          country?: string
          country_iso2?: string | null
          account_type?: Database['public']['Enums']['account_type']
          currency_default?: string
          parent_account_id?: string | null
          segment?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'accounts_parent_account_id_fkey'
            columns: ['parent_account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
        ]
      }
      contacts: {
        Row: {
          id: string
          account_id: string
          name: string
          role: string | null
          email: string | null
          phone: string | null
          language: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          name: string
          role?: string | null
          email?: string | null
          phone?: string | null
          language?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          name?: string
          role?: string | null
          email?: string | null
          phone?: string | null
          language?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
        ]
      }
      users: {
        Row: {
          id: string
          name: string
          role: Database['public']['Enums']['user_role']
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name?: string
          role?: Database['public']['Enums']['user_role']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: Database['public']['Enums']['user_role']
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          account_id: string
          owner_id: string
          assistant_id: string | null
          quote_number: string
          quote_type: Database['public']['Enums']['quote_type']
          stage: Database['public']['Enums']['quote_stage']
          total_value: number | null
          currency: string
          fx_to_brl: number | null
          probability: number | null
          product_group: Database['public']['Enums']['product_group'] | null
          product_description: string | null
          received_at: string
          sent_at: string | null
          expected_close_at: string | null
          decided_at: string | null
          loss_reason: Database['public']['Enums']['loss_reason'] | null
          loss_competitor: string | null
          loss_notes: string | null
          commission_pct_ds: number
          commission_pct_dfj: number
          commission_pct_other: number
          commission_other_label: string | null
          last_activity_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          owner_id: string
          assistant_id?: string | null
          quote_number: string
          quote_type: Database['public']['Enums']['quote_type']
          stage?: Database['public']['Enums']['quote_stage']
          total_value?: number | null
          currency?: string
          fx_to_brl?: number | null
          probability?: number | null
          product_group?: Database['public']['Enums']['product_group'] | null
          product_description?: string | null
          received_at: string
          sent_at?: string | null
          expected_close_at?: string | null
          decided_at?: string | null
          loss_reason?: Database['public']['Enums']['loss_reason'] | null
          loss_competitor?: string | null
          loss_notes?: string | null
          commission_pct_ds?: number
          commission_pct_dfj?: number
          commission_pct_other?: number
          commission_other_label?: string | null
          last_activity_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          owner_id?: string
          assistant_id?: string | null
          quote_number?: string
          quote_type?: Database['public']['Enums']['quote_type']
          stage?: Database['public']['Enums']['quote_stage']
          total_value?: number | null
          currency?: string
          fx_to_brl?: number | null
          probability?: number | null
          product_group?: Database['public']['Enums']['product_group'] | null
          product_description?: string | null
          received_at?: string
          sent_at?: string | null
          expected_close_at?: string | null
          decided_at?: string | null
          loss_reason?: Database['public']['Enums']['loss_reason'] | null
          loss_competitor?: string | null
          loss_notes?: string | null
          commission_pct_ds?: number
          commission_pct_dfj?: number
          commission_pct_other?: number
          commission_other_label?: string | null
          last_activity_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quotes_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_assistant_id_fkey'
            columns: ['assistant_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          product_code: string | null
          description: string | null
          quantity: number | null
          unit_price: number | null
          total: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          product_code?: string | null
          description?: string | null
          quantity?: number | null
          unit_price?: number | null
          total?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          product_code?: string | null
          description?: string | null
          quantity?: number | null
          unit_price?: number | null
          total?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quote_items_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          },
        ]
      }
      orders: {
        Row: {
          id: string
          account_id: string
          quote_id: string | null
          po_number: string | null
          internal_number: string | null
          status: Database['public']['Enums']['order_status']
          total_value: number
          currency: string
          fx_to_brl: number
          received_at: string
          promised_delivery_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          quote_id?: string | null
          po_number?: string | null
          internal_number?: string | null
          status?: Database['public']['Enums']['order_status']
          total_value: number
          currency: string
          fx_to_brl: number
          received_at: string
          promised_delivery_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          quote_id?: string | null
          po_number?: string | null
          internal_number?: string | null
          status?: Database['public']['Enums']['order_status']
          total_value?: number
          currency?: string
          fx_to_brl?: number
          received_at?: string
          promised_delivery_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'orders_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'orders_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_code: string | null
          description: string | null
          quantity: number | null
          unit_price: number | null
          total: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_code?: string | null
          description?: string | null
          quantity?: number | null
          unit_price?: number | null
          total?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_code?: string | null
          description?: string | null
          quantity?: number | null
          unit_price?: number | null
          total?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      }
      activities: {
        Row: {
          id: string
          account_id: string | null
          quote_id: string | null
          order_id: string | null
          contact_id: string | null
          user_id: string
          kind: Database['public']['Enums']['activity_kind']
          title: string | null
          body: string | null
          due_at: string | null
          completed_at: string | null
          occurred_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id?: string | null
          quote_id?: string | null
          order_id?: string | null
          contact_id?: string | null
          user_id: string
          kind: Database['public']['Enums']['activity_kind']
          title?: string | null
          body?: string | null
          due_at?: string | null
          completed_at?: string | null
          occurred_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string | null
          quote_id?: string | null
          order_id?: string | null
          contact_id?: string | null
          user_id?: string
          kind?: Database['public']['Enums']['activity_kind']
          title?: string | null
          body?: string | null
          due_at?: string | null
          completed_at?: string | null
          occurred_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activities_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      brain_alerts: {
        Row: {
          id: string
          account_id: string | null
          quote_id: string | null
          alert_type: Database['public']['Enums']['alert_type']
          severity: Database['public']['Enums']['alert_severity']
          title: string
          body: string
          suggested_action: string | null
          suggested_prompt: string | null
          dismissed: boolean
          dismissed_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id?: string | null
          quote_id?: string | null
          alert_type: Database['public']['Enums']['alert_type']
          severity: Database['public']['Enums']['alert_severity']
          title: string
          body: string
          suggested_action?: string | null
          suggested_prompt?: string | null
          dismissed?: boolean
          dismissed_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string | null
          quote_id?: string | null
          alert_type?: Database['public']['Enums']['alert_type']
          severity?: Database['public']['Enums']['alert_severity']
          title?: string
          body?: string
          suggested_action?: string | null
          suggested_prompt?: string | null
          dismissed?: boolean
          dismissed_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'brain_alerts_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'brain_alerts_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          },
        ]
      }
      monthly_reports: {
        Row: {
          id: string
          period: string
          slug: string
          title: string
          narrative: string | null
          published: boolean
          published_at: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          period: string
          slug: string
          title: string
          narrative?: string | null
          published?: boolean
          published_at?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          period?: string
          slug?: string
          title?: string
          narrative?: string | null
          published?: boolean
          published_at?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'monthly_reports_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      report_snapshots: {
        Row: {
          id: string
          report_id: string
          metric_key: string
          payload: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          report_id: string
          metric_key: string
          payload: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          metric_key?: string
          payload?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'report_snapshots_report_id_fkey'
            columns: ['report_id']
            isOneToOne: false
            referencedRelation: 'monthly_reports'
            referencedColumns: ['id']
          },
        ]
      }
      fx_rates: {
        Row: {
          id: string
          date: string
          currency: string
          rate_to_brl: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          currency: string
          rate_to_brl: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          currency?: string
          rate_to_brl?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          id: string
          received_at: string
          from_name: string | null
          from_email: string | null
          subject: string | null
          body: string | null
          account_id: string | null
          quote_id: string | null
          status: Database['public']['Enums']['request_status']
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          received_at?: string
          from_name?: string | null
          from_email?: string | null
          subject?: string | null
          body?: string | null
          account_id?: string | null
          quote_id?: string | null
          status?: Database['public']['Enums']['request_status']
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          received_at?: string
          from_name?: string | null
          from_email?: string | null
          subject?: string | null
          body?: string | null
          account_id?: string | null
          quote_id?: string | null
          status?: Database['public']['Enums']['request_status']
          source?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quote_requests_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_requests_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          },
        ]
      }
      job_runs: {
        Row: {
          id: string
          job_name: string
          started_at: string
          finished_at: string | null
          success: boolean | null
          details: Json | null
          error_message: string | null
        }
        Insert: {
          id?: string
          job_name: string
          started_at?: string
          finished_at?: string | null
          success?: boolean | null
          details?: Json | null
          error_message?: string | null
        }
        Update: {
          id?: string
          job_name?: string
          started_at?: string
          finished_at?: string | null
          success?: boolean | null
          details?: Json | null
          error_message?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_action_queue: {
        Row: {
          id: string | null
          quote_id: string | null
          account_id: string | null
          quote_number: string | null
          account_name: string | null
          country_iso2: string | null
          stage: string | null
          task_kind: string | null
          severity: Database['public']['Enums']['alert_severity'] | null
          title: string | null
          detail: string | null
          total_value: number | null
          currency: string | null
          overdue_days: number | null
          due_in_days: number | null
          sort_value_brl: number | null
          suggested_action: string | null
          severity_ord: number | null
        }
        Relationships: []
      }
      v_executive_summary: {
        Row: {
          pipeline_brl: number | null
          pipeline_weighted_brl: number | null
          open_quotes: number | null
          pending_actions: number | null
          critical_actions: number | null
          critical_value_brl: number | null
          action_value_brl: number | null
          last_fx_usd_date: string | null
          top_account_concentration_pct: number | null
          top_account_name: string | null
        }
        Relationships: []
      }
      v_pipeline_by_account: {
        Row: {
          account_id: string | null
          account_name: string | null
          country_iso2: string | null
          open_quotes: number | null
          pipeline_brl: number | null
          pipeline_weighted_brl: number | null
        }
        Relationships: []
      }
      v_pipeline_active: {
        Row: {
          id: string
          account_id: string
          owner_id: string
          assistant_id: string | null
          quote_number: string
          quote_type: Database['public']['Enums']['quote_type']
          stage: Database['public']['Enums']['quote_stage']
          total_value: number | null
          currency: string
          fx_to_brl: number | null
          probability: number | null
          product_group: Database['public']['Enums']['product_group'] | null
          product_description: string | null
          received_at: string
          sent_at: string | null
          expected_close_at: string | null
          decided_at: string | null
          loss_reason: Database['public']['Enums']['loss_reason'] | null
          loss_competitor: string | null
          loss_notes: string | null
          commission_pct_ds: number
          commission_pct_dfj: number
          commission_pct_other: number
          commission_other_label: string | null
          last_activity_at: string
          created_at: string
          updated_at: string
          account_name: string
          country: string
          country_iso2: string | null
          days_in_stage: number
          total_value_brl: number | null
          has_active_alert: boolean
          alert_severity: Database['public']['Enums']['alert_severity'] | null
          alert_title: string | null
        }
        Relationships: []
      }
      v_account_health: {
        Row: {
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
        Relationships: []
      }
      v_country_metrics: {
        Row: {
          country: string
          country_iso2: string
          quoted_value_usd: number
          orders_value_usd: number
          hit_rate: number
          quote_count: number
          order_count: number
        }
        Relationships: []
      }
      v_monthly_kpis: {
        Row: {
          month: string
          quotes_received: number
          quotes_sent: number
          orders_received: number
          total_quoted_usd: number
          total_ordered_usd: number
        }
        Relationships: []
      }
    }
    Functions: {
      auto_stall_quotes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      auto_expire_stalled: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_fx_rate: {
        Args: { p_currency: string; p_date?: string }
        Returns: number
      }
      quote_effective_probability: {
        Args: { p_stage: Database['public']['Enums']['quote_stage']; p_probability: number }
        Returns: number
      }
      quote_stage_default_probability: {
        Args: { p_stage: Database['public']['Enums']['quote_stage'] }
        Returns: number
      }
      quote_value_brl: {
        Args: { p_total: number; p_currency: string; p_fx: number }
        Returns: number
      }
      import_proposal: {
        Args: { p_proposal: Json; p_owner_id: string }
        Returns: Json
      }
      run_daily_maintenance: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
    }
    Enums: {
      user_role: 'owner' | 'assistant'
      account_type:
        | 'direct_customer'
        | 'subsidiary'
        | 'distributor'
        | 'representative'
        | 'partner'
      quote_type: 'competitive' | 'reposition'
      quote_stage:
        | 'received'
        | 'in_analysis'
        | 'sent'
        | 'negotiation'
        | 'won'
        | 'lost'
        | 'expired'
        | 'stalled'
      product_group:
        | 'preformados'
        | 'cadeias'
        | 'svd_amortecedor'
        | 'opgw_fibra'
        | 'cruzeta'
        | 'ferragens'
        | 'isoladores'
        | 'conectores'
        | 'outros'
      loss_reason:
        | 'price'
        | 'lead_time'
        | 'competitor'
        | 'specification'
        | 'no_response'
        | 'customer_canceled'
        | 'other'
      order_status:
        | 'received'
        | 'in_production'
        | 'shipped'
        | 'delivered'
        | 'canceled'
      activity_kind:
        | 'call'
        | 'email_sent'
        | 'email_received'
        | 'meeting'
        | 'note'
        | 'task'
        | 'system_event'
      alert_type:
        | 'cooling_quote'
        | 'stalled_high_value'
        | 'pattern_anomaly'
        | 'opportunity'
        | 'deadline_risk'
        | 'unusual_drop'
      alert_severity: 'info' | 'warning' | 'critical'
      request_status: 'new' | 'quoting' | 'quoted' | 'discarded'
    }
    CompositeTypes: Record<never, never>
  }
}

// ─── Helpers (mesmo formato do supabase gen types) ────────────────────────────

type PublicSchema = Database['public']

export type Tables<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
