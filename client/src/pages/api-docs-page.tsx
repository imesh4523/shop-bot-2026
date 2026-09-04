import React, { useState } from "react";
import { 
  Key, 
  Code2, 
  Terminal, 
  ShieldCheck, 
  Copy, 
  Check, 
  Play, 
  Database, 
  ShoppingCart, 
  Layers, 
  Clock, 
  BarChart3, 
  User, 
  Globe, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Zap,
  Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface EndpointDoc {
  id: string;
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
  authRequired: boolean;
  requestBody?: string;
  responseExample: string;
}

const ENDPOINTS: EndpointDoc[] = [
  {
    id: "me",
    method: "GET",
    path: "/api/v1/me",
    title: "Get Balance & Profile",
    description: "Fetch associated Telegram user ID, current balance in USD/cents, and account details.",
    authRequired: true,
    responseExample: JSON.stringify({
      success: true,
      data: {
        id: 104,
        telegram_id: "78291048",
        username: "developer_pro",
        first_name: "Alex",
        balance_cents: 2500,
        balance_usd: "25.00",
        currency: "USD",
        referral_balance_cents: 300,
        created_at: "2026-08-15T12:00:00Z"
      }
    }, null, 2)
  },
  {
    id: "products",
    method: "GET",
    path: "/api/v1/products",
    title: "List Available Products",
    description: "Returns all active store products with real-time available stock count, pricing, and pre-order settings.",
    authRequired: true,
    responseExample: JSON.stringify({
      success: true,
      count: 2,
      data: [
        {
          id: 1,
          name: "AWS $10K Credit Account",
          description: "Full warranty AWS account with 10k credits",
          category: "AWS",
          price_cents: 6500,
          price_usd: "65.00",
          status: "available",
          stock: 14,
          is_in_stock: true,
          is_preorder_enabled: false,
          preorder_quota: 50
        },
        {
          id: 2,
          name: "DigitalOcean $200 1-Year",
          description: "DigitalOcean 10 Droplets limit account",
          category: "DigitalOcean",
          price_cents: 1200,
          price_usd: "12.00",
          status: "available",
          stock: 0,
          is_in_stock: false,
          is_preorder_enabled: true,
          preorder_quota: 25
        }
      ]
    }, null, 2)
  },
  {
    id: "order",
    method: "POST",
    path: "/api/v1/order",
    title: "Place Single Order",
    description: "Purchase one product item. If in stock, credentials are delivered immediately in response. If out of stock & pre-orders are enabled, queues pre-order.",
    authRequired: true,
    requestBody: JSON.stringify({
      product_id: 1,
      quantity: 1
    }, null, 2),
    responseExample: JSON.stringify({
      success: true,
      type: "instant",
      message: "Order completed successfully.",
      data: {
        order_ids: [4821],
        product_name: "AWS $10K Credit Account",
        quantity: 1,
        total_price_usd: "65.00",
        delivered_items: [
          "aws_access_key: AKIAIOSFODNN7EXAMPLE | secret: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        ],
        created_at: "2026-09-04T18:30:00.000Z"
      }
    }, null, 2)
  },
  {
    id: "batch-order",
    method: "POST",
    path: "/api/v1/batch-order",
    title: "Place Multiple / Batch Orders",
    description: "Purchase multiple items or different products in a single API call.",
    authRequired: true,
    requestBody: JSON.stringify({
      orders: [
        { product_id: 1, quantity: 2 },
        { product_id: 3, quantity: 1 }
      ]
    }, null, 2),
    responseExample: JSON.stringify({
      success: true,
      processed_count: 2,
      data: [
        {
          product_id: 1,
          product_name: "AWS $10K Credit Account",
          success: true,
          delivered_items: [
            "credential_item_1...",
            "credential_item_2..."
          ]
        },
        {
          product_id: 3,
          product_name: "Gemini Pro Key",
          success: true,
          delivered_items: [
            "gemini_api_key_1..."
          ]
        }
      ]
    }, null, 2)
  },
  {
    id: "orders",
    method: "GET",
    path: "/api/v1/orders",
    title: "Order History",
    description: "Retrieve list of past orders created via this API key.",
    authRequired: true,
    responseExample: JSON.stringify({
      success: true,
      count: 1,
      data: [
        {
          id: 4821,
          product_id: 1,
          product_name: "AWS $10K Credit Account",
          price_cents: 6500,
          price_usd: "65.00",
          status: "completed",
          delivered_content: "aws_access_key: AKIAIOSFODNN7EXAMPLE...",
          created_at: "2026-09-04T18:30:00.000Z"
        }
      ]
    }, null, 2)
  },
  {
    id: "order-details",
    method: "GET",
    path: "/api/v1/order/{id}",
    title: "Single Order Details",
    description: "Get specific details and delivered credentials for an order ID.",
    authRequired: true,
    responseExample: JSON.stringify({
      success: true,
      data: {
        id: 4821,
        product_id: 1,
        product_name: "AWS $10K Credit Account",
        price_cents: 6500,
        price_usd: "65.00",
        status: "completed",
        delivered_content: "aws_access_key: AKIAIOSFODNN7EXAMPLE...",
        created_at: "2026-09-04T18:30:00.000Z"
      }
    }, null, 2)
  },
  {
    id: "pending",
    method: "GET",
    path: "/api/v1/pending/{id}",
    title: "Pre-order Approval Status",
    description: "Check fulfillment status of a queued pre-order.",
    authRequired: true,
    responseExample: JSON.stringify({
      success: true,
      data: {
        id: 12,
        product_id: 2,
        product_name: "DigitalOcean $200 1-Year",
        amount_usd: "12.00",
        status: "pending_fulfillment",
        delivered_content: null,
        fulfilled_at: null,
        created_at: "2026-09-04T16:00:00.000Z"
      }
    }, null, 2)
  },
  {
    id: "stats",
    method: "GET",
    path: "/api/v1/stats",
    title: "API Key Statistics",
    description: "Get current API key active state, total orders, success orders, failed attempts, total revenue generated, and last used time.",
    authRequired: true,
    responseExample: JSON.stringify({
      success: true,
      data: {
        key: "ric_1RKcDI3fmFdP…",
        full_key: "ric_1RKcDI3fmFdPzqQjsjUWv6Q44s2E39luPf5O2skfLRg",
        status: "active",
        total_orders: 14,
        success_orders: 14,
        failed_orders: 0,
        revenue_usd: "340.00",
        last_used_at: "2026-09-04T18:35:00.000Z",
        created_at: "2026-09-01T10:00:00.000Z"
      }
    }, null, 2)
  }
];

export default function ApiDocsPage() {
  const [apiKeyInput, setApiKeyInput] = useState<string>("ric_1RKcDI3fmFdPzqQjsjUWv6Q44s2E39luPf5O2skfLRg");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeEndpointId, setActiveEndpointId] = useState<string>("me");
  const [langTab, setLangTab] = useState<"curl" | "node" | "python">("curl");
  
  // Live testing state
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://csxstorebo-b2f.d.onjrnm.link";
  const activeEndpoint = ENDPOINTS.find(e => e.id === activeEndpointId) || ENDPOINTS[0];

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getCodeSnippet = (endpoint: EndpointDoc, lang: "curl" | "node" | "python") => {
    const fullUrl = `${baseUrl}${endpoint.path.replace('{id}', '1')}`;
    const key = apiKeyInput || "YOUR_API_KEY";

    if (lang === "curl") {
      if (endpoint.method === "GET") {
        return `curl -X GET "${fullUrl}" \\\n  -H "X-API-Key: ${key}"`;
      } else {
        return `curl -X POST "${fullUrl}" \\\n  -H "X-API-Key: ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '${endpoint.requestBody || "{}"}'`;
      }
    } else if (lang === "node") {
      if (endpoint.method === "GET") {
        return `const response = await fetch("${fullUrl}", {\n  method: "GET",\n  headers: {\n    "X-API-Key": "${key}"\n  }\n});\nconst data = await response.json();\nconsole.log(data);`;
      } else {
        return `const response = await fetch("${fullUrl}", {\n  method: "POST",\n  headers: {\n    "X-API-Key": "${key}",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify(${endpoint.requestBody || "{}"})\n});\nconst data = await response.json();\nconsole.log(data);`;
      }
    } else {
      if (endpoint.method === "GET") {
        return `import requests\n\nheaders = {"X-API-Key": "${key}"}\nresponse = requests.get("${fullUrl}", headers=headers)\nprint(response.json())`;
      } else {
        return `import requests\n\nheaders = {\n    "X-API-Key": "${key}",\n    "Content-Type": "application/json"\n}\npayload = ${endpoint.requestBody || "{}"}\nresponse = requests.post("${fullUrl}", headers=headers, json=payload)\nprint(response.json())`;
      }
    }
  };

  const runLiveTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const url = `${baseUrl}${activeEndpoint.path.replace('{id}', '1')}`;
      const options: RequestInit = {
        method: activeEndpoint.method,
        headers: {
          "X-API-Key": apiKeyInput,
          "Content-Type": "application/json"
        }
      };
      if (activeEndpoint.method === "POST" && activeEndpoint.requestBody) {
        options.body = activeEndpoint.requestBody;
      }

      const res = await fetch(url, options);
      const json = await res.json();
      setTestResult(JSON.stringify(json, null, 2));
    } catch (err: any) {
      setTestResult(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-500 selection:text-white pb-20">
      {/* Top Banner Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Store Developer API</h1>
                <Badge variant="outline" className="border-purple-500/40 text-purple-400 bg-purple-500/10">v1.0 REST</Badge>
              </div>
              <p className="text-xs text-slate-400">Automated Store Integration & Order Execution</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <a 
              href="https://t.me/Imesh_cloud_bot" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center space-x-2 text-xs font-medium text-purple-400 hover:text-purple-300 bg-purple-950/60 border border-purple-800/60 px-3 py-1.5 rounded-lg transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Get API Key in Bot</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Quick Auth & Base URL Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Globe className="h-4 w-4 text-purple-400" />
                Base URL
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <code className="text-xs font-mono text-purple-300 bg-purple-950/40 px-2.5 py-1.5 rounded border border-purple-800/50 truncate max-w-[220px]">
                {baseUrl}
              </code>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => copyToClipboard(baseUrl, 'baseUrl')}>
                {copiedField === 'baseUrl' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Auth Header
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <code className="text-xs font-mono text-emerald-300 bg-emerald-950/40 px-2.5 py-1.5 rounded border border-emerald-800/50 truncate max-w-[220px]">
                X-API-Key: &lt;your_key&gt;
              </code>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => copyToClipboard("X-API-Key: <your_key>", 'authHeader')}>
                {copiedField === 'authHeader' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-400" />
                Test API Key
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input 
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="ric_1RKc..."
                className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-amber-300 focus:border-amber-500"
              />
            </CardContent>
          </Card>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Endpoint Sidebar Navigation */}
          <div className="lg:col-span-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-3">API Endpoints</h3>
            <div className="space-y-1.5">
              {ENDPOINTS.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => setActiveEndpointId(ep.id)}
                  className={`w-full text-left px-3.5 py-3 rounded-xl transition flex items-center justify-between border ${
                    activeEndpointId === ep.id 
                      ? "bg-purple-950/50 border-purple-500/50 text-white shadow-lg shadow-purple-900/20" 
                      : "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Badge 
                      className={
                        ep.method === "GET" 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] px-2" 
                          : "bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] px-2"
                      }
                    >
                      {ep.method}
                    </Badge>
                    <span className="text-xs font-mono font-medium">{ep.path}</span>
                  </div>
                  <ChevronRight className={`h-4 w-4 transition-transform ${activeEndpointId === ep.id ? "rotate-90 text-purple-400" : "text-slate-600"}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Endpoint Details & Playground */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-slate-900/90 border-slate-800 backdrop-blur-xl">
              <CardHeader className="border-b border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge 
                      className={
                        activeEndpoint.method === "GET" 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-mono text-xs px-2.5 py-1" 
                          : "bg-blue-500/20 text-blue-400 border-blue-500/40 font-mono text-xs px-2.5 py-1"
                      }
                    >
                      {activeEndpoint.method}
                    </Badge>
                    <h2 className="text-lg font-mono font-bold text-white">{activeEndpoint.path}</h2>
                  </div>
                  <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                    Auth: X-API-Key
                  </Badge>
                </div>
                <CardTitle className="text-xl text-slate-100 pt-2">{activeEndpoint.title}</CardTitle>
                <CardDescription className="text-slate-400">{activeEndpoint.description}</CardDescription>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                {/* Code Examples Tabs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Code2 className="h-3.5 w-3.5 text-purple-400" />
                      Request Code Examples
                    </span>
                    <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setLangTab("curl")}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${langTab === "curl" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
                      >
                        cURL
                      </button>
                      <button
                        onClick={() => setLangTab("node")}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${langTab === "node" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
                      >
                        JavaScript
                      </button>
                      <button
                        onClick={() => setLangTab("python")}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${langTab === "python" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
                      >
                        Python
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs font-mono text-purple-300 overflow-x-auto">
                      {getCodeSnippet(activeEndpoint, langTab)}
                    </pre>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-2 right-2 h-7 w-7 text-slate-400 hover:text-white"
                      onClick={() => copyToClipboard(getCodeSnippet(activeEndpoint, langTab), 'snippet')}
                    >
                      {copiedField === 'snippet' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Request Body section if POST */}
                {activeEndpoint.requestBody && (
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      JSON Request Body
                    </span>
                    <pre className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto">
                      {activeEndpoint.requestBody}
                    </pre>
                  </div>
                )}

                {/* Response Example */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                      Sample Response (200 OK)
                    </span>
                  </div>
                  <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs font-mono text-emerald-400/90 overflow-x-auto max-h-80">
                    {activeEndpoint.responseExample}
                  </pre>
                </div>

                {/* Live Test / Playground */}
                <div className="border-t border-slate-800/80 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      Live API Tester
                    </span>
                    <Button
                      onClick={runLiveTest}
                      disabled={isTesting}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs h-9 px-4 rounded-xl shadow-lg shadow-purple-600/25"
                    >
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      {isTesting ? "Executing Request..." : "Run Test"}
                    </Button>
                  </div>

                  {testResult && (
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Live Server Response:</span>
                      <pre className="bg-slate-950 border border-purple-900/50 p-4 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto max-h-96">
                        {testResult}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
