import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { 
  ShieldCheck, 
  Search, 
  User, 
  DollarSign, 
  Package, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Wrench,
  ExternalLink,
  History,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function CustomerTrackerPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: users = [], isLoading: loadingUsers } = useQuery<any[]>({
    queryKey: ['/api/telegram-users'],
  });

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ['/api/orders'],
  });

  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ['/api/payments'],
  });

  const auditMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/audit-and-fix');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/telegram-users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      toast({
        title: "⚡ System Audit & Fix Complete",
        description: data.message,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Audit Error",
        description: err.message || "Failed to run audit",
        variant: "destructive",
      });
    }
  });

  const filteredUsers = users.filter((u: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (u.telegramId && u.telegramId.toLowerCase().includes(term)) ||
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.firstName && u.firstName.toLowerCase().includes(term)) ||
      (u.lastName && u.lastName.toLowerCase().includes(term))
    );
  });

  const selectedUser = users.find((u: any) => u.telegramId === selectedUserId || String(u.id) === selectedUserId) || filteredUsers[0];

  const userOrders = selectedUser 
    ? orders.filter((o: any) => o.telegramUserId === selectedUser.id || String(o.telegramUserId) === selectedUser.telegramId)
    : [];

  const userPayments = selectedUser
    ? payments.filter((p: any) => p.telegramUserId === selectedUser.telegramId || String(p.telegramUserId) === String(selectedUser.id))
    : [];

  return (
    <div className="space-y-8 p-6 pb-24 max-w-7xl mx-auto">
      {/* Header & One-Click Fix Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-purple-900/40 via-indigo-900/40 to-slate-900/40 p-8 rounded-3xl border border-purple-500/20 shadow-2xl backdrop-blur-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl">
              <ShieldCheck className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Customer Audit & Fix Center</h1>
              <p className="text-slate-400 text-sm font-medium">
                Advanced tracking, transaction verification, and instant automated issue repairs.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => auditMutation.mutate()}
          disabled={auditMutation.isPending}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-6 px-8 rounded-2xl shadow-lg shadow-emerald-500/20 border border-emerald-400/30 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          {auditMutation.isPending ? (
            <RefreshCw className="w-5 h-5 animate-spin mr-3" />
          ) : (
            <Wrench className="w-5 h-5 mr-3" />
          )}
          ⚡ Run System Audit & Fix Issues
        </Button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Customer Search & List */}
        <Card className="bg-slate-900/60 border-purple-500/20 backdrop-blur-xl shadow-xl lg:col-span-1 flex flex-col h-[700px]">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" /> Customers ({filteredUsers.length})
            </CardTitle>
            <CardDescription className="text-slate-400">Search customer by Telegram ID, name, or handle</CardDescription>

            <div className="relative mt-4">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Search Telegram ID or @username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-950/60 border-purple-500/20 text-white placeholder:text-slate-500 rounded-xl"
              />
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto space-y-2 pr-2">
            {loadingUsers ? (
              <div className="p-8 text-center text-slate-500">Loading customer list...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No matching customers found.</div>
            ) : (
              filteredUsers.map((u: any) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserId(u.telegramId || String(u.id))}
                    className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 border ${
                      isSelected
                        ? "bg-purple-600/20 border-purple-500/50 shadow-lg shadow-purple-500/10"
                        : "bg-slate-950/40 border-purple-500/10 hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white flex items-center gap-2">
                        {u.firstName || 'Customer'} {u.username ? `(@${u.username})` : ''}
                      </div>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                        ${((u.balance || 0) / 100).toFixed(2)}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      ID: {u.telegramId}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right Column: Deep Customer Audit & History */}
        <div className="lg:col-span-2 space-y-6">
          {selectedUser ? (
            <>
              {/* Customer Profile Overview Card */}
              <Card className="bg-slate-900/60 border-purple-500/20 backdrop-blur-xl shadow-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-black text-white flex items-center gap-3">
                        {selectedUser.firstName} {selectedUser.lastName || ''}
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                          {selectedUser.username ? `@${selectedUser.username}` : `ID: ${selectedUser.telegramId}`}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-slate-400 mt-1">
                        Registered: {new Date(selectedUser.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-950/60 border border-purple-500/10 rounded-2xl">
                    <div className="text-xs text-slate-400 uppercase font-bold flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-emerald-400" /> Current Balance
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-1">
                      ${((selectedUser.balance || 0) / 100).toFixed(2)}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-purple-500/10 rounded-2xl">
                    <div className="text-xs text-slate-400 uppercase font-bold flex items-center gap-1">
                      <Package className="w-4 h-4 text-purple-400" /> Total Orders
                    </div>
                    <div className="text-2xl font-black text-purple-300 mt-1">
                      {userOrders.length}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-purple-500/10 rounded-2xl">
                    <div className="text-xs text-slate-400 uppercase font-bold flex items-center gap-1">
                      <History className="w-4 h-4 text-indigo-400" /> Top-up Payments
                    </div>
                    <div className="text-2xl font-black text-indigo-300 mt-1">
                      {userPayments.length}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Delivered Purchases Audit Table */}
              <Card className="bg-slate-900/60 border-purple-500/20 backdrop-blur-xl shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-400" /> Customer Orders & Delivered Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userOrders.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No orders found for this customer.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-xs">
                          <tr>
                            <th className="p-3">Order ID</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-500/10">
                          {userOrders.map((ord: any) => (
                            <tr key={ord.id} className="hover:bg-purple-500/5">
                              <td className="p-3 font-bold text-white">#{ord.id}</td>
                              <td className="p-3">
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                  {ord.status}
                                </Badge>
                              </td>
                              <td className="p-3 text-slate-400 text-xs">
                                {new Date(ord.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-slate-900/60 border-purple-500/20 backdrop-blur-xl p-12 text-center text-slate-400">
              Select a customer from the left sidebar to inspect their transactions and order status.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
