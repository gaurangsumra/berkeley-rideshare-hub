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
      calendar_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          provider: string
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          provider?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          provider?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_access: {
        Row: {
          event_id: string
          granted_at: string | null
          granted_via_ride_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          event_id: string
          granted_at?: string | null
          granted_via_ride_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          event_id?: string
          granted_at?: string | null
          granted_via_ride_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_access_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_access_granted_via_ride_id_fkey"
            columns: ["granted_via_ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_comments: {
        Row: {
          comment: string
          created_at: string | null
          event_id: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string | null
          event_id: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string | null
          event_id?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          city: string
          created_at: string | null
          created_by: string
          date_time: string
          description: string | null
          destination: string
          id: string
          name: string
          search_vector: unknown
        }
        Insert: {
          city: string
          created_at?: string | null
          created_by: string
          date_time: string
          description?: string | null
          destination: string
          id?: string
          name: string
          search_vector?: unknown
        }
        Update: {
          city?: string
          created_at?: string | null
          created_by?: string
          date_time?: string
          description?: string | null
          destination?: string
          id?: string
          name?: string
          search_vector?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_submissions: {
        Row: {
          admin_notes: string | null
          contact_email: string
          created_at: string | null
          description: string
          feedback_type: string
          id: string
          ride_id: string | null
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          contact_email: string
          created_at?: string | null
          description: string
          feedback_type: string
          id?: string
          ride_id?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          contact_email?: string
          created_at?: string | null
          description?: string
          feedback_type?: string
          id?: string
          ride_id?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_submissions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_votes: {
        Row: {
          created_at: string | null
          id: string
          ride_id: string
          user_id: string
          vote_option: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ride_id: string
          user_id: string
          vote_option: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ride_id?: string
          user_id?: string
          vote_option?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_votes_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          ride_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          ride_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          ride_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_confirmations: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          id: string
          uber_payment_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          uber_payment_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          uber_payment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_confirmations_uber_payment_id_fkey"
            columns: ["uber_payment_id"]
            isOneToOne: false
            referencedRelation: "uber_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          created_at: string | null
          id: string
          last_reminder_sent: string | null
          payment_confirmed: boolean | null
          reminder_count: number | null
          uber_payment_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_reminder_sent?: string | null
          payment_confirmed?: boolean | null
          reminder_count?: number | null
          uber_payment_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_reminder_sent?: string | null
          payment_confirmed?: boolean | null
          reminder_count?: number | null
          uber_payment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_uber_payment_id_fkey"
            columns: ["uber_payment_id"]
            isOneToOne: false
            referencedRelation: "uber_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          invited_via_ride_id: string | null
          is_invited_user: boolean | null
          name: string
          photo: string | null
          program: string | null
          venmo_username: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          invited_via_ride_id?: string | null
          is_invited_user?: boolean | null
          name: string
          photo?: string | null
          program?: string | null
          venmo_username?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          invited_via_ride_id?: string | null
          is_invited_user?: boolean | null
          name?: string
          photo?: string | null
          program?: string | null
          venmo_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_via_ride_id_fkey"
            columns: ["invited_via_ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_attendance_responses: {
        Row: {
          attended_user_ids: string[]
          id: string
          responded_at: string | null
          respondent_user_id: string
          ride_id: string
          survey_id: string
        }
        Insert: {
          attended_user_ids: string[]
          id?: string
          responded_at?: string | null
          respondent_user_id: string
          ride_id: string
          survey_id: string
        }
        Update: {
          attended_user_ids?: string[]
          id?: string
          responded_at?: string | null
          respondent_user_id?: string
          ride_id?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_attendance_responses_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_attendance_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "ride_attendance_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_attendance_surveys: {
        Row: {
          consensus_processed: boolean
          created_at: string | null
          id: string
          responses_received: number
          ride_id: string
          survey_deadline: string
          survey_sent_at: string | null
          survey_status: Database["public"]["Enums"]["survey_status"]
          total_members: number
          updated_at: string | null
        }
        Insert: {
          consensus_processed?: boolean
          created_at?: string | null
          id?: string
          responses_received?: number
          ride_id: string
          survey_deadline: string
          survey_sent_at?: string | null
          survey_status?: Database["public"]["Enums"]["survey_status"]
          total_members: number
          updated_at?: string | null
        }
        Update: {
          consensus_processed?: boolean
          created_at?: string | null
          id?: string
          responses_received?: number
          ride_id?: string
          survey_deadline?: string
          survey_sent_at?: string | null
          survey_status?: Database["public"]["Enums"]["survey_status"]
          total_members?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_attendance_surveys_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: true
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_completions: {
        Row: {
          completed_at: string | null
          confirmed_by_consensus: boolean
          id: string
          ride_id: string
          total_voters: number
          user_id: string
          vote_count: number
        }
        Insert: {
          completed_at?: string | null
          confirmed_by_consensus?: boolean
          id?: string
          ride_id: string
          total_voters: number
          user_id: string
          vote_count: number
        }
        Update: {
          completed_at?: string | null
          confirmed_by_consensus?: boolean
          id?: string
          ride_id?: string
          total_voters?: number
          user_id?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ride_completions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_group_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          ride_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          ride_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          ride_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_group_messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_groups: {
        Row: {
          capacity: number | null
          created_at: string | null
          created_by: string
          departure_time: string
          event_id: string
          id: string
          meeting_point: string | null
          min_capacity: number | null
          travel_mode: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          created_by: string
          departure_time: string
          event_id: string
          id?: string
          meeting_point?: string | null
          min_capacity?: number | null
          travel_mode: string
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          created_by?: string
          departure_time?: string
          event_id?: string
          id?: string
          meeting_point?: string | null
          min_capacity?: number | null
          travel_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          invite_token: string
          invited_email: string | null
          inviter_name: string | null
          max_uses: number | null
          ride_id: string
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          invite_token: string
          invited_email?: string | null
          inviter_name?: string | null
          max_uses?: number | null
          ride_id: string
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_email?: string | null
          inviter_name?: string | null
          max_uses?: number | null
          ride_id?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ride_invites_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_members: {
        Row: {
          created_at: string | null
          id: string
          ride_id: string
          role: string | null
          status: string | null
          user_id: string
          willing_to_pay: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ride_id: string
          role?: string | null
          status?: string | null
          user_id: string
          willing_to_pay?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ride_id?: string
          role?: string | null
          status?: string | null
          user_id?: string
          willing_to_pay?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_members_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_message_reads: {
        Row: {
          id: string
          last_read_at: string | null
          ride_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string | null
          ride_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string | null
          ride_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_message_reads_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      uber_payments: {
        Row: {
          amount: number | null
          cost_type: string | null
          created_at: string | null
          id: string
          payer_user_id: string
          payer_venmo_username: string | null
          ride_id: string
          venmo_link: string | null
        }
        Insert: {
          amount?: number | null
          cost_type?: string | null
          created_at?: string | null
          id?: string
          payer_user_id: string
          payer_venmo_username?: string | null
          ride_id: string
          venmo_link?: string | null
        }
        Update: {
          amount?: number | null
          cost_type?: string | null
          created_at?: string | null
          id?: string
          payer_user_id?: string
          payer_venmo_username?: string | null
          ride_id?: string
          venmo_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uber_payments_payer_user_id_fkey"
            columns: ["payer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uber_payments_payer_user_id_fkey"
            columns: ["payer_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uber_payments_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          rated_user_id: string
          rater_user_id: string
          rating: number | null
          ride_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rated_user_id: string
          rater_user_id: string
          rating?: number | null
          ride_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rated_user_id?: string
          rater_user_id?: string
          rating?: number | null
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          photo: string | null
          program: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          photo?: string | null
          program?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          photo?: string | null
          program?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_ride_stats: {
        Args: { user_uuid: string }
        Returns: {
          completed_rides: number
          completion_percentage: number
          total_rides: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      search_events: {
        Args: { search_query: string }
        Returns: {
          city: string
          created_at: string
          created_by: string
          date_time: string
          description: string
          destination: string
          id: string
          name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      notification_type:
        | "new_message"
        | "member_joined"
        | "member_left"
        | "group_full"
        | "group_ready"
        | "meeting_point_tie"
        | "ride_starting_soon"
        | "payment_amount_entered"
        | "payment_reminder"
        | "payment_confirmed"
        | "venmo_required"
      survey_status: "pending" | "in_progress" | "completed" | "expired"
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
      app_role: ["admin", "moderator", "user"],
      notification_type: [
        "new_message",
        "member_joined",
        "member_left",
        "group_full",
        "group_ready",
        "meeting_point_tie",
        "ride_starting_soon",
        "payment_amount_entered",
        "payment_reminder",
        "payment_confirmed",
        "venmo_required",
      ],
      survey_status: ["pending", "in_progress", "completed", "expired"],
    },
  },
} as const
