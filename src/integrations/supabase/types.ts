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
      clock_entries: {
        Row: {
          approval_notes: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          break_duration: number | null
          break_end: string | null
          break_start: string | null
          clock_in: string
          clock_out: string | null
          created_at: string | null
          id: string
          last_location_update: string | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          total_hours: number | null
          user_id: string
        }
        Insert: {
          approval_notes?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_duration?: number | null
          break_end?: string | null
          break_start?: string | null
          clock_in: string
          clock_out?: string | null
          created_at?: string | null
          id?: string
          last_location_update?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          total_hours?: number | null
          user_id: string
        }
        Update: {
          approval_notes?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_duration?: number | null
          break_end?: string | null
          break_start?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string | null
          id?: string
          last_location_update?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          total_hours?: number | null
          user_id?: string
        }
        Relationships: []
      }
      job_updates: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          notes: string | null
          photo_urls: string[] | null
          update_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          notes?: string | null
          photo_urls?: string[] | null
          update_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          photo_urls?: string[] | null
          update_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_updates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          customer_address: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          estimated_duration: number | null
          id: string
          job_description: string
          job_type: string | null
          materials_checklist: Json | null
          materials_completion: number | null
          materials_required: string | null
          notes: string | null
          priority: string | null
          safety_checklist: Json | null
          safety_completion: number | null
          safety_requirements: string | null
          scheduled_end: string | null
          scheduled_start: string
          signature_url: string | null
          status: string | null
          updated_at: string | null
          work_completion: number | null
          work_progress: Json | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          estimated_duration?: number | null
          id?: string
          job_description: string
          job_type?: string | null
          materials_checklist?: Json | null
          materials_completion?: number | null
          materials_required?: string | null
          notes?: string | null
          priority?: string | null
          safety_checklist?: Json | null
          safety_completion?: number | null
          safety_requirements?: string | null
          scheduled_end?: string | null
          scheduled_start: string
          signature_url?: string | null
          status?: string | null
          updated_at?: string | null
          work_completion?: number | null
          work_progress?: Json | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          estimated_duration?: number | null
          id?: string
          job_description?: string
          job_type?: string | null
          materials_checklist?: Json | null
          materials_completion?: number | null
          materials_required?: string | null
          notes?: string | null
          priority?: string | null
          safety_checklist?: Json | null
          safety_completion?: number | null
          safety_requirements?: string | null
          scheduled_end?: string | null
          scheduled_start?: string
          signature_url?: string | null
          status?: string | null
          updated_at?: string | null
          work_completion?: number | null
          work_progress?: Json | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          read: boolean
          related_job_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          read?: boolean
          related_job_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          read?: boolean
          related_job_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      photo_approvals: {
        Row: {
          comments: string | null
          created_at: string
          id: string
          job_update_id: string
          photo_url: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: string
          job_update_id: string
          photo_url: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: string
          job_update_id?: string
          photo_url?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_approvals_job_update_id_fkey"
            columns: ["job_update_id"]
            isOneToOne: false
            referencedRelation: "job_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_checklist_completion: {
        Args: { checklist: Json }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "staff" | "supervisor" | "manager"
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
    Enums: {
      app_role: ["staff", "supervisor", "manager"],
    },
  },
} as const
