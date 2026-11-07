import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  ShoppingCart, 
  Calendar, 
  User, 
  Eye, 
  Copy, 
  Check, 
  Package, 
  Layers, 
  Share2, 
  ShoppingBag, 
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Server
} from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function OrdersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | "cloud" | "smm" | "partner" | "cssx">("all");
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);

  // Fetch Consolidated Orders (Cloud, SMM, Sandromania, CSxStore)
  const { data: allOrders = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ["/api/admin/all-orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/all-orders", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch consolidated orders");
      return res.json();
    },
    refetchInterval: 12000,
  });

  const copyToClipboard = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Copied!",
      description: "Order credentials copied to clipboard.",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      // Type Filter
      if (selectedType !== "all") {
        if (selectedType === "partner") {
          if (order.orderType !== "partner" && order.orderType !== "sandromania") return false;
        } else if (order.orderType !== selectedType) {
          return false;
        }
      }

      // Search query
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      const idStr = String(order.id || "").toLowerCase();
      const rawIdStr = String(order.rawId || "");
      const titleStr = String(order.title || order.product?.name || "").toLowerCase();
      const buyerStr = String(order.buyer || "").toLowerCase();
      const usernameStr = String(order.buyerUsername || order.telegramUser?.username || "").toLowerCase();
      const emailStr = String(order.buyerEmail || order.telegramUser?.email || "").toLowerCase();
      const tgIdStr = String(order.buyerTelegramId || order.telegramUser?.telegramId || "");
      const statusStr = String(order.status || "").toLowerCase();

      return (
        idStr.includes(q) ||
        rawIdStr.includes(q) ||
        titleStr.includes(q) ||
        buyerStr.includes(q) ||
        usernameStr.includes(q) ||
        emailStr.includes(q) ||
        tgIdStr.includes(q) ||
        statusStr.includes(q)
      );
    });
  }, [allOrders, selectedType, search]);

  const counts = useMemo(() => {
    return {
      all: allOrders.length,
      cloud: allOrders.filter(o => o.orderType === "cloud").length,
      partner: allOrders.filter(o => o.orderType === "partner" || o.orderType === "sandromania").length,
      cssx: allOrders.filter(o => o.orderType === "cssx").length,
      smm: allOrders.filter(o => o.orderType === "smm").length,
    };
  }, [allOrders]);

  const getOrderIcon = (orderType: string) => {
    switch (orderType) {
      case "smm":
        return <Share2 className="w-4 h-4 text-purple-400" />;
      case "partner":
      case "sandromania":
        return <ShoppingBag className="w-4 h-4 text-emerald-400" />;
      case "cssx":
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case "cloud":
      default:
        return <ShoppingCart className="w-4 h-4 text-purple-400" />;
    }
  };

  const getOrderTypeBadge = (orderType: string, typeLabel?: string) => {
    switch (orderType) {
      case "smm":
        return (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
            SMM Boost
          </span>
        );
      case "partner":
      case "sandromania":
        return (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            Sandromania
          </span>
        );
      case "cssx":
        return (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            CSxStore Partner
          </span>
        );
      case "cloud":
      default:
        return (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">
            Cloud
          </span>
        );
    }
  };

  const renderStatusBadge = (statusStr: string) => {
    const s = (statusStr || "").toLowerCase();
    if (s === "completed" || s === "approved" || s === "success" || s === "active") {
      return (
        <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> COMPLETED
        </Badge>
      );
    }
    if (s.includes("pend") || s.includes("wait") || s.includes("progress")) {
      return (
        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1">
          <Clock className="w-3 h-3" /> {statusStr.toUpperCase()}
        </Badge>
      );
    }
    return (
      <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1">
        <XCircle className="w-3 h-3" /> {statusStr.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-white">Orders</h1>
            <Badge variant="outline" className="border-purple-500/30 text-purple-300 font-mono text-xs">
              {allOrders.length} Total
            </Badge>
          </div>
          <p className="text-white/40 mt-1 font-medium text-xs">
            History of all transactions across Cloud, SMM, Sandromania & CSxStore.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-10 px-3.5 glass-panel border-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              type="search"
              placeholder="Search orders, buyer, ID..."
              className="pl-9 glass-panel border-white/10 text-white placeholder:text-white/20 h-10 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedType("all")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            selectedType === "all"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
              : "glass-panel border-white/5 text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> All Orders ({counts.all})
        </button>

        <button
          onClick={() => setSelectedType("cloud")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            selectedType === "cloud"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
              : "glass-panel border-white/5 text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5 text-blue-400" /> Cloud Accounts ({counts.cloud})
        </button>

        <button
          onClick={() => setSelectedType("partner")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            selectedType === "partner"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "glass-panel border-white/5 text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" /> Sandromania ({counts.partner})
        </button>

        <button
          onClick={() => setSelectedType("cssx")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            selectedType === "cssx"
              ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30"
              : "glass-panel border-white/5 text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> CSxStore Partner ({counts.cssx})
        </button>

        <button
          onClick={() => setSelectedType("smm")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            selectedType === "smm"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
              : "glass-panel border-white/5 text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <Share2 className="w-3.5 h-3.5 text-purple-400" /> YouuHost Boosts ({counts.smm})
        </button>
      </div>

      {/* Main Table */}
      <div className="glass-card border-0 rounded-3xl overflow-hidden shadow-2xl">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Order ID</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Product</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Buyer</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Date</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Status</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Amount</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] text-right pr-8">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-white/5">
                  <TableCell><Skeleton className="h-5 w-16 bg-white/5" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-36 bg-white/5" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32 bg-white/5" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 bg-white/5" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 bg-white/5" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 bg-white/5" /></TableCell>
                  <TableCell className="pr-8"><Skeleton className="h-8 w-8 ml-auto rounded-xl bg-white/5" /></TableCell>
                </TableRow>
              ))
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center text-white/30 font-medium">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const orderId = order.id || `#${order.rawId}`;
                const title = order.title || order.product?.name || "Digital Service";
                const username = order.buyerUsername || (order.telegramUser?.username ? `@${order.telegramUser.username}` : null);
                const email = order.buyerEmail || order.telegramUser?.email || null;
                const tgId = order.buyerTelegramId || order.telegramUser?.telegramId || null;
                
                // Purchase Currency Exact Output (LKR -> Rs. XXX, USD -> $X.XX)
                const displayAmount = order.displayAmount 
                  || (order.currency === "LKR" ? (order.amountLkr || `Rs. ${order.amountPaidLkr}`) : (order.amountUsd || `$${((order.amountCents || order.product?.price || 0) / 100).toFixed(2)}`));

                const credentials = order.deliveredContent || order.credential?.content || order.deliveryText || order.details || "Instant fulfillment processed.";

                return (
                  <TableRow key={order.id || order.rawId} className="border-white/5 hover:bg-white/5 transition-all duration-300">
                    {/* Order ID */}
                    <TableCell className="font-mono text-xs font-black text-purple-300/80 tracking-tight">
                      {orderId}
                    </TableCell>

                    {/* Product */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                          {getOrderIcon(order.orderType)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-white tracking-tight truncate max-w-[200px] sm:max-w-xs">
                            {title}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {getOrderTypeBadge(order.orderType, order.typeLabel)}
                            {order.quantity > 1 && (
                              <span className="text-[10px] text-white/40 font-mono">
                                ×{order.quantity}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Buyer (Matches Image 2) */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/30 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-white tracking-tight truncate max-w-[160px]">
                            {username || email || (tgId ? `ID: ${tgId}` : "Unknown User")}
                          </span>
                          {email && (
                            <span className="text-[11px] text-purple-300 font-mono truncate max-w-[180px]">
                              {email}
                            </span>
                          )}
                          {tgId && (
                            <span className="text-[10px] text-white/30 font-black">
                              {tgId}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-white/40 text-[11px] font-bold">
                        <Calendar className="w-3 h-3 text-white/20 shrink-0" />
                        {order.createdAt ? format(new Date(order.createdAt), "MMM d, HH:mm") : "-"}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {renderStatusBadge(order.status)}
                    </TableCell>

                    {/* Amount (Customer Purchase Currency - USD or Rs) */}
                    <TableCell className="font-mono font-black text-sm text-white">
                      {displayAmount}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right pr-8">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setSelectedOrderDetails(order)}
                        className="h-10 w-10 rounded-xl text-white/30 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <Eye className="h-5 w-5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Order Credentials / Details Dialog */}
      <Dialog open={!!selectedOrderDetails} onOpenChange={(open) => !open && setSelectedOrderDetails(null)}>
        <DialogContent className="glass-panel border-white/10 bg-background/95 backdrop-blur-3xl sm:max-w-lg rounded-[2rem] p-8 shadow-4xl text-white">
          {selectedOrderDetails && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl font-black text-white tracking-tight">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white shadow-lg shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span>Order {selectedOrderDetails.id || `#${selectedOrderDetails.rawId}`}</span>
                      {getOrderTypeBadge(selectedOrderDetails.orderType, selectedOrderDetails.typeLabel)}
                    </div>
                    <p className="text-xs text-white/40 font-normal mt-0.5">
                      {selectedOrderDetails.title || selectedOrderDetails.product?.name}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Amount & Buyer Banner */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Buyer</span>
                  <span className="font-bold text-white truncate block">
                    {selectedOrderDetails.buyerUsername || selectedOrderDetails.buyerEmail || selectedOrderDetails.buyerTelegramId}
                  </span>
                  {selectedOrderDetails.buyerEmail && (
                    <span className="text-[11px] text-purple-300 font-mono block truncate">
                      {selectedOrderDetails.buyerEmail}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Charged Amount</span>
                  <span className="font-black text-base font-mono text-emerald-400 block">
                    {selectedOrderDetails.displayAmount || (selectedOrderDetails.currency === "LKR" ? selectedOrderDetails.amountLkr : selectedOrderDetails.amountUsd)}
                  </span>
                  <span className="text-[10px] text-white/40 font-mono block">
                    Currency: {selectedOrderDetails.currency || "USD"}
                  </span>
                </div>
              </div>

              {/* Delivery Text / Credentials Box */}
              <div>
                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">
                  Delivered License / Credentials Content:
                </span>
                <div className="p-4 rounded-2xl glass-panel border-white/10 bg-black/40 relative group min-h-[100px] flex items-center">
                  <pre className="text-xs text-white/90 font-mono whitespace-pre-wrap break-all relative z-10 leading-relaxed w-full">
                    {selectedOrderDetails.deliveredContent || selectedOrderDetails.credential?.content || selectedOrderDetails.deliveryText || selectedOrderDetails.details || "No credential data available"}
                  </pre>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-3 right-3 h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold border-white/10 gap-1.5"
                    onClick={() => copyToClipboard(
                      selectedOrderDetails.deliveredContent || selectedOrderDetails.credential?.content || selectedOrderDetails.deliveryText || selectedOrderDetails.details || "", 
                      selectedOrderDetails.id || selectedOrderDetails.rawId
                    )}
                  >
                    {copiedId === (selectedOrderDetails.id || selectedOrderDetails.rawId) ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-white/60" /> Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/5">
                <span>Date: {selectedOrderDetails.createdAt ? format(new Date(selectedOrderDetails.createdAt), "yyyy-MM-dd HH:mm:ss") : "N/A"}</span>
                <span>Status: <strong className="text-white font-mono uppercase">{selectedOrderDetails.status}</strong></span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
