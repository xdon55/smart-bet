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
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bet_legs: {
        Row: {
          bet_id: string
          event_id: string
          id: string
          market_id: string
          odds_at_placement: number
          selection_id: string
          settled_at: string | null
          status: Database["public"]["Enums"]["leg_status"]
        }
        Insert: {
          bet_id: string
          event_id: string
          id?: string
          market_id: string
          odds_at_placement: number
          selection_id: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["leg_status"]
        }
        Update: {
          bet_id?: string
          event_id?: string
          id?: string
          market_id?: string
          odds_at_placement?: number
          selection_id?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["leg_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bet_legs_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_legs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_legs_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_legs_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "selections"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          bet_type: Database["public"]["Enums"]["bet_type"]
          cashout_amount: number | null
          currency: string
          id: string
          ip_address: string | null
          is_free_bet: boolean
          payout: number
          placed_at: string
          potential_payout: number
          settled_at: string | null
          stake: number
          status: Database["public"]["Enums"]["bet_status"]
          total_odds: number
          user_bonus_id: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          bet_type: Database["public"]["Enums"]["bet_type"]
          cashout_amount?: number | null
          currency?: string
          id?: string
          ip_address?: string | null
          is_free_bet?: boolean
          payout?: number
          placed_at?: string
          potential_payout: number
          settled_at?: string | null
          stake: number
          status?: Database["public"]["Enums"]["bet_status"]
          total_odds: number
          user_bonus_id?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          bet_type?: Database["public"]["Enums"]["bet_type"]
          cashout_amount?: number | null
          currency?: string
          id?: string
          ip_address?: string | null
          is_free_bet?: boolean
          payout?: number
          placed_at?: string
          potential_payout?: number
          settled_at?: string | null
          stake?: number
          status?: Database["public"]["Enums"]["bet_status"]
          total_odds?: number
          user_bonus_id?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_user_bonus_fk"
            columns: ["user_bonus_id"]
            isOneToOne: false
            referencedRelation: "user_bonuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_code_legs: {
        Row: {
          booking_code_id: string
          id: string
          odds: number
          selection_id: string
          sort_order: number
        }
        Insert: {
          booking_code_id: string
          id?: string
          odds: number
          selection_id: string
          sort_order?: number
        }
        Update: {
          booking_code_id?: string
          id?: string
          odds?: number
          selection_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_code_legs_booking_code_id_fkey"
            columns: ["booking_code_id"]
            isOneToOne: false
            referencedRelation: "booking_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_code_legs_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "selections"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_codes: {
        Row: {
          code: string
          created_at: string
          currency: string
          expires_at: string
          id: string
          leg_count: number
          load_count: number
          stake: number | null
          total_odds: number
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          leg_count?: number
          load_count?: number
          stake?: number | null
          total_odds?: number
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          leg_count?: number
          load_count?: number
          stake?: number | null
          total_odds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_codes_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "booking_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          decimals: number
          is_active: boolean
          name: string
          symbol: string | null
        }
        Insert: {
          code: string
          decimals?: number
          is_active?: boolean
          name: string
          symbol?: string | null
        }
        Update: {
          code?: string
          decimals?: number
          is_active?: boolean
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          fee: number
          id: string
          ip_address: string | null
          payment_method_id: string | null
          provider: string
          provider_reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          fee?: number
          id?: string
          ip_address?: string | null
          payment_method_id?: string | null
          provider: string
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          fee?: number
          id?: string
          ip_address?: string | null
          payment_method_id?: string | null
          provider?: string
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          created_at: string
          external_id: string | null
          home_score: number | null
          home_team_id: string | null
          id: string
          is_featured: boolean
          league_id: string
          name: string
          result_data: Json
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          external_id?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          is_featured?: boolean
          league_id: string
          name: string
          result_data?: Json
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          external_id?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          is_featured?: boolean
          league_id?: string
          name?: string
          result_data?: Json
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_documents: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["kyc_doc_type"]
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: Database["public"]["Enums"]["kyc_doc_type"]
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["kyc_doc_type"]
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          country_code: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          sport_id: string
        }
        Insert: {
          country_code?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          sport_id: string
        }
        Update: {
          country_code?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          currency: string
          description: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          reference_id: string | null
          reference_type: string | null
          transaction_type: Database["public"]["Enums"]["ledger_tx_type"]
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: Database["public"]["Enums"]["ledger_tx_type"]
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: Database["public"]["Enums"]["ledger_tx_type"]
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      market_types: {
        Row: {
          code: string
          description: string | null
          id: string
          name: string
          sport_id: string | null
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          name: string
          sport_id?: string | null
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          name?: string
          sport_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_types_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          closes_at: string | null
          created_at: string
          event_id: string
          id: string
          is_live: boolean
          line: number | null
          market_type_id: string
          name: string
          settled_at: string | null
          status: Database["public"]["Enums"]["market_status"]
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          is_live?: boolean
          line?: number | null
          market_type_id: string
          name: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          is_live?: boolean
          line?: number | null
          market_type_id?: string
          name?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "markets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_market_type_id_fkey"
            columns: ["market_type_id"]
            isOneToOne: false
            referencedRelation: "market_types"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          is_read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      odds_history: {
        Row: {
          id: number
          odds: number
          recorded_at: string
          selection_id: string
        }
        Insert: {
          id?: number
          odds: number
          recorded_at?: string
          selection_id: string
        }
        Update: {
          id?: number
          odds?: number
          recorded_at?: string
          selection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odds_history_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "selections"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          is_verified: boolean
          label: string | null
          method_type: Database["public"]["Enums"]["payment_method_type"]
          provider: string
          provider_token: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          label?: string | null
          method_type: Database["public"]["Enums"]["payment_method_type"]
          provider: string
          provider_token?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          label?: string | null
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          provider?: string
          provider_token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      profiles: {
        Row: {
          address_line: string | null
          city: string | null
          country_code: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string | null
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          language: string
          last_login_at: string | null
          last_name: string | null
          marketing_opt_in: boolean
          national_id: string | null
          odds_format: string
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          terms_accepted_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          address_line?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          language?: string
          last_login_at?: string | null
          last_name?: string | null
          marketing_opt_in?: boolean
          national_id?: string | null
          odds_format?: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          address_line?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          language?: string
          last_login_at?: string | null
          last_name?: string | null
          marketing_opt_in?: boolean
          national_id?: string | null
          odds_format?: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          bonus_type: Database["public"]["Enums"]["bonus_type"]
          code: string | null
          created_at: string
          currency: string | null
          description: string | null
          ends_at: string | null
          fixed_amount: number | null
          id: string
          is_active: boolean
          match_percent: number | null
          max_bonus_amount: number | null
          max_redemptions: number | null
          min_deposit: number | null
          min_odds: number | null
          name: string
          starts_at: string
          wagering_multiplier: number
        }
        Insert: {
          bonus_type: Database["public"]["Enums"]["bonus_type"]
          code?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          ends_at?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          match_percent?: number | null
          max_bonus_amount?: number | null
          max_redemptions?: number | null
          min_deposit?: number | null
          min_odds?: number | null
          name: string
          starts_at?: string
          wagering_multiplier?: number
        }
        Update: {
          bonus_type?: Database["public"]["Enums"]["bonus_type"]
          code?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          ends_at?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          match_percent?: number | null
          max_bonus_amount?: number | null
          max_redemptions?: number | null
          min_deposit?: number | null
          min_odds?: number | null
          name?: string
          starts_at?: string
          wagering_multiplier?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_paid: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_paid?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_paid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      selections: {
        Row: {
          id: string
          market_id: string
          name: string
          odds: number
          sort_order: number
          status: Database["public"]["Enums"]["selection_status"]
          updated_at: string
        }
        Insert: {
          id?: string
          market_id: string
          name: string
          odds: number
          sort_order?: number
          status?: Database["public"]["Enums"]["selection_status"]
          updated_at?: string
        }
        Update: {
          id?: string
          market_id?: string
          name?: string
          odds?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["selection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "selections_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      self_exclusions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          reason: string | null
          starts_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          reason?: string | null
          starts_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          reason?: string | null
          starts_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_exclusions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      teams: {
        Row: {
          country_code: string | null
          id: string
          logo_url: string | null
          name: string
          short_name: string | null
          sport_id: string
        }
        Insert: {
          country_code?: string | null
          id?: string
          logo_url?: string | null
          name: string
          short_name?: string | null
          sport_id: string
        }
        Update: {
          country_code?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string | null
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bonuses: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          promotion_id: string
          status: Database["public"]["Enums"]["user_bonus_status"]
          user_id: string
          wagering_progress: number
          wagering_required: number
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          promotion_id: string
          status?: Database["public"]["Enums"]["user_bonus_status"]
          user_id: string
          wagering_progress?: number
          wagering_required?: number
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          promotion_id?: string
          status?: Database["public"]["Enums"]["user_bonus_status"]
          user_id?: string
          wagering_progress?: number
          wagering_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_bonuses_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bonuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_limits: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          is_active: boolean
          limit_type: Database["public"]["Enums"]["limit_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          limit_type: Database["public"]["Enums"]["limit_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          limit_type?: Database["public"]["Enums"]["limit_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_limits_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          country_code: string | null
          created_at: string
          device_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          is_locked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_locked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_locked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          currency: string
          destination: string | null
          fee: number
          id: string
          payment_method_id: string | null
          provider: string | null
          provider_reference: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          fee?: number
          id?: string
          payment_method_id?: string | null
          provider?: string | null
          provider_reference?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          fee?: number
          id?: string
          payment_method_id?: string | null
          provider?: string | null
          provider_reference?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_manual_deposit: {
        Args: { p_deposit_id: string }
        Returns: undefined
      }
      complete_deposit: {
        Args: { p_deposit_id: string }
        Returns: undefined
      }
      create_booking_code: {
        Args: { p_selection_ids: string[]; p_stake?: number }
        Returns: string
      }
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean }
      load_booking_code: {
        Args: { p_code: string }
        Returns: {
          code: string
          created_at: string
          event_id: string
          event_name: string
          expires_at: string
          is_available: boolean
          leg_index: number
          market_id: string
          market_name: string
          odds: number
          odds_at_creation: number
          selection_id: string
          selection_name: string
          stake: number | null
          starts_at: string
          total_odds: number
        }[]
      }
      place_bet: {
        Args: { p_selection_ids: string[]; p_stake: number }
        Returns: string
      }
      post_ledger_entry: {
        Args: {
          p_amount: number
          p_description?: string
          p_idempotency_key?: string
          p_metadata?: Json
          p_reference_id?: string
          p_reference_type?: string
          p_tx_type: Database["public"]["Enums"]["ledger_tx_type"]
          p_wallet_id: string
        }
        Returns: Database["public"]["Tables"]["ledger_entries"]["Row"]
      }
      reject_withdrawal: {
        Args: { p_reason: string; p_withdrawal_id: string }
        Returns: undefined
      }
      request_withdrawal: {
        Args: { p_amount: number; p_payment_method_id?: string }
        Returns: string
      }
      resolve_phone_login: {
        Args: { p_password: string; p_phone: string }
        Returns: string
      }
      settle_bet: {
        Args: { p_bet_id: string }
        Returns: Database["public"]["Enums"]["bet_status"]
      }
      settle_market: {
        Args: {
          p_market_id: string
          p_void_ids?: string[]
          p_winning_ids: string[]
        }
        Returns: number
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "self_excluded" | "closed"
      bet_status: "pending" | "won" | "lost" | "void" | "cashed_out" | "cancelled"
      bet_type: "single" | "accumulator"
      bonus_type: "deposit_match" | "free_bet" | "cashback" | "no_deposit"
      event_status: "scheduled" | "live" | "finished" | "postponed" | "cancelled" | "abandoned"
      kyc_doc_type:
        | "passport"
        | "national_id"
        | "drivers_license"
        | "proof_of_address"
        | "selfie"
        | "other"
      kyc_status: "none" | "pending" | "verified" | "rejected"
      leg_status: "pending" | "won" | "lost" | "void"
      ledger_tx_type:
        | "deposit"
        | "withdrawal"
        | "withdrawal_reversal"
        | "bet_stake"
        | "bet_win"
        | "bet_refund"
        | "bet_cashout"
        | "bonus_credit"
        | "bonus_reversal"
        | "fee"
        | "adjustment"
        | "chargeback"
      limit_type:
        | "deposit_daily"
        | "deposit_weekly"
        | "deposit_monthly"
        | "loss_daily"
        | "loss_weekly"
        | "loss_monthly"
        | "stake_single"
      market_status: "open" | "suspended" | "closed" | "settled" | "void"
      notification_type: "system" | "bet" | "payment" | "promo" | "kyc" | "security"
      payment_method_type: "card" | "bank_transfer" | "mobile_money" | "e_wallet"
      payment_status: "pending" | "processing" | "completed" | "failed" | "cancelled" | "rejected"
      selection_status: "active" | "suspended" | "won" | "lost" | "void"
      user_bonus_status: "active" | "completed" | "expired" | "forfeited"
      user_role: "user" | "support" | "trader" | "admin"
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
  : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "suspended", "self_excluded", "closed"],
      bet_status: ["pending", "won", "lost", "void", "cashed_out", "cancelled"],
      bet_type: ["single", "accumulator"],
      bonus_type: ["deposit_match", "free_bet", "cashback", "no_deposit"],
      event_status: ["scheduled", "live", "finished", "postponed", "cancelled", "abandoned"],
      kyc_doc_type: [
        "passport",
        "national_id",
        "drivers_license",
        "proof_of_address",
        "selfie",
        "other",
      ],
      kyc_status: ["none", "pending", "verified", "rejected"],
      leg_status: ["pending", "won", "lost", "void"],
      ledger_tx_type: [
        "deposit",
        "withdrawal",
        "withdrawal_reversal",
        "bet_stake",
        "bet_win",
        "bet_refund",
        "bet_cashout",
        "bonus_credit",
        "bonus_reversal",
        "fee",
        "adjustment",
        "chargeback",
      ],
      limit_type: [
        "deposit_daily",
        "deposit_weekly",
        "deposit_monthly",
        "loss_daily",
        "loss_weekly",
        "loss_monthly",
        "stake_single",
      ],
      market_status: ["open", "suspended", "closed", "settled", "void"],
      notification_type: ["system", "bet", "payment", "promo", "kyc", "security"],
      payment_method_type: ["card", "bank_transfer", "mobile_money", "e_wallet"],
      payment_status: ["pending", "processing", "completed", "failed", "cancelled", "rejected"],
      selection_status: ["active", "suspended", "won", "lost", "void"],
      user_bonus_status: ["active", "completed", "expired", "forfeited"],
      user_role: ["user", "support", "trader", "admin"],
    },
  },
} as const
