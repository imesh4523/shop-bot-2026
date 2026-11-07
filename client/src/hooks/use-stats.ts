import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useStats() {
  return useQuery({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      const res = await fetch(api.stats.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      const parsed = api.stats.get.responses[200].safeParse(data);
      return parsed.success ? parsed.data : (data || {
        totalSales: 0,
        dailySales: 0,
        totalRevenue: 0,
        dailyRevenue: 0,
        availableProducts: 0,
        totalUsers: 0,
        monthlyUsers: 0,
        activeUsersToday: 0,
      });
    },
  });
}

