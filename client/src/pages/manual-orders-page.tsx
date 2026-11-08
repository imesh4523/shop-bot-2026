import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  Send,
  AlertTriangle,
  Mail,
  User,
  ShoppingBag,
  DollarSign,
  Layers,
  Sparkles,
  ExternalLink,
  Filter,
  CheckCheck,
  MessageCircle,
  Calendar,
  ChevronRight,
  ShieldAlert,
  Boxes,
  Package,
  Plus,
  Minus,
  Save
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ManualOrdersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copiedEmailId, setCopiedEmailId] = useState<number | null>(null);

  // Delivery Modal State
  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [selectedDeliverOrder, setSelectedDeliverOrder] = useState<any | null>(null);
  const [deliveryNote, setDeliveryNote] = useState("");

  // Cancel & Refund Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedCancelOrder, setSelectedCancelOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Live Auto-Sync Query (every 3 seconds)
  const { data: manualOrders = [], isLoading, isFetching, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/manual-orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/manual-orders");
      if (!res.ok) throw new Error("Failed to load manual orders");
      return res.json();
    },
    refetchInterval: 3000,
  });

  // Manual Products (Canva, YouTube) Live Stock Management
  const [stockInputs, setStockInputs] = useState<Record<number, number>>({});
  const [stockUpdatingId, setStockUpdatingId] = useState<number | null>(null);

  const { data: manualProducts = [], isLoading: isStockLoading, refetch: refetchStock } = useQuery<any[]>({
    queryKey: ["/api/admin/manual-products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/manual-products");
      if (!res.ok) throw new Error("Failed to load manual products stock");
      return res.json();
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, stock }: { productId: number; stock: number }) => {
      const res = await fetch(`/api/admin/manual-products/${productId}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update stock");
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/manual-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({
        title: "Stock Updated! ✅",
        description: `Product stock successfully updated to ${variables.stock} units.`,
      });
      setStockUpdatingId(null);
    },
    onError: (err: any) => {
      toast({
        title: "Stock Update Failed",
        description: err.message,
        variant: "destructive",
      });
      setStockUpdatingId(null);
    },
  });

  // Mark Delivered Mutation
  const deliverMutation = useMutation({
    mutationFn: async ({ orderId, deliveryNote }: { orderId: number; deliveryNote: string }) => {
      const res = await fetch(`/api/admin/manual-orders/${orderId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to mark order as delivered");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/manual-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/manual-orders/pending-count"] });
      toast({
        title: "Order Delivered! 🎉",
        description: "Order marked as completed and customer notified via Telegram.",
      });
      setDeliverModalOpen(false);
      setSelectedDeliverOrder(null);
      setDeliveryNote("");
    },
    onError: (err: any) => {
      toast({
        title: "Action Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Cancel & Refund Mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: number; reason: string }) => {
      const res = await fetch(`/api/admin/manual-orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to cancel order");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/manual-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/manual-orders/pending-count"] });
      toast({
        title: "Order Cancelled & Refunded! 💰",
        description: data.message || "Customer wallet balance has been refunded in full.",
      });
      setCancelModalOpen(false);
      setSelectedCancelOrder(null);
      setCancelReason("");
    },
    onError: (err: any) => {
      toast({
        title: "Cancellation Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Copy Email to Clipboard with tactile feedback
  const handleCopyEmail = (email: string, id: number) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmailId(id);
    toast({
      title: "Email Copied! 📋",
      description: email,
    });
    setTimeout(() => {
      setCopiedEmailId(null);
    }, 2500);
  };

  // Filter & Search Logic
  const filteredOrders = manualOrders.filter((ord) => {
    const statusMatch =
      statusFilter === "all" || ord.status?.toLowerCase() === statusFilter.toLowerCase();

    const q = searchQuery.toLowerCase().trim();
    if (!q) return statusMatch;

    const emailMatch = ord.customerEmail?.toLowerCase().includes(q);
    const prodMatch = ord.productName?.toLowerCase().includes(q);
    const userMatch =
      ord.username?.toLowerCase().includes(q) ||
      ord.firstName?.toLowerCase().includes(q) ||
      String(ord.telegramId || "").includes(q);
    const idMatch = String(ord.id).includes(q);

    return statusMatch && (emailMatch || prodMatch || userMatch || idMatch);
  });

  // Calculate live stats
  const pendingCount = manualOrders.filter((o) => o.status === "pending").length;
  const completedCount = manualOrders.filter((o) => o.status === "completed").length;
  const cancelledCount = manualOrders.filter((o) => o.status === "cancelled").length;

  // Helper for brand icon
  const getBrandIcon = (productName: string = "") => {
    const name = productName.toLowerCase();
    if (name.includes("youtube")) {
      return (
        <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-red-500 fill-current" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
      );
    }
    if (name.includes("canva")) {
      return (
        <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center shrink-0 font-black text-cyan-400 text-sm">
          C
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400">
        <Mail className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6 md:p-8 max-w-7xl mx-auto pb-20">
      {/* Header Banner - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-purple-950/60 via-indigo-950/50 to-slate-900/80 border border-purple-500/30 p-4 sm:p-6 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30 shrink-0">
            <Mail className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
              Manual Orders Manager
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 sm:h-6 px-2 text-[10px] sm:text-xs font-black text-white bg-red-500 rounded-full animate-pulse shadow-md shadow-red-500/50">
                  {pendingCount} PENDING
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              Manage YouTube, Canva subscriptions & customer email deliveries
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-purple-500/40 hover:bg-purple-500/10 text-purple-300 font-bold text-xs h-8 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Sync {isFetching ? "..." : ""}
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards - 3 Compact Columns on Mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Pending Card */}
        <div
          onClick={() => setStatusFilter("pending")}
          className={`cursor-pointer rounded-xl sm:rounded-2xl p-3 sm:p-5 border transition-all ${
            statusFilter === "pending"
              ? "bg-amber-500/15 border-amber-500 shadow-md shadow-amber-500/10"
              : "bg-slate-900/60 border-amber-500/30 hover:border-amber-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs uppercase tracking-wider font-black text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              Pending
            </span>
            <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-400 hidden sm:block" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-white mt-1 sm:mt-2">
            {pendingCount}
          </div>
          <p className="text-[9px] sm:text-xs text-gray-400 truncate mt-0.5">Awaiting action</p>
        </div>

        {/* Completed Card */}
        <div
          onClick={() => setStatusFilter("completed")}
          className={`cursor-pointer rounded-xl sm:rounded-2xl p-3 sm:p-5 border transition-all ${
            statusFilter === "completed"
              ? "bg-emerald-500/15 border-emerald-500 shadow-md shadow-emerald-500/10"
              : "bg-slate-900/60 border-emerald-500/30 hover:border-emerald-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs uppercase tracking-wider font-black text-emerald-400">
              Completed
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-400 hidden sm:block" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-white mt-1 sm:mt-2">
            {completedCount}
          </div>
          <p className="text-[9px] sm:text-xs text-gray-400 truncate mt-0.5">Delivered</p>
        </div>

        {/* Cancelled Card */}
        <div
          onClick={() => setStatusFilter("cancelled")}
          className={`cursor-pointer rounded-xl sm:rounded-2xl p-3 sm:p-5 border transition-all ${
            statusFilter === "cancelled"
              ? "bg-red-500/15 border-red-500 shadow-md shadow-red-500/10"
              : "bg-slate-900/60 border-red-500/30 hover:border-red-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs uppercase tracking-wider font-black text-red-400">
              Cancelled
            </span>
            <XCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-400 hidden sm:block" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-white mt-1 sm:mt-2">
            {cancelledCount}
          </div>
          <p className="text-[9px] sm:text-xs text-gray-400 truncate mt-0.5">Refunded</p>
        </div>
      </div>

      {/* Manual Products Live Stock & Inventory Widget */}
      <div className="bg-gradient-to-br from-slate-900/90 via-purple-950/20 to-slate-900/90 border border-purple-500/30 rounded-2xl p-3.5 sm:p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-purple-500/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-purple-500/20 rounded-xl border border-amber-500/30 text-amber-400 shrink-0">
              <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
                  Manual Delivery Available Stock
                </h2>
                <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px] font-mono px-2 py-0.5 bg-amber-500/10">
                  Canva & YouTube Live
                </Badge>
              </div>
              <p className="text-[11px] text-gray-400">
                Direct stock count for manual delivery items. Decrements automatically on purchase; customers see "SOLD OUT" when 0.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStock()}
            disabled={isStockLoading}
            className="h-7 text-xs border-purple-500/30 text-purple-300 hover:bg-purple-500/20 self-end sm:self-center rounded-lg"
          >
            <RefreshCw className={`w-3 h-3 mr-1.5 ${isStockLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {isStockLoading ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            Loading manual inventory...
          </div>
        ) : manualProducts.length === 0 ? (
          <div className="py-4 text-center text-xs text-gray-400">
            No manual delivery products found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {manualProducts.map((p: any) => {
              const currentStock = typeof stockInputs[p.id] === "number" ? stockInputs[p.id] : (p.manualStock ?? 0);
              const isModified = stockInputs[p.id] !== undefined && stockInputs[p.id] !== (p.manualStock ?? 0);
              const isUpdating = stockUpdatingId === p.id;
              const isOutOfStock = currentStock <= 0;

              return (
                <div
                  key={p.id}
                  className={`relative bg-slate-950/80 border rounded-xl p-3.5 transition-all ${
                    isOutOfStock
                      ? "border-red-500/40 bg-red-950/10"
                      : isModified
                      ? "border-amber-500/60 shadow-md shadow-amber-500/10"
                      : "border-slate-800 hover:border-purple-500/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getBrandIcon(p.name)}
                      <div className="min-w-0">
                        <div className="font-black text-sm text-white truncate flex items-center gap-1.5">
                          <span>{p.name}</span>
                          <span className="text-[10px] text-gray-500 font-mono">#{p.id}</span>
                        </div>
                        <div className="text-xs text-purple-300 font-bold flex items-center gap-2 mt-0.5">
                          <span>Rs. {Number(p.price).toLocaleString()}</span>
                          <span className="text-[10px] text-gray-500">• Manual Email Delivery</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          OUT OF STOCK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          AVAILABLE: {p.manualStock ?? 0}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock Counter Controls */}
                  <div className="space-y-2 pt-2.5 border-t border-slate-800/80">
                    <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                      {/* Plus / Minus & Number Input */}
                      <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 shadow-inner">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-white rounded-md"
                          onClick={() => {
                            const newVal = Math.max(0, currentStock - 1);
                            setStockInputs((prev) => ({ ...prev, [p.id]: newVal }));
                          }}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={currentStock}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setStockInputs((prev) => ({ ...prev, [p.id]: isNaN(val) ? 0 : Math.max(0, val) }));
                          }}
                          className="h-7 w-16 text-center text-xs font-black bg-transparent border-0 focus-visible:ring-0 p-0 text-white"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-white rounded-md"
                          onClick={() => {
                            const newVal = currentStock + 1;
                            setStockInputs((prev) => ({ ...prev, [p.id]: newVal }));
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1 overflow-x-auto">
                        {[0, 10, 25, 50, 100].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setStockInputs((prev) => ({ ...prev, [p.id]: preset }))}
                            className={`text-[10px] px-2 py-1 rounded-md font-mono transition-all ${
                              currentStock === preset
                                ? "bg-purple-600 text-white font-black shadow-sm shadow-purple-500/40"
                                : "bg-slate-900/90 text-gray-400 border border-slate-800 hover:text-white hover:border-slate-700"
                            }`}
                          >
                            {preset === 0 ? "0 (Sold Out)" : `+${preset}`}
                          </button>
                        ))}
                      </div>

                      {/* Save Button */}
                      <Button
                        size="sm"
                        disabled={isUpdating || !isModified}
                        onClick={() => {
                          setStockUpdatingId(p.id);
                          updateStockMutation.mutate({ productId: p.id, stock: currentStock });
                        }}
                        className={`h-7 ml-auto text-xs font-black px-3.5 rounded-lg shrink-0 transition-all ${
                          isModified
                            ? "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-500/30 scale-105"
                            : "bg-slate-800/80 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {isModified ? "Save Stock" : "Saved"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search & Filter Bar - Mobile Friendly */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search email, order #, product, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-950/80 border-slate-800 text-xs sm:text-sm text-white h-10 rounded-xl focus-visible:ring-purple-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] text-gray-400 font-bold shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {[
            { id: "all", label: "All Orders", count: manualOrders.length },
            { id: "pending", label: "Pending", count: pendingCount },
            { id: "completed", label: "Completed", count: completedCount },
            { id: "cancelled", label: "Cancelled", count: cancelledCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-xl text-xs font-black shrink-0 transition-all flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-slate-950 text-gray-400 hover:text-white border border-slate-800"
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-slate-800 text-gray-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-400 mb-2" />
            Loading manual orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 text-center p-8 sm:p-12 rounded-2xl">
            <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-gray-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No Orders Found</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "Try clearing your search terms or filter selection."
                : "Incoming customer orders for YouTube and Canva will appear here in real time."}
            </p>
          </div>
        ) : (
          filteredOrders.map((ord) => {
            const isPending = ord.status === "pending";
            const isCompleted = ord.status === "completed";
            const isCancelled = ord.status === "cancelled";

            const formattedPaidLkr = ord.amountPaidLkr
              ? `Rs. ${Number(ord.amountPaidLkr).toLocaleString()}`
              : ord.productPriceLkr
              ? `Rs. ${Number(ord.productPriceLkr).toLocaleString()}`
              : null;
            const formattedPaidUsd = ord.amountPaid
              ? `$${(ord.amountPaid / 100).toFixed(2)}`
              : ord.productPrice
              ? `$${(ord.productPrice / 100).toFixed(2)}`
              : null;

            return (
              <div
                key={ord.id}
                className={`rounded-2xl border p-4 sm:p-5 transition-all space-y-3 ${
                  isPending
                    ? "bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5"
                    : isCompleted
                    ? "bg-slate-900/70 border-emerald-500/30"
                    : "bg-slate-900/40 border-slate-800/80 opacity-75"
                }`}
              >
                {/* Top Row: Order ID, Date, and Status Badge */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-slate-800 text-gray-300">
                      #ORD-{ord.id}
                    </span>
                    {ord.createdAt && (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        {new Date(ord.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>

                  <Badge
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      isPending
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                        : isCompleted
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-red-500/20 text-red-300 border-red-500/40"
                    }`}
                  >
                    {isPending ? "⏳ PENDING DELIVERY" : isCompleted ? "✅ DELIVERED" : "❌ CANCELLED"}
                  </Badge>
                </div>

                {/* Main Product & Customer Info Row */}
                <div className="flex items-start gap-3">
                  {getBrandIcon(ord.productName)}

                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-white text-sm sm:text-base leading-snug">
                      {ord.productName || "Manual Subscription"}
                    </h3>

                    <div className="flex items-center gap-2 flex-wrap mt-1 text-xs">
                      {/* Customer info */}
                      <span className="flex items-center gap-1 text-purple-300 font-bold">
                        <User className="w-3.5 h-3.5 text-purple-400" />
                        {ord.firstName || ord.username || `User #${ord.telegramUserId}`}
                        {ord.username && (
                          <a
                            href={`https://t.me/${ord.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-400 hover:underline flex items-center gap-0.5 font-normal"
                          >
                            (@{ord.username})
                          </a>
                        )}
                      </span>

                      <span className="text-gray-600">•</span>

                      {/* Price info */}
                      <span className="font-black text-emerald-400 font-mono">
                        {formattedPaidLkr || formattedPaidUsd}{" "}
                        {formattedPaidLkr && formattedPaidUsd && (
                          <span className="text-gray-400 font-normal text-[11px]">
                            ({formattedPaidUsd})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delivery Email Container - High Priority Mobile Display */}
                <div className="bg-slate-950/90 border border-purple-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-purple-400 tracking-wider">
                      <Mail className="w-3.5 h-3.5" />
                      Customer Delivery Email
                    </div>
                    <div className="text-sm font-mono font-black text-white select-all break-all mt-0.5">
                      {ord.customerEmail || (
                        <span className="text-red-400 italic">No email provided</span>
                      )}
                    </div>
                    {ord.customerNote && (
                      <p className="text-[11px] text-gray-400 italic mt-1 bg-white/5 p-1.5 rounded-lg border border-white/5">
                        <b className="text-gray-300 not-italic">Note:</b> {ord.customerNote}
                      </p>
                    )}
                  </div>

                  {ord.customerEmail && (
                    <Button
                      size="sm"
                      onClick={() => handleCopyEmail(ord.customerEmail, ord.id)}
                      className={`w-full sm:w-auto shrink-0 font-black text-xs h-9 rounded-xl transition-all ${
                        copiedEmailId === ord.id
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40"
                      }`}
                    >
                      {copiedEmailId === ord.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5" /> Copied Email!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Email
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Action Buttons for Mobile / Desktop */}
                <div className="pt-1">
                  {isPending ? (
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedDeliverOrder(ord);
                          setDeliveryNote("");
                          setDeliverModalOpen(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-10 rounded-xl shadow-md flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Deliver Order</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedCancelOrder(ord);
                          setCancelReason("");
                          setCancelModalOpen(true);
                        }}
                        className="bg-red-600/90 hover:bg-red-600 text-white font-black text-xs h-10 rounded-xl shadow-md flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Cancel & Refund</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between">
                      <span className="truncate">
                        {ord.deliveryText || (isCompleted ? "Delivered to customer" : "Refunded to wallet")}
                      </span>
                      <span className="text-[10px] text-gray-500 shrink-0 ml-2">
                        {isCompleted ? "Completed" : "Cancelled"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Deliver Order Modal - Mobile Optimized */}
      <Dialog open={deliverModalOpen} onOpenChange={setDeliverModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white w-[94vw] max-w-md mx-auto rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400 text-base sm:text-lg">
              <CheckCircle2 className="w-5 h-5 shrink-0" /> Confirm Delivery
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Order #{selectedDeliverOrder?.id} • {selectedDeliverOrder?.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 space-y-1">
              <p className="text-[11px] text-gray-400 font-bold uppercase">Customer Delivery Email:</p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-black text-white text-xs sm:text-sm break-all">
                  {selectedDeliverOrder?.customerEmail}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    handleCopyEmail(selectedDeliverOrder?.customerEmail, selectedDeliverOrder?.id)
                  }
                  className="h-7 text-xs text-purple-400 hover:text-purple-300 shrink-0"
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300">
                Delivery / Activation Note (Sent to Customer Bot)
              </label>
              <Textarea
                placeholder="e.g. Your Canva invitation has been sent to your email. Please check your inbox and accept the team invite!"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-white focus-visible:ring-emerald-500 rounded-xl"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeliverModalOpen(false)}
              className="border-slate-800 text-gray-400 h-9 rounded-xl flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                deliverMutation.mutate({
                  orderId: selectedDeliverOrder.id,
                  deliveryNote,
                })
              }
              disabled={deliverMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-9 rounded-xl flex-1 sm:flex-none"
            >
              {deliverMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Delivering...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Confirm Delivery
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel & Refund Confirmation Modal - Mobile Optimized */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="bg-slate-900 border-red-500/30 text-white w-[94vw] max-w-md mx-auto rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400 text-base sm:text-lg">
              <AlertTriangle className="w-5 h-5 shrink-0" /> Cancel & Refund
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Immediately marks Order #{selectedCancelOrder?.id} as cancelled and refunds full balance to user wallet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 bg-red-950/30 rounded-xl border border-red-500/20 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Product:</span>
                <span className="font-bold text-white">{selectedCancelOrder?.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Customer:</span>
                <span className="font-bold text-white">
                  {selectedCancelOrder?.firstName || selectedCancelOrder?.username || "Customer"}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-red-500/20">
                <span className="text-gray-400">Refund Amount:</span>
                <span className="font-black text-emerald-400 font-mono text-sm">
                  {selectedCancelOrder?.amountPaidLkr
                    ? `Rs. ${Number(selectedCancelOrder.amountPaidLkr).toLocaleString()}`
                    : `Rs. ${selectedCancelOrder?.productPriceLkr || 0}`}{" "}
                  (
                  {selectedCancelOrder?.amountPaid
                    ? `$${(selectedCancelOrder.amountPaid / 100).toFixed(2)}`
                    : `$${((selectedCancelOrder?.productPrice || 0) / 100).toFixed(2)}`}
                  )
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300">
                Cancellation Reason (Optional)
              </label>
              <Input
                placeholder="e.g. Account activation unavailable / Refunded upon request"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-white focus-visible:ring-red-500 rounded-xl h-9"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(false)}
              className="border-slate-800 text-gray-400 h-9 rounded-xl flex-1 sm:flex-none"
            >
              Keep Order
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                cancelMutation.mutate({
                  orderId: selectedCancelOrder.id,
                  reason: cancelReason,
                })
              }
              disabled={cancelMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-black h-9 rounded-xl flex-1 sm:flex-none"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Refunding...
                </>
              ) : (
                <>
                  <DollarSign className="w-3.5 h-3.5 mr-1.5" /> Confirm Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
