import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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
  Eye,
  FileText,
  Printer,
  Download,
  Building2,
  Sparkles,
  Loader2,
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
  id: number | string;
  externalOrderId?: number | string | null;
  productId: number;
  productName: string;
  priceCents: number;
  priceUsd: string;
  unitPriceUsd?: string;
  quantity?: number;
  priceLkr: number;
  status: string;
  storeSource: string;
  storeName: string;
  storeType?: string;
  channelId?: string;
  apiKeyId?: number | null;
  apiKey?: string | null;
  telegramUserId?: number | null;
  customerName?: string | null;
  customerEmail?: string | null;
  buyer?: string | null;
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
    totalRevenueCents?: number;
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
  const [copiedOrderId, setCopiedOrderId] = useState<string | number | null>(null);
  const [viewingOrder, setViewingOrder] = useState<ConnectedStoreOrder | null>(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<ConnectedStoreOrder | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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

  const copyToClipboard = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text);
    setCopiedOrderId(id);
    toast({
      title: "Copied!",
      description: "Content copied to clipboard.",
    });
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const filteredOrders = (data?.orders || []).filter(ord => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (ord.productName || "").toLowerCase().includes(term) ||
      (ord.storeName || "").toLowerCase().includes(term) ||
      ord.id.toString().toLowerCase().includes(term) ||
      (ord.customerName && ord.customerName.toLowerCase().includes(term)) ||
      (ord.apiKey && ord.apiKey.toLowerCase().includes(term)) ||
      (ord.deliveredContent && ord.deliveredContent.toLowerCase().includes(term))
    );
  });

  // Calculate Active Metrics
  const calculatedTotalUsd = filteredOrders.reduce((acc, o) => {
    const s = (o.status || '').toLowerCase();
    if (s === 'failed' || s === 'cancelled') return acc;
    return acc + (parseFloat(o.priceUsd) || (o.priceCents ? o.priceCents / 100 : 0));
  }, 0);

  const lkrRate = data?.summary?.usdToLkrRate || 305.50;
  const calculatedTotalLkr = Math.round(calculatedTotalUsd * lkrRate);

  const handleDownloadPdf = async () => {
    const element = document.getElementById("printable-statement");
    if (!element) return;
    
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#f8fafc",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", margin, margin, contentWidth, contentHeight);

      const filename = selectedInvoiceOrder 
        ? `Invoice-YOUUHOST-${selectedInvoiceOrder.externalOrderId || selectedInvoiceOrder.id}.pdf`
        : `Invoice-Statement-YOUUHOST-${new Date().toISOString().slice(0, 10)}.pdf`;

      pdf.save(filename);

      toast({
        title: "PDF Downloaded",
        description: `${filename} has been saved to your downloads.`,
      });
    } catch (err: any) {
      console.error("PDF generation error:", err);
      toast({
        title: "PDF Download Failed",
        description: err.message || "Failed to generate PDF.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const activeStoreName = 
    selectedStore === "all" 
      ? "All Connected Stores & API Channels" 
      : selectedStore === "sandromania"
      ? "Sandromania CDK Partner Store"
      : selectedStore === "cssx"
      ? "CSxStore CDK Partner Store"
      : selectedStore === "cssx_smm"
      ? "CSSX / SMM Social Boost API"
      : selectedStore === "n1panel"
      ? "N1Panel SMM Platform"
      : selectedStore === "direct"
      ? "Direct Cloud Store (Web/MiniApp)"
      : data?.stores?.find(s => s.id === selectedStore)?.name || selectedStore;

  const formattedDateRange = () => {
    if (timeRange === "24h") return "Past 24 Hours";
    if (timeRange === "7d") return "Past 7 Days";
    if (timeRange === "30d") return "Past 30 Days";
    if (timeRange === "month") return "Current Month to Date";
    if (timeRange === "custom" && startDate && endDate) return `${startDate} to ${endDate}`;
    if (timeRange === "custom" && startDate) return `From ${startDate}`;
    return "All Time Filtered";
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-950/80 border border-purple-800/80 flex items-center justify-center text-purple-400 shadow-md">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                Connected Stores & API Partner Tracker
              </h1>
              <p className="text-slate-400 text-xs md:text-sm mt-0.5">
                Real-time purchase analytics, duration filtering, and delivered goods tracker across all connected stores.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            disabled={isFetching}
            className="gap-2 bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white shrink-0 text-xs font-bold rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-purple-400' : ''}`} />
            Refresh Live Stream
          </Button>

          <Button
            onClick={() => {
              setSelectedInvoiceOrder(null);
              setShowPdfModal(true);
            }}
            className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-purple-600/25 shrink-0"
          >
            <FileText className="w-4 h-4" />
            Export Store Statement (PDF)
          </Button>
        </div>
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
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs rounded-xl">
                  <SelectValue placeholder="All Connected Stores" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectItem value="all">🌐 All Channels & API Stores</SelectItem>
                  <SelectItem value="sandromania">🛍️ Sandromania CDK Shop</SelectItem>
                  <SelectItem value="cssx">💎 CSxStore CDK Partner Shop</SelectItem>
                  <SelectItem value="cssx_smm">🚀 CSSX / CDX Social Boost API</SelectItem>
                  <SelectItem value="n1panel">⚡ N1Panel SMM Platform</SelectItem>
                  <SelectItem value="direct">🛒 Direct Cloud Store (Web/MiniApp)</SelectItem>
                  {data?.stores?.filter(st => !['all', 'sandromania', 'cssx', 'cssx_smm', 'n1panel', 'direct'].includes(st.id)).map(st => (
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
                <TabsList className="bg-slate-950 border border-slate-800 grid grid-cols-5 h-9 rounded-xl">
                  <TabsTrigger value="24h" className="text-xs font-bold">24 Hours</TabsTrigger>
                  <TabsTrigger value="7d" className="text-xs font-bold">7 Days</TabsTrigger>
                  <TabsTrigger value="30d" className="text-xs font-bold">30 Days</TabsTrigger>
                  <TabsTrigger value="month" className="text-xs font-bold">This Month</TabsTrigger>
                  <TabsTrigger value="custom" className="text-xs font-bold">Custom</TabsTrigger>
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
                  className="pl-9 bg-slate-950 border-slate-800 text-xs text-slate-200 h-9 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Custom Date Picker Inputs if 'custom' is active */}
          {timeRange === "custom" && (
            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Start Date</label>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 rounded-xl font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">End Date</label>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 rounded-xl font-bold"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* High-Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="bg-slate-900/80 border-slate-800 shadow-sm relative overflow-hidden rounded-3xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Revenue (USD)
            </CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              ${calculatedTotalUsd > 0 ? calculatedTotalUsd.toFixed(2) : data?.summary?.totalRevenueUsd || "0.00"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              in selected time window
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 shadow-sm relative overflow-hidden rounded-3xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Revenue (LKR)
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-400 font-mono">
              Rs. {(calculatedTotalLkr > 0 ? calculatedTotalLkr : data?.summary?.totalRevenueLkr || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Rate: ~1 USD = {data?.summary?.usdToLkrRate || 305.5} LKR
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 shadow-sm relative overflow-hidden rounded-3xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Purchases
            </CardTitle>
            <ShoppingCart className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-purple-300 font-mono">
              {filteredOrders.length} items
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {filteredOrders.filter(o => ['completed', 'approved', 'success'].includes((o.status || '').toLowerCase())).length} completed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 shadow-sm relative overflow-hidden rounded-3xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
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
              Sandromania, CSxStore, SMM, API & Direct
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Partner Breakdown Cards */}
      {data?.stores && data.stores.length > 0 && (
        <Card className="bg-slate-900/60 border-slate-800 rounded-3xl">
          <CardHeader className="pb-3 border-b border-slate-800/60">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Store className="w-4 h-4 text-purple-400" />
              Connected Channel Performance Overview
            </CardTitle>
            <CardDescription className="text-xs">
              Filter by Sandromania, CSxStore, CSSX / SMM, N1Panel, Direct Shop, or Reseller API Keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {data.stores.map((st) => (
                <div 
                  key={st.id} 
                  onClick={() => setSelectedStore(st.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
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
                        : st.id === "cssx"
                        ? "border-cyan-500/30 text-cyan-300 bg-cyan-500/10"
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
      <Card className="bg-slate-900/80 border-slate-800 shadow-xl overflow-hidden rounded-3xl">
        <CardHeader className="border-b border-slate-800/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" />
                Filtered Purchases & Delivered Goods Stream ({filteredOrders.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Showing {filteredOrders.length} orders matching your duration and store filters.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-slate-800 text-slate-300 self-start sm:self-auto text-xs font-bold">
              {timeRange.toUpperCase()} Duration Filter
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-16 text-slate-500 animate-pulse font-bold">
              Loading connected store analytics stream...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-bold">
              No orders found for the selected store and time duration.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/80">
                  <TableRow className="border-slate-800">
                    <TableHead className="text-xs text-slate-400 w-28">Order #</TableHead>
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
                    const isCssx = (ord as any).storeType === "cssx" || ord.id.toString().includes("CSX");
                    const isSmm = (ord as any).storeType === "cssx_smm" || ord.id.toString().includes("SMM");

                    return (
                      <TableRow key={ord.id} className="border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-purple-400">
                          {String(ord.id).startsWith("#") ? ord.id : `#${ord.id}`}
                        </TableCell>

                        <TableCell>
                          <div className="font-semibold text-xs text-white max-w-[220px] truncate">
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
                              : isCssx
                              ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-300"
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
                            Rs. {ord.priceLkr ? Number(ord.priceLkr).toLocaleString() : Math.round((parseFloat(ord.priceUsd) || 0) * lkrRate).toLocaleString()}
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          {ord.status === "completed" || ord.status === "approved" || ord.status === "success" ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-black">
                              Completed
                            </Badge>
                          ) : ord.status === "pending" ? (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] font-black">
                              Pending
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px] font-black">
                              {ord.status}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                          {ord.createdAt ? new Date(ord.createdAt).toLocaleString() : "N/A"}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-1.5 flex-wrap">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1 text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/40 rounded-lg px-2"
                              onClick={() => {
                                setSelectedInvoiceOrder(ord);
                                setShowPdfModal(true);
                              }}
                              title="Download/Print PDF Invoice for this order"
                            >
                              <FileText className="w-3 h-3 text-purple-400" /> Invoice
                            </Button>

                            {ord.deliveredContent ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs gap-1 text-slate-300 hover:text-white bg-slate-950 border border-slate-800 rounded-lg px-2"
                                  onClick={() => setViewingOrder(ord)}
                                >
                                  <Eye className="w-3 h-3 text-blue-400" /> View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs gap-1 text-slate-300 hover:text-white bg-slate-950 border border-slate-800 rounded-lg px-2"
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
                              <span className="text-[10px] text-amber-400/80 italic px-1">Auto-Delivered</span>
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
        <DialogContent className="max-w-xl bg-slate-950 border-slate-800 text-slate-100 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base font-bold">
              <span>Order #{viewingOrder?.id} Delivery Credentials</span>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs font-mono">
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
              <pre className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-xs font-mono text-emerald-300 overflow-x-auto select-all whitespace-pre-wrap break-all">
                {viewingOrder?.deliveredContent || "No credential content recorded."}
              </pre>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {viewingOrder?.deliveredContent && (
                <Button
                  onClick={() => copyToClipboard(viewingOrder.deliveredContent!, viewingOrder.id)}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1.5 rounded-xl font-bold"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Credentials
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* OFFICIAL ORDER CONFIRMATION EMAIL TEMPLATE INVOICE MODAL */}
      <Dialog open={showPdfModal} onOpenChange={setShowPdfModal}>
        <DialogContent className="max-w-xl max-h-[96vh] overflow-y-auto bg-slate-900/95 border border-slate-800 text-slate-100 rounded-3xl p-4 md:p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 print:hidden">
            <div>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                {selectedInvoiceOrder 
                  ? `Order #${selectedInvoiceOrder.id} Invoice Receipt` 
                  : `Partner Store Ledger (${activeStoreName})`}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Official Order Confirmation & verified invoice receipt.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 px-3.5 py-1.5 h-8 transition-all disabled:opacity-75"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {isGeneratingPdf ? "Generating PDF..." : "Download PDF"}
              </Button>
            </div>
          </div>

          {/* EXACT EMAIL TEMPLATE DESIGN CARD (buildOrderCredentialsEmailHtml) */}
          <div 
            id="printable-statement" 
            className="bg-[#f8fafc] text-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-xl max-w-[500px] mx-auto font-sans print:border-none print:shadow-none print:p-0 print:m-0 print:bg-white"
          >
            {/* Top Logo & Header (Official Logo Image with 100% Transparent Background) */}
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2">
                <img 
                  src="/assets/youuhost_official_logo.png?v=4" 
                  alt="YouuHost" 
                  className="h-8 md:h-10 w-auto object-contain bg-transparent"
                  onError={(e) => {
                    (e.currentTarget as any).src = "/logo.png";
                  }}
                />
              </div>
              <div className="text-right">
                <span className="text-xl md:text-2xl font-black tracking-wider text-[#111827]">INVOICE</span>
              </div>
            </div>

            {/* Clean, Separated & Well-Spaced Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5 text-[12px]">
              {/* Invoice Details Card */}
              <div className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5 shadow-xs">
                <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Invoice Details</p>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Invoice No:</span>
                  <strong className="text-slate-900 font-bold font-mono">
                    {selectedInvoiceOrder ? `INV-${selectedInvoiceOrder.id}` : `PARTNER-${filteredOrders.length}`}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Date:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedInvoiceOrder && selectedInvoiceOrder.createdAt
                      ? new Date(selectedInvoiceOrder.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                      : new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-slate-400">Payment Status:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
                    PAID
                  </span>
                </div>
              </div>

              {/* Billed To Card (support@youuhost.com in green) */}
              <div className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5 shadow-xs">
                <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Billed To</p>
                <p className="font-bold text-slate-900 truncate">
                  YouuHost Support
                </p>
                <p className="text-emerald-600 font-bold truncate text-[11.5px]">
                  support@youuhost.com
                </p>
                <p className="text-slate-600 text-[10.5px] truncate pt-0.5">
                  <span className="text-slate-400">Channel:</span> <span className="font-semibold text-slate-800">{activeStoreName}</span>
                </p>
              </div>
            </div>

            {/* Main White Card Container */}
            <div className="bg-white rounded-[24px] border border-[#f1f5f9] shadow-sm p-4 md:p-6">
              {/* OFFICIAL INVOICE TABLE */}
              <table className="w-full text-left text-xs border-collapse my-2">
                <thead>
                  <tr className="border-t border-b border-[#e2e8f0] text-[#111827] text-[12px] font-semibold">
                    <th className="py-2.5 px-1.5 text-left font-bold">Description</th>
                    <th className="py-2.5 px-1.5 text-right font-bold whitespace-nowrap">Unit price</th>
                    <th className="py-2.5 px-1.5 text-center font-bold">Qty</th>
                    <th className="py-2.5 px-1.5 text-right font-bold whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] text-[12px]">
                  {selectedInvoiceOrder ? (
                    (() => {
                      const qty = selectedInvoiceOrder.quantity || 1;
                      const unitUsd = selectedInvoiceOrder.unitPriceUsd 
                        ? parseFloat(selectedInvoiceOrder.unitPriceUsd) 
                        : (parseFloat(selectedInvoiceOrder.priceUsd) / qty);
                      const totalUsd = parseFloat(selectedInvoiceOrder.priceUsd) || (unitUsd * qty);
                      const orderDate = selectedInvoiceOrder.createdAt ? new Date(selectedInvoiceOrder.createdAt) : new Date();
                      return (
                        <tr>
                          <td className="py-3 px-1.5 font-medium text-[#475569] leading-snug">
                            <div>
                              <span className="font-semibold text-slate-900">{selectedInvoiceOrder.productName}</span>
                              <div className="text-[10px] text-slate-500 font-mono mt-1 flex flex-wrap items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0 inline-block" />
                                <span className="whitespace-nowrap">
                                  {orderDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                </span>
                                <span>•</span>
                                <span className="whitespace-nowrap">
                                  {orderDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-1.5 text-right font-normal text-[#475569] whitespace-nowrap align-top">
                            ${unitUsd.toFixed(2)} USD
                          </td>
                          <td className="py-3 px-1.5 text-center font-bold text-slate-800 align-top">
                            {qty}
                          </td>
                          <td className="py-3 px-1.5 text-right font-bold text-[#111827] whitespace-nowrap align-top">
                            ${totalUsd.toFixed(2)} USD
                          </td>
                        </tr>
                      );
                    })()
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-5 text-center text-slate-400 text-xs italic">
                        No orders recorded for this store in selected duration.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.slice(0, 25).map((ord, idx) => {
                      const qty = ord.quantity || 1;
                      const unitUsd = ord.unitPriceUsd 
                        ? parseFloat(ord.unitPriceUsd) 
                        : ((parseFloat(ord.priceUsd) || (ord.priceCents ? ord.priceCents / 100 : 0)) / qty);
                      const totalUsd = parseFloat(ord.priceUsd) || (unitUsd * qty);
                      const orderDate = ord.createdAt ? new Date(ord.createdAt) : new Date();
                      return (
                        <tr key={idx}>
                          <td className="py-2.5 px-1.5 font-medium text-[#475569] leading-snug">
                            <div>
                              <span className="font-semibold text-slate-900">{ord.productName}</span>
                              <div className="text-[10px] text-slate-500 font-mono mt-1 flex flex-wrap items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0 inline-block" />
                                <span className="whitespace-nowrap">
                                  {orderDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                </span>
                                <span>•</span>
                                <span className="whitespace-nowrap">
                                  {orderDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-1.5 text-right font-normal text-[#475569] whitespace-nowrap align-top">
                            ${unitUsd.toFixed(2)} USD
                          </td>
                          <td className="py-2.5 px-1.5 text-center font-bold text-slate-800 align-top">
                            {qty}
                          </td>
                          <td className="py-2.5 px-1.5 text-right font-bold text-[#111827] whitespace-nowrap align-top">
                            ${totalUsd.toFixed(2)} USD
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Discounts Row */}
                  <tr className="border-t border-[#f1f5f9]">
                    <td colSpan={2}></td>
                    <td className="py-2 px-1.5 text-right text-[11.5px] text-[#64748b]">Discounts</td>
                    <td className="py-2 px-1.5 text-right text-[11.5px] text-[#64748b]">$0.00</td>
                  </tr>

                  {/* Subtotal Row */}
                  <tr>
                    <td colSpan={2}></td>
                    <td className="py-1 px-1.5 text-right text-[11.5px] text-[#64748b]">Subtotal</td>
                    <td className="py-1 px-1.5 text-right text-[11.5px] font-semibold text-[#64748b]">
                      ${selectedInvoiceOrder 
                        ? parseFloat(selectedInvoiceOrder.priceUsd).toFixed(2)
                        : calculatedTotalUsd.toFixed(2)} USD
                    </td>
                  </tr>

                  {/* Total Row */}
                  <tr>
                    <td colSpan={2}></td>
                    <td className="py-1.5 px-1.5 text-right text-[12.5px] font-bold text-[#111827]">Total</td>
                    <td className="py-1.5 px-1.5 text-right text-[12.5px] font-black text-[#111827]">
                      ${selectedInvoiceOrder 
                        ? parseFloat(selectedInvoiceOrder.priceUsd).toFixed(2)
                        : calculatedTotalUsd.toFixed(2)} USD
                    </td>
                  </tr>

                  {/* Payment Row */}
                  <tr>
                    <td colSpan={2}></td>
                    <td className="py-1.5 px-1.5 text-right text-[12.5px] font-bold text-[#00d166]">Payment</td>
                    <td className="py-1.5 px-1.5 text-right text-[12.5px] font-black text-[#00d166]">
                      ${selectedInvoiceOrder 
                        ? parseFloat(selectedInvoiceOrder.priceUsd).toFixed(2)
                        : calculatedTotalUsd.toFixed(2)} USD
                    </td>
                  </tr>

                  {/* Settled Price in USD */}
                  <tr className="border-t border-slate-100">
                    <td colSpan={2}></td>
                    <td className="py-1.5 px-1.5 text-right text-[12px] font-bold text-emerald-600">Settled (USD)</td>
                    <td className="py-1.5 px-1.5 text-right text-[12px] font-black text-emerald-600">
                      ${selectedInvoiceOrder 
                        ? parseFloat(selectedInvoiceOrder.priceUsd).toFixed(2)
                        : calculatedTotalUsd.toFixed(2)} USD
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Action Button */}
              <div className="mt-5 mb-4 text-center print:hidden flex items-center justify-center gap-2">
                <Button 
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="w-full max-w-[280px] bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold text-sm rounded-full py-3 h-auto shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-75"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isGeneratingPdf ? "Generating PDF File..." : "Download PDF"}
                </Button>
              </div>

              {/* Card Footer */}
              <div className="text-center text-[11px] text-[#64748b] leading-relaxed mt-4 pt-3 border-t border-slate-100">
                Official verified ledger receipt generated for <strong className="text-[#111827]">{activeStoreName}</strong>.<br />
                Best Regards, <strong className="text-[#111827]">YouuHost Cloud Systems</strong>
              </div>
            </div>

            {/* Outer Footer Note */}
            <div className="mt-4 text-center text-[10px] text-[#94a3b8] leading-tight">
              <p className="mb-0.5 font-medium">https://youuhost.com • Official Store Tracker</p>
              <p>Automated cloud sync & partner reconciliation.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
