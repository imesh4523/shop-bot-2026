import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useOrders() {
  return useQuery({
    queryKey: [api.orders.list.path],
    queryFn: async () => {
      const res = await fetch(api.orders.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      const parsed = api.orders.list.responses[200].safeParse(data);
      return parsed.success ? parsed.data : (Array.isArray(data) ? data : []);
    },
  });
}
