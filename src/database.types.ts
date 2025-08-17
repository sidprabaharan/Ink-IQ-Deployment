
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
    PostgrestVersion: "13.0.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      artwork_files: {
        Row: {
          category: string
          colors_or_threads: string | null
          created_at: string | null
          created_by: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          imprint_location: string | null
          imprint_method: string | null
          imprint_size: string | null
          notes: string | null
          org_id: string
          quote_item_id: string | null
          updated_at: string | null
          upload_status: string | null
        }
        Insert: {
          category: string
          colors_or_threads?: string | null
          created_at?: string | null
          created_by: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          imprint_location?: string | null
          imprint_method?: string | null
          imprint_size?: string | null
          notes?: string | null
          org_id: string
          quote_item_id?: string | null
          updated_at?: string | null
          upload_status?: string | null
        }
        Update: {
          category?: string
          colors_or_threads?: string | null
          created_at?: string | null
          created_by?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          imprint_location?: string | null
          imprint_method?: string | null
          imprint_size?: string | null
          notes?: string | null
          org_id?: string
          quote_item_id?: string | null
          updated_at?: string | null
          upload_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artwork_files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_files_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          org_id: string
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          org_id: string
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: Json | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      imprints: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          imprint_type: string
          name: string
          org_id: string
          price_per_100: number | null
          price_per_1000: number | null
          price_per_unit: number | null
          product_id: string
          setup_fee: number | null
          turnaround_time: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          imprint_type: string
          name: string
          org_id: string
          price_per_100?: number | null
          price_per_1000?: number | null
          price_per_unit?: number | null
          product_id: string
          setup_fee?: number | null
          turnaround_time?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          imprint_type?: string
          name?: string
          org_id?: string
          price_per_100?: number | null
          price_per_1000?: number | null
          price_per_unit?: number | null
          product_id?: string
          setup_fee?: number | null
          turnaround_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imprints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imprints_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          description: string | null
          group_index: number | null
          group_label: string | null
          id: string
          invoice_id: string
          item_type: string
          l: number | null
          line_no: number
          line_subtotal: number | null
          m: number | null
          product_name: string | null
          product_sku: string | null
          qty: number | null
          s: number | null
          taxed: boolean | null
          unit_price: number | null
          xl: number | null
          xs: number | null
          xxl: number | null
          xxxl: number | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          group_index?: number | null
          group_label?: string | null
          id?: string
          invoice_id: string
          item_type?: string
          l?: number | null
          line_no?: number
          line_subtotal?: number | null
          m?: number | null
          product_name?: string | null
          product_sku?: string | null
          qty?: number | null
          s?: number | null
          taxed?: boolean | null
          unit_price?: number | null
          xl?: number | null
          xs?: number | null
          xxl?: number | null
          xxxl?: number | null
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          group_index?: number | null
          group_label?: string | null
          id?: string
          invoice_id?: string
          item_type?: string
          l?: number | null
          line_no?: number
          line_subtotal?: number | null
          m?: number | null
          product_name?: string | null
          product_sku?: string | null
          qty?: number | null
          s?: number | null
          taxed?: boolean | null
          unit_price?: number | null
          xl?: number | null
          xs?: number | null
          xxl?: number | null
          xxxl?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          invoice_id: string
          memo: string | null
          method: string
          received_at: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id: string
          memo?: string | null
          method: string
          received_at?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id?: string
          memo?: string | null
          method?: string
          received_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          invoice_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          invoice_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          invoice_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_status_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string | null
          discount_amount: number | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          org_id: string
          quote_id: string | null
          shipping_amount: number | null
          status: string
          subtotal: number | null
          tax_amount: number | null
          terms: string | null
          total_amount: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          balance_due?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          org_id: string
          quote_id?: string | null
          shipping_amount?: number | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          terms?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          balance_due?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          org_id?: string
          quote_id?: string | null
          shipping_amount?: number | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          terms?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      org_users: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          role: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          role: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          role?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string | null
          id: string
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean | null
          base_price: number | null
          category: string | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          dimensions: string | null
          id: string
          materials: string | null
          max_quantity: number | null
          min_quantity: number | null
          name: string
          org_id: string
          sku: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          base_price?: number | null
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          dimensions?: string | null
          id?: string
          materials?: string | null
          max_quantity?: number | null
          min_quantity?: number | null
          name: string
          org_id: string
          sku: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          base_price?: number | null
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          dimensions?: string | null
          id?: string
          materials?: string | null
          max_quantity?: number | null
          min_quantity?: number | null
          name?: string
          org_id?: string
          sku?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quote_imprints: {
        Row: {
          colors_or_threads: string | null
          created_at: string
          height: number | null
          id: string
          location: string | null
          method: string
          notes: string | null
          quote_id: string
          quote_item_id: string
          width: number | null
        }
        Insert: {
          colors_or_threads?: string | null
          created_at?: string
          height?: number | null
          id?: string
          location?: string | null
          method: string
          notes?: string | null
          quote_id: string
          quote_item_id: string
          width?: number | null
        }
        Update: {
          colors_or_threads?: string | null
          created_at?: string
          height?: number | null
          id?: string
          location?: string | null
          method?: string
          notes?: string | null
          quote_id?: string
          quote_item_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_imprints_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_imprints_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          garment_status: string | null
          group_index: number | null
          group_label: string | null
          id: string
          imprint_cost: number | null
          imprint_type: string | null
          item_number: string | null
          l: number | null
          m: number | null
          mockup_images: Json | null
          notes: string | null
          org_id: string
          product_description: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          quote_id: string
          s: number | null
          setup_fee: number | null
          taxed: boolean | null
          total_price: number
          unit_price: number
          updated_at: string | null
          xl: number | null
          xs: number | null
          xxl: number | null
          xxxl: number | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          garment_status?: string | null
          group_index?: number | null
          group_label?: string | null
          id?: string
          imprint_cost?: number | null
          imprint_type?: string | null
          item_number?: string | null
          l?: number | null
          m?: number | null
          mockup_images?: Json | null
          notes?: string | null
          org_id: string
          product_description?: string | null
          product_name: string
          product_sku?: string | null
          quantity: number
          quote_id: string
          s?: number | null
          setup_fee?: number | null
          taxed?: boolean | null
          total_price: number
          unit_price: number
          updated_at?: string | null
          xl?: number | null
          xs?: number | null
          xxl?: number | null
          xxxl?: number | null
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          garment_status?: string | null
          group_index?: number | null
          group_label?: string | null
          id?: string
          imprint_cost?: number | null
          imprint_type?: string | null
          item_number?: string | null
          l?: number | null
          m?: number | null
          mockup_images?: Json | null
          notes?: string | null
          org_id?: string
          product_description?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          quote_id?: string
          s?: number | null
          setup_fee?: number | null
          taxed?: boolean | null
          total_price?: number
          unit_price?: number
          updated_at?: string | null
          xl?: number | null
          xs?: number | null
          xxl?: number | null
          xxxl?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_date: string | null
          created_at: string | null
          created_by: string
          customer_due_date: string | null
          customer_id: string
          description: string | null
          discount_amount: number | null
          discount_percentage: number | null
          final_amount: number | null
          id: string
          invoice_date: string | null
          notes: string | null
          org_id: string
          payment_due_date: string | null
          production_due_date: string | null
          quote_number: string
          sent_date: string | null
          status: string
          subject: string | null
          tax_amount: number | null
          tax_rate: number | null
          terms_conditions: string | null
          total_amount: number | null
          updated_at: string | null
          updated_by: string | null
          valid_until: string | null
        }
        Insert: {
          approved_date?: string | null
          created_at?: string | null
          created_by: string
          customer_due_date?: string | null
          customer_id: string
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          final_amount?: number | null
          id?: string
          invoice_date?: string | null
          notes?: string | null
          org_id: string
          payment_due_date?: string | null
          production_due_date?: string | null
          quote_number: string
          sent_date?: string | null
          status?: string
          subject?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valid_until?: string | null
        }
        Update: {
          approved_date?: string | null
          created_at?: string | null
          created_by?: string
          customer_due_date?: string | null
          customer_id?: string
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          final_amount?: number | null
          id?: string
          invoice_date?: string | null
          notes?: string | null
          org_id?: string
          payment_due_date?: string | null
          production_due_date?: string | null
          quote_number?: string
          sent_date?: string | null
          status?: string
          subject?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_quote_item: {
        Args: {
          imprint_cost?: number
          imprint_type?: string
          notes?: string
          product_description?: string
          product_name: string
          product_sku?: string
          quantity: number
          quote_id: string
          setup_fee?: number
          unit_price: number
        }
        Returns: Json
      }
      add_quote_item_v2: {
        Args: {
          p_category: string
          p_color: string
          p_garment_status: string
          p_group_index: number
          p_group_label: string
          p_imprint_cost: number
          p_imprint_type: string
          p_item_number: string
          p_l: number
          p_m: number
          p_notes: string
          p_product_description: string
          p_product_name: string
          p_product_sku: string
          p_quantity: number
          p_quote_id: string
          p_s: number
          p_setup_fee: number
          p_taxed: boolean
          p_unit_price: number
          p_xl: number
          p_xs: number
          p_xxl: number
          p_xxxl: number
        }
        Returns: string
      }
      check_user_role: {
        Args: { org_id: string; required_role: string }
        Returns: boolean
      }
      create_customer: {
        Args: {
          customer_address?: Json
          customer_company?: string
          customer_email?: string
          customer_name: string
          customer_notes?: string
          customer_phone?: string
          customer_status?: string
        }
        Returns: Json
      }
      create_imprint: {
        Args: {
          imprint_description?: string
          imprint_name: string
          imprint_type?: string
          price_per_100?: number
          price_per_1000?: number
          price_per_unit?: number
          product_id: string
          setup_fee?: number
          turnaround_time?: string
        }
        Returns: Json
      }
      create_invoice_from_quote: {
        Args: {
          p_due_date?: string
          p_invoice_date?: string
          p_quote_id: string
        }
        Returns: {
          invoice_id: string
        }[]
      }
      create_product: {
        Args: {
          base_price?: number
          cost_price?: number
          dimensions?: string
          materials?: string
          max_quantity?: number
          min_quantity?: number
          product_category?: string
          product_description?: string
          product_name: string
          product_sku: string
        }
        Returns: Json
      }
      create_quote: {
        Args: {
          customer_due_date?: string
          customer_id: string
          discount_percentage?: number
          invoice_date?: string
          notes?: string
          payment_due_date?: string
          production_due_date?: string
          quote_description?: string
          quote_subject?: string
          tax_rate?: number
          terms_conditions?: string
          valid_until_days?: number
        }
        Returns: Json
      }
      create_quote_with_items: {
        Args: {
          customer_due_date: string
          customer_id: string
          discount_percentage: number
          invoice_date: string
          items: Json
          notes: string
          payment_due_date: string
          production_due_date: string
          quote_description: string
          quote_subject: string
          tax_rate: number
          terms_conditions: string
          valid_until_days: number
        }
        Returns: Json
      }
      create_quote_with_items_v2: {
        Args: {
          customer_due_date: string
          customer_id: string
          discount_percentage: number
          invoice_date: string
          items: Json
          notes: string
          payment_due_date: string
          production_due_date: string
          quote_description: string
          quote_subject: string
          tax_rate: number
          terms_conditions: string
          valid_until_days: number
        }
        Returns: Json
      }
      delete_artwork_file: {
        Args: { p_file_id: string }
        Returns: Json
      }
      delete_customer: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      delete_product: {
        Args: { product_id: string }
        Returns: Json
      }
      delete_quote: {
        Args: { p_quote_id: string }
        Returns: Json
      }
      generate_invoice_number: {
        Args: { p_org_id: string }
        Returns: string
      }
      get_all_customers_overview: {
        Args: Record<PropertyKey, never>
        Returns: {
          current_quotes_volume: number
          customer_company: string
          customer_id: string
          customer_name: string
          orders_count: number
          total_sales_volume: number
        }[]
      }
      get_artwork_files: {
        Args: { p_quote_item_id: string }
        Returns: Json
      }
      get_customer: {
        Args: { customer_id: string }
        Returns: Json
      }
      get_customer_orders_count: {
        Args: { customer_id: string }
        Returns: number
      }
      get_customer_overview_data: {
        Args: { customer_id: string }
        Returns: Json
      }
      get_customer_quotes_volume: {
        Args: { customer_id: string }
        Returns: number
      }
      get_customer_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_customer_total_sales: {
        Args: { customer_id: string }
        Returns: number
      }
      get_customers: {
        Args: {
          page_number?: number
          page_size?: number
          search_term?: string
          sort_by?: string
          sort_order?: string
          status_filter?: string
        }
        Returns: {
          current_page: number
          customers: Json
          total_count: number
          total_pages: number
        }[]
      }
      get_invoice: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      get_invoices: {
        Args: { p_page?: number; p_size?: number }
        Returns: {
          invoices: Json
        }[]
      }
      get_product: {
        Args: { product_id: string }
        Returns: Json
      }
      get_product_imprints: {
        Args: { product_id: string }
        Returns: Json
      }
      get_product_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_products: {
        Args: {
          active_filter?: boolean
          category_filter?: string
          page_number?: number
          page_size?: number
          search_term?: string
          sort_by?: string
          sort_order?: string
        }
        Returns: {
          current_page: number
          products: Json
          total_count: number
          total_pages: number
        }[]
      }
      get_quote: {
        Args: { p_quote_id: string }
        Returns: Json
      }
      get_quotes: {
        Args:
          | Record<PropertyKey, never>
          | {
              customer_filter?: string
              date_from?: string
              date_to?: string
              page_number?: number
              page_size?: number
              search_term?: string
              sort_by?: string
              sort_order?: string
              status_filter?: string
            }
        Returns: {
          current_page: number
          quotes: Json
          total_count: number
          total_pages: number
        }[]
      }
      get_user_org: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_org_info: {
        Args: Record<PropertyKey, never>
        Returns: {
          member_count: number
          org_id: string
          org_name: string
          org_settings: Json
          org_slug: string
          user_role: string
        }[]
      }
      invite_user_to_org: {
        Args: { invitee_email: string; invitee_role?: string }
        Returns: Json
      }
      record_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_memo: string
          p_method: string
          p_received_at: string
          p_reference: string
        }
        Returns: undefined
      }
      remove_quote_item: {
        Args: { item_id: string; quote_id: string }
        Returns: Json
      }
      update_customer: {
        Args: { customer_id: string; updates: Json }
        Returns: Json
      }
      update_invoice_status: {
        Args: { p_invoice_id: string; p_new_status: string }
        Returns: undefined
      }
      update_product: {
        Args: { product_id: string; updates: Json }
        Returns: Json
      }
      update_quote_status: {
        Args: { new_status: string; notes?: string; quote_id: string }
        Returns: Json
      }
      update_quote_totals: {
        Args: { quote_id: string }
        Returns: Json
      }
      upload_artwork_file: {
        Args: {
          p_category: string
          p_colors_or_threads?: string
          p_file_name: string
          p_file_path: string
          p_file_size: number
          p_file_type: string
          p_imprint_location?: string
          p_imprint_method?: string
          p_imprint_size?: string
          p_notes?: string
          p_quote_item_id: string
        }
        Returns: Json
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
