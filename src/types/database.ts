export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: {
          id: string;
          name: string;
          code: string;
          slug: string;
          pin_hash: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["branches"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["branches"]["Insert"]>;
      };
      users: {
        Row: {
          id: string;
          name: string;
          role: "cashier" | "admin" | "owner";
          branch_id: string | null;
          phone: string | null;
          pin_hash: string | null;
          is_active: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      meat_types: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          unit: string;
          has_count: boolean;
          sort_order: number;
          is_active: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["meat_types"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["meat_types"]["Insert"]>;
      };
      payment_methods: {
        Row: {
          id: string;
          name: string;
          code: string | null;
          is_active: boolean;
          sort_order: number;
        };
        Insert: Omit<Database["public"]["Tables"]["payment_methods"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["payment_methods"]["Insert"]>;
      };
      daily_reports: {
        Row: {
          id: string;
          branch_id: string;
          report_date: string;
          cashier_id: string | null;
          total_sales: number | null;
          invoice_count: number | null;
          returns_value: number;
          discounts_value: number;
          cash_expected: number | null;
          cash_actual: number | null;
          cash_difference: number | null;
          sales_pdf_url: string | null;
          fridge_photo_url: string | null;
          cash_photo_url: string | null;
          status: "draft" | "submitted" | "approved" | "flagged";
          notes: string | null;
          submitted_at: string;
          synced_to_excel: boolean;
          synced_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["daily_reports"]["Row"],
          "id" | "cash_difference" | "submitted_at"
        > & { id?: string; submitted_at?: string };
        Update: Partial<Database["public"]["Tables"]["daily_reports"]["Insert"]>;
      };
      report_payments: {
        Row: {
          id: string;
          report_id: string;
          payment_method_id: string;
          amount: number;
        };
        Insert: Omit<Database["public"]["Tables"]["report_payments"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["report_payments"]["Insert"]>;
      };
      report_meat_movements: {
        Row: {
          id: string;
          report_id: string;
          meat_type_id: string;
          movement_type: "incoming" | "sales" | "outgoing" | "remaining" | "opening";
          count: number;
          weight_kg: number | null;
          notes: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["report_meat_movements"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["report_meat_movements"]["Insert"]>;
      };
      report_expenses: {
        Row: {
          id: string;
          report_id: string;
          category: string | null;
          description: string | null;
          amount: number;
        };
        Insert: Omit<Database["public"]["Tables"]["report_expenses"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["report_expenses"]["Insert"]>;
      };
      alerts: {
        Row: {
          id: string;
          report_id: string | null;
          branch_id: string | null;
          type: string | null;
          severity: "info" | "warning" | "critical";
          message: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["alerts"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["alerts"]["Insert"]>;
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          action: string | null;
          entity_type: string | null;
          entity_id: string | null;
          old_value: Json | null;
          new_value: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_log"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
      };
      step_fields: {
        Row: {
          id: string;
          step: number;
          field_name: string;
          field_label: string;
          field_type: "text" | "number" | "file" | "select" | "textarea" | "checkbox";
          is_required: boolean;
          options: Json | null;
          file_types: string[] | null;
          placeholder: string | null;
          help_text: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["step_fields"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["step_fields"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience types
export type Branch = Database["public"]["Tables"]["branches"]["Row"];
export type User = Database["public"]["Tables"]["users"]["Row"];
export type MeatType = Database["public"]["Tables"]["meat_types"]["Row"];
export type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];
export type DailyReport = Database["public"]["Tables"]["daily_reports"]["Row"];
export type ReportPayment = Database["public"]["Tables"]["report_payments"]["Row"];
export type ReportMeatMovement = Database["public"]["Tables"]["report_meat_movements"]["Row"];
export type ReportExpense = Database["public"]["Tables"]["report_expenses"]["Row"];
export type Alert = Database["public"]["Tables"]["alerts"]["Row"];
export type StepField = Database["public"]["Tables"]["step_fields"]["Row"];
