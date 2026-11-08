import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Tag,
  Search,
  Save,
  Check,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  DollarSign,
  TrendingDown,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface ApiCatalogItem {
  id: number;
  name: string;
  type: string;
  description: string;
  retailPriceCents: number;
  retailPriceLkr: number;
  apiPriceCents: number | null;
  apiPriceLkr: number | null;
  isApiEnabled: boolean;
  status: string;
  stock: number;
  slug?: string;
}

export default function AdminApiCatalogPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  // Local state for editing API prices and enabled status
  const [editedItems, setEditedItems] = useState<Record<number, {
    apiPriceUsd?: string;
    apiPriceLkr?: string;
    isApiEnabled?: boolean;
    isDirty?: boolean;
  }>>({});

  const { data: products = [], isLoading, refetch } = useQuery<ApiCatalogItem[]>({
    queryKey: ["/api/admin/api-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/admin/api-catalog");
      if (!res.ok) throw new Error("Failed to load API catalog");
      const data: ApiCatalogItem[] = await res.json();
      return data;
    },
  });

  const savePricingMutation = useMutation({
    mutationFn: async ({
      id,
      apiPriceCents,
      apiPriceLkr,
      isApiEnabled,
    }: {
      id: number;
      apiPriceCents: number | null;
      apiPriceLkr: number | null;
      isApiEnabled: boolean;
    }) => {
      const res = await fetch(`/api/admin/products/${id}/api-pricing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiPriceCents, apiPriceLkr, isApiEnabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update pricing");
      }
      return data;
    },
    onSuccess: (data, vars) => {
      toast({
        title: "API Pricing Saved! ✅",
        description: `Product #${vars.id} wholesale configuration updated.`,
      });
      // Clear dirty state for this item
      setEditedItems((prev) => ({
        ...prev,
        [vars.id]: {
          ...prev[vars.id],
          isDirty: false,
        },
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/products"] });
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: "Could Not Save Pricing",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const getItemState = (item: ApiCatalogItem) => {
    const edit = editedItems[item.id] || {};
    const apiPriceUsdStr = edit.apiPriceUsd !== undefined 
      ? edit.apiPriceUsd 
      : item.apiPriceCents ? (item.apiPriceCents / 100).toFixed(2) : "";
    const apiPriceLkrStr = edit.apiPriceLkr !== undefined
      ? edit.apiPriceLkr
      : item.apiPriceLkr ? String(item.apiPriceLkr) : "";
    const isApiEnabled = edit.isApiEnabled !== undefined
      ? edit.isApiEnabled
      : item.isApiEnabled !== false;
    const isDirty = Boolean(edit.isDirty);

    return { apiPriceUsdStr, apiPriceLkrStr, isApiEnabled, isDirty };
  };

  const handlePriceUsdChange = (id: number, val: string) => {
    setEditedItems((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        apiPriceUsd: val,
        isDirty: true,
      },
    }));
  };

  const handlePriceLkrChange = (id: number, val: string) => {
    setEditedItems((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        apiPriceLkr: val,
        isDirty: true,
      },
    }));
  };

  const handleToggleEnabled = (id: number, enabled: boolean) => {
    setEditedItems((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isApiEnabled: enabled,
        isDirty: true,
      },
    }));
  };

  const handleSaveItem = (item: ApiCatalogItem) => {
    const { apiPriceUsdStr, apiPriceLkrStr, isApiEnabled } = getItemState(item);

    const apiPriceCents = apiPriceUsdStr.trim() !== ""
      ? Math.max(0, Math.round(parseFloat(apiPriceUsdStr) * 100))
      : null;
    const apiPriceLkr = apiPriceLkrStr.trim() !== ""
      ? Math.max(0, parseInt(apiPriceLkrStr, 10))
      : null;

    savePricingMutation.mutate({
      id: item.id,
      apiPriceCents,
      apiPriceLkr,
      isApiEnabled,
    });
  };

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      String(p.id).includes(q)
    );
  });

  const apiEnabledCount = products.filter((p) => p.isApiEnabled !== false).length;
  const wholesaleDiscountedCount = products.filter((p) => p.apiPriceCents && p.apiPriceCents > 0).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-300">
              <Tag className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              API Catalog & Wholesale Pricing
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-white/60">
            Set custom wholesale prices for external developers & resellers ordering via API (<span className="text-purple-300 font-mono">/api/v1/order</span>). If an API price is left blank, retail price applies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-xs font-bold gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Reseller API Online (v1)
          </Badge>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-[#130b24]/80 border-white/10 shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">Total Catalog Items</p>
              <p className="text-lg font-black text-white">{products.length} Products</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#130b24]/80 border-white/10 shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">API Enabled Products</p>
              <p className="text-lg font-black text-emerald-400">{apiEnabledCount} / {products.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#130b24]/80 border-white/10 shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300 shrink-0">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">Wholesale Overrides</p>
              <p className="text-lg font-black text-blue-400">{wholesaleDiscountedCount} Active</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          type="text"
          placeholder="Search items by ID, title, or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12 bg-[#130b24]/80 border-white/15 text-white placeholder:text-white/40 rounded-2xl focus:border-purple-500 text-sm"
        />
      </div>

      {/* Loading Indicator */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/60">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-semibold">Loading API catalog...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-10 text-center rounded-3xl bg-[#130b24]/60 border border-white/10 text-white/60">
          <Package className="w-10 h-10 mx-auto mb-2 text-white/30" />
          <p className="text-base font-bold text-white">No products found</p>
          <p className="text-xs text-white/50 mt-1">Try another search filter.</p>
        </div>
      ) : (
        <>
          {/* Mobile Card List (Screen < md) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredProducts.map((item) => {
              const { apiPriceUsdStr, apiPriceLkrStr, isApiEnabled, isDirty } = getItemState(item);
              const isSaving = savePricingMutation.isPending && (savePricingMutation.variables as any)?.id === item.id;
              
              const retailUsd = item.retailPriceCents / 100;
              const currentApiUsd = apiPriceUsdStr ? parseFloat(apiPriceUsdStr) : null;
              const discountPct = (currentApiUsd && currentApiUsd < retailUsd) 
                ? Math.round(((retailUsd - currentApiUsd) / retailUsd) * 100) 
                : null;

              return (
                <div
                  key={item.id}
                  className={`bg-[#130b24]/90 border rounded-3xl p-4 shadow-xl space-y-3.5 transition-all ${
                    isApiEnabled ? "border-white/15" : "border-red-500/20 opacity-75"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md font-bold">
                          #{item.id}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold border-white/20 text-white/70">
                          {item.type}
                        </Badge>
                        {!isApiEnabled && (
                          <Badge variant="destructive" className="text-[9px] font-bold">
                            API Disabled
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-black text-white text-base mt-1 line-clamp-1">{item.name}</h3>
                    </div>

                    {/* API Toggle Switch */}
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] text-white/50 font-bold uppercase mb-1">API Orders</span>
                      <Switch
                        checked={isApiEnabled}
                        onCheckedChange={(checked) => handleToggleEnabled(item.id, checked)}
                      />
                    </div>
                  </div>

                  {/* Stock & Retail Baseline */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div>
                      <p className="text-[10px] text-white/50 uppercase font-bold">Customer Retail</p>
                      <p className="font-black text-white text-sm">Rs. {item.retailPriceLkr?.toLocaleString()}</p>
                      <p className="text-[10px] text-white/60">${retailUsd.toFixed(2)} USD</p>
                    </div>

                    <div>
                      <p className="text-[10px] text-white/50 uppercase font-bold">Live Inventory</p>
                      <p className={`font-black text-sm ${item.stock > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                        {item.stock > 0 ? `${item.stock} in stock` : "0 in stock"}
                      </p>
                      <p className="text-[10px] text-white/50">{item.status}</p>
                    </div>
                  </div>

                  {/* Wholesale Pricing Inputs */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-purple-300 uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-purple-400" />
                        Wholesale API Price
                      </span>
                      {discountPct && (
                        <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          {discountPct}% Wholesale Discount
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-white/50 font-bold block">USD ($)</label>
                        <div className="flex items-center rounded-xl bg-black/40 border border-white/15 px-3 py-2 focus-within:border-purple-500">
                          <span className="text-xs text-white/40 mr-1">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={apiPriceUsdStr}
                            placeholder={retailUsd.toFixed(2)}
                            onChange={(e) => handlePriceUsdChange(item.id, e.target.value)}
                            className="bg-transparent text-white font-mono text-xs w-full focus:outline-none placeholder:text-white/30"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-white/50 font-bold block">LKR (Rs.)</label>
                        <div className="flex items-center rounded-xl bg-black/40 border border-white/15 px-3 py-2 focus-within:border-purple-500">
                          <span className="text-xs text-white/40 mr-1">Rs.</span>
                          <input
                            type="number"
                            step="1"
                            value={apiPriceLkrStr}
                            placeholder={String(item.retailPriceLkr)}
                            onChange={(e) => handlePriceLkrChange(item.id, e.target.value)}
                            className="bg-transparent text-white font-mono text-xs w-full focus:outline-none placeholder:text-white/30"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <Button
                    size="sm"
                    onClick={() => handleSaveItem(item)}
                    disabled={isSaving || !isDirty}
                    className={`w-full text-xs font-black rounded-xl h-11 flex items-center justify-center gap-2 ${
                      isDirty
                        ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 animate-pulse"
                        : "bg-white/5 text-white/40 border border-white/5"
                    }`}
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>{isDirty ? "Save Pricing Changes" : "Pricing Saved"}</span>
                      </>
                    )}
                  </Button>
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
                    <th className="py-4 px-4">Customer Retail</th>
                    <th className="py-4 px-4">Stock</th>
                    <th className="py-4 px-4 min-w-[140px]">Wholesale USD</th>
                    <th className="py-4 px-4 min-w-[140px]">Wholesale LKR</th>
                    <th className="py-4 px-4 text-center">API Enabled</th>
                    <th className="py-4 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {filteredProducts.map((item) => {
                    const { apiPriceUsdStr, apiPriceLkrStr, isApiEnabled, isDirty } = getItemState(item);
                    const isSaving = savePricingMutation.isPending && (savePricingMutation.variables as any)?.id === item.id;
                    const retailUsd = item.retailPriceCents / 100;

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
                          <div className="font-bold text-white text-xs">
                            Rs. {item.retailPriceLkr?.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-white/40">
                            ${retailUsd.toFixed(2)} USD
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1 font-semibold ${item.stock > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.stock > 0 ? "bg-emerald-400" : "bg-amber-400"}`} />
                            {item.stock} in stock
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center rounded-xl bg-black/40 border border-white/15 px-2.5 py-1.5 focus-within:border-purple-500 transition-colors w-32">
                            <span className="text-xs text-white/40 mr-1">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={apiPriceUsdStr}
                              placeholder={retailUsd.toFixed(2)}
                              onChange={(e) => handlePriceUsdChange(item.id, e.target.value)}
                              className="bg-transparent text-white font-mono text-xs w-full focus:outline-none placeholder:text-white/30"
                            />
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center rounded-xl bg-black/40 border border-white/15 px-2.5 py-1.5 focus-within:border-purple-500 transition-colors w-32">
                            <span className="text-xs text-white/40 mr-1">Rs.</span>
                            <input
                              type="number"
                              step="1"
                              value={apiPriceLkrStr}
                              placeholder={String(item.retailPriceLkr)}
                              onChange={(e) => handlePriceLkrChange(item.id, e.target.value)}
                              className="bg-transparent text-white font-mono text-xs w-full focus:outline-none placeholder:text-white/30"
                            />
                          </div>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <Switch
                            checked={isApiEnabled}
                            onCheckedChange={(checked) => handleToggleEnabled(item.id, checked)}
                          />
                        </td>

                        <td className="py-4 px-5 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleSaveItem(item)}
                            disabled={isSaving || !isDirty}
                            className={`h-9 px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 ml-auto ${
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

