import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface InvoiceLineInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CreateInvoiceInput {
  header: {
    invoice_number?: string;
    customer_id: string | null;
    invoice_date: string;
    status: string;
    total_amount: number;
  };
  lines: InvoiceLineInput[];
}

export interface UpdateInvoiceInput extends CreateInvoiceInput {
  id: string;
}

export const useInvoices = () => {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name), invoice_lines(*, products(name))")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceData: CreateInvoiceInput) => {
      const { invoice_number, ...baseHeader } = invoiceData.header;
      const header = {
        ...baseHeader,
        customer_id: baseHeader.customer_id || null,
        total_amount: Number(baseHeader.total_amount) || 0,
        ...(invoice_number?.trim() ? { invoice_number: invoice_number.trim() } : {}),
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert([header])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const lines = invoiceData.lines.map((line) => ({
        invoice_id: invoice.id,
        product_id: line.product_id,
        quantity: Number(line.quantity) || 1,
        unit_price: Number(line.unit_price) || 0,
        total_price: Number(line.total_price) || 0,
      }));

      const { error: linesError } = await supabase.from("invoice_lines").insert(lines);

      if (linesError) {
        await supabase.from("invoices").delete().eq("id", invoice.id);
        throw linesError;
      }
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
    },
  });
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceData: UpdateInvoiceInput) => {
      const { invoice_number, ...baseHeader } = invoiceData.header;
      const header = {
        ...baseHeader,
        customer_id: baseHeader.customer_id || null,
        total_amount: Number(baseHeader.total_amount) || 0,
        ...(invoice_number?.trim() ? { invoice_number: invoice_number.trim() } : {}),
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .update(header)
        .eq("id", invoiceData.id)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const { error: deleteLinesError } = await supabase
        .from("invoice_lines")
        .delete()
        .eq("invoice_id", invoiceData.id);

      if (deleteLinesError) throw deleteLinesError;

      const lines = invoiceData.lines.map((line) => ({
        invoice_id: invoiceData.id,
        product_id: line.product_id,
        quantity: Number(line.quantity) || 1,
        unit_price: Number(line.unit_price) || 0,
        total_price: Number(line.total_price) || 0,
      }));

      const { error: linesError } = await supabase.from("invoice_lines").insert(lines);

      if (linesError) throw linesError;
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
    },
  });
};
