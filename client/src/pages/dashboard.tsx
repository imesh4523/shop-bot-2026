import { useStats } from "@/hooks/use-stats";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Users,
  Store,
  Layers,
  Server,
  ArrowUpRight,
  Globe
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();

  // Fetch all orders across all channels (Direct Cloud, Sandromania, SMM Boost)
  const { data: allOrders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/all-orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/all-orders");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000,
  });

  const lkrRate = 330;

  // Historical 7-day data for the chart from consolidated multi-store orders
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayName = format(date, "EEE");
    const dayStart = new Date(date.setHours(0, 0, 0, 0));
    const dayEnd = new Date(date.setHours(23, 59, 59, 999));
    
    const dailyTotal = allOrders
      .filter(order => {
        if (!order.createdAt) return false;
        const orderDate = new Date(order.createdAt);
        return orderDate >= dayStart && orderDate <= dayEnd;
      })
      .reduce((sum, order) => {
        const rawUsd = parseFloat((order.amountUsd || "$0").replace(/[^0-9.]/g, "")) || 0;
        return sum + rawUsd;
      }, 0);
      
    return { name: dayName, total: Number(dailyTotal.toFixed(2)) };
  });

  const recentOrders = allOrders.slice(0, 6);

  const dailyRevUsd = ((stats?.dailyRevenue || 0) / 100).toFixed(2);
  const dailyRevLkr = Math.round(((stats?.dailyRevenue || 0) / 100) * lkrRate).toLocaleString();
  const totalRevUsd = ((stats?.totalRevenue || 0) / 100).toFixed(2);
  const totalRevLkr = Math.round(((stats?.totalRevenue || 0) / 100) * lkrRate).toLocaleString();

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-2xl">
            Dashboard
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Real-time multi-channel overview across Cloud Accounts, Partner Stores & SMM panels.
          </p>
        </div>
        <div className="glass-panel px-5 py-2 rounded-full flex items-center gap-2.5 text-xs font-bold text-white shadow-lg border-white/20">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          System Active
        </div>
      </div>

      {/* Primary Revenue Grid (USD & LKR Dual Stats) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 1. Daily Revenue (USD & LKR) */}
        <Card className="glass-card border-0 bg-white/[0.02] relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black text-white/50 uppercase tracking-widest">
              Daily Revenue
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-28 bg-white/5" />
            ) : (
              <div>
                <div className="text-3xl font-black text-white tracking-tight font-mono">
                  ${dailyRevUsd}
                </div>
                <div className="text-xs font-bold text-emerald-400 mt-1 font-mono flex items-center gap-1">
                  <span>≈ Rs. {dailyRevLkr} LKR</span>
                </div>
                <p className="text-[10px] text-white/30 mt-1 font-medium">Last 24 hours across all stores</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Daily Sales Count */}
        <Card className="glass-card border-0 bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black text-white/50 uppercase tracking-widest">
              Daily Sales
            </CardTitle>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-20 bg-white/5" />
            ) : (
              <div>
                <div className="text-3xl font-black text-white tracking-tight">
                  {stats?.dailySales ?? 0}
                </div>
                <p className="text-xs font-bold text-purple-300 mt-1">Orders in past 24h</p>
                <p className="text-[10px] text-white/30 mt-1 font-medium">Instant auto-fulfilled items</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Total Revenue (USD & LKR) */}
        <Card className="glass-card border-0 bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black text-white/50 uppercase tracking-widest">
              Total Revenue
            </CardTitle>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-28 bg-white/5" />
            ) : (
              <div>
                <div className="text-3xl font-black text-white tracking-tight font-mono">
                  ${totalRevUsd}
                </div>
                <div className="text-xs font-bold text-blue-300 mt-1 font-mono flex items-center gap-1">
                  <span>≈ Rs. {totalRevLkr} LKR</span>
                </div>
                <p className="text-[10px] text-white/30 mt-1 font-medium">Total multi-channel gross revenue</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Total Sales */}
        <Card className="glass-card border-0 bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black text-white/50 uppercase tracking-widest">
              Total Sales
            </CardTitle>
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
              <Package className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-20 bg-white/5" />
            ) : (
              <div>
                <div className="text-3xl font-black text-white tracking-tight">
                  {stats?.totalSales ?? 0}
                </div>
                <p className="text-xs font-bold text-pink-300 mt-1">Successful fulfilled deliveries</p>
                <p className="text-[10px] text-white/30 mt-1 font-medium">All historical orders</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Stats Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Total Bot Users"
          value={stats?.totalUsers?.toString() || "0"}
          icon={Users}
          description="Total registered customers"
          loading={statsLoading}
        />
        <StatsCard
          title="Monthly New Users"
          value={stats?.monthlyUsers?.toString() || "0"}
          icon={Users}
          description="New users in past 30 days"
          loading={statsLoading}
        />
        <StatsCard
          title="Active Users Today"
          value={stats?.activeUsersToday?.toString() || "0"}
          icon={TrendingUp}
          description="Active in past 24 hours"
          loading={statsLoading}
        />
      </div>

      {/* Chart & Recent Multi-Store Orders */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Chart */}
        <Card className="col-span-4 glass-card p-2 border-0 bg-white/[0.01]">
          <CardHeader>
            <CardTitle className="text-lg font-black text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                7-Day Multi-Store Revenue
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                Live Dynamic Feed
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f0a1e', 
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#ffffff'
                    }}
                    formatter={(value: any) => [`$${value} USD`, "Daily Total"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#8B5CF6"
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Multi-Store Orders */}
        <Card className="col-span-3 glass-card border-0 bg-white/[0.01]">
          <CardHeader>
            <CardTitle className="text-lg font-black text-white flex items-center justify-between">
              <span>Recent Sales</span>
              <span className="text-xs text-white/40 font-normal">All Channels</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl bg-white/5" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[160px] bg-white/5" />
                      <Skeleton className="h-3 w-[120px] bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.map((order: any) => {
                  const isPartner = order.orderType === "partner";
                  const isSmm = order.orderType === "smm";
                  return (
                    <div key={order.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isPartner ? 'bg-pink-500/10 text-pink-400' : isSmm ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {isPartner ? <Store className="w-4 h-4" /> : isSmm ? <Layers className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-white truncate">
                            {order.title || "Digital Product"}
                          </p>
                          <p className="text-[10px] text-white/40 truncate">
                            {order.buyer || "Anonymous"} · <span className="text-purple-300">{order.typeLabel || "Store"}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <p className="text-xs font-black text-emerald-400 font-mono">
                          {order.amountUsd}
                        </p>
                        <p className="text-[10px] text-white/40">
                          {order.createdAt ? format(new Date(order.createdAt), "MMM d, HH:mm") : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-white/30 py-8">
                <Package className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-xs font-bold">No orders recorded yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  loading 
}: { 
  title: string; 
  value: string; 
  icon: any; 
  description: string; 
  loading: boolean;
}) {
  return (
    <Card className="glass-card border-0 bg-white/[0.02]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-black text-white/50 uppercase tracking-widest">
          {title}
        </CardTitle>
        <div className="p-2 rounded-xl bg-white/5 text-purple-400">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-24 bg-white/5" />
            <Skeleton className="h-3 w-32 bg-white/5" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-black text-white tracking-tight">{value}</div>
            <p className="text-[10px] text-white/40 mt-1 font-medium">
              {description}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
