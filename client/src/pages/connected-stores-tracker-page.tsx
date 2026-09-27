import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Network, 
  Search, 
  Filter, 
  DollarSign, 
  ShoppingCart, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  Store, 
  Layers, 
  TrendingUp, 
  RefreshCw, 
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Package,
  ArrowUpRight,
  Eye
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ConnectedStoreOrder {
  id: number;
  productId: number;
  productName: string;
  priceCents: number;
  priceUsd: string;
  priceLkr: number;
  status: string;
  storeSource: string;
  storeName: string;
  apiKeyId?: number | null;
  apiKey?: string | null;
  telegramUserId?: number | null;
  customerName?: string | null;
  customerEmail?: string | null;
  deliveredContent?: string | null;
  createdAt: string;
}

interface AnalyticsResponse {
  summary: {
    totalOrders: number;
    completedOrders: number;
    failedOrders: number;
    totalRevenueCents: number;
    totalRevenueUsd: string;
    totalRevenueLkr: number;
    usdToLkrRate: number;
  };
  stores: {
    id: string;
    name: string;
    type: string;
    totalOrders: number;
    totalRevenueCents: number;
    totalRevenueUsd: string;
    totalRevenueLkr: number;
  }[];
  orders: ConnectedStoreOrder[];
}

export default function ConnectedStoresTrackerPage() {
  const { toast } = useToast();
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("30d");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [copiedOrderId, setCopiedOrderId] = useState<number | null>(null);
  const [viewingOrder, setViewingOrder] = useState<ConnectedStoreOrder | null>(null);

  // Fetch Analytics & Orders
  const { data, isLoading, refetch, isFetching } = useQuery<AnalyticsResponse>({
    queryKey: ["/api/admin/connected-stores/analytics", selectedStore, timeRange, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStore) params.append("store", selectedStore);
      if (timeRange) params.append("timeRange", timeRange);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      
      const res = await apiRequest("GET", `/api/admin/connected-stores/analytics?${params.toString()}`);
      return res.json();
    }
  });

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedOrderId(id);
    toast({
      title: "Copied!",
      description: "Credential content copied to clipboard.",
    });
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const filteredOrders = (data?.orders || []).filter(ord => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      ord.productName.toLowerCase().includes(term) ||
      ord.storeName.toLowerCase().includes(term) ||
      ord.id.toString().includes(term) ||
      (ord.customerName && ord.customerName.toLowerCase().includes(term)) ||
      (ord.apiKey && ord.apiKey.toLowerCase().includes(term)) ||
      (ord.deliveredContent && ord.deliveredContent.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-950/80 border border-purple-800/80 flex items-center justify-center text-purple-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
                Connected Stores & API Partner Tracker
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Real-time purchase analytics, duration filtering, and delivered goods tracker across all connected stores.
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={() => refetch()} 
          variant="outline" 
          disabled={isFetching}
          className="gap-2 bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-purple-400' : ''}`} />
          Refresh Live Stream
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {/* Store / Peer Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-purple-400" /> Channel / Provider Filter
              </label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                  <SelectValue placeholder="All Connected Stores" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectItem value="all">🌐 All Channels & API Stores</SelectItem>
                  <SelectItem value="sandromania">🛍️ Sandromania CDK Shop</SelectItem>
                  <SelectItem value="cssx_smm">🚀 CSSX / CDX Social Boost API</SelectItem>
                  <SelectItem value="n1panel">⚡ N1Panel SMM Platform</SelectItem>
                  <SelectItem value="direct">🛒 Direct Cloud Store (Web/MiniApp)</SelectItem>
                  {data?.stores?.filter(st => !['all', 'sandromania', 'cssx_smm', 'n1panel', 'direct'].includes(st.id)).map(st => (
                    <SelectItem key={st.id} value={st.id}>
                      🔑 {st.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Duration Tabs */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Time Duration
              </label>
              <Tabs value={timeRange} onValueChange={setTimeRange} className="w-full">
                <TabsList className="bg-slate-950 border border-slate-800 grid grid-cols-5 h-9">
                  <TabsTrigger value="24h" className="text-xs">24 Hours</TabsTrigger>
                  <TabsTrigger value="7d" className="text-xs">7 Days</TabsTrigger>
                  <TabsTrigger value="30d" className="text-xs">30 Days</TabsTrigger>
                  <TabsTrigger value="month" className="text-xs">This Month</TabsTrigger>
                  <TabsTrigger value="custom" className="text-xs">Custom</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Live Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-emerald-400" /> Filter Orders / Items
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <Input 
                  placeholder="Search item, order #, buyer email, key..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-950 border-slate-800 text-xs text-slate-200 h-9"
                />
              </div>
            </div>
          </div>

          {/* Custom Date Picker Inputs if 'custom' is active */}
          {timeRange === "custom" && (
            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Start Date</label>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">End Date</label>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* High-Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="bg-slate-900/80 border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Revenue (USD)
            </CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              ${data?.summary?.totalRevenueUsd || "0.00"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              in selected time window
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Revenue (LKR)
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-400 font-mono">
              Rs. {(data?.summary?.totalRevenueLkr || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Rate: ~1 USD = {data?.summary?.usdToLkrRate || 315} LKR
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Purchases
            </CardTitle>
            <ShoppingCart className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-purple-300 font-mono">
              {data?.summary?.totalOrders || 0} items
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {data?.summary?.completedOrders || 0} completed • {data?.summary?.failedOrders || 0} failed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Store Channels
            </CardTitle>
            <Layers className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-indigo-300 font-mono">
              {(data?.stores || []).length} connected
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Sandromania, CSSX, N1Panel, API & Direct
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Partner Breakdown Cards */}
      {data?.stores && data.stores.length > 0 && (
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-3 border-b border-slate-800/60">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Store className="w-4 h-4 text-purple-400" />
              Connected Channel Performance Overview
            </CardTitle>
            <CardDescription className="text-xs">
              Filter by Sandromania, CSSX / CDX SMM, N1Panel, Direct Shop, or Reseller API Keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {data.stores.map((st) => (
                <div 
                  key={st.id} 
                  onClick={() => setSelectedStore(st.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedStore === st.id 
                      ? 'bg-purple-950/50 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.25)]' 
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-white truncate">{st.name}</span>
                    <Badge variant="outline" className={`text-[9.5px] uppercase font-bold shrink-0 ${
                      st.id === "sandromania" 
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" 
                        : st.id === "cssx_smm" || st.id === "n1panel"
                        ? "border-purple-500/30 text-purple-300 bg-purple-500/10"
                        : "border-slate-700 text-blue-300"
                    }`}>
                      {st.type ? String(st.type).toUpperCase() : "STORE"}
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between text-xs">
                    <span className="text-slate-400">{st.totalOrders} orders</span>
                    <span className="font-mono font-bold text-emerald-400">${st.totalRevenueUsd}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivered Orders & Purchases Table */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" />
                Filtered Purchases & Delivered Goods Stream
              </CardTitle>
              <CardDescription className="text-xs">
                Showing {filteredOrders.length} orders matching your duration and store filters.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-slate-800 text-slate-300 self-start sm:self-auto text-xs">
              {timeRange.toUpperCase()} Duration Filter
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-16 text-slate-500 animate-pulse">
              Loading connected store analytics stream...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              No orders found for the selected store and time duration.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/80">
                  <TableRow className="border-slate-800">
                    <TableHead className="text-xs text-slate-400 w-24">Order #</TableHead>
                    <TableHead className="text-xs text-slate-400">Product / Item</TableHead>
                    <TableHead className="text-xs text-slate-400">Buyer Details</TableHead>
                    <TableHead className="text-xs text-slate-400">Channel / Provider</TableHead>
                    <TableHead className="text-xs text-slate-400 text-right">Amount (USD / LKR)</TableHead>
                    <TableHead className="text-xs text-slate-400 text-center">Status</TableHead>
                    <TableHead className="text-xs text-slate-400">Timestamp</TableHead>
                    <TableHead className="text-xs text-slate-400 text-right">Credentials & Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((ord) => {
                    const isSandromania = (ord as any).storeType === "sandromania" || ord.id.toString().includes("PARTNER");
                    const isSmm = (ord as any).storeType === "cssx_smm" || ord.id.toString().includes("SMM");

                    return (
                      <TableRow key={ord.id} className="border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-purple-400">
                          #{ord.id}
                        </TableCell>

                        <TableCell>
                          <div className="font-semibold text-xs text-white max-w-[200px] truncate">
                            {ord.productName}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            ID: {ord.productId}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-0.5 max-w-[200px]">
                            {ord.customerName && (
                              <div className="text-xs font-bold text-slate-200 truncate">
                                {ord.customerName}
                              </div>
                            )}
                            {ord.customerEmail && (
                              <div className="text-[11px] text-purple-300 font-mono truncate">
                                ✉️ {ord.customerEmail}
                              </div>
                            )}
                            {!ord.customerName && !ord.customerEmail && (
                              <div className="text-xs text-slate-400">
                                {ord.buyer || "Customer"}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className={`text-[11px] gap-1.5 py-0.5 font-bold ${
                            isSandromania 
                              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                              : isSmm
                              ? "bg-purple-950/40 border-purple-500/40 text-purple-300"
                              : "bg-slate-950 border-slate-700 text-slate-300"
                          }`}>
                            <Store className="w-3 h-3" />
                            {ord.storeName || ord.storeSource}
                          </Badge>
                          {ord.apiKey && (
                            <div className="text-[10px] font-mono text-slate-500 mt-1">
                              Key: {ord.apiKey.substring(0, 12)}...
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-right font-mono">
                          <div className="text-xs font-bold text-emerald-400">
                            ${ord.priceUsd}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Rs. {ord.priceLkr?.toLocaleString() || "0"}
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          {ord.status === "completed" || ord.status === "approved" || ord.status === "success" ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-medium">
                              Completed
                            </Badge>
                          ) : ord.status === "pending" ? (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] font-medium">
                              Pending
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px] font-medium">
                              {ord.status}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                          {ord.createdAt ? new Date(ord.createdAt).toLocaleString() : "N/A"}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {ord.deliveredContent ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs gap-1.5 text-slate-300 hover:text-white bg-slate-950 border border-slate-800"
                                  onClick={() => setViewingOrder(ord)}
                                >
                                  <Eye className="w-3 h-3 text-blue-400" /> View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs gap-1.5 text-slate-300 hover:text-white bg-slate-950 border border-slate-800"
                                  onClick={() => copyToClipboard(ord.deliveredContent!, ord.id)}
                                >
                                  {copiedOrderId === ord.id ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-purple-400" />
                                  )}
                                  Copy
                                </Button>
                              </>
                            ) : (
                              <span className="text-[11px] text-amber-400/80 italic">Manual/Pending</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Delivered Credentials Modal */}
      <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
        <DialogContent className="max-w-xl bg-slate-950 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base font-bold">
              <span>Order #{viewingOrder?.id} Delivery Credentials</span>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">
                ${viewingOrder?.priceUsd} USD
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Product: <strong className="text-white">{viewingOrder?.productName}</strong> • Store: <strong className="text-purple-300">{viewingOrder?.storeName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-2">Delivered Content / Login Credentials:</span>
              <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto select-all whitespace-pre-wrap break-all">
                {viewingOrder?.deliveredContent || "No credential content recorded."}
              </pre>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {viewingOrder?.deliveredContent && (
                <Button
                  onClick={() => copyToClipboard(viewingOrder.deliveredContent!, viewingOrder.id)}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Credentials
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
