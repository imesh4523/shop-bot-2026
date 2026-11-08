import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  Key,
  ShieldCheck,
  Layers,
  Globe,
  RefreshCw,
  Zap,
  Code2,
  Server,
  ChevronRight,
  Database,
  Lock,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface EndpointInfo {
  method: "GET" | "POST";
  path: string;
  summary: string;
  description: string;
  auth: boolean;
  requestBody?: string;
  curlExample: string;
  responseExample: string;
}

const ENDPOINTS: EndpointInfo[] = [
  {
    method: "GET",
    path: "/api/v1/me",
    summary: "Get Account Profile & Wallet Balances",
    description: "Returns the developer's Telegram account profile, dual-currency wallet balances (USD cents and LKR), and account tier.",
    auth: true,
    curlExample: `curl -X GET "https://api.youuhost.com/api/v1/me" \\
  -H "X-API-Key: yh_live_your_api_key_here"`,
    responseExample: `{
  "success": true,
  "data": {
    "id": 142,
    "telegram_id": "7507799896",
    "username": "developer_pro",
    "balance_cents": 15400,
    "balance_usd": "154.00",
    "balance_lkr": 47047,
    "currency": "USD"
  }
}`
  },
  {
    method: "GET",
    path: "/api/v1/products",
    summary: "List Store Catalog & Stock Quantities",
    description: "Retrieve all available cloud accounts, bots, tools, and digital goods with real-time stock availability and live prices.",
    auth: true,
    curlExample: `curl -X GET "https://api.youuhost.com/api/v1/products" \\
  -H "X-API-Key: yh_live_your_api_key_here"`,
    responseExample: `{
  "success": true,
  "count": 42,
  "data": [
    {
      "id": 12,
      "name": "Hotmail / Outlook Mail Accounts",
      "category": "Cloud & Accounts",
      "price_cents": 10,
      "price_usd": "0.10",
      "price_lkr": 31,
      "stock": 250,
      "is_in_stock": true
    }
  ]
}`
  },
  {
    method: "GET",
    path: "/api/v1/categories",
    summary: "List Categories & Stock Breakdown",
    description: "Returns all catalog categories with total active products and in-stock count.",
    auth: true,
    curlExample: `curl -X GET "https://api.youuhost.com/api/v1/categories" \\
  -H "X-API-Key: yh_live_your_api_key_here"`,
    responseExample: `{
  "success": true,
  "count": 6,
  "data": [
    {
      "name": "Cloud & Accounts",
      "total_products": 14,
      "in_stock_products": 12
    }
  ]
}`
  },
  {
    method: "POST",
    path: "/api/v1/order",
    summary: "Place Instant Purchase Order",
    description: "Atomically purchases one or more units of a product, deducting wallet balance and delivering the credentials instantly.",
    auth: true,
    requestBody: `{
  "product_id": 12,
  "quantity": 1,
  "coupon_code": "WELCOME10"
}`,
    curlExample: `curl -X POST "https://api.youuhost.com/api/v1/order" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: yh_live_your_api_key_here" \\
  -d '{"product_id": 12, "quantity": 1}'`,
    responseExample: `{
  "success": true,
  "message": "Order fulfilled instantly!",
  "order_id": 8492,
  "product_id": 12,
  "product_name": "Hotmail / Outlook Mail Accounts",
  "quantity": 1,
  "amount_paid_cents": 10,
  "new_balance_cents": 15390,
  "credentials": [
    "user@hotmail.com:Password123"
  ]
}`
  },
  {
    method: "POST",
    path: "/api/v1/batch-order",
    summary: "Batch Multi-Product Purchase",
    description: "Purchase multiple different products in a single atomic transaction.",
    auth: true,
    requestBody: `{
  "orders": [
    { "product_id": 12, "quantity": 2 },
    { "product_id": 15, "quantity": 1 }
  ]
}`,
    curlExample: `curl -X POST "https://api.youuhost.com/api/v1/batch-order" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: yh_live_your_api_key_here" \\
  -d '{"orders": [{"product_id": 12, "quantity": 2}]}'`,
    responseExample: `{
  "success": true,
  "fulfilled_count": 2,
  "total_charged_cents": 20,
  "orders": [...]
}`
  },
  {
    method: "GET",
    path: "/api/v1/orders",
    summary: "Get Order History",
    description: "Returns paginated purchase history for this API key with delivered credentials and timestamps.",
    auth: true,
    curlExample: `curl -X GET "https://api.youuhost.com/api/v1/orders?limit=20&page=1" \\
  -H "X-API-Key: yh_live_your_api_key_here"`,
    responseExample: `{
  "success": true,
  "page": 1,
  "limit": 20,
  "total_orders": 85,
  "data": [...]
}`
  },
  {
    method: "GET",
    path: "/api/v1/stats",
    summary: "API Key Lifetime Metrics",
    description: "Lifetime analytics, successful orders, failed orders, and total spent via this API key.",
    auth: true,
    curlExample: `curl -X GET "https://api.youuhost.com/api/v1/stats" \\
  -H "X-API-Key: yh_live_your_api_key_here"`,
    responseExample: `{
  "success": true,
  "data": {
    "total_orders": 85,
    "success_orders": 85,
    "failed_orders": 0,
    "revenue_cents": 8500,
    "status": "active"
  }
}`
  }
];

