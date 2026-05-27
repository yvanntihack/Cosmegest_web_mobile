import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface DashboardInvoice {
  total_amount: number | string | null;
  status: string | null;
  invoice_date: string | null;
  created_at: string | null;
}

export interface DashboardPurchaseLine {
  quantity: number | string | null;
  unit_price: number | string | null;
  total_price: number | string | null;
  products: {
    id: string;
    reference: string | null;
    name: string;
  } | null;
  invoices: {
    id: string;
    invoice_date: string | null;
    status: string | null;
    customer_id: string | null;
    customers: {
      id: string;
      name: string;
      segment: string | null;
    } | null;
  } | null;
}

const firstRelation = <T,>(value: T | T[] | null | undefined) =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ["dashboard_stats"],
    queryFn: async () => {
      const [
        { count: productCount, error: productError },
        { count: customerCount, error: customerError },
        { count: invoiceCount, error: invoiceCountError },
        { data: invoices, error: invoiceError },
        { data: purchaseLines, error: purchaseLinesError },
      ] = await Promise.all([
        supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("customers")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("invoices")
          .select("total_amount,status,invoice_date,created_at")
          .neq("status", "annulee"),
        supabase
          .from("invoice_lines")
          .select(
            "quantity,unit_price,total_price,products(id,reference,name),invoices(id,invoice_date,status,customer_id,customers(id,name,segment))",
          ),
      ]);

      if (productError || customerError || invoiceCountError || invoiceError || purchaseLinesError) {
        throw productError || customerError || invoiceCountError || invoiceError || purchaseLinesError;
      }

      const sales = (invoices ?? []) as DashboardInvoice[];
      const purchases = ((purchaseLines ?? []) as unknown as Array<{
        quantity: number | string | null;
        unit_price: number | string | null;
        total_price: number | string | null;
        products:
          | DashboardPurchaseLine["products"]
          | NonNullable<DashboardPurchaseLine["products"]>[];
        invoices:
          | {
              id: string;
              invoice_date: string | null;
              status: string | null;
              customer_id: string | null;
              customers:
                | NonNullable<NonNullable<DashboardPurchaseLine["invoices"]>["customers"]>
                | NonNullable<NonNullable<DashboardPurchaseLine["invoices"]>["customers"]>[]
                | null;
            }
          | Array<{
              id: string;
              invoice_date: string | null;
              status: string | null;
              customer_id: string | null;
              customers:
                | NonNullable<NonNullable<DashboardPurchaseLine["invoices"]>["customers"]>
                | NonNullable<NonNullable<DashboardPurchaseLine["invoices"]>["customers"]>[]
                | null;
            }>
          | null;
      }>).map((line) => {
        const invoice = firstRelation(line.invoices);

        return {
          quantity: line.quantity,
          unit_price: line.unit_price,
          total_price: line.total_price,
          products: firstRelation(line.products),
          invoices: invoice
            ? {
                ...invoice,
                customers: firstRelation(invoice.customers),
              }
            : null,
        };
      }) satisfies DashboardPurchaseLine[];

      const revenue = sales.reduce(
        (sum, invoice) => sum + (Number(invoice.total_amount) || 0),
        0,
      );

      return {
        products: productCount || 0,
        customers: customerCount || 0,
        invoices: invoiceCount || 0,
        revenue,
        sales,
        purchases,
      };
    },
  });
};
