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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      brand_profiles: {
        Row: {
          brand_name: string
          business_summary: string | null
          created_at: string
          geography: string | null
          id: string
          industry: string | null
          industry_other: string | null
          logo_url: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          brand_name: string
          business_summary?: string | null
          created_at?: string
          geography?: string | null
          id?: string
          industry?: string | null
          industry_other?: string | null
          logo_url?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          brand_name?: string
          business_summary?: string | null
          created_at?: string
          geography?: string | null
          id?: string
          industry?: string | null
          industry_other?: string | null
          logo_url?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      influencers: {
        Row: {
          created_at: string
          followers: number
          geography: string | null
          id: string
          name: string
          niche_audience: string | null
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          followers?: number
          geography?: string | null
          id?: string
          name: string
          niche_audience?: string | null
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          followers?: number
          geography?: string | null
          id?: string
          name?: string
          niche_audience?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          plan: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          plan?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      scc_actions: {
        Row: {
          action_type: string
          created_at: string | null
          description: string | null
          id: string
          page_id: string | null
          priority: string | null
          query_id: string | null
          snapshot_id: string
          status: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          page_id?: string | null
          priority?: string | null
          query_id?: string | null
          snapshot_id: string
          status?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          page_id?: string | null
          priority?: string | null
          query_id?: string | null
          snapshot_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scc_actions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "scc_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scc_actions_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "scc_queries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scc_actions_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "scc_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      scc_page_snapshot_metrics: {
        Row: {
          avg_position: number | null
          canonical_ok: boolean | null
          clicks: number | null
          conversions: number | null
          created_at: string | null
          ctr: number | null
          has_h1: boolean | null
          has_meta: boolean | null
          has_title: boolean | null
          id: string
          impressions: number | null
          indexable: boolean | null
          internal_link_depth: number | null
          page_id: string
          page_opportunity_score: number | null
          paid_clicks: number | null
          paid_conversions: number | null
          paid_cost: number | null
          paid_revenue: number | null
          paid_risk_score: number | null
          priority_bucket: string | null
          revenue: number | null
          revenue_score: number | null
          schema_types: Json | null
          sessions: number | null
          snapshot_id: string
          structural_score: number | null
          visibility_score: number | null
        }
        Insert: {
          avg_position?: number | null
          canonical_ok?: boolean | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          ctr?: number | null
          has_h1?: boolean | null
          has_meta?: boolean | null
          has_title?: boolean | null
          id?: string
          impressions?: number | null
          indexable?: boolean | null
          internal_link_depth?: number | null
          page_id: string
          page_opportunity_score?: number | null
          paid_clicks?: number | null
          paid_conversions?: number | null
          paid_cost?: number | null
          paid_revenue?: number | null
          paid_risk_score?: number | null
          priority_bucket?: string | null
          revenue?: number | null
          revenue_score?: number | null
          schema_types?: Json | null
          sessions?: number | null
          snapshot_id: string
          structural_score?: number | null
          visibility_score?: number | null
        }
        Update: {
          avg_position?: number | null
          canonical_ok?: boolean | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          ctr?: number | null
          has_h1?: boolean | null
          has_meta?: boolean | null
          has_title?: boolean | null
          id?: string
          impressions?: number | null
          indexable?: boolean | null
          internal_link_depth?: number | null
          page_id?: string
          page_opportunity_score?: number | null
          paid_clicks?: number | null
          paid_conversions?: number | null
          paid_cost?: number | null
          paid_revenue?: number | null
          paid_risk_score?: number | null
          priority_bucket?: string | null
          revenue?: number | null
          revenue_score?: number | null
          schema_types?: Json | null
          sessions?: number | null
          snapshot_id?: string
          structural_score?: number | null
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scc_page_snapshot_metrics_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "scc_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scc_page_snapshot_metrics_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "scc_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      scc_pages: {
        Row: {
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          page_type: string | null
          site_id: string
          url: string
        }
        Insert: {
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          page_type?: string | null
          site_id: string
          url: string
        }
        Update: {
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          page_type?: string | null
          site_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "scc_pages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "scc_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      scc_queries: {
        Row: {
          first_seen_at: string | null
          id: string
          intent_type: string | null
          last_seen_at: string | null
          query_category: string | null
          query_text: string
          site_id: string
        }
        Insert: {
          first_seen_at?: string | null
          id?: string
          intent_type?: string | null
          last_seen_at?: string | null
          query_category?: string | null
          query_text: string
          site_id: string
        }
        Update: {
          first_seen_at?: string | null
          id?: string
          intent_type?: string | null
          last_seen_at?: string | null
          query_category?: string | null
          query_text?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scc_queries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "scc_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      scc_query_snapshot_metrics: {
        Row: {
          avg_position: number | null
          clicks: number | null
          created_at: string | null
          ctr: number | null
          id: string
          impressions: number | null
          opportunity_score: number | null
          priority_bucket: string | null
          query_id: string
          snapshot_id: string
          visibility_score: number | null
        }
        Insert: {
          avg_position?: number | null
          clicks?: number | null
          created_at?: string | null
          ctr?: number | null
          id?: string
          impressions?: number | null
          opportunity_score?: number | null
          priority_bucket?: string | null
          query_id: string
          snapshot_id: string
          visibility_score?: number | null
        }
        Update: {
          avg_position?: number | null
          clicks?: number | null
          created_at?: string | null
          ctr?: number | null
          id?: string
          impressions?: number | null
          opportunity_score?: number | null
          priority_bucket?: string | null
          query_id?: string
          snapshot_id?: string
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scc_query_snapshot_metrics_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "scc_queries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scc_query_snapshot_metrics_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "scc_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      scc_sites: {
        Row: {
          cms_detected: string | null
          country: string | null
          created_at: string | null
          id: string
          industry: string | null
          site_url: string
          user_id: string
        }
        Insert: {
          cms_detected?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          site_url: string
          user_id: string
        }
        Update: {
          cms_detected?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          site_url?: string
          user_id?: string
        }
        Relationships: []
      }
      scc_snapshots: {
        Row: {
          created_at: string | null
          finished_at: string | null
          id: string
          mode: string
          notes: string | null
          site_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          finished_at?: string | null
          id?: string
          mode: string
          notes?: string | null
          site_id: string
          started_at?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          notes?: string | null
          site_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scc_snapshots_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "scc_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      trends: {
        Row: {
          active: boolean | null
          created_at: string
          hashtags: string | null
          id: string
          premium_only: boolean | null
          region: string | null
          trend_name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          hashtags?: string | null
          id?: string
          premium_only?: boolean | null
          region?: string | null
          trend_name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          hashtags?: string | null
          id?: string
          premium_only?: boolean | null
          region?: string | null
          trend_name?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          account_type: string
          brand_name: string | null
          business_summary: string | null
          created_at: string
          email: string | null
          full_name: string | null
          geography: string | null
          industry: string | null
          industry_other: string | null
          instagram: string | null
          linkedin: string | null
          location: string | null
          logo_url: string | null
          tiktok: string | null
          updated_at: string | null
          user_id: string
          website: string | null
          youtube: string | null
        }
        Insert: {
          account_type?: string
          brand_name?: string | null
          business_summary?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          geography?: string | null
          industry?: string | null
          industry_other?: string | null
          instagram?: string | null
          linkedin?: string | null
          location?: string | null
          logo_url?: string | null
          tiktok?: string | null
          updated_at?: string | null
          user_id: string
          website?: string | null
          youtube?: string | null
        }
        Update: {
          account_type?: string
          brand_name?: string | null
          business_summary?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          geography?: string | null
          industry?: string | null
          industry_other?: string | null
          instagram?: string | null
          linkedin?: string | null
          location?: string | null
          logo_url?: string | null
          tiktok?: string | null
          updated_at?: string | null
          user_id?: string
          website?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
