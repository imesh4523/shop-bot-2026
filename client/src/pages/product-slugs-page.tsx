import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Globe,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  Search,
  Sparkles,
  Save,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ProductSlugItem {
  id: number;
  name: string;
  type: string;
  price: number;
  priceLkr: number;
  status: string;
  slug: string;
  stock: number;
  isPreorderEnabled?: boolean;
}

export default function ProductSlugsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [localSlugs, setLocalSlugs] = useState<Record<number, string>>({});

  const { data: products = [], isLoading, refetch } = useQuery<ProductSlugItem[]>({
    queryKey: ["/api/admin/product-slugs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/product-slugs");
      if (!res.ok) throw new Error("Failed to load products");
      const data: ProductSlugItem[] = await res.json();
      // Initialize local slugs state
      const initialMap: Record<number, string> = {};
      data.forEach((p) => {
        initialMap[p.id] = p.slug || "";
      });
      setLocalSlugs((prev) => ({ ...initialMap, ...prev }));
      return data;
    },
  });

  const saveSlugMutation = useMutation({
    mutationFn: async ({ id, slug }: { id: number; slug: string }) => {
      const res = await fetch(`/api/admin/products/${id}/slug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update slug");
      }
      return data;
    },
    onSuccess: (data, vars) => {
      toast({
        title: "Slug Saved Successfully! 🎉",
        description: `Direct URL: youuhost.com/${data.slug || vars.slug}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-slugs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: "Could Not Save Slug",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSlugChange = (id: number, val: string) => {
    // Auto-clean on typing
    const cleaned = val
      .toLowerCase()
      .replace(/^https?:\/\/[^\/]+\//, "")
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-");
    setLocalSlugs((prev) => ({ ...prev, [id]: cleaned }));
  };

  const getAutoSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const handleCopyLink = (item: ProductSlugItem) => {
    const activeSlug = (localSlugs[item.id] !== undefined ? localSlugs[item.id] : item.slug) || getAutoSlug(item.name);
    const domain = typeof window !== "undefined" ? window.location.host.replace(/^imeshmain2\./, "") : "youuhost.com";
    const fullUrl = `https://${domain}/${activeSlug}`;

    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(item.id);
      toast({
        title: "Direct Link Copied! 📋",
        description: fullUrl,
      });
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const handleOpenLink = (item: ProductSlugItem) => {
    const activeSlug = (localSlugs[item.id] !== undefined ? localSlugs[item.id] : item.slug) || getAutoSlug(item.name);
    const domain = typeof window !== "undefined" ? window.location.host.replace(/^imeshmain2\./, "") : "youuhost.com";
    const fullUrl = `https://${domain}/${activeSlug}`;
    window.open(fullUrl, "_blank");
  };

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase();
    const currSlug = localSlugs[p.id] || p.slug || "";
    return (
      p.name.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      currSlug.toLowerCase().includes(q)
    );
  });

  const totalWithSlug = products.filter((p) => Boolean(p.slug)).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Globe className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Product URLs & Slugs Manager
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-white/60">
            Create direct short URLs (e.g. <span className="text-purple-300 font-mono font-bold">youuhost.com/capcut</span> or <span className="text-purple-300 font-mono font-bold">youuhost.com/canva</span>). Customers visiting these links directly open the product!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1.5 bg-purple-500/10 border-purple-500/30 text-purple-300 text-xs font-bold gap-1.5">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            {totalWithSlug} / {products.length} Custom URLs Active
          </Badge>
        </div>
      </div>

      {/* Quick Search & Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-[#130b24]/80 border-white/10 shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">Catalog Products</p>
              <p className="text-lg font-black text-white">{products.length} Items</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#130b24]/80 border-white/10 shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">Custom Slugs Configured</p>
              <p className="text-lg font-black text-emerald-400">{totalWithSlug} Products</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#130b24]/80 border-white/10 shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">Customer Experience</p>
              <p className="text-xs font-bold text-white/90">Instant Modal Auto-Open</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          type="text"
          placeholder="Search products by name, category, or URL slug..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12 bg-[#130b24]/80 border-white/15 text-white placeholder:text-white/40 rounded-2xl focus:border-purple-500 text-sm"
        />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/60">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-semibold">Loading product catalog...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-10 text-center rounded-3xl bg-[#130b24]/60 border border-white/10 text-white/60">
          <Package className="w-10 h-10 mx-auto mb-2 text-white/30" />
          <p className="text-base font-bold text-white">No products found</p>
          <p className="text-xs text-white/50 mt-1">Try adjusting your search query.</p>
        </div>
      ) : (
        <>
          {/* Mobile Card List (Screen < md) */}
          <div className="grid grid-cols-1 gap-3.5 md:hidden">
            {filteredProducts.map((item) => {
              const currentSlug = localSlugs[item.id] !== undefined ? localSlugs[item.id] : item.slug || "";
              const suggestedSlug = getAutoSlug(item.name);
              const isDirty = (localSlugs[item.id] !== undefined && localSlugs[item.id] !== (item.slug || ""));
              const isSaving = saveSlugMutation.isPending && (saveSlugMutation.variables as any)?.id === item.id;
              const hasSlug = Boolean(currentSlug);

              return (
                <div
                  key={item.id}
                  className="bg-[#130b24]/90 border border-white/15 rounded-3xl p-4 shadow-xl space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md font-bold">
                          #{item.id}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold border-white/20 text-white/70">
                          {item.type}
                        </Badge>
                      </div>
                      <h3 className="font-black text-white text-base mt-1 line-clamp-1">{item.name}</h3>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-emerald-400">Rs. {item.priceLkr?.toLocaleString()}</p>
                      <p className="text-[11px] text-white/50">${(item.price / 100).toFixed(2)} USD</p>
                    </div>
                  </div>

                  {/* Stock & Status Bar */}
                  <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-white/60">Live Stock:</span>
                    <span className={`font-bold ${item.stock > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                      {item.stock > 0 ? `${item.stock} in stock` : "Out of stock / Pre-order"}
                    </span>
                  </div>

                  {/* Slug Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      Custom URL Slug
                    </label>
                    <div className="flex items-center rounded-xl bg-black/40 border border-white/15 px-3 py-1.5 focus-within:border-purple-500 transition-colors">
                      <span className="text-xs text-purple-300 font-mono select-none mr-1">youuhost.com/</span>
                      <input
                        type="text"
                        value={currentSlug}
                        placeholder={suggestedSlug}
                        onChange={(e) => handleSlugChange(item.id, e.target.value)}
                        className="bg-transparent text-white font-mono text-xs w-full focus:outline-none placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleCopyLink(item)}
                      className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl h-10 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleOpenLink(item)}
                      variant="outline"
                      className="border-white/20 text-white/80 hover:text-white hover:bg-white/10 text-xs font-bold rounded-xl h-10 flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Test URL</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => saveSlugMutation.mutate({ id: item.id, slug: currentSlug })}
                      disabled={isSaving || !isDirty}
                      className={`text-xs font-black rounded-xl h-10 flex items-center justify-center gap-1.5 ${
                        isDirty
                          ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 animate-pulse"
                          : "bg-white/5 text-white/40 border border-white/5"
                      }`}
                    >
                      {isSaving ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>{isDirty ? "Save" : "Saved"}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (Screen >= md) */}
          <div className="hidden md:block bg-[#130b24]/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-black uppercase tracking-wider text-white/50">
                    <th className="py-4 px-5">ID & Product</th>
                    <th className="py-4 px-4">Category</th>
                    <th className="py-4 px-4">Retail Price</th>
                    <th className="py-4 px-4">Stock</th>
                    <th className="py-4 px-4 min-w-[260px]">Custom Slug</th>
                    <th className="py-4 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {filteredProducts.map((item) => {
                    const currentSlug = localSlugs[item.id] !== undefined ? localSlugs[item.id] : item.slug || "";
                    const suggestedSlug = getAutoSlug(item.name);
                    const isDirty = (localSlugs[item.id] !== undefined && localSlugs[item.id] !== (item.slug || ""));
                    const isSaving = saveSlugMutation.isPending && (saveSlugMutation.variables as any)?.id === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[11px] text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-md">
                              #{item.id}
                            </span>
                            <span className="font-bold text-white text-sm">{item.name}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold border-white/15 text-white/70">
                            {item.type}
                          </Badge>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-bold text-emerald-400 text-xs">
                            Rs. {item.priceLkr?.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-white/40">
                            ${(item.price / 100).toFixed(2)} USD
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1 font-semibold ${item.stock > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.stock > 0 ? "bg-emerald-400" : "bg-amber-400"}`} />
                            {item.stock} in stock
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center rounded-xl bg-black/40 border border-white/15 px-3 py-1.5 focus-within:border-purple-500 transition-colors max-w-sm">
                            <span className="text-xs text-purple-300 font-mono select-none mr-1">youuhost.com/</span>
                            <input
                              type="text"
                              value={currentSlug}
                              placeholder={suggestedSlug}
                              onChange={(e) => handleSlugChange(item.id, e.target.value)}
                              className="bg-transparent text-white font-mono text-xs w-full focus:outline-none placeholder:text-white/30"
                            />
                          </div>
                        </td>

                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleCopyLink(item)}
                              variant="outline"
                              className="h-9 px-3 border-white/15 text-white/80 hover:text-white hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1.5"
                            >
                              {copiedId === item.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => handleOpenLink(item)}
                              variant="ghost"
                              className="h-9 w-9 p-0 text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
                              title="Test link in browser"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => saveSlugMutation.mutate({ id: item.id, slug: currentSlug })}
                              disabled={isSaving || !isDirty}
                              className={`h-9 px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                                isDirty
                                  ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30"
                                  : "bg-white/5 text-white/30 border border-white/5"
                              }`}
                            >
                              {isSaving ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-3.5 h-3.5" />
                                  <span>{isDirty ? "Save" : "Saved"}</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

