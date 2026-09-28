import { useQuery, useMutation } from "@tanstack/react-query";
import { Product, Credential, InsertCredential } from "@shared/schema";
import { api, buildUrl } from "@shared/routes";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Trash2, 
  Key, 
  Loader2, 
  Search, 
  Server, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  ShoppingBag, 
  Package, 
  TrendingUp, 
  Copy, 
  RefreshCw, 
  ExternalLink,
  Store,
  Layers
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCredentialSchema } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useProducts } from "@/hooks/use-products";
import { format } from "date-fns";

export default function InventoryPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const { data: products } = useProducts();
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "sold">("all");
  const [activeTab, setActiveTab] = useState<string>("credentials");
  const [selectedSoldItem, setSelectedSoldItem] = useState<any | null>(null);

  // 1. Fetch Local Account Credentials
  const { data: credentials = [], isLoading: isLoadingCreds } = useQuery<Credential[]>({
    queryKey: ["/api/all-credentials"],
    queryFn: async () => {
      const res = await fetch("/api/all-credentials");
      if (!res.ok) throw new Error("Failed to fetch credentials");
      return res.json();
    }
  });

  // 2. Fetch Connected Stores / Sandromania Products
  const { data: partnerProducts = [], isLoading: isLoadingPartner, refetch: refetchPartner } = useQuery<any[]>({
    queryKey: ["/api/admin/sandromania/products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sandromania/products");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // 3. Fetch Consolidated Sold Orders across ALL Stores (Cloud, Sandromania, SMM)
  const { data: allSoldOrders = [], isLoading: isLoadingSold, refetch: refetchSold } = useQuery<any[]>({
    queryKey: ["/api/admin/all-orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/all-orders");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Sync Live Stock from Sandromania
  const syncStockMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/sandromania/sync-stock", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to sync stock");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "⚡ Stock Synced Successfully!",
        description: data.message || "Live stock counts refreshed from partner store.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sandromania/products"] });
    },
    onError: (err: any) => {
      toast({
        title: "Stock Sync Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertCredential>({
    resolver: zodResolver(insertCredentialSchema),
    defaultValues: {
      productId: 0,
      content: "",
      status: "available",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCredential) => {
      const entries = data.content
        .split(/(?:\r?\n|^)\d+\s+/)
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0);

      if (entries.length > 1) {
        for (const entry of entries) {
          await apiRequest("POST", api.credentials.create.path, {
            ...data,
            content: entry
          });
        }
      } else {
        await apiRequest("POST", api.credentials.create.path, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-credentials"] });
      form.reset();
      toast({ title: "Credentials added successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", buildUrl(api.credentials.delete.path, { id }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-credentials"] });
      toast({ title: "Credential deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<InsertCredential> }) => {
      await apiRequest("PATCH", buildUrl(api.credentials.update.path, { id }), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-credentials"] });
      toast({ title: "Credential updated successfully" });
    },
  });

  // Calculate Metrics
  const availableLocalCount = credentials.filter(c => c.status === "available").length;
  const soldLocalCount = credentials.filter(c => c.status === "sold").length;
  const totalPartnerStock = partnerProducts.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalAllSalesCount = allSoldOrders.length;

  // Filter Local Credentials
  const filteredCredentials = credentials.filter(cred => {
    const product = products?.find(p => p.id === cred.productId);
    const matchesSearch = cred.content.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (product?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProduct = selectedProductId === "all" || cred.productId === Number(selectedProductId);
    const matchesStatus = statusFilter === "all" || cred.status === statusFilter;
    return matchesSearch && matchesProduct && matchesStatus;
  });

  // Filter Sold Orders
  const filteredSoldOrders = allSoldOrders.filter(o => {
    const s = searchTerm.toLowerCase();
    return (
      (o.title || "").toLowerCase().includes(s) ||
      (o.buyer || "").toLowerCase().includes(s) ||
      (o.id || "").toLowerCase().includes(s) ||
      (o.category || "").toLowerCase().includes(s) ||
      (o.deliveredContent || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-8 animate-in">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter drop-shadow-2xl">
            Inventory Hub
          </h1>
          <p className="text-white/40 text-sm font-medium">
            Manage account credentials, connected store stocks, and track sold inventory.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all duration-300 hover:scale-105 active:scale-95">
                <Plus className="mr-2 h-4 w-4" /> Add Credentials
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-white/10 bg-background/95 backdrop-blur-3xl sm:max-w-[500px] rounded-3xl p-8 shadow-4xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
                  <Key className="w-5 h-5 text-purple-400" />
                  Add Stock
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6 pt-4">
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[9px] font-black uppercase tracking-widest text-white/30 ml-0.5">Select Product</FormLabel>
                        <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={field.value.toString()}>
                          <FormControl>
                            <SelectTrigger className="glass-panel h-11 rounded-xl border-white/5 bg-white/[0.02] text-sm text-white focus:border-purple-500/50 transition-all">
                              <SelectValue placeholder="Select a product" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="glass-panel border-white/10 bg-background text-white rounded-xl">
                            {products?.map(p => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[9px] font-black uppercase tracking-widest text-white/30 ml-0.5">Account Details (Single or Numbered list for Bulk)</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="01 email:pass&#10;02 email2:pass2" 
                            className="glass-panel rounded-xl border-white/5 bg-white/[0.02] text-xs text-white placeholder:text-white/10 focus:border-purple-500/50 transition-all font-mono min-h-[120px] py-3"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:opacity-90 font-black uppercase tracking-widest text-[9px] h-11 rounded-xl shadow-xl transition-all active:scale-95">
                      {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add to Inventory
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs font-bold text-white/40 mb-1">
            <span>Available Stock</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{availableLocalCount}</div>
          <span className="text-[10px] text-emerald-400/80 font-semibold">Ready for instant delivery</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs font-bold text-white/40 mb-1">
            <span>Sold Inventory</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">{soldLocalCount}</div>
          <span className="text-[10px] text-purple-400/80 font-semibold">Local account credentials sold</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs font-bold text-white/40 mb-1">
            <span>Partner Goods Stock</span>
            <Store className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalPartnerStock}</div>
          <span className="text-[10px] text-blue-400/80 font-semibold">{partnerProducts.length} connected products</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs font-bold text-white/40 mb-1">
            <span>Total Orders Fulfilled</span>
            <ShoppingBag className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalAllSalesCount}</div>
          <span className="text-[10px] text-pink-400/80 font-semibold">Across all stores & channels</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="bg-black/40 p-1 rounded-2xl border border-white/10 flex flex-wrap">
            <TabsTrigger value="credentials" className="rounded-xl font-black text-xs gap-2">
              <Key className="w-3.5 h-3.5" /> All Account Stock ({credentials.length})
            </TabsTrigger>
            <TabsTrigger value="partner_stock" className="rounded-xl font-black text-xs gap-2">
              <Store className="w-3.5 h-3.5" /> Connected Stores Stock ({partnerProducts.length})
            </TabsTrigger>
            <TabsTrigger value="sold_items" className="rounded-xl font-black text-xs gap-2 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sold Items & Fulfilled ({allSoldOrders.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === "partner_stock" && (
            <Button
              size="sm"
              onClick={() => syncStockMutation.mutate()}
              disabled={syncStockMutation.isPending}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/15 rounded-xl text-xs font-bold gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStockMutation.isPending ? "animate-spin text-purple-300" : ""}`} />
              {syncStockMutation.isPending ? "Syncing..." : "Sync Live Stock"}
            </Button>
          )}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-purple-400 transition-colors" />
            <Input
              placeholder={activeTab === "sold_items" ? "Search sold orders by product, buyer, id or credentials..." : "Search stock items..."}
              className="glass-panel pl-10 h-11 rounded-xl border-white/10 text-sm text-white placeholder:text-white/20 focus:border-purple-500/50 transition-all duration-500 shadow-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {activeTab === "credentials" && (
            <>
              <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                <SelectTrigger className="w-full sm:w-[160px] glass-panel h-11 rounded-xl border-white/10 text-sm text-white">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="glass-panel border-white/10 bg-[#0f0a1e] text-white rounded-xl">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available (In Stock)</SelectItem>
                  <SelectItem value="sold">Sold Items</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="w-full sm:w-[200px] glass-panel h-11 rounded-xl border-white/10 text-sm text-white">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent className="glass-panel border-white/10 bg-[#0f0a1e] text-white rounded-xl">
                  <SelectItem value="all">All Products</SelectItem>
                  {products?.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {/* 1. CREDENTIALS TAB */}
        <TabsContent value="credentials">
          <div className="glass-card border-0 rounded-2xl overflow-hidden shadow-2xl bg-white/[0.01] backdrop-blur-3xl">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] pl-6 py-4">Product</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] py-4">Credentials / License Content</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] py-4">Status</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] text-right pr-6 py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingCreds ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-white/20 text-xs">Loading stock...</TableCell>
                  </TableRow>
                ) : filteredCredentials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center text-white/20 font-black text-sm uppercase tracking-tighter">
                      No stock found matching filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCredentials.map((cred) => {
                    const product = products?.find(p => p.id === cred.productId);
                    const isSold = cred.status === "sold";
                    return (
                      <TableRow key={cred.id} className="border-white/5 hover:bg-white/[0.03] transition-all duration-300 group">
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                              <Server className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-black text-white tracking-tight">{product?.name || "Unknown Product"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-white/80 max-w-[320px] truncate">
                          {cred.content}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`border-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                              !isSold ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {isSold ? "SOLD" : "AVAILABLE"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                navigator.clipboard.writeText(cred.content);
                                toast({ title: "Copied to clipboard!" });
                              }}
                              className="h-8 w-8 rounded-lg text-white/20 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-white/20 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="glass-panel border-white/10 bg-background/95 backdrop-blur-3xl sm:max-w-[500px] rounded-3xl p-8 shadow-4xl">
                                <DialogHeader>
                                  <DialogTitle className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
                                    <Edit2 className="w-5 h-5 text-purple-400" />
                                    Edit Stock
                                  </DialogTitle>
                                </DialogHeader>
                                <EditCredentialForm 
                                  credential={cred} 
                                  products={products || []} 
                                  onSuccess={() => {}} 
                                  mutation={updateMutation}
                                />
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              onClick={() => {
                                if (confirm("Delete this stock entry?")) {
                                  deleteMutation.mutate(cred.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 2. CONNECTED STORES STOCK TAB */}
        <TabsContent value="partner_stock">
          <div className="glass-card border-0 rounded-2xl overflow-hidden shadow-2xl bg-white/[0.01] backdrop-blur-3xl">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] pl-6 py-4">Product Name</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] py-4">Category</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] py-4">Live Stock</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] py-4">Selling Price</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] text-right pr-6 py-4">Fulfillment Mode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPartner ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-white/20 text-xs">Loading partner catalog...</TableCell>
                  </TableRow>
                ) : partnerProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-white/20 font-black text-sm uppercase tracking-tighter">
                      No connected store products imported yet. Go to Sandromania page to import.
                    </TableCell>
                  </TableRow>
                ) : (
                  partnerProducts.map((p) => {
                    const stockVal = p.stock ?? 0;
                    return (
                      <TableRow key={p.id} className="border-white/5 hover:bg-white/[0.03] transition-all duration-300">
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400">
                              <ShoppingBag className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-sm font-black text-white block">{p.title}</span>
                              <span className="text-[10px] text-white/40 font-mono">External ID: #{p.externalProductId}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {p.category || "General"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`border-0 px-2.5 py-1 rounded-lg text-[10px] font-black ${
                              stockVal > 0 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {stockVal > 0 ? `${stockVal} Units Available` : 'Stock: 0'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-black text-white">
                          ${((p.sellingPriceUsd || 0) / 100).toFixed(2)} USD
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Instant CDK Auto-Delivery
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 3. SOLD ITEMS AUDIT LOG TAB */}
        <TabsContent value="sold_items">
          <div className="glass-card border-0 rounded-2xl overflow-hidden shadow-2xl bg-white/[0.01] backdrop-blur-3xl">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] pl-6 py-4">Sold Item / Product</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] py-4">Source Store</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] py-4">Buyer</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] py-4">Sale Amount</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] py-4">Sold Date</TableHead>
                  <TableHead className="text-white/40 font-bold uppercase tracking-widest text-[10px] text-right pr-6 py-4">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingSold ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-white/20 text-xs">Loading sales history...</TableCell>
                  </TableRow>
                ) : filteredSoldOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-white/20 font-black text-sm uppercase tracking-tighter">
                      No sold items found matching query.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSoldOrders.map((order) => {
                    const isPartner = order.orderType === "partner";
                    const isSmm = order.orderType === "smm";
                    return (
                      <TableRow key={order.id} className="border-white/5 hover:bg-white/[0.03] transition-all duration-300">
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isPartner ? 'bg-pink-500/10 text-pink-400' : isSmm ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                            }`}>
                              {isPartner ? <ShoppingBag className="w-4 h-4" /> : isSmm ? <Layers className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                            </div>
                            <div>
                              <span className="text-sm font-black text-white block">{order.title}</span>
                              <span className="text-[10px] text-white/40 font-mono">Order ID: {order.id}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isPartner ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' : isSmm ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {order.typeLabel || (isPartner ? 'Sandromania Store' : isSmm ? 'SMM Panel' : 'Cloud Store')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-semibold text-white/90 block">{order.buyer}</span>
                          {order.buyerEmail && <span className="text-[10px] text-white/40 block">{order.buyerEmail}</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-black text-emerald-400">
                          {order.amountUsd} <span className="text-[10px] text-white/40">({order.amountLkr})</span>
                        </TableCell>
                        <TableCell className="text-[11px] text-white/60">
                          {order.createdAt ? format(new Date(order.createdAt), "MMM d, yyyy h:mm a") : "-"}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSoldItem(order)}
                            className="h-8 bg-white/10 hover:bg-white/20 text-white border-white/15 rounded-xl text-xs font-bold gap-1.5"
                          >
                            View Sold Info
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Sold Item Details Modal */}
      {selectedSoldItem && (
        <Dialog open={!!selectedSoldItem} onOpenChange={() => setSelectedSoldItem(null)}>
          <DialogContent className="glass-panel border-white/10 bg-background/95 backdrop-blur-3xl sm:max-w-[540px] rounded-3xl p-6 shadow-4xl text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Sold Inventory Fulfillment Record
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Product:</span>
                  <span className="font-bold text-white">{selectedSoldItem.title}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Source Store:</span>
                  <span className="font-bold text-purple-300">{selectedSoldItem.typeLabel || "Store Sale"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Buyer:</span>
                  <span className="font-bold text-white">{selectedSoldItem.buyer}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Amount Paid:</span>
                  <span className="font-black text-emerald-400">{selectedSoldItem.amountUsd} ({selectedSoldItem.amountLkr})</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Sold Date:</span>
                  <span className="text-white/70">{selectedSoldItem.createdAt ? format(new Date(selectedSoldItem.createdAt), "PPP p") : "-"}</span>
                </div>
              </div>

              {/* Delivered Account Content / License */}
              {selectedSoldItem.deliveredContent && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-emerald-400">Delivered Credentials / Key:</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedSoldItem.deliveredContent);
                        toast({ title: "Credentials copied to clipboard!" });
                      }}
                      className="h-7 text-xs font-bold text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Key
                    </Button>
                  </div>
                  <pre className="p-3.5 bg-black/60 border border-white/10 rounded-2xl text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap select-all">
                    {selectedSoldItem.deliveredContent}
                  </pre>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                onClick={() => setSelectedSoldItem(null)}
                className="w-full bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs"
              >
                Close Record
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EditCredentialForm({ 
  credential, 
  products, 
  mutation 
}: { 
  credential: Credential, 
  products: Product[], 
  onSuccess: () => void,
  mutation: any
}) {
  const form = useForm<InsertCredential>({
    resolver: zodResolver(insertCredentialSchema),
    defaultValues: {
      productId: credential.productId,
      content: credential.content,
      status: credential.status as any,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate({ id: credential.id, data }))} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="productId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[9px] font-black uppercase tracking-widest text-white/30 ml-0.5">Product</FormLabel>
              <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={field.value.toString()}>
                <FormControl>
                  <SelectTrigger className="glass-panel h-11 rounded-xl border-white/5 bg-white/[0.02] text-sm text-white focus:border-purple-500/50 transition-all">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="glass-panel border-white/10 bg-background text-white rounded-xl">
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[9px] font-black uppercase tracking-widest text-white/30 ml-0.5">Account Details</FormLabel>
              <FormControl>
                <Textarea 
                  {...field} 
                  className="glass-panel rounded-xl border-white/5 bg-white/[0.02] text-xs text-white placeholder:text-white/10 focus:border-purple-500/50 transition-all font-mono min-h-[120px] py-3"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[9px] font-black uppercase tracking-widest text-white/30 ml-0.5">Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="glass-panel h-11 rounded-xl border-white/5 bg-white/[0.02] text-sm text-white focus:border-purple-500/50 transition-all">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="glass-panel border-white/10 bg-background text-white rounded-xl">
                  <SelectItem value="available">Available (In Stock)</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={mutation.isPending} className="w-full bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:opacity-90 font-black uppercase tracking-widest text-[9px] h-11 rounded-xl shadow-xl transition-all active:scale-95">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
