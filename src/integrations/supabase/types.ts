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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          metadata?: Json
        }
        Relationships: []
      }
      bet_selections: {
        Row: {
          bet_id: string
          event_id: string
          event_label: string
          id: number
          market_key: string
          market_name: string
          odds: number
          selection_key: string
          selection_label: string
          status: string
        }
        Insert: {
          bet_id: string
          event_id: string
          event_label: string
          id?: number
          market_key: string
          market_name: string
          odds: number
          selection_key: string
          selection_label: string
          status?: string
        }
        Update: {
          bet_id?: string
          event_id?: string
          event_label?: string
          id?: number
          market_key?: string
          market_name?: string
          odds?: number
          selection_key?: string
          selection_label?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bet_selections_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          code: string
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          potential_payout: number
          settled_at: string | null
          stake: number
          status: string
          total_odds: number
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          potential_payout: number
          settled_at?: string | null
          stake: number
          status?: string
          total_odds: number
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          potential_payout?: number
          settled_at?: string | null
          stake?: number
          status?: string
          total_odds?: number
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account: string
          amount: number
          created_at: string
          currency: string
          direction: string
          id: number
          transaction_id: string
          wallet_id: string | null
        }
        Insert: {
          account: string
          amount: number
          created_at?: string
          currency?: string
          direction: string
          id?: number
          transaction_id: string
          wallet_id?: string | null
        }
        Update: {
          account?: string
          amount?: number
          created_at?: string
          currency?: string
          direction?: string
          id?: number
          transaction_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otps: {
        Row: {
          attempts: number
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          purpose: string
        }
        Insert: {
          attempts?: number
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          purpose?: string
        }
        Update: {
          attempts?: number
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
        }
        Relationships: []
      }
      platform_config: {
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
      profiles: {
        Row: {
          account_status: string
          country: string
          created_at: string
          currency: string
          date_of_birth: string | null
          display_name: string | null
          email: string | null
          id: string
          kyc_status: string
          national_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          country?: string
          created_at?: string
          currency?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          kyc_status?: string
          national_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          country?: string
          created_at?: string
          currency?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          kyc_status?: string
          national_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sb_events: {
        Row: {
          away: string
          country: string
          created_at: string
          day_bucket: string
          home: string
          id: string
          is_live: boolean
          league: string
          sport: string
          starts_label: string
          status: string
        }
        Insert: {
          away: string
          country: string
          created_at?: string
          day_bucket: string
          home: string
          id: string
          is_live?: boolean
          league: string
          sport: string
          starts_label: string
          status?: string
        }
        Update: {
          away?: string
          country?: string
          created_at?: string
          day_bucket?: string
          home?: string
          id?: string
          is_live?: boolean
          league?: string
          sport?: string
          starts_label?: string
          status?: string
        }
        Relationships: []
      }
      sb_markets: {
        Row: {
          event_id: string
          id: string
          market_key: string
          name: string
          status: string
        }
        Insert: {
          event_id: string
          id: string
          market_key: string
          name: string
          status?: string
        }
        Update: {
          event_id?: string
          id?: string
          market_key?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sb_markets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sb_events"
            referencedColumns: ["id"]
          },
        ]
      }
      sb_selections: {
        Row: {
          id: number
          label: string
          market_id: string
          odds: number
          selection_key: string
          status: string
        }
        Insert: {
          id?: number
          label: string
          market_id: string
          odds: number
          selection_key: string
          status?: string
        }
        Update: {
          id?: number
          label?: string
          market_id?: string
          odds?: number
          selection_key?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sb_selections_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "sb_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          direction: string
          id: string
          idempotency_key: string
          metadata: Json
          reference: string | null
          status: string
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          direction: string
          id?: string
          idempotency_key: string
          metadata?: Json
          reference?: string | null
          status?: string
          type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          direction?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          reference?: string | null
          status?: string
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          created_at: string
          currency: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      place_bet: {
        Args: {
          _idempotency_key: string
          _picks: Json
          _stake: number
          _user_id: string
        }
        Returns: string
      }
      wallet_balance: { Args: { _user_id: string }; Returns: number }
      wallet_transact: {
        Args: {
          _amount: number
          _counter_account: string
          _direction: string
          _idempotency_key: string
          _metadata?: Json
          _reference?: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "player" | "agent" | "cashier" | "trader" | "admin"
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
    Enums: {
      app_role: ["player", "agent", "cashier", "trader", "admin"],
    },
  },
} as const
