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
      profiles: {
        Row: {
          id: string
          name: string | null
          phone: string | null
          plan: string | null
          trial_ends_at: string | null
          timezone: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          name?: string | null
          phone?: string | null
          plan?: string | null
          trial_ends_at?: string | null
          timezone?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          phone?: string | null
          plan?: string | null
          trial_ends_at?: string | null
          timezone?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          id: string
          user_id: string
          name: string
          purchase_value: number | null
          expected_rent: number | null
          type: string | null
          status: string | null
          address: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          purchase_value?: number | null
          expected_rent?: number | null
          type?: string | null
          status?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          purchase_value?: number | null
          expected_rent?: number | null
          type?: string | null
          status?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          phone: string | null
          document: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email?: string | null
          phone?: string | null
          document?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          document?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      leases: {
        Row: {
          id: string
          user_id: string
          property_id: string
          tenant_id: string
          rent_value: number
          due_day: number | null
          start_date: string
          end_date: string | null
          active: boolean | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          tenant_id: string
          rent_value: number
          due_day?: number | null
          start_date: string
          end_date?: string | null
          active?: boolean | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          tenant_id?: string
          rent_value?: number
          due_day?: number | null
          start_date?: string
          end_date?: string | null
          active?: boolean | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_history: {
        Row: {
          id: string
          lease_id: string
          user_id: string
          previous_value: number
          new_value: number
          index_used: string | null
          adjustment_date: string
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          lease_id: string
          user_id: string
          previous_value: number
          new_value: number
          index_used?: string | null
          adjustment_date: string
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          lease_id?: string
          user_id?: string
          previous_value?: number
          new_value?: number
          index_used?: string | null
          adjustment_date?: string
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_history_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          user_id: string | null
          name: string
          type: string | null
          is_system: boolean | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          type?: string | null
          is_system?: boolean | null
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          type?: string | null
          is_system?: boolean | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          lease_id: string | null
          property_id: string
          category_id: string | null
          type: string
          amount: number
          due_date: string
          billing_month: string
          paid_date: string | null
          status: string | null
          is_auto_generated: boolean | null
          recurrence: string | null
          recurrence_day: number | null
          recurrence_start_date: string | null
          recurrence_end_date: string | null
          recurrence_group_id: string | null
          notes: string | null
          attachment_url: string | null
          parent_transaction_id: string | null
          created_at: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          lease_id?: string | null
          property_id: string
          category_id?: string | null
          type: string
          amount: number
          due_date: string
          billing_month: string
          paid_date?: string | null
          status?: string | null
          is_auto_generated?: boolean | null
          recurrence?: string | null
          recurrence_day?: number | null
          recurrence_start_date?: string | null
          recurrence_end_date?: string | null
          recurrence_group_id?: string | null
          notes?: string | null
          attachment_url?: string | null
          parent_transaction_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          lease_id?: string | null
          property_id?: string
          category_id?: string | null
          type?: string
          amount?: number
          due_date?: string
          billing_month?: string
          paid_date?: string | null
          status?: string | null
          is_auto_generated?: boolean | null
          recurrence?: string | null
          recurrence_day?: number | null
          recurrence_start_date?: string | null
          recurrence_end_date?: string | null
          recurrence_group_id?: string | null
          notes?: string | null
          attachment_url?: string | null
          parent_transaction_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_config: {
        Row: {
          id: string
          user_id: string
          ibs_rate: number | null
          cbs_rate: number | null
          exemption_revenue_limit: number | null
          exemption_property_count: number | null
          residential_deduction: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          ibs_rate?: number | null
          cbs_rate?: number | null
          exemption_revenue_limit?: number | null
          exemption_property_count?: number | null
          residential_deduction?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          ibs_rate?: number | null
          cbs_rate?: number | null
          exemption_revenue_limit?: number | null
          exemption_property_count?: number | null
          residential_deduction?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          id: string
          job_name: string
          run_at: string | null
          status: string | null
          rows_affected: number | null
          error_message: string | null
          duration_ms: number | null
        }
        Insert: {
          id?: string
          job_name: string
          run_at?: string | null
          status?: string | null
          rows_affected?: number | null
          error_message?: string | null
          duration_ms?: number | null
        }
        Update: {
          id?: string
          job_name?: string
          run_at?: string | null
          status?: string | null
          rows_affected?: number | null
          error_message?: string | null
          duration_ms?: number | null
        }
        Relationships: []
      }
      domain_events: {
        Row: {
          id: string
          user_id: string | null
          event_type: string
          event_version: number | null
          source: string
          payload: Json
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          event_type: string
          event_version?: number | null
          source?: string
          payload: Json
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          event_type?: string
          event_version?: number | null
          source?: string
          payload?: Json
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      active_transactions: {
        Row: {
          id: string | null
          user_id: string | null
          lease_id: string | null
          property_id: string | null
          category_id: string | null
          type: string | null
          amount: number | null
          due_date: string | null
          billing_month: string | null
          paid_date: string | null
          status: string | null
          is_auto_generated: boolean | null
          recurrence: string | null
          recurrence_day: number | null
          recurrence_start_date: string | null
          recurrence_end_date: string | null
          recurrence_group_id: string | null
          notes: string | null
          attachment_url: string | null
          parent_transaction_id: string | null
          created_at: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions_view: {
        Row: {
          id: string | null
          user_id: string | null
          lease_id: string | null
          property_id: string | null
          category_id: string | null
          type: string | null
          amount: number | null
          due_date: string | null
          billing_month: string | null
          paid_date: string | null
          status: string | null
          is_auto_generated: boolean | null
          notes: string | null
          attachment_url: string | null
          recurrence: string | null
          recurrence_group_id: string | null
          parent_transaction_id: string | null
          created_at: string | null
          updated_at: string | null
          updated_by: string | null
          xmin: string | null
          property_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      user_today: {
        Args: {
          p_user_id: string
        }
        Returns: string
      }
      get_plan_limit: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      generate_monthly_rents: {
        Args: Record<string, never>
        Returns: number
      }
      generate_recurring_expenses: {
        Args: Record<string, never>
        Returns: number
      }
      recompute_statuses: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      try_acquire_job_lock: {
        Args: {
          p_job_name: string
        }
        Returns: boolean
      }
      release_job_lock: {
        Args: {
          p_job_name: string
        }
        Returns: undefined
      }
      backfill_lease_history: {
        Args: {
          p_lease_id: string
        }
        Returns: number
      }
      update_transaction_optimistic: {
        Args: {
          p_id: string
          p_expected_xmin: string
          p_new_status: string
          p_paid_date?: string | null
        }
        Returns: boolean
      }
      edit_transaction_fields: {
        Args: {
          p_id: string
          p_expected_xmin: string
          p_notes?: string | null
          p_category_id?: string | null
        }
        Returns: boolean
      }
      edit_recurring_series: {
        Args: {
          p_group_id: string
          p_notes?: string | null
          p_category_id?: string | null
          p_amount?: number | null
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for convenience
export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never
