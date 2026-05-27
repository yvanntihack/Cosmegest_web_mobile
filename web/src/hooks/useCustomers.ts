import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  segment: string | null;
}

export type CreateCustomerInput = Partial<Pick<Customer, "code">> & Pick<Customer, "name"> & {
  phone?: string;
  segment?: string | null;
};

export type UpdateCustomerInput = Pick<Customer, "code" | "name"> & {
  phone?: string;
  segment?: string | null;
};

export const useCustomers = () => {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (customer: CreateCustomerInput) => {
      const payload = {
        name: customer.name.trim(),
        phone: customer.phone?.trim() || null,
        segment: customer.segment || "particulier",
        ...(customer.code?.trim() ? { code: customer.code.trim() } : {}),
      };
      const { data, error } = await supabase.from("customers").insert([payload]).select();
      if (error) throw error;
      return data as Customer[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateCustomerInput }) => {
      const payload = {
        code: updates.code.trim(),
        name: updates.name.trim(),
        phone: updates.phone?.trim() || null,
        segment: updates.segment || "particulier",
      };
      const { data, error } = await supabase.from("customers").update(payload).eq("id", id).select();
      if (error) throw error;
      return data as Customer[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
    },
  });
};
