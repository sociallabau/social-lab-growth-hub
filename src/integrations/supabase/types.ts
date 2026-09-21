export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      checklist_items: {
        Row: {
          done: boolean
          done_at: string | null
          done_by: string | null
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          sort_order: number
          title: string
        }
        Update: {
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      client_costs: {
        Row: {
          client_id: string
          editing_hours: number | null
          editing_rate: number | null
          filming_hours: number | null
          filming_rate: number | null
          notes: string | null
          other_cost: number | null
          social_hours: number | null
          social_rate: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          editing_hours?: number | null
          editing_rate?: number | null
          filming_hours?: number | null
          filming_rate?: number | null
          notes?: string | null
          other_cost?: number | null
          social_hours?: number | null
          social_rate?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          editing_hours?: number | null
          editing_rate?: number | null
          filming_hours?: number | null
          filming_rate?: number | null
          notes?: string | null
          other_cost?: number | null
          social_hours?: number | null
          social_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_costs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_costs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      client_hours: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          date: string
          hours: number
          id: string
          note: string | null
          person: string | null
          role: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          hours: number
          id?: string
          note?: string | null
          person?: string | null
          role?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          hours?: number
          id?: string
          note?: string | null
          person?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_hours_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_hours_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          last_scope_review: string | null
          lead_channel: string | null
          lead_id: string | null
          monthly_fee: number | null
          name: string
          notes: string | null
          price_review_status: string
          service_line: string | null
          start_date: string | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          last_scope_review?: string | null
          lead_channel?: string | null
          lead_id?: string | null
          monthly_fee?: number | null
          name: string
          notes?: string | null
          price_review_status?: string
          service_line?: string | null
          start_date?: string | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          last_scope_review?: string | null
          lead_channel?: string | null
          lead_id?: string | null
          monthly_fee?: number | null
          name?: string
          notes?: string | null
          price_review_status?: string
          service_line?: string | null
          start_date?: string | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_lead_fk"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          blockers: string | null
          completed_at: string
          completed_by: string | null
          date: string
          highlights: string | null
          leads_reviewed: number
        }
        Insert: {
          blockers?: string | null
          completed_at?: string
          completed_by?: string | null
          date: string
          highlights?: string | null
          leads_reviewed?: number
        }
        Update: {
          blockers?: string | null
          completed_at?: string
          completed_by?: string | null
          date?: string
          highlights?: string | null
          leads_reviewed?: number
        }
        Relationships: []
      }
      daily_entries: {
        Row: {
          channel: string
          clients_won: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          marketing_spend: number
          meetings_held: number
          new_leads: number
          notes: string | null
          responded_within_30_min: number
          service_line: string | null
          tier: string
          updated_at: string
          value_won_monthly: number
        }
        Insert: {
          channel: string
          clients_won?: number
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          marketing_spend?: number
          meetings_held?: number
          new_leads?: number
          notes?: string | null
          responded_within_30_min?: number
          service_line?: string | null
          tier: string
          updated_at?: string
          value_won_monthly?: number
        }
        Update: {
          channel?: string
          clients_won?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          marketing_spend?: number
          meetings_held?: number
          new_leads?: number
          notes?: string | null
          responded_within_30_min?: number
          service_line?: string | null
          tier?: string
          updated_at?: string
          value_won_monthly?: number
        }
        Relationships: []
      }
      integration_runs: {
        Row: {
          finished_at: string | null
          id: string
          integration: string
          items: number | null
          message: string | null
          ok: boolean | null
          started_at: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          integration: string
          items?: number | null
          message?: string | null
          ok?: boolean | null
          started_at?: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          integration?: string
          items?: number | null
          message?: string | null
          ok?: boolean | null
          started_at?: string
        }
        Relationships: []
      }
      integration_state: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          at: string
          body: string | null
          created_by: string | null
          id: string
          kind: string
          lead_id: string
        }
        Insert: {
          at?: string
          body?: string | null
          created_by?: string | null
          id?: string
          kind?: string
          lead_id: string
        }
        Update: {
          at?: string
          body?: string | null
          created_by?: string | null
          id?: string
          kind?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_is_lead: boolean | null
          ai_reason: string | null
          ai_summary: string | null
          channel: string | null
          client_id: string | null
          company: string | null
          created_at: string
          email: string | null
          first_response_at: string | null
          fit: string
          id: string
          instagram_handle: string | null
          lost_reason: string | null
          meeting_at: string | null
          message: string | null
          monthly_marketing_budget: string | null
          name: string | null
          number_of_agents: string | null
          owner_email: string | null
          phone: string | null
          price_band: string | null
          quoted_value: number | null
          received_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_line: string | null
          source: string
          source_ref: string | null
          status: string
          subject: string | null
          tier: string | null
          updated_at: string
          won_at: string | null
          won_value: number | null
        }
        Insert: {
          ai_is_lead?: boolean | null
          ai_reason?: string | null
          ai_summary?: string | null
          channel?: string | null
          client_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          first_response_at?: string | null
          fit?: string
          id?: string
          instagram_handle?: string | null
          lost_reason?: string | null
          meeting_at?: string | null
          message?: string | null
          monthly_marketing_budget?: string | null
          name?: string | null
          number_of_agents?: string | null
          owner_email?: string | null
          phone?: string | null
          price_band?: string | null
          quoted_value?: number | null
          received_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_line?: string | null
          source?: string
          source_ref?: string | null
          status?: string
          subject?: string | null
          tier?: string | null
          updated_at?: string
          won_at?: string | null
          won_value?: number | null
        }
        Update: {
          ai_is_lead?: boolean | null
          ai_reason?: string | null
          ai_summary?: string | null
          channel?: string | null
          client_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          first_response_at?: string | null
          fit?: string
          id?: string
          instagram_handle?: string | null
          lost_reason?: string | null
          meeting_at?: string | null
          message?: string | null
          monthly_marketing_budget?: string | null
          name?: string | null
          number_of_agents?: string | null
          owner_email?: string | null
          phone?: string | null
          price_band?: string | null
          quoted_value?: number | null
          received_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_line?: string | null
          source?: string
          source_ref?: string | null
          status?: string
          subject?: string | null
          tier?: string | null
          updated_at?: string
          won_at?: string | null
          won_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          active: boolean
          id: string
          list: string
          sort_order: number
          value: string
        }
        Insert: {
          active?: boolean
          id?: string
          list: string
          sort_order?: number
          value: string
        }
        Update: {
          active?: boolean
          id?: string
          list?: string
          sort_order?: number
          value?: string
        }
        Relationships: []
      }
      location_defaults: {
        Row: {
          annual_leave_weeks: number
          hours_per_week: number
          location: string
          public_holidays_days: number
          sick_days: number
          training_days: number
          utilisation: number
        }
        Insert: {
          annual_leave_weeks: number
          hours_per_week: number
          location: string
          public_holidays_days: number
          sick_days: number
          training_days: number
          utilisation: number
        }
        Update: {
          annual_leave_weeks?: number
          hours_per_week?: number
          location?: string
          public_holidays_days?: number
          sick_days?: number
          training_days?: number
          utilisation?: number
        }
        Relationships: []
      }
      meta_ads_daily: {
        Row: {
          actions: Json | null
          ad_account_id: string
          clicks: number
          date: string
          impressions: number
          leads: number
          schedules: number
          spend: number
          synced_at: string
        }
        Insert: {
          actions?: Json | null
          ad_account_id: string
          clicks?: number
          date: string
          impressions?: number
          leads?: number
          schedules?: number
          spend?: number
          synced_at?: string
        }
        Update: {
          actions?: Json | null
          ad_account_id?: string
          clicks?: number
          date?: string
          impressions?: number
          leads?: number
          schedules?: number
          spend?: number
          synced_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          hours_by_role: Json
          id: string
          planned_volume: number | null
          price: number | null
          revenue_target: number | null
          tier: string
        }
        Insert: {
          hours_by_role?: Json
          id?: string
          planned_volume?: number | null
          price?: number | null
          revenue_target?: number | null
          tier: string
        }
        Update: {
          hours_by_role?: Json
          id?: string
          planned_volume?: number | null
          price?: number | null
          revenue_target?: number | null
          tier?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          avg_client_lifetime_months: number
          default_editing_rate: number | null
          default_filming_rate: number | null
          default_social_rate: number | null
          enquiry_owner_email: string | null
          fixed_monthly_acquisition_cost: number
          gross_margin: number
          id: number
          not_fit_resource_url: string | null
          plan_ceiling: number
          price_point_current: number
          price_point_high: number
          price_point_mid: number
          target_aov: number
          target_conversion: number
          target_labour_pct: number
          target_leads_per_week: number
          target_ltv_cac: number
          target_monthly_revenue: number
          target_net_margin: number
          target_responded_30: number
          tracking_start_month: string
          updated_at: string
        }
        Insert: {
          avg_client_lifetime_months?: number
          default_editing_rate?: number | null
          default_filming_rate?: number | null
          default_social_rate?: number | null
          enquiry_owner_email?: string | null
          fixed_monthly_acquisition_cost?: number
          gross_margin?: number
          id?: number
          not_fit_resource_url?: string | null
          plan_ceiling?: number
          price_point_current?: number
          price_point_high?: number
          price_point_mid?: number
          target_aov?: number
          target_conversion?: number
          target_labour_pct?: number
          target_leads_per_week?: number
          target_ltv_cac?: number
          target_monthly_revenue?: number
          target_net_margin?: number
          target_responded_30?: number
          tracking_start_month?: string
          updated_at?: string
        }
        Update: {
          avg_client_lifetime_months?: number
          default_editing_rate?: number | null
          default_filming_rate?: number | null
          default_social_rate?: number | null
          enquiry_owner_email?: string | null
          fixed_monthly_acquisition_cost?: number
          gross_margin?: number
          id?: number
          not_fit_resource_url?: string | null
          plan_ceiling?: number
          price_point_current?: number
          price_point_high?: number
          price_point_mid?: number
          target_aov?: number
          target_conversion?: number
          target_labour_pct?: number
          target_leads_per_week?: number
          target_ltv_cac?: number
          target_monthly_revenue?: number
          target_net_margin?: number
          target_responded_30?: number
          tracking_start_month?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          annual_cost: number | null
          annual_leave_weeks: number | null
          created_at: string
          hours_per_week: number | null
          id: string
          location: string
          name: string
          pay_rise_per_year: number | null
          public_holidays_days: number | null
          role: string | null
          sick_days: number | null
          training_days: number | null
          utilisation: number | null
        }
        Insert: {
          annual_cost?: number | null
          annual_leave_weeks?: number | null
          created_at?: string
          hours_per_week?: number | null
          id?: string
          location?: string
          name: string
          pay_rise_per_year?: number | null
          public_holidays_days?: number | null
          role?: string | null
          sick_days?: number | null
          training_days?: number | null
          utilisation?: number | null
        }
        Update: {
          annual_cost?: number | null
          annual_leave_weeks?: number | null
          created_at?: string
          hours_per_week?: number | null
          id?: string
          location?: string
          name?: string
          pay_rise_per_year?: number | null
          public_holidays_days?: number | null
          role?: string | null
          sick_days?: number | null
          training_days?: number | null
          utilisation?: number | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          role?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      clients_with_stats: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string | null
          last_scope_review: string | null
          lead_channel: string | null
          lead_id: string | null
          monthly_fee: number | null
          months_active: number | null
          name: string | null
          notes: string | null
          price_review_status: string | null
          revenue_to_date: number | null
          start_date: string | null
          status: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string | null
          last_scope_review?: string | null
          lead_channel?: string | null
          lead_id?: string | null
          monthly_fee?: number | null
          months_active?: never
          name?: string | null
          notes?: string | null
          price_review_status?: string | null
          revenue_to_date?: never
          start_date?: string | null
          status?: never
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string | null
          last_scope_review?: string | null
          lead_channel?: string | null
          lead_id?: string | null
          monthly_fee?: number | null
          months_active?: never
          name?: string | null
          notes?: string | null
          price_review_status?: string | null
          revenue_to_date?: never
          start_date?: string | null
          status?: never
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_lead_fk"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_team_admin: { Args: never; Returns: boolean }
      is_team_member: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
