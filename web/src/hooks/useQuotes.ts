import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface QuoteLine {
  id: string;
  label: string;
  quantity: number;
  unitPrice: number;
}

export interface QuoteData {
  number: string;
  clientName: string;
  quoteDate: string;
  buyer: string;
  dueDate: string;
  structureName: string;
  rangeName: string;
  productName: string;
  dominantColors: string;
  additionalInfo: string;
  articles: QuoteLine[];
  containers: QuoteLine[];
  packagingPrints: QuoteLine[];
  labels: QuoteLine[];
  mockups: QuoteLine[];
  logoPrice: number;
  discount: number;
  subtotal: number;
  total: number;
}

export type CreateQuoteInput = Omit<QuoteData, "number"> & {
  customerId: string;
  number?: string;
};

type QuoteLineType = "articles" | "containers" | "packaging_prints" | "labels" | "mockups";
type QuoteLineRowType = QuoteLineType | "logo";

const lineGroups: Array<{ type: QuoteLineType; key: keyof Pick<QuoteData, "articles" | "containers" | "packagingPrints" | "labels" | "mockups"> }> = [
  { type: "articles", key: "articles" },
  { type: "containers", key: "containers" },
  { type: "packaging_prints", key: "packagingPrints" },
  { type: "labels", key: "labels" },
  { type: "mockups", key: "mockups" },
];

const toLine = (line: any): QuoteLine => ({
  id: line.id,
  label: line.label ?? "",
  quantity: Number(line.quantity) || 0,
  unitPrice: Number(line.unit_price) || 0,
});

const linesByType = (lines: any[] | null | undefined, type: QuoteLineType) =>
  (lines ?? []).filter((line) => line.line_type === type).map(toLine);

const lineTotal = (line: QuoteLine) => line.quantity * line.unitPrice;

const buildLineRows = (quote: CreateQuoteInput, quoteId: string) =>
  lineGroups.flatMap(({ type, key }) =>
    (quote[key] as QuoteLine[])
      .filter((line) => line.label || line.quantity || line.unitPrice)
      .map((line) => ({
        quote_id: quoteId,
        line_type: type as QuoteLineRowType,
        label: line.label,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        total_price: lineTotal(line),
      })),
  );

export const useQuotes = () => {
  return useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, customers(name), quote_lines(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((quote: any): QuoteData => ({
        number: quote.quote_number,
        clientName: quote.customers?.name ?? "",
        quoteDate: quote.quote_date,
        buyer: quote.buyer ?? "",
        dueDate: quote.due_date ?? "",
        structureName: quote.structure_name ?? "",
        rangeName: quote.range_name ?? "",
        productName: quote.product_name ?? "",
        dominantColors: quote.dominant_colors ?? "",
        additionalInfo: quote.additional_info ?? "",
        articles: linesByType(quote.quote_lines, "articles"),
        containers: linesByType(quote.quote_lines, "containers"),
        packagingPrints: linesByType(quote.quote_lines, "packaging_prints"),
        labels: linesByType(quote.quote_lines, "labels"),
        mockups: linesByType(quote.quote_lines, "mockups"),
        logoPrice: Number(quote.logo_price) || 0,
        discount: Number(quote.discount) || 0,
        subtotal: Number(quote.subtotal) || 0,
        total: Number(quote.total) || 0,
      }));
    },
  });
};

export const useCreateQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quote: CreateQuoteInput) => {
      const quoteRow: Record<string, unknown> = {
        customer_id: quote.customerId,
        quote_date: quote.quoteDate,
        buyer: quote.buyer,
        due_date: quote.dueDate || null,
        structure_name: quote.structureName,
        range_name: quote.rangeName,
        product_name: quote.productName,
        dominant_colors: quote.dominantColors,
        additional_info: quote.additionalInfo,
        logo_price: quote.logoPrice,
        discount: quote.discount,
        subtotal: quote.subtotal,
        total: quote.total,
      };

      if (quote.number) {
        quoteRow.quote_number = quote.number;
      }

      const { data: createdQuote, error: quoteError } = await supabase
        .from("quotes")
        .insert([quoteRow])
        .select()
        .single();

      if (quoteError) throw quoteError;

      const lineRows = buildLineRows(quote, createdQuote.id);
      if (quote.logoPrice > 0) {
        lineRows.push({
          quote_id: createdQuote.id,
          line_type: "logo",
          label: "Creation logo",
          quantity: 1,
          unit_price: quote.logoPrice,
          total_price: quote.logoPrice,
        });
      }

      if (lineRows.length) {
        const { error: linesError } = await supabase.from("quote_lines").insert(lineRows);
        if (linesError) throw linesError;
      }

      return createdQuote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
};
