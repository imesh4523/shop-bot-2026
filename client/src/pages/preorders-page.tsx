import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Clock, 
  Search, 
  User, 
  DollarSign, 
  Package, 
  RefreshCw, 
  CheckCircle2, 
  Zap,
  Calendar,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function PreordersPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: preorders = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/preorders'],
  });

  const fulfillMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/fulfill-preorders');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/preorders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/all-credentials'] });
      toast({
        title: "⚡ Pre-Order Auto-Fulfillment Triggered",
        description: data.message || "Processed pending pre-orders with available stock",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Fulfillment Error",
        description: err.message || "Failed to fulfill pre-orders",
        variant: "destructive",
      });
    }
  });

  const filteredPreorders = preorders.filter((po: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const customerName = po.telegramUser ? `${po.telegramUser.firstName || ''} ${po.telegramUser.username || ''} ${po.telegramUser.telegramId || ''}`.toLowerCase() : '';
    const productName = po.product ? po.product.name.toLowerCase() : '';
    const status = po.status.toLowerCase();
    return customerName.includes(term) || productName.includes(term) || status.includes(term);
  });

  const pendingCount = preorders.filter((po: any) => po.status === 'pending_fulfillment').length;
  const fulfilledCount = preorders.filter((po: any) => po.status === 'fulfilled').length;
  const totalRevenueUSD = preorders.reduce((sum: number, po: any) => sum + (po.totalPrice || 0), 0) / 100;

  return (
    <div className="space-y-8 p-6 pb-24 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-purple-900/40 via-indigo-900/40 to-slate-900/40 p-8 rounded-3xl border border-purple-500/20 shadow-2xl backdrop-blur-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl">
              <Clock className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Pre-Orders Engine 24/7</h1>
              <p className="text-slate-400 text-sm font-medium">
                Manage 24/7 pre-orders and instant auto-fulfillment when stock is added.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => fulfillMutation.mutate()}
          disabled={fulfillMutation.isPending}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-6 px-8 rounded-2xl shadow-lg shadow-purple-500/20 border border-purple-400/30 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          {fulfillMutation.isPending ? (
            <RefreshCw className="w-5 h-5 animate-spin mr-3" />
          ) : (
            <Zap className="w-5 h-5 mr-3 text-amber-300" />
          )}
          ⚡ Fulfill Pending Pre-Orders Now
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-900/60 border-purple-500/20 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Total Pre-Orders</span>
              <Layers className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-3xl font-black text-white mt-2">{preorders.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-amber-500/20 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase">Pending Fulfillment</span>
              <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div className="text-3xl font-black text-amber-400 mt-2">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-emerald-500/20 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase">Fulfilled Orders</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400 mt-2">{fulfilledCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-indigo-500/20 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase">Pre-Order Revenue</span>
              <DollarSign className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-indigo-300 mt-2">${totalRevenueUSD.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pre-Orders Table Card */}
      <Card className="bg-slate-900/60 border-purple-500/20 backdrop-blur-xl shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" /> Pre-Orders Management
              </CardTitle>
              <CardDescription className="text-slate-400">
                Customers will automatically receive credentials as soon as stock is added.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Search pre-orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-950/60 border-purple-500/20 text-white placeholder:text-slate-500 rounded-xl"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">Loading pre-orders...</div>
          ) : filteredPreorders.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No pre-orders found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="p-4">Pre-Order ID</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Product</th>
                    <th className="p-4">Quantity</th>
                    <th className="p-4">Paid Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/10">
                  {filteredPreorders.map((po: any) => {
                    const isPending = po.status === 'pending_fulfillment';
                    return (
                      <tr key={po.id} className="hover:bg-purple-500/5 transition-colors">
                        <td className="p-4 font-bold text-white">#{po.id}</td>
                        <td className="p-4">
                          <div className="font-bold text-white">
                            {po.telegramUser?.firstName || 'Customer'}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {po.telegramUser?.username ? `@${po.telegramUser.username}` : `ID: ${po.telegramUser?.telegramId || 'N/A'}`}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-purple-300">
                          {po.product?.name || `Product #${po.productId}`}
                        </td>
                        <td className="p-4 font-bold text-slate-200">
                          {po.quantity} Pcs
                        </td>
                        <td className="p-4 font-bold text-emerald-400">
                          ${((po.totalPrice || 0) / 100).toFixed(2)} USD
                        </td>
                        <td className="p-4">
                          {isPending ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1.5 w-fit">
                              <Clock className="w-3.5 h-3.5 animate-pulse" /> Pending Stock
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 w-fit">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Fulfilled
                            </Badge>
                          )}
                        </td>
                        <td className="p-4 text-xs text-slate-400 font-mono">
                          {new Date(po.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
