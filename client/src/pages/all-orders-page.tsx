import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  ShoppingCart,
  Calendar,
  User,
  Eye,
  Copy,
  Check,
  Package,
  Share2,
  ShoppingBag,
  Zap,
  ExternalLink,
  Layers,
  RefreshCw,
  Loader2,
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  Server
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { FaAws, FaSpotify, FaYoutube, FaInstagram, FaFacebook, FaTiktok, FaTelegramPlane } from "react-icons/fa";
import { SiDigitalocean, SiGooglecloud, SiOpenai, SiBinance } from "react-icons/si";
import { VscAzure } from "react-icons/vsc";

// Real Brand Icon Renderer for Orders Hub
function OrderBrandIcon({ title = "", type = "", className = "w-6 h-6" }: { title?: string; type?: string; className?: string }) {
  const n = (title + " " + type).toLowerCase();
  if (n.includes("aws") || n.includes("amazon")) return <FaAws className={`${className} text-[#FF9900]`} />;
  if (n.includes("digitalocean") || n.includes("digital ocean")) return <SiDigitalocean className={`${className} text-[#0080FF]`} />;
  if (n.includes("azure") || n.includes("microsoft")) return <VscAzure className={`${className} text-[#0089D6]`} />;
  if (n.includes("google") || n.includes("gcp")) return <SiGooglecloud className={`${className} text-[#4285F4]`} />;
  if (n.includes("facebook") || n.includes("fb")) return <FaFacebook className={`${className} text-[#1877F2]`} />;
  if (n.includes("instagram") || n.includes("ig")) return <FaInstagram className={`${className} text-[#E1306C]`} />;
  if (n.includes("tiktok")) return <FaTiktok className={`${className} text-white`} />;
  if (n.includes("telegram") || n.includes("tg")) return <FaTelegramPlane className={`${className} text-[#24A1DE]`} />;
  if (n.includes("youtube") || n.includes("yt")) return <FaYoutube className={`${className} text-[#FF0000]`} />;
  if (n.includes("spotify")) return <FaSpotify className={`${className} text-[#1DB954]`} />;
  if (n.includes("openai") || n.includes("chatgpt") || n.includes("gpt")) return <SiOpenai className={`${className} text-[#10A37F]`} />;
  if (n.includes("binance")) return <SiBinance className={`${className} text-[#F3BA2F]`} />;
  if (type === "smm") return <Share2 className={`${className} text-purple-400`} />;
  if (type === "partner") return <ShoppingBag className={`${className} text-emerald-400`} />;
  return <Package className={`${className} text-blue-400`} />;
}

