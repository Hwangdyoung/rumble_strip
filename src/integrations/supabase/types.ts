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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          action_type: string
          alert_id: string | null
          created_at: string
          id: string
          memo: string
          patient_id: string
          staff_id: string
        }
        Insert: {
          action_type: string
          alert_id?: string | null
          created_at?: string
          id?: string
          memo?: string
          patient_id: string
          staff_id?: string
        }
        Update: {
          action_type?: string
          alert_id?: string | null
          created_at?: string
          id?: string
          memo?: string
          patient_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_handoffs: {
        Row: {
          alert_id: string
          created_at: string
          from_staff: string | null
          id: string
          note: string
          patient_id: string
          reason: string
          to_staff: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          from_staff?: string | null
          id?: string
          note?: string
          patient_id: string
          reason: string
          to_staff: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          from_staff?: string | null
          id?: string
          note?: string
          patient_id?: string
          reason?: string
          to_staff?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_handoffs_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_handoffs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_handoffs_from_staff_fkey"
            columns: ["from_staff"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_handoffs_to_staff_fkey"
            columns: ["to_staff"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_level: string | null
          alert_score: number | null
          assigned_at: string | null
          assignee_id: string | null
          created_at: string
          id: string
          message: string
          outcome: string
          outcome_at: string | null
          outcome_note: string | null
          patient_id: string
          resolved_at: string | null
          risk_score_id: string | null
          status: string
        }
        Insert: {
          alert_level?: string | null
          alert_score?: number | null
          assigned_at?: string | null
          assignee_id?: string | null
          created_at?: string
          id?: string
          message: string
          outcome?: string
          outcome_at?: string | null
          outcome_note?: string | null
          patient_id: string
          resolved_at?: string | null
          risk_score_id?: string | null
          status?: string
        }
        Update: {
          alert_level?: string | null
          alert_score?: number | null
          assigned_at?: string | null
          assignee_id?: string | null
          created_at?: string
          id?: string
          message?: string
          outcome?: string
          outcome_at?: string | null
          outcome_note?: string | null
          patient_id?: string
          resolved_at?: string | null
          risk_score_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_risk_score_id_fkey"
            columns: ["risk_score_id"]
            isOneToOne: false
            referencedRelation: "risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          alert_id: string | null
          assignee_id: string | null
          created_at: string
          created_by: string | null
          done_at: string | null
          due_date: string
          id: string
          note: string
          patient_id: string
        }
        Insert: {
          alert_id?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date: string
          id?: string
          note?: string
          patient_id: string
        }
        Update: {
          alert_id?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date?: string
          id?: string
          note?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_staff: {
        Row: {
          created_at: string
          is_contact: boolean
          patient_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          is_contact?: boolean
          patient_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          is_contact?: boolean
          patient_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_staff_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: number
          created_at: string
          id: string
          name: string
          prescription_start_date: string
          prescription_weeks: number
          session_target_minutes: number
          weekly_target_days: number
        }
        Insert: {
          age: number
          created_at?: string
          id?: string
          name: string
          prescription_start_date: string
          prescription_weeks?: number
          session_target_minutes?: number
          weekly_target_days?: number
        }
        Update: {
          age?: number
          created_at?: string
          id?: string
          name?: string
          prescription_start_date?: string
          prescription_weeks?: number
          session_target_minutes?: number
          weekly_target_days?: number
        }
        Relationships: []
      }
      play_logs: {
        Row: {
          accuracy: number | null
          ended_early: boolean
          id: string
          patient_id: string
          play_minutes: number
          reaction_ms: number | null
          session_end: string
          session_start: string
          tasks_completed: number
        }
        Insert: {
          accuracy?: number | null
          ended_early?: boolean
          id?: string
          patient_id: string
          play_minutes: number
          reaction_ms?: number | null
          session_end: string
          session_start: string
          tasks_completed?: number
        }
        Update: {
          accuracy?: number | null
          ended_early?: boolean
          id?: string
          patient_id?: string
          play_minutes?: number
          reaction_ms?: number | null
          session_end?: string
          session_start?: string
          tasks_completed?: number
        }
        Relationships: [
          {
            foreignKeyName: "play_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_scores: {
        Row: {
          calculated_at: string
          check_date: string | null
          id: string
          level: string
          patient_id: string
          reasons: Json
          score: number
          source: string
        }
        Insert: {
          calculated_at?: string
          check_date?: string | null
          id?: string
          level: string
          patient_id: string
          reasons?: Json
          score: number
          source?: string
        }
        Update: {
          calculated_at?: string
          check_date?: string | null
          id?: string
          level?: string
          patient_id?: string
          reasons?: Json
          score?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_scores_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          name: string
          role: string
        }
        Insert: {
          created_at?: string
          id: string
          is_admin?: boolean
          name: string
          role: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          name?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_patient: { Args: { pid: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
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