export default function ApiDocsPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"interactive" | "scalar">("interactive");
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointInfo>(ENDPOINTS[0]);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  const baseUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//api.${window.location.hostname.replace(/^(imeshmain2\.|admin\.|api\.)/, "")}/api/v1`
    : "https://api.youuhost.com/api/v1";

  useEffect(() => {
    document.title = "youuhost · Developer API Documentation";
  }, []);

  const handleCopy = (text: string, type: "key" | "curl" | "base") => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else if (type === "curl") {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else {
      setCopiedBaseUrl(true);
      setTimeout(() => setCopiedBaseUrl(false), 2000);
    }
  };

  const handleBackToStore = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0C22] text-white flex flex-col font-sans selection:bg-[#6C5CE7] selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#151235]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToStore}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs font-bold text-white flex items-center gap-1.5 border border-white/10 shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Store
            </button>
            <div className="h-4 w-px bg-white/15" />
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#6C5CE7] to-[#FF5E62] flex items-center justify-center shadow-md">
                <Code2 className="w-4 h-4 text-white" />
              </span>
              <div>
                <span className="text-sm font-black tracking-tight flex items-center gap-1.5">
                  youuhost <span className="text-purple-400 font-mono text-xs">API v1.0</span>
                </span>
                <span className="text-[10px] text-white/60 block -mt-0.5">Automated Cloud & Bot Gateway</span>
              </div>
            </div>
          </div>

          {/* Action Pills */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(baseUrl, "base")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-purple-300 border border-purple-500/20 transition-colors"
              title="Copy Base URL"
            >
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span className="truncate max-w-[200px]">{baseUrl}</span>
              {copiedBaseUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-white/50" />}
            </button>

            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-[#5B42F3] hover:bg-[#6C5CE7] text-white text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <span>Full Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6">
        {/* Hero Banner with Base URL & Auth Overview */}
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#1E194D] via-[#1A1642] to-[#120F30] border border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#6C5CE7]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10.5px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Production Ready · 70 req/sec Tier
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Developer REST API & Reseller Gateway
              </h1>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                Seamlessly purchase cloud servers, accounts, social boost, and software keys programmatically from your custom Telegram bots, web apps, or scripts.
              </p>
            </div>

            {/* Quick Switch Tabs */}
            <div className="bg-black/30 p-1 rounded-2xl border border-white/10 flex items-center gap-1 shrink-0">
              <button
                onClick={() => setActiveTab("interactive")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  activeTab === "interactive"
                    ? "bg-[#6C5CE7] text-white shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> Interactive Explorer
              </button>
              <button
                onClick={() => setActiveTab("scalar")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  activeTab === "scalar"
                    ? "bg-[#6C5CE7] text-white shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Scalar Swagger View
              </button>
            </div>
          </div>

          {/* Authentication Badge row */}
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span className="text-white/60">Header:</span>
              <code className="bg-black/40 px-2 py-0.5 rounded-md text-amber-300 font-mono text-[11px] border border-amber-500/20">
                X-API-Key: yh_live_&lt;your_key&gt;
              </code>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              <span className="text-white/60">Alternative:</span>
              <code className="bg-black/40 px-2 py-0.5 rounded-md text-purple-300 font-mono text-[11px] border border-purple-500/20">
                Authorization: Bearer yh_live_...
              </code>
            </div>
          </div>
        </div>

        {/* TAB 1: INTERACTIVE EXPLORER (Zero-latency in-app reference) */}
        {activeTab === "interactive" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
            {/* Left Column: Endpoint Navigation List */}
            <div className="lg:col-span-5 space-y-2 bg-[#151235]/60 p-3 rounded-3xl border border-white/10">
              <div className="px-3 py-2 text-xs font-black text-white/50 uppercase tracking-wider flex items-center justify-between">
                <span>Available Endpoints</span>
                <span className="text-purple-400 font-mono">{ENDPOINTS.length} Operations</span>
              </div>

              <div className="space-y-1.5">
                {ENDPOINTS.map((ep) => {
                  const isSelected = selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method;
                  return (
                    <button
                      key={`${ep.method}-${ep.path}`}
                      onClick={() => setSelectedEndpoint(ep)}
                      className={`w-full text-left p-3 rounded-2xl transition-all border flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-gradient-to-r from-[#6C5CE7]/30 to-[#5B42F3]/20 border-[#6C5CE7] shadow-sm text-white"
                          : "bg-white/5 border-transparent hover:bg-white/10 text-white/80 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase font-mono tracking-wider shrink-0 ${
                            ep.method === "GET"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          }`}
                        >
                          {ep.method}
                        </span>
                        <div className="truncate">
                          <span className="font-mono text-xs font-semibold block truncate">{ep.path}</span>
                          <span className="text-[10.5px] text-white/50 block truncate">{ep.summary}</span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? "text-[#6C5CE7] translate-x-0.5" : "text-white/30"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Endpoint Deep Dive & Testing */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-[#151235]/70 rounded-3xl p-5 sm:p-6 border border-white/10 shadow-md space-y-4">
                {/* Method + Path Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-lg uppercase font-mono tracking-wider ${
                        selectedEndpoint.method === "GET"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      }`}
                    >
                      {selectedEndpoint.method}
                    </span>
                    <span className="font-mono text-sm sm:text-base font-bold text-white">
                      {selectedEndpoint.path}
                    </span>
                  </div>
                  {selectedEndpoint.auth && (
                    <span className="text-[10.5px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Key className="w-3 h-3 text-amber-400" /> API Key Required
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-white/80 leading-relaxed">
                  {selectedEndpoint.description}
                </p>

                {/* Request Body (if POST) */}
                {selectedEndpoint.requestBody && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-white/70 block">Request Payload (application/json)</span>
                    <pre className="bg-black/50 p-3 rounded-2xl border border-white/10 font-mono text-[11px] text-purple-300 overflow-x-auto">
                      {selectedEndpoint.requestBody}
                    </pre>
                  </div>
                )}

                {/* cURL Example Code */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/70 flex items-center gap-1">
                      <Terminal className="w-3.5 h-3.5 text-purple-400" /> cURL Command
                    </span>
                    <button
                      onClick={() => handleCopy(selectedEndpoint.curlExample, "curl")}
                      className="text-[11px] font-bold text-purple-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-white/10 transition-colors"
                    >
                      {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedCurl ? "Copied" : "Copy cURL"}
                    </button>
                  </div>
                  <pre className="bg-black/60 p-3.5 rounded-2xl border border-white/10 font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre">
                    {selectedEndpoint.curlExample}
                  </pre>
                </div>

                {/* Response Preview */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-white/70 block">Sample 200 OK Response</span>
                  <pre className="bg-black/50 p-3.5 rounded-2xl border border-white/10 font-mono text-[11px] text-amber-200 overflow-x-auto max-h-64 overflow-y-auto">
                    {selectedEndpoint.responseExample}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SCALAR SWAGGER FULL VIEW (With graceful loading state) */}
        {activeTab === "scalar" && (
          <div className="flex-1 rounded-3xl overflow-hidden border border-white/10 bg-[#0b0b14] shadow-2xl relative min-h-[750px] flex flex-col">
            {iframeLoading && (
              <div className="absolute inset-0 z-10 bg-[#0b0b14] flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-[#6C5CE7] animate-spin" />
                <p className="text-sm font-bold text-white">Loading Scalar API Portal...</p>
                <p className="text-xs text-white/50">Fetching OpenAPI specification</p>
              </div>
            )}
            <iframe
              src="/docs"
              title="youuhost Scalar Documentation"
              className="w-full h-full min-h-[750px] border-0 flex-1 block"
              onLoad={() => setIframeLoading(false)}
              allow="clipboard-write; clipboard-read"
            />
          </div>
        )}
      </div>
    </div>
  );
}