export default function AllOrdersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | "cloud" | "smm" | "partner">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "completed" | "pending" | "canceled">("all");
  const [viewOrderDetail, setViewOrderDetail] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: allOrders = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ["/api/admin/all-orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/all-orders");
      if (!res.ok) throw new Error("Failed to fetch consolidated orders");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const filteredOrders = allOrders.filter(o => {
    const matchesSearch = 
      (o.id || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.buyer || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.link || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.category || "").toLowerCase().includes(search.toLowerCase());

    const matchesType = selectedType === "all" || o.orderType === selectedType;

    const s = (o.status || "").toLowerCase();
    const isCompleted = s === "completed" || s === "approved" || s === "success";
    const isPending = s === "pending" || s === "processing" || s === "in progress";
    const isCanceled = s === "canceled" || s === "refunded" || s === "partial" || s === "failed";

    let matchesStatus = true;
    if (selectedStatus === "completed") matchesStatus = isCompleted;
    else if (selectedStatus === "pending") matchesStatus = isPending;
    else if (selectedStatus === "canceled") matchesStatus = isCanceled;

    return matchesSearch && matchesType && matchesStatus;
  });

  const totalRevenueCents = allOrders.reduce((acc, o) => acc + (o.amountCents || 0), 0);
  const cloudCount = allOrders.filter(o => o.orderType === "cloud").length;
  const smmCount = allOrders.filter(o => o.orderType === "smm").length;
  const partnerCount = allOrders.filter(o => o.orderType === "partner").length;

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: "Copied to Clipboard! 📋" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6C5CE7] to-[#A855F7] flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
                All Orders Hub
                <Badge variant="outline" className="border-purple-500/30 text-purple-300 font-mono text-xs">
                  {allOrders.length} Total
                </Badge>
              </h1>
              <p className="text-white/40 text-xs font-medium mt-0.5">
                Consolidated master orders feed across Cloud Store, SMM Boosts, and Partner Goods.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-10 px-4 glass-panel border-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-3xl border border-white/10 space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-white/40 tracking-wider">Total Orders</span>
          <div className="text-2xl font-black text-white">{allOrders.length}</div>
          <span className="text-[11px] text-purple-300 font-medium">All Channels</span>
        </div>
        <div className="glass-card p-4 rounded-3xl border border-white/10 space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-blue-400 tracking-wider">Cloud Accounts</span>
          <div className="text-2xl font-black text-white">{cloudCount}</div>
          <span className="text-[11px] text-blue-300/80 font-medium">Direct Store</span>
        </div>
        <div className="glass-card p-4 rounded-3xl border border-white/10 space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-purple-400 tracking-wider">SMM Boost Orders</span>
          <div className="text-2xl font-black text-white">{smmCount}</div>
          <span className="text-[11px] text-purple-300/80 font-medium">N1Panel API</span>
        </div>
        <div className="glass-card p-4 rounded-3xl border border-white/10 space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider">Partner CDK Goods</span>
          <div className="text-2xl font-black text-white">{partnerCount}</div>
          <span className="text-[11px] text-emerald-300/80 font-medium">Sandromania Shop</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card p-4 rounded-3xl border border-white/10 space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-white/30" />
            <Input
              type="search"
              placeholder="Search by ID, product, buyer, link..."
              className="pl-9 glass-panel border-white/10 text-white placeholder:text-white/20 h-10 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Type Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1">
            <button
              onClick={() => setSelectedType("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                selectedType === "all"
                  ? "bg-white text-black shadow-lg"
                  : "glass-panel border-white/10 text-white/50 hover:text-white"
              }`}
            >
              All ({allOrders.length})
            </button>
            <button
              onClick={() => setSelectedType("cloud")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                selectedType === "cloud"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "glass-panel border-white/10 text-white/50 hover:text-white"
              }`}
            >
              ☁️ Cloud ({cloudCount})
            </button>
            <button
              onClick={() => setSelectedType("smm")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                selectedType === "smm"
                  ? "bg-purple-600 text-white shadow-lg"
                  : "glass-panel border-white/10 text-white/50 hover:text-white"
              }`}
            >
              🚀 SMM ({smmCount})
            </button>
            <button
              onClick={() => setSelectedType("partner")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                selectedType === "partner"
                  ? "bg-emerald-600 text-white shadow-lg"
                  : "glass-panel border-white/10 text-white/50 hover:text-white"
              }`}
            >
              📦 Partner ({partnerCount})
            </button>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Status:</span>
          {(["all", "completed", "pending", "canceled"] as const).map(st => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${
                selectedStatus === st
                  ? "bg-white/20 text-white font-extrabold border border-white/20"
                  : "text-white/40 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Master Table */}
      <div className="glass-card border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] pl-6">Order ID</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Type</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Item / Service</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Buyer</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Amount</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Start / Remains</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Status</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Date</TableHead>
              <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] text-right pr-6">Inspect</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-white/5">
                  <TableCell className="pl-6"><div className="h-4 w-16 bg-white/5 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-white/5 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-40 bg-white/5 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-24 bg-white/5 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-white/5 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-white/5 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 bg-white/5 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 bg-white/5 rounded animate-pulse" /></TableCell>
                  <TableCell className="pr-6"><div className="h-8 w-8 ml-auto bg-white/5 rounded-xl animate-pulse" /></TableCell>
                </TableRow>
              ))
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center text-white/30 font-bold">
                  No orders found matching your search and filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const s = (order.status || "").toLowerCase();
                const isCompleted = s === "completed" || s === "approved" || s === "success";
                const isPending = s === "pending" || s === "processing" || s === "in progress";

                return (
                  <TableRow key={order.id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="pl-6 font-mono font-black text-purple-300 text-xs">
                      {order.id}
                    </TableCell>

                    <TableCell>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                        order.orderType === "cloud"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : order.orderType === "smm"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        {order.typeLabel}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2.5 max-w-xs">
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <OrderBrandIcon title={order.title} type={order.orderType} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-white truncate">{order.title}</div>
                          <div className="text-[10px] text-white/40 truncate font-mono">
                            {order.category} {order.quantity ? `· Qty: ${order.quantity}` : ""}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs font-medium text-white/80">
                      {order.buyer}
                    </TableCell>

                    <TableCell className="font-mono font-black text-xs text-white">
                      <div>{order.amountUsd}</div>
                      <div className="text-[10px] text-white/40">{order.amountLkr}</div>
                    </TableCell>

                    <TableCell className="text-[11px] font-mono text-white/70">
                      {order.orderType === "smm" ? (
                        <div>
                          <span className="text-emerald-400">{order.startCount || "0"}</span> / <span className="text-amber-400">{order.remains || "0"}</span>
                        </div>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${
                        isCompleted
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : isPending
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : isPending ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {order.status}
                      </span>
                    </TableCell>

                    <TableCell className="text-[11px] text-white/40 font-mono">
                      {format(new Date(order.createdAt), "dd MMM yyyy, HH:mm")}
                    </TableCell>

                    <TableCell className="text-right pr-6">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewOrderDetail(order)}
                        className="h-8 w-8 p-0 rounded-xl hover:bg-white/10 text-purple-300"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Order Inspector Modal */}
      <Dialog open={!!viewOrderDetail} onOpenChange={(open) => !open && setViewOrderDetail(null)}>
        <DialogContent className="max-w-lg w-full bg-[#120F24] border border-white/10 rounded-[32px] p-6 text-white shadow-2xl">
          {viewOrderDetail && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-purple-400 uppercase tracking-widest">
                    Order Details: {viewOrderDetail.id}
                  </span>
                  <Badge variant="outline" className="border-white/10 text-white font-mono text-[10px]">
                    {viewOrderDetail.typeLabel}
                  </Badge>
                </div>
                <DialogTitle className="text-lg font-black text-white mt-1 flex items-center gap-2">
                  <OrderBrandIcon title={viewOrderDetail.title} type={viewOrderDetail.orderType} className="w-5 h-5" />
                  {viewOrderDetail.title}
                </DialogTitle>
                <DialogDescription className="text-white/40 text-xs">
                  Created on {format(new Date(viewOrderDetail.createdAt), "dd MMMM yyyy 'at' HH:mm:ss")}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono">
                <div>
                  <span className="text-white/40 text-[10px] block uppercase font-bold">Buyer</span>
                  <span className="font-bold text-white">{viewOrderDetail.buyer}</span>
                </div>
                <div>
                  <span className="text-white/40 text-[10px] block uppercase font-bold">Price</span>
                  <span className="font-bold text-emerald-400">{viewOrderDetail.amountUsd} ({viewOrderDetail.amountLkr})</span>
                </div>
                <div>
                  <span className="text-white/40 text-[10px] block uppercase font-bold">Status</span>
                  <span className="font-bold uppercase text-purple-300">{viewOrderDetail.status}</span>
                </div>
                <div>
                  <span className="text-white/40 text-[10px] block uppercase font-bold">Channel</span>
                  <span className="font-bold text-white/80">{viewOrderDetail.typeLabel}</span>
                </div>
              </div>

              {/* SMM Link & Stats */}
              {viewOrderDetail.link && (
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                  <div className="text-[10px] font-bold text-white/40 uppercase">SMM Target Link & Counts</div>
                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 font-mono text-purple-300 break-all select-all flex items-center justify-between gap-2">
                    <span className="truncate">{viewOrderDetail.link}</span>
                    <button
                      onClick={() => copyText(viewOrderDetail.link, "link")}
                      className="text-white/60 hover:text-white p-1"
                    >
                      {copiedId === "link" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono text-xs">
                    <div className="p-2 bg-white/5 rounded-xl">
                      <div className="text-[9px] text-white/40 uppercase">Quantity</div>
                      <div className="font-black text-white">{viewOrderDetail.quantity}</div>
                    </div>
                    <div className="p-2 bg-white/5 rounded-xl">
                      <div className="text-[9px] text-emerald-400 uppercase">Start Count</div>
                      <div className="font-black text-emerald-400">{viewOrderDetail.startCount || "0"}</div>
                    </div>
                    <div className="p-2 bg-white/5 rounded-xl">
                      <div className="text-[9px] text-amber-400 uppercase">Remains</div>
                      <div className="font-black text-amber-400">{viewOrderDetail.remains || "0"}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivered Credentials / License */}
              {viewOrderDetail.deliveredContent && (
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5 text-xs">
                      <Zap className="w-3.5 h-3.5" /> Delivered Credentials / CDK:
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyText(viewOrderDetail.deliveredContent, "cred")}
                      className="h-7 text-[11px] font-bold text-purple-300 hover:text-white"
                    >
                      {copiedId === "cred" ? <Check className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
                      Copy Content
                    </Button>
                  </div>
                  <pre className="p-3 bg-black/60 rounded-xl font-mono text-emerald-400 text-xs overflow-x-auto whitespace-pre-wrap select-all border border-emerald-500/20">
                    {viewOrderDetail.deliveredContent}
                  </pre>
                </div>
              )}

              <Button
                onClick={() => setViewOrderDetail(null)}
                className="w-full h-11 bg-white/10 hover:bg-white/20 text-white font-black text-xs rounded-2xl border border-white/10"
              >
                Close Details
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
