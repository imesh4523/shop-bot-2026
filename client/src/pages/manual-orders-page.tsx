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

  // Copy Email to Clipboard with instant feedback
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

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border border-purple-500/20 p-6 rounded-2xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                Manual Orders Manager
                {pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-black text-white bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50">
                    {pendingCount} PENDING
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Process manual subscriptions (Canva Pro, YouTube Premium) with customer emails & 1-click refund
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-purple-500/30 hover:bg-purple-500/10 text-purple-300 font-semibold"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Live Sync {isFetching && "..."}
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-amber-400">Pending Orders</p>
              <h3 className="text-3xl font-black text-white mt-1">{pendingCount}</h3>
              <p className="text-xs text-gray-400 mt-1">Awaiting delivery</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-emerald-400">Completed Orders</p>
              <h3 className="text-3xl font-black text-white mt-1">{completedCount}</h3>
              <p className="text-xs text-gray-400 mt-1">Delivered successfully</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-red-400">Cancelled / Refunded</p>
              <h3 className="text-3xl font-black text-white mt-1">{cancelledCount}</h3>
              <p className="text-xs text-gray-400 mt-1">Refunded to customer</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <XCircle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-slate-900/40 border-slate-800">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by email, order #, product, or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-950/60 border-slate-800 text-sm text-white focus-visible:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs text-gray-400 font-bold flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" /> Status:
            </span>
            {["all", "pending", "completed", "cancelled"].map((st) => (
              <Button
                key={st}
                size="sm"
                variant={statusFilter === st ? "default" : "outline"}
                onClick={() => setStatusFilter(st)}
                className={`capitalize text-xs font-bold ${
                  statusFilter === st
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : "border-slate-800 text-gray-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {st}
                {st === "pending" && pendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px]">
                    {pendingCount}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Orders List / Table */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-400 mb-2" />
            Loading manual orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card className="bg-slate-900/30 border-slate-800 text-center p-12">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto mb-4 text-gray-400">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">No Manual Orders Found</h3>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery || statusFilter !== "all"
                ? "Try clearing your filters or search keywords."
                : "Incoming manual orders for Canva and YouTube will appear here automatically."}
            </p>
          </Card>
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
              <Card
                key={ord.id}
                className={`bg-slate-900/60 border transition-all ${
                  isPending
                    ? "border-amber-500/40 bg-gradient-to-r from-amber-950/20 to-slate-900/60 shadow-lg shadow-amber-500/5"
                    : isCompleted
                    ? "border-emerald-500/30"
                    : "border-slate-800 opacity-75"
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Product & Status */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                          isPending
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : isCompleted
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-red-500/10 border-red-500/30 text-red-400"
                        }`}
                      >
                        {isPending ? (
                          <Clock className="w-6 h-6 animate-pulse" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <XCircle className="w-6 h-6" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-400">
                            #{ord.id}
                          </span>
                          <h3 className="font-bold text-white text-base">
                            {ord.productName || "Manual Subscription"}
                          </h3>
                          <Badge
                            className={`text-[10px] font-black uppercase px-2 py-0.5 ${
                              isPending
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse"
                                : isCompleted
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : "bg-red-500/20 text-red-300 border-red-500/30"
                            }`}
                          >
                            {ord.status}
                          </Badge>
                          {ord.createdAt && (
                            <span className="text-[11px] text-gray-500">
                              {new Date(ord.createdAt).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Customer & Price Info */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 pt-1">
                          <span className="flex items-center gap-1 text-gray-300">
                            <User className="w-3.5 h-3.5 text-purple-400" />
                            {ord.firstName || ord.username || `User #${ord.telegramUserId}`}
                            {ord.username && (
                              <span className="text-gray-500">(@{ord.username})</span>
                            )}
                          </span>

                          <span className="text-gray-600">•</span>

                          <span className="font-semibold text-emerald-400">
                            {formattedPaidLkr || formattedPaidUsd}{" "}
                            {formattedPaidLkr && formattedPaidUsd && (
                              <span className="text-gray-400 font-normal">
                                ({formattedPaidUsd})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Customer Email Box with 1-Click Copy */}
                    <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-3 flex items-center justify-between gap-3 min-w-[280px] max-w-md">
                      <div className="overflow-hidden">
                        <p className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">
                          Delivery Email (Customer)
                        </p>
                        <p className="text-sm font-black text-white truncate font-mono select-all">
                          {ord.customerEmail || "No email provided"}
                        </p>
                        {ord.customerNote && (
                          <p className="text-[11px] text-gray-400 italic truncate mt-0.5">
                            Note: {ord.customerNote}
                          </p>
                        )}
                      </div>

                      {ord.customerEmail && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCopyEmail(ord.customerEmail, ord.id)}
                          className={`shrink-0 font-bold text-xs transition-all ${
                            copiedEmailId === ord.id
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40"
                          }`}
                        >
                          {copiedEmailId === ord.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1" /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1" /> Copy Email
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                      {isPending ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedDeliverOrder(ord);
                              setDeliveryNote("");
                              setDeliverModalOpen(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            Mark Delivered
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedCancelOrder(ord);
                              setCancelReason("");
                              setCancelModalOpen(true);
                            }}
                            className="bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs"
                          >
                            <XCircle className="w-4 h-4 mr-1.5" />
                            Cancel & Refund
                          </Button>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400 italic">
                          {ord.deliveryText || `Order ${ord.status}`}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Deliver Order Modal */}
      <Dialog open={deliverModalOpen} onOpenChange={setDeliverModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" /> Mark Order as Delivered
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Order #{selectedDeliverOrder?.id} • {selectedDeliverOrder?.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
              <p className="text-xs text-gray-400">Customer Delivery Email:</p>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-white text-sm">
                  {selectedDeliverOrder?.customerEmail}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    handleCopyEmail(selectedDeliverOrder?.customerEmail, selectedDeliverOrder?.id)
                  }
                  className="h-7 text-xs text-purple-400 hover:text-purple-300"
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300">
                Delivery Instructions / Activation Note (Optional)
              </label>
              <Textarea
                placeholder="e.g. Your Canva invitation has been sent to your email. Please check your inbox and accept the team invitation!"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                className="bg-slate-950 border-slate-800 text-sm focus-visible:ring-emerald-500"
                rows={3}
              />
              <p className="text-[11px] text-gray-500">
                This note will be recorded on the order and sent directly to the customer's Telegram bot.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeliverModalOpen(false)}
              className="border-slate-800 text-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                deliverMutation.mutate({
                  orderId: selectedDeliverOrder.id,
                  deliveryNote,
                })
              }
              disabled={deliverMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {deliverMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm Delivery
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel & Refund Confirmation Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="bg-slate-900 border-red-500/30 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" /> Cancel Order & Refund Balance
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              This action will mark Order #{selectedCancelOrder?.id} as cancelled and
              immediately refund the full purchase amount to the customer's wallet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-red-950/30 rounded-xl border border-red-500/20 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Product:</span>
                <span className="font-bold text-white">{selectedCancelOrder?.productName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Customer:</span>
                <span className="font-bold text-white">
                  {selectedCancelOrder?.firstName || selectedCancelOrder?.username || "Customer"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Refund Amount:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">
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

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300">
                Cancellation Reason (Sent to Customer)
              </label>
              <Input
                placeholder="e.g. Account activation unavailable / Requested by user"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="bg-slate-950 border-slate-800 text-sm focus-visible:ring-red-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              className="border-slate-800 text-gray-400"
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                cancelMutation.mutate({
                  orderId: selectedCancelOrder.id,
                  reason: cancelReason,
                })
              }
              disabled={cancelMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Processing Refund...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4 mr-1.5" /> Confirm Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

