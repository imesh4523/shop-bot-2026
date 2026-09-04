import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Key, 
  RefreshCw, 
  Ban, 
  Copy, 
  Check, 
  Search, 
  BarChart3, 
  DollarSign, 
  ShoppingCart, 
  ShieldAlert, 
  Settings, 
  ExternalLink,
  Users,
  Clock,
  Eye,
  Plus,
  UserCheck,
  PackageCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface UserGroupedCustomer {
  telegramUserId: number;
  telegramUser: any;
  activeKey: any | null;
  allKeys: any[];
  totalOrders: number;
  successOrders: number;
  failedOrders: number;
  revenueCents: number;
  latestLastUsedAt: Date | null;
  createdAt: Date | null;
}

export default function AdminApiKeysPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);

  // Settings State
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [docsUrlInput, setDocsUrlInput] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Customer Details Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<UserGroupedCustomer | null>(null);

  // Fetch all API keys
  const { data: apiKeys = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/api-keys"],
  });

  // Fetch Settings
  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ["/api/settings"],
    onSuccess: (data) => {
      const bUrl = data.find((s: any) => s.key === "API_BASE_URL")?.value || "";
      const dUrl = data.find((s: any) => s.key === "API_DOCS_URL")?.value || "";
      if (bUrl) setBaseUrlInput(bUrl);
      if (dUrl) setDocsUrlInput(dUrl);
    }
  });

  // Fetch specific user's complete API keys & order history
  const { data: userApiDetails, isLoading: isLoadingUserDetails } = useQuery<{ keys: any[]; orders: any[] }>({
    queryKey: [`/api/admin/users/${selectedCustomer?.telegramUserId}/api-details`],
    enabled: !!selectedCustomer?.telegramUserId,
  });

  // Revoke Mutation
  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/admin/api-keys/${id}/revoke`);
    },
    onSuccess: () => {
      toast({ title: "Key Revoked", description: "API key has been revoked successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      if (selectedCustomer) {
        queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${selectedCustomer.telegramUserId}/api-details`] });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  // Regenerate Mutation
  const generateMutation = useMutation({
    mutationFn: async (telegramUserId: number) => {
      await apiRequest("POST", `/api/admin/api-keys/generate`, { telegramUserId });
    },
    onSuccess: () => {
      toast({ title: "Key Generated", description: "New API key generated for customer." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      if (selectedCustomer) {
        queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${selectedCustomer.telegramUserId}/api-details`] });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  // Save Settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await apiRequest("POST", "/api/settings", { key: "API_BASE_URL", value: baseUrlInput });
      await apiRequest("POST", "/api/settings", { key: "API_DOCS_URL", value: docsUrlInput });
      toast({ title: "Settings Saved", description: "API Base URL & Documentation links updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    } catch (err: any) {
      toast({ title: "Error Saving Settings", description: err.message, variant: "destructive" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // Group API Keys by Customer (Telegram User ID)
  const userMap = new Map<number, UserGroupedCustomer>();

  apiKeys.forEach((k: any) => {
    const existing = userMap.get(k.telegramUserId);
    if (!existing) {
      userMap.set(k.telegramUserId, {
        telegramUserId: k.telegramUserId,
        telegramUser: k.telegramUser,
        activeKey: k.status === "active" ? k : null,
        allKeys: [k],
        totalOrders: k.totalOrders || 0,
        successOrders: k.successOrders || 0,
        failedOrders: k.failedOrders || 0,
        revenueCents: k.revenue || 0,
        latestLastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt) : null,
        createdAt: k.createdAt ? new Date(k.createdAt) : null
      });
    } else {
      existing.allKeys.push(k);
      existing.totalOrders += k.totalOrders || 0;
      existing.successOrders += k.successOrders || 0;
      existing.failedOrders += k.failedOrders || 0;
      existing.revenueCents += k.revenue || 0;

      if (k.status === "active") {
        existing.activeKey = k;
      } else if (!existing.activeKey) {
        existing.activeKey = k; // Fallback to latest created key if none active
      }

      if (k.lastUsedAt) {
        const d = new Date(k.lastUsedAt);
        if (!existing.latestLastUsedAt || d > existing.latestLastUsedAt) {
          existing.latestLastUsedAt = d;
        }
      }
    }
  });

  const groupedCustomers = Array.from(userMap.values());

  // Stats calculation
  const totalKeysCount = apiKeys.length;
  const activeKeysCount = apiKeys.filter(k => k.status === "active").length;
  const totalRevenueCents = apiKeys.reduce((acc, k) => acc + (k.revenue || 0), 0);
  const totalPurchases = apiKeys.reduce((acc, k) => acc + (k.totalOrders || 0), 0);

  // Filtering Customers
  const filteredCustomers = groupedCustomers.filter(c => {
    const matchesSearch = 
      c.telegramUserId.toString().includes(searchTerm) ||
      (c.activeKey && c.activeKey.key.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.telegramUser?.username && c.telegramUser.username.toLowerCase().includes(searchTerm.toLowerCase()));

    const hasActive = !!c.activeKey && c.activeKey.status === "active";
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? hasActive : !hasActive);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Key className="h-6 w-6 text-purple-500" />
            Developer API Keys Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor unique customer API keys, track sales analytics, revoke/regenerate keys, and configure Base URLs.
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique API Customers</CardTitle>
            <Users className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupedCustomers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{activeKeysCount} active keys · {totalKeysCount} total keys created</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total API Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalRevenueCents / 100).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Generated via REST API</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total API Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPurchases}</div>
            <p className="text-xs text-muted-foreground mt-1">Automated Purchases</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Documentation</CardTitle>
            <ExternalLink className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <a 
              href="/docs" 
              target="_blank" 
              className="text-sm font-semibold text-purple-400 hover:underline flex items-center gap-1"
            >
              Open /docs Webpage <ExternalLink className="h-3 w-3" />
            </a>
            <p className="text-xs text-muted-foreground mt-1">Public Developer Docs</p>
          </CardContent>
        </Card>
      </div>

      {/* Global API Configuration Settings Card */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader>
          <CardTitle className="text-md font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-purple-400" />
            API Links Configuration
          </CardTitle>
          <CardDescription>
            Configure the Base URL and Documentation link sent in Telegram bot messages and `/docs` page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Custom Base URL</label>
              <Input 
                value={baseUrlInput} 
                onChange={(e) => setBaseUrlInput(e.target.value)} 
                placeholder="https://csxstorebo-b2f.d.onjrnm.link/custom" 
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Documentation URL</label>
              <Input 
                value={docsUrlInput} 
                onChange={(e) => setDocsUrlInput(e.target.value)} 
                placeholder="https://csxstorebo-b2f.d.onjrnm.link/docs" 
                className="font-mono text-xs"
              />
            </div>
          </div>
          <Button onClick={handleSaveSettings} disabled={isSavingSettings} size="sm" className="bg-purple-600 hover:bg-purple-500 text-white">
            {isSavingSettings ? "Saving..." : "Save API Configuration"}
          </Button>
        </CardContent>
      </Card>

      {/* Table & Controls */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Customer Developer API Accounts</CardTitle>
              <CardDescription>Unique customer accounts. Click any customer row to view all keys, sales, and order credentials.</CardDescription>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search user, Telegram ID or key..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="h-9 px-3 text-xs rounded-md bg-background border border-input"
              >
                <option value="all">All Customers</option>
                <option value="active">Active Key Only</option>
                <option value="revoked">No Active Key</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border border-border/60 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Customer / Telegram ID</TableHead>
                  <TableHead>Active API Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Orders (S / F)</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Customer Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Loading API Customers...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No API customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((cust) => {
                    const activeK = cust.activeKey;
                    const isActive = activeK && activeK.status === "active";

                    return (
                      <TableRow 
                        key={cust.telegramUserId}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setSelectedCustomer(cust)}
                      >
                        <TableCell className="font-medium">
                          <div>
                            <div className="text-xs font-semibold flex items-center gap-1.5 text-purple-300">
                              <UserCheck className="h-3.5 w-3.5" />
                              {cust.telegramUser?.username ? `@${cust.telegramUser.username}` : `Customer #${cust.telegramUserId}`}
                            </div>
                            <div className="text-[11px] text-muted-foreground">ID: {cust.telegramUser?.telegramId || cust.telegramUserId}</div>
                          </div>
                        </TableCell>

                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {activeK ? (
                            <div className="flex items-center space-x-2">
                              <code className="text-xs font-mono bg-muted/60 px-2 py-1 rounded truncate max-w-[180px]">
                                {activeK.key}
                              </code>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6" 
                                onClick={() => copyToClipboard(activeK.key, activeK.id)}
                              >
                                {copiedKeyId === activeK.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No key created</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {isActive ? (
                            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px]">
                              Revoked
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs">
                          {cust.totalOrders} ({cust.successOrders} / {cust.failedOrders})
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs font-bold text-emerald-400">
                          ${(cust.revenueCents / 100).toFixed(2)}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {cust.latestLastUsedAt ? cust.latestLastUsedAt.toLocaleString() : "Never"}
                        </TableCell>

                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedCustomer(cust)}
                            className="h-7 text-xs gap-1.5 bg-purple-950/60 text-purple-300 hover:bg-purple-900/60 border border-purple-800/50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View History ({cust.allKeys.length} keys)
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Customer Comprehensive Details Modal */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-purple-950/80 border border-purple-800 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {selectedCustomer?.telegramUser?.username ? `@${selectedCustomer.telegramUser.username}` : `Customer #${selectedCustomer?.telegramUserId}`}
                  </h2>
                  <p className="text-xs text-slate-400">Telegram ID: {selectedCustomer?.telegramUser?.telegramId || selectedCustomer?.telegramUserId}</p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => selectedCustomer && generateMutation.mutate(selectedCustomer.telegramUserId)}
                disabled={generateMutation.isPending}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Generate New Key
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Quick Metrics Header inside Modal */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block">Total API Revenue</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                ${((selectedCustomer?.revenueCents || 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block">Total API Orders</span>
              <span className="text-lg font-bold text-blue-400 font-mono">
                {selectedCustomer?.totalOrders || 0} items
              </span>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block">API Keys Generated</span>
              <span className="text-lg font-bold text-purple-400 font-mono">
                {selectedCustomer?.allKeys.length || 0} keys
              </span>
            </div>
          </div>

          <Tabs defaultValue="keys" className="w-full pt-4">
            <TabsList className="bg-slate-900 border border-slate-800">
              <TabsTrigger value="keys" className="text-xs gap-2">
                <Key className="h-3.5 w-3.5" />
                API Keys History ({userApiDetails?.keys?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-xs gap-2">
                <PackageCheck className="h-3.5 w-3.5" />
                Delivered Orders & Credentials ({userApiDetails?.orders?.length || 0})
              </TabsTrigger>
            </TabsList>

            {/* Keys History Tab */}
            <TabsContent value="keys" className="space-y-4 pt-3">
              {isLoadingUserDetails ? (
                <div className="text-center py-8 text-slate-500">Loading user API keys...</div>
              ) : !userApiDetails?.keys || userApiDetails.keys.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No API keys found for this customer.</div>
              ) : (
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-900">
                      <TableRow>
                        <TableHead className="text-xs text-slate-400">API Key String</TableHead>
                        <TableHead className="text-xs text-slate-400">Status</TableHead>
                        <TableHead className="text-xs text-slate-400 text-right">Orders (S/F)</TableHead>
                        <TableHead className="text-xs text-slate-400 text-right">Revenue</TableHead>
                        <TableHead className="text-xs text-slate-400">Created At</TableHead>
                        <TableHead className="text-xs text-slate-400 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userApiDetails.keys.map((k: any) => (
                        <TableRow key={k.id} className="border-slate-800/60">
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <code className="text-xs font-mono bg-slate-900 px-2 py-1 rounded text-purple-300">
                                {k.key}
                              </code>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-slate-400 hover:text-white"
                                onClick={() => copyToClipboard(k.key, k.id)}
                              >
                                {copiedKeyId === k.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          </TableCell>

                          <TableCell>
                            {k.status === "active" ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                                Active Key
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px]">
                                Revoked
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-right font-mono text-xs text-slate-300">
                            {k.totalOrders || 0} ({k.successOrders || 0} / {k.failedOrders || 0})
                          </TableCell>

                          <TableCell className="text-right font-mono text-xs font-bold text-emerald-400">
                            ${((k.revenue || 0) / 100).toFixed(2)}
                          </TableCell>

                          <TableCell className="text-xs text-slate-400">
                            {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : "N/A"}
                          </TableCell>

                          <TableCell className="text-right">
                            {k.status === "active" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => revokeMutation.mutate(k.id)}
                                disabled={revokeMutation.isPending}
                                className="h-7 text-xs gap-1"
                              >
                                <Ban className="h-3 w-3" />
                                Revoke
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Orders & Delivered Credentials Tab */}
            <TabsContent value="orders" className="space-y-4 pt-3">
              {isLoadingUserDetails ? (
                <div className="text-center py-8 text-slate-500">Loading order credentials...</div>
              ) : !userApiDetails?.orders || userApiDetails.orders.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No purchases made via API by this customer yet.</div>
              ) : (
                <div className="space-y-3">
                  {userApiDetails.orders.map((ord: any) => (
                    <Card key={ord.id} className="bg-slate-900/90 border-slate-800">
                      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-slate-800/60">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-mono text-purple-400 font-bold">#{ord.id}</span>
                          <span className="text-sm font-bold text-white">{ord.productName}</span>
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                            ${ord.priceUsd} USD
                          </Badge>
                        </div>
                        <span className="text-xs text-slate-400">
                          {ord.createdAt ? new Date(ord.createdAt).toLocaleString() : "N/A"}
                        </span>
                      </CardHeader>
                      <CardContent className="p-4">
                        <span className="text-xs text-slate-400 block mb-1.5 font-medium">Delivered Credential / Content:</span>
                        {ord.deliveredContent ? (
                          <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto select-all">
                            {ord.deliveredContent}
                          </pre>
                        ) : (
                          <span className="text-xs text-amber-400 italic">No credential content linked (Pre-order or custom fulfillment).</span>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
