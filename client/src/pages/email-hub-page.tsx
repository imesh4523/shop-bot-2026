import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Eye,
  Settings,
  Users,
  CreditCard,
  FileCheck,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface EmailLog {
  id: number;
  toEmail: string;
  recipientName: string | null;
  subject: string;
  templateType: string;
  status: "sent" | "failed";
  errorMessage: string | null;
  metadata: any;
  sentAt: string | null;
  createdAt: string;
}

export default function EmailHubPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("compose");

  // Form states
  const [templateType, setTemplateType] = useState<"payment_success" | "custom_broadcast" | "security_alert">("payment_success");
  const [recipientMode, setRecipientMode] = useState<"single" | "broadcast">("single");
  const [toEmail, setToEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("Payment Successful - Your Transaction Invoice");
  const [amount, setAmount] = useState("LKR 14,990.00");
  const [planName, setPlanName] = useState("Enterprise Cloud & Bot Hosting");
  const [billingCycle, setBillingCycle] = useState("Monthly");
  const [paymentMethod, setPaymentMethod] = useState("mastercard");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-2026-${Math.floor(100000 + Math.random() * 900000)}`);
  const [bodyHeading, setBodyHeading] = useState("Payment Successful");
  const [bodyMessage, setBodyMessage] = useState("Your subscription invoice for your plan has been processed successfully. Thank you for choosing YouuHost!");
  const [ctaText, setCtaText] = useState("Manage Subscription");
  const [ctaUrl, setCtaUrl] = useState("https://youuhost.com/userdashbord/dashboard");

  // Preview HTML state
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [viewEmailModal, setViewEmailModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Fetch logs
  const { data: logsData, isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery<{ success: boolean; logs: EmailLog[]; counts: any }>({
    queryKey: ["/api/admin/emails/logs"],
    refetchInterval: 15000,
  });

  // Fetch registered users for broadcast count
  const { data: usersData } = useQuery<{ success: boolean; count: number; users: { id: number; username: string; email: string; fullName: string }[] }>({
    queryKey: ["/api/admin/emails/users"],
  });

  // Live preview fetch
  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const payload = {
          templateType,
          toEmail: toEmail || "customer@example.com",
          recipientName: recipientName || "Valued Customer",
          subject,
          amount,
          planName,
          billingCycle,
          paymentMethod,
          invoiceNumber,
          bodyHeading,
          bodyMessage,
          ctaText,
          ctaUrl,
        };
        const res = await apiRequest("POST", "/api/admin/emails/preview", payload);
        const data = await res.json();
        if (data.html) {
          setPreviewHtml(data.html);
        }
      } catch (err) {
        console.error("Failed to load preview:", err);
      }
    };
    const timeout = setTimeout(fetchPreview, 300);
    return () => clearTimeout(timeout);
  }, [templateType, toEmail, recipientName, subject, amount, planName, billingCycle, paymentMethod, invoiceNumber, bodyHeading, bodyMessage, ctaText, ctaUrl]);

  // Dispatch email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        templateType,
        recipientMode,
        toEmail,
        recipientName,
        subject,
        amount,
        planName,
        billingCycle,
        paymentMethod,
        invoiceNumber,
        bodyHeading,
        bodyMessage,
        ctaText,
        ctaUrl,
      };
      const res = await apiRequest("POST", "/api/admin/emails/send", payload);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Email Dispatched Successfully",
          description: recipientMode === "broadcast" 
            ? `Sent to ${data.sentCount} users (${data.failedCount} failed).` 
            : `Email successfully delivered to ${toEmail}.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/emails/logs"] });
        // generate a new invoice number for next invoice
        setInvoiceNumber(`INV-2026-${Math.floor(100000 + Math.random() * 900000)}`);
      } else {
        toast({
          title: "Failed to Dispatch",
          description: data.error || "Could not send email.",
          variant: "destructive",
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Dispatch Error",
        description: err.message || "Failed to send email. Check SMTP credentials.",
        variant: "destructive",
      });
    },
  });

  // SMTP Test Connection Mutation
  const smtpTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/emails/test-smtp", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "SMTP Connection Verified",
          description: data.message || "Connected to mail server successfully.",
        });
      } else {
        toast({
          title: "SMTP Connection Failed",
          description: data.error || "Check your host/port credentials.",
          variant: "destructive",
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "SMTP Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const logs = logsData?.logs || [];
  const counts = logsData?.counts || { total: 0, sent: 0, failed: 0, sentToday: 0 };
  const userCount = usersData?.count || 0;

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.toEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.recipientName && log.recipientName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === "all" || log.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent p-6 rounded-2xl border border-emerald-500/20 backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                YouuHost Email Center
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                  Pro Engine v2.4
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                Dispatch pixel-perfect branded payment receipts, transactional invoices, and bulk custom notifications.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => smtpTestMutation.mutate()}
            disabled={smtpTestMutation.isPending}
            className="border-white/10 hover:border-emerald-500/40 text-xs"
          >
            <ShieldCheck className={`h-4 w-4 mr-1.5 text-emerald-400 ${smtpTestMutation.isPending ? "animate-spin" : ""}`} />
            {smtpTestMutation.isPending ? "Testing SMTP..." : "Test SMTP Config"}
          </Button>
          <Button
            size="sm"
            onClick={() => refetchLogs()}
            variant="ghost"
            className="text-xs text-muted-foreground hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-white/10 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Dispatched</p>
              <p className="text-2xl font-bold text-white">{counts.total}</p>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Send className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/10 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Delivered (Sent)</p>
              <p className="text-2xl font-bold text-emerald-400">{counts.sent}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/10 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Failed Delivery</p>
              <p className="text-2xl font-bold text-rose-400">{counts.failed}</p>
            </div>
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/10 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sent Today</p>
              <p className="text-2xl font-bold text-cyan-400">{counts.sentToday}</p>
            </div>
            <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card/60 border border-white/10 p-1 rounded-xl">
          <TabsTrigger value="compose" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white gap-2">
            <Send className="h-4 w-4" /> Compose & Dispatch
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white gap-2">
            <Clock className="h-4 w-4" /> Delivery Logs & History
            <Badge variant="secondary" className="ml-1 bg-white/10 text-xs">{logs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white gap-2">
            <Settings className="h-4 w-4" /> SMTP & Branding Config
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: COMPOSE & LIVE PREVIEW */}
        <TabsContent value="compose" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Controls (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="bg-card/60 border-white/10 backdrop-blur-md">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-400" /> Template Configuration
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Choose template style and configure custom receipt variables
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Template Choice */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Template Design</Label>
                    <Select
                      value={templateType}
                      onValueChange={(val: any) => {
                        setTemplateType(val);
                        if (val === "payment_success") {
                          setSubject("Payment Successful - Your Transaction Invoice");
                          setBodyHeading("Payment Successful");
                        } else if (val === "custom_broadcast") {
                          setSubject("Important Update from YouuHost");
                          setBodyHeading("Platform Announcement");
                        } else {
                          setSubject("Security Alert - Action Required");
                          setBodyHeading("Account Security Notice");
                        }
                      }}
                    >
                      <SelectTrigger className="bg-background/80 border-white/10">
                        <SelectValue placeholder="Select template..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment_success">
                          <div className="flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-emerald-400" />
                            <span>Payment Successful Invoice (Receipt)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="custom_broadcast">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-cyan-400" />
                            <span>Custom Marketing / Announcement</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="security_alert">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            <span>Security & Account Notice</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Audience Choice */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Target Audience</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRecipientMode("single")}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                          recipientMode === "single"
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                            : "bg-background/50 border-white/10 text-muted-foreground hover:bg-white/5"
                        }`}
                      >
                        <Mail className="h-3.5 w-3.5" /> Single Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecipientMode("broadcast")}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                          recipientMode === "broadcast"
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                            : "bg-background/50 border-white/10 text-muted-foreground hover:bg-white/5"
                        }`}
                      >
                        <Users className="h-3.5 w-3.5" /> Broadcast ({userCount} Users)
                      </button>
                    </div>
                  </div>

                  {/* Single Recipient Inputs */}
                  {recipientMode === "single" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Recipient Email</Label>
                        <Input
                          placeholder="client@gmail.com"
                          value={toEmail}
                          onChange={(e) => setToEmail(e.target.value)}
                          className="bg-background/80 border-white/10 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Recipient Name</Label>
                        <Input
                          placeholder="e.g. Test User"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          className="bg-background/80 border-white/10 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Subject Line */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Subject Line</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="bg-background/80 border-white/10 text-xs"
                    />
                  </div>

                  {/* Payment Specific Fields */}
                  {templateType === "payment_success" && (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                        Invoice & Transaction Metadata
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Invoice #</Label>
                          <Input
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            className="bg-background/80 border-white/10 text-xs h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Amount Paid</Label>
                          <Input
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-background/80 border-white/10 text-xs h-8"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Plan / Description</Label>
                          <Input
                            value={planName}
                            onChange={(e) => setPlanName(e.target.value)}
                            className="bg-background/80 border-white/10 text-xs h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Billing Cycle</Label>
                          <Input
                            value={billingCycle}
                            onChange={(e) => setBillingCycle(e.target.value)}
                            className="bg-background/80 border-white/10 text-xs h-8"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px]">Payment Method (Authentic Logo)</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger className="bg-background/80 border-white/10 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mastercard">💳 Mastercard (Official Dual Circles)</SelectItem>
                            <SelectItem value="visa">💳 Visa (Official Gold/Blue)</SelectItem>
                            <SelectItem value="binance">🟡 Binance Pay (Official Brand Badge)</SelectItem>
                            <SelectItem value="cryptomus">🟢 Cryptomus (Official Hex Badge)</SelectItem>
                            <SelectItem value="wallet">💎 YouuHost Instant Balance Wallet</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Body Text */}
                  <div className="space-y-1.5 pt-2 border-t border-white/10">
                    <Label className="text-xs">Main Message Body</Label>
                    <Textarea
                      rows={3}
                      value={bodyMessage}
                      onChange={(e) => setBodyMessage(e.target.value)}
                      className="bg-background/80 border-white/10 text-xs"
                    />
                  </div>

                  {/* CTA Button Customization */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Button Label</Label>
                      <Input
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        className="bg-background/80 border-white/10 text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Button URL</Label>
                      <Input
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        className="bg-background/80 border-white/10 text-xs h-8"
                      />
                    </div>
                  </div>

                  {/* Dispatch Button */}
                  <Button
                    onClick={() => sendEmailMutation.mutate()}
                    disabled={sendEmailMutation.isPending || (recipientMode === "single" && !toEmail)}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-lg shadow-emerald-500/20 h-10 mt-2"
                  >
                    {sendEmailMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Dispatching Email...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        {recipientMode === "broadcast" ? `Broadcast to All ${userCount} Users` : "Send Verified Email Now"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Live Sandbox Iframe Email Preview (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-white">Live Email Rendering Sandbox</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground border-white/10">
                    Mobile & Desktop Responsive
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([previewHtml], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank");
                  }}
                  className="text-xs h-7 text-cyan-400 hover:text-cyan-300"
                >
                  <ExternalLink className="h-3 w-3 mr-1" /> Open in New Tab
                </Button>
              </div>

              {/* Mobile/Tablet Preview Container */}
              <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-2xl flex justify-center items-center">
                <div className="w-full max-w-[480px] bg-white rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 transition-all">
                  {/* Mock Email Client Header */}
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between text-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                        Y
                      </div>
                      <div>
                        <p className="text-[11px] font-bold leading-none text-slate-900">YouuHost System</p>
                        <p className="text-[9px] text-slate-500">to {recipientName || "me"}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Inbox</span>
                  </div>

                  {/* HTML Iframe */}
                  <iframe
                    title="Email Preview"
                    srcDoc={previewHtml}
                    className="w-full h-[620px] border-0 bg-[#f4f7fa]"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: DELIVERY LOGS & AUDIT */}
        <TabsContent value="logs" className="space-y-4 mt-0">
          <Card className="bg-card/60 border-white/10 backdrop-blur-md">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">Email Dispatch History & Logs</CardTitle>
                  <CardDescription className="text-xs">
                    Comprehensive trace of all outgoing transactional receipts and broadcast emails
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-48 md:w-64">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search recipient or subject..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-xs bg-background/80 border-white/10"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 text-xs w-28 bg-background/80 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading email logs...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No email logs found</p>
                  <p className="text-xs text-muted-foreground/60">Dispatch a test email using the Compose tab.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/10 text-muted-foreground uppercase font-semibold">
                      <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Recipient</th>
                        <th className="p-3">Subject</th>
                        <th className="p-3">Template</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date & Time</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 font-mono text-muted-foreground">#{log.id}</td>
                          <td className="p-3">
                            <div className="font-medium text-white">{log.recipientName || "Valued User"}</div>
                            <div className="text-muted-foreground text-[11px] font-mono">{log.toEmail}</div>
                          </td>
                          <td className="p-3 max-w-[220px] truncate text-slate-300">{log.subject}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="border-white/10 text-[10px]">
                              {log.templateType}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {log.status === "sent" ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Delivered
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] gap-1" title={log.errorMessage || ""}>
                                <XCircle className="h-3 w-3" /> Failed
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground font-mono text-[11px]">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedLog(log);
                                setViewEmailModal(true);
                              }}
                              className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SETTINGS & SMTP */}
        <TabsContent value="settings" className="space-y-4 mt-0">
          <Card className="bg-card/60 border-white/10 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-400" /> SMTP Server & Branding Configuration
              </CardTitle>
              <CardDescription className="text-xs">
                Active email relay server configuration and branding details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-white/10 bg-background/50 space-y-2">
                  <p className="text-xs font-semibold text-white flex items-center gap-2">
                    <Mail className="h-4 w-4 text-emerald-400" /> SMTP Host & Port
                  </p>
                  <p className="text-xs text-muted-foreground">Default uses NodeMailer / Gmail SMTP relay or custom host.</p>
                  <div className="font-mono text-xs text-emerald-300 bg-black/40 p-2 rounded border border-white/5">
                    HOST: smtp.gmail.com | PORT: 587 (TLS/SSL)
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-background/50 space-y-2">
                  <p className="text-xs font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-cyan-400" /> Branding Sender
                  </p>
                  <p className="text-xs text-muted-foreground">All emails are verified with YouuHost official header signatures.</p>
                  <div className="font-mono text-xs text-cyan-300 bg-black/40 p-2 rounded border border-white/5">
                    "YouuHost" &lt;support@youuhost.com&gt;
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => smtpTestMutation.mutate()}
                  disabled={smtpTestMutation.isPending}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Test SMTP Relay Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal for viewing Email Log Details */}
      <Dialog open={viewEmailModal} onOpenChange={setViewEmailModal}>
        <DialogContent className="max-w-xl bg-slate-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-400" /> Email Dispatch Record #{selectedLog?.id}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Detailed audit trail of dispatched email payload and server response.
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div>
                  <span className="text-muted-foreground">Recipient:</span>
                  <p className="font-medium text-white">{selectedLog.recipientName || "—"} ({selectedLog.toEmail})</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium">
                    {selectedLog.status === "sent" ? (
                      <span className="text-emerald-400">Delivered</span>
                    ) : (
                      <span className="text-rose-400">Failed</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Subject:</span>
                  <p className="font-medium text-white">{selectedLog.subject}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Timestamp:</span>
                  <p className="font-medium text-slate-300 font-mono">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {selectedLog.errorMessage && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <p className="font-semibold mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Error Details:
                  </p>
                  <p className="font-mono text-[11px]">{selectedLog.errorMessage}</p>
                </div>
              )}

              {selectedLog.metadata && (
                <div className="space-y-1">
                  <span className="text-muted-foreground font-semibold">Metadata Payload:</span>
                  <pre className="p-3 bg-black/60 rounded-lg border border-white/10 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setToEmail(selectedLog.toEmail);
                    setRecipientName(selectedLog.recipientName || "");
                    setSubject(selectedLog.subject);
                    setActiveTab("compose");
                    setViewEmailModal(false);
                  }}
                  className="border-white/10 text-xs"
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Load into Compose Tab
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setViewEmailModal(false)}
                  className="text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
