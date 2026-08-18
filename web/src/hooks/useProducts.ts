import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface Product {
  id: string;
  reference: string;
  name: string;
  selling_price: number;
  category_id: string | null;
  categories: { name: string } | null;
  price_type?: string | null;
  wholesale_price?: number | null;
}

export type CreateProductInput = Omit<Pick<Product, "reference" | "name" | "selling_price" | "category_id">, "reference"> & {
  reference?: string;
  price_type?: string | null;
  wholesale_price?: number | null;
};

export const useProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*, categories(name)");
      if (error) throw error;
      return data as Product[];
    },
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (product: CreateProductInput) => {
      const payload = {
        name: product.name.trim(),
        selling_price: product.selling_price,
        category_id: product.category_id || null,
        price_type: product.price_type || 'detaillant',
        wholesale_price: product.wholesale_price == null ? null : product.wholesale_price,
        ...(product.reference?.trim() ? { reference: product.reference.trim() } : {}),
      };
      const { data, error } = await supabase.from("products").insert([payload]).select();
      if (error) throw error;
      return data as Product[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
    },
  });
};
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Product> }) => {
      const payload = {
        ...updates,
        name: typeof updates?.name === "string" ? updates.name.trim() : updates?.name,
        reference: typeof updates?.reference === "string" ? updates.reference.trim() : updates?.reference,
        category_id: updates?.category_id || null,
        price_type: updates?.price_type ?? 'detaillant',
        wholesale_price: updates?.wholesale_price == null ? null : updates?.wholesale_price,
      } as Partial<Product>;
      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", id)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
    },
  });
};
