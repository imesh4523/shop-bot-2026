import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Clock,
  Search,
  Loader2,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Mail,
  Copy,
  ChevronRight,
  ShieldAlert,
  FileCode,
  Check,
  Filter,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface CustomerErrorLog {
  id: number;
  customerIdentifier: string;
  telegramUserId: number | null;
  severity: "critical" | "warning" | "info";
  category: "order" | "payment" | "delivery" | "wallet" | "auth" | "api" | "general";
  actionContext: string | null;
  errorMessage: string;
  errorDetails: string | null;
  status: "unresolved" | "in_progress" | "resolved" | "ignored";
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface StatsData {
  total: number;
  critical: number;
  warning: number;
  unresolved: number;
  resolved: number;
}

export default function AdvancedErrorCheckerPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [activeLog, setActiveLog] = useState<CustomerErrorLog | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [isUpdatingNotes, setIsUpdatingNotes] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<{
    logs: CustomerErrorLog[];
    stats: StatsData;
  }>({
    queryKey: ["/api/admin/customer-errors", selectedSeverity, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSeverity !== "all") params.set("severity", selectedSeverity);
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      const res = await fetch(`/api/admin/customer-errors?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load customer error logs");
      return res.json();
    },
    refetchInterval: 10000, // Live poll every 10 seconds
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status: string; adminNotes?: string }) => {
      const res = await fetch(`/api/admin/customer-errors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customer-errors"] });
      toast({
        title: "Status Updated",
        description: "Customer issue status successfully updated.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Update Failed",
        description: err.message || "Could not update issue status.",
        variant: "destructive",
      });
    },
  });

  const logs = data?.logs || [];
  const stats = data?.stats || { total: 0, critical: 0, warning: 0, unresolved: 0, resolved: 0 };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const matchCustomer = log.customerIdentifier?.toLowerCase().includes(q);
      const matchMsg = log.errorMessage?.toLowerCase().includes(q);
      const matchContext = log.actionContext?.toLowerCase().includes(q);
      const matchCategory = log.category?.toLowerCase().includes(q);
      const matchNotes = log.adminNotes?.toLowerCase().includes(q);
      return matchCustomer || matchMsg || matchContext || matchCategory || matchNotes;
    });
  }, [logs, searchQuery]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard.`,
    });
  };

  const openLogDetails = (log: CustomerErrorLog) => {
    setActiveLog(log);
    setEditNotes(log.adminNotes || "");
  };

  const handleSaveNotes = async () => {
    if (!activeLog) return;
    setIsUpdatingNotes(true);
    try {
      await updateStatusMutation.mutateAsync({
        id: activeLog.id,
        status: activeLog.status,
        adminNotes: editNotes,
      });
      setActiveLog({ ...activeLog, adminNotes: editNotes });
      toast({ title: "Saved", description: "Admin notes updated." });
    } finally {
      setIsUpdatingNotes(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Advanced Error Checker
                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
                  Live Monitor
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                Real-time tracking of customer purchase errors, payment verification failures & instant outreach
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-primary" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-card/50 border-border/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Errors</p>
              <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <FileCode className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 border-red-500/20 cursor-pointer hover:border-red-500/40 transition-colors"
          onClick={() => setSelectedSeverity(selectedSeverity === "critical" ? "all" : "critical")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <p className="text-xs text-red-400 font-medium uppercase tracking-wider">Big Errors (Urgent)</p>
              </div>
              <h3 className="text-2xl font-bold text-red-500 mt-1">{stats.critical}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition-colors"
          onClick={() => setSelectedSeverity(selectedSeverity === "warning" ? "all" : "warning")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-400 font-medium uppercase tracking-wider">Warnings</p>
              <h3 className="text-2xl font-bold text-amber-400 mt-1">{stats.warning}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 border-orange-500/20 cursor-pointer hover:border-orange-500/40 transition-colors"
          onClick={() => setSelectedStatus(selectedStatus === "unresolved" ? "all" : "unresolved")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-400 font-medium uppercase tracking-wider">Unresolved</p>
              <h3 className="text-2xl font-bold text-orange-400 mt-1">{stats.unresolved}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 border-emerald-500/20 cursor-pointer hover:border-emerald-500/40 transition-colors col-span-2 lg:col-span-1"
          onClick={() => setSelectedStatus(selectedStatus === "resolved" ? "all" : "resolved")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Resolved</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">{stats.resolved}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="bg-card/50 border-border/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer email, Telegram @username, User ID or error message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>

            {/* Severity Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <Button
                variant={selectedSeverity === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSeverity("all")}
                className="text-xs h-8"
              >
                All Severity
              </Button>
              <Button
                variant={selectedSeverity === "critical" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setSelectedSeverity("critical")}
                className={`text-xs h-8 ${selectedSeverity !== "critical" ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : ""}`}
              >
                🚨 Big Errors
              </Button>
              <Button
                variant={selectedSeverity === "warning" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSeverity("warning")}
                className={`text-xs h-8 ${selectedSeverity !== "warning" ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" : "bg-amber-500 text-black hover:bg-amber-600"}`}
              >
                ⚠️ Warnings
              </Button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <Button
                variant={selectedStatus === "all" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus("all")}
                className="text-xs h-8"
              >
                All Status
              </Button>
              <Button
                variant={selectedStatus === "unresolved" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus("unresolved")}
                className="text-xs h-8"
              >
                Unresolved
              </Button>
              <Button
                variant={selectedStatus === "resolved" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus("resolved")}
                className="text-xs h-8"
              >
                Resolved
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="bg-card/50 border-border/40">
        <CardHeader className="p-4 sm:p-5 border-b border-border/40 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Customer Error Records</CardTitle>
            <CardDescription className="text-xs">
              Showing {filteredLogs.length} logged incidents
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Loading customer error logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-base font-medium text-foreground">No Errors Found</p>
                <p className="text-xs mt-1">There are no errors matching your current filter criteria.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 bg-muted/20">
                  <TableHead className="w-[120px]">Severity</TableHead>
                  <TableHead className="w-[200px]">Customer</TableHead>
                  <TableHead className="w-[160px]">Category / Flow</TableHead>
                  <TableHead>Error Message</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[130px]">Time</TableHead>
                  <TableHead className="w-[140px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const isCritical = log.severity === "critical";
                  const isWarning = log.severity === "warning";
                  const isResolved = log.status === "resolved";
                  const isEmail = log.customerIdentifier?.includes("@");
                  const isTelegramUsername = log.customerIdentifier?.startsWith("@") || (!isEmail && isNaN(Number(log.customerIdentifier)));

                  return (
                    <TableRow 
                      key={log.id} 
                      className={`border-border/40 hover:bg-muted/10 transition-colors ${
                        isCritical && !isResolved ? "bg-red-500/[0.03]" : ""
                      }`}
                    >
                      {/* Severity */}
                      <TableCell>
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Big Error
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                            <Info className="w-3 h-3" />
                            Info
                          </span>
                        )}
                      </TableCell>

                      {/* Customer */}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 font-medium text-xs text-foreground truncate max-w-[190px]">
                            {log.customerIdentifier}
                            <button
                              onClick={() => copyToClipboard(log.customerIdentifier, "Customer ID")}
                              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                              title="Copy"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          
                          {/* Quick Contact Buttons */}
                          <div className="flex items-center gap-1.5">
                            {isTelegramUsername && (
                              <a
                                href={`https://t.me/${log.customerIdentifier.replace("@", "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20"
                              >
                                <MessageCircle className="w-2.5 h-2.5" />
                                Telegram
                              </a>
                            )}
                            {isEmail && (
                              <a
                                href={`mailto:${log.customerIdentifier}`}
                                className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:underline bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20"
                              >
                                <Mail className="w-2.5 h-2.5" />
                                Email
                              </a>
                            )}
                            {log.telegramUserId && (
                              <span className="text-[10px] text-muted-foreground">
                                UID: {log.telegramUserId}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Category & Flow */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="text-xs font-medium capitalize text-foreground">
                            {log.actionContext || log.category}
                          </span>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                            {log.category}
                          </p>
                        </div>
                      </TableCell>

                      {/* Error Message */}
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-xs text-foreground font-mono leading-relaxed line-clamp-2">
                            {log.errorMessage}
                          </p>
                          {log.adminNotes && (
                            <p className="text-[11px] text-primary/80 italic flex items-center gap-1">
                              <span>📝 Note:</span> {log.adminNotes}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Resolved
                          </span>
                        ) : log.status === "in_progress" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            In Progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            Unresolved
                          </span>
                        )}
                      </TableCell>

                      {/* Time */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openLogDetails(log)}
                            className="h-7 text-xs px-2"
                          >
                            Details
                          </Button>

                          {!isResolved ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: log.id, status: "resolved" })}
                              className="h-7 text-xs px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Resolve
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: log.id, status: "unresolved" })}
                              className="h-7 text-xs px-2 text-muted-foreground"
                            >
                              Reopen
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Incident Detail & Customer Contact Dialog */}
      <Dialog open={!!activeLog} onOpenChange={(open) => !open && setActiveLog(null)}>
        {activeLog && (
          <DialogContent className="max-w-2xl bg-card border-border/60">
            <DialogHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {activeLog.severity === "critical" ? (
                    <span className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                      <AlertOctagon className="w-5 h-5" />
                    </span>
                  ) : (
                    <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                  )}
                  <div>
                    <DialogTitle className="text-lg font-bold">
                      Customer Incident #{activeLog.id}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Logged on {new Date(activeLog.createdAt).toLocaleString()}
                    </DialogDescription>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={
                    activeLog.status === "resolved"
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : "border-orange-500/30 text-orange-400 bg-orange-500/10"
                  }
                >
                  {activeLog.status.toUpperCase()}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-sm mt-2">
              {/* Customer Contact Card */}
              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Customer Identifier</p>
                  <p className="font-semibold text-foreground text-sm flex items-center gap-1.5 mt-0.5">
                    {activeLog.customerIdentifier}
                    <button
                      onClick={() => copyToClipboard(activeLog.customerIdentifier, "Customer ID")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </p>
                  {activeLog.telegramUserId && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Database User ID: {activeLog.telegramUserId}
                    </p>
                  )}
                </div>

                {/* Instant Outreach Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {activeLog.customerIdentifier?.includes("@") && (
                    <a
                      href={`mailto:${activeLog.customerIdentifier}`}
                      className="flex-1 sm:flex-initial"
                    >
                      <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10">
                        <Mail className="w-3.5 h-3.5" />
                        Send Email
                      </Button>
                    </a>
                  )}
                  {activeLog.customerIdentifier && !activeLog.customerIdentifier.includes("@") && (
                    <a
                      href={`https://t.me/${activeLog.customerIdentifier.replace("@", "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 sm:flex-initial"
                    >
                      <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                        <MessageCircle className="w-3.5 h-3.5" />
                        Open Telegram
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {/* Action Context & Error Message */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Action Context</p>
                <div className="p-2.5 rounded-lg bg-background border border-border/40 font-medium text-xs">
                  {activeLog.actionContext || activeLog.category}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Error Message</p>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 font-mono text-xs whitespace-pre-wrap">
                  {activeLog.errorMessage}
                </div>
              </div>

              {/* Error Technical Details */}
              {activeLog.errorDetails && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Technical Details & Payload</p>
                    <button
                      onClick={() => copyToClipboard(activeLog.errorDetails || "", "Payload JSON")}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy JSON
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-black/60 border border-border/40 font-mono text-[11px] text-muted-foreground max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {activeLog.errorDetails}
                  </pre>
                </div>
              )}

              {/* Admin Notes */}
              <div className="space-y-1.5 pt-1">
                <p className="text-xs text-muted-foreground">Admin Investigation Notes</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add notes about user contact or resolution..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="text-xs bg-background/50"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={isUpdatingNotes}
                    className="text-xs shrink-0"
                  >
                    Save Notes
                  </Button>
                </div>
              </div>

              {/* Resolution Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border/40">
                <div className="text-xs text-muted-foreground">
                  Status: <span className="font-semibold text-foreground capitalize">{activeLog.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  {activeLog.status !== "resolved" ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        updateStatusMutation.mutate({ id: activeLog.id, status: "resolved", adminNotes: editNotes });
                        setActiveLog(null);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark as Resolved
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        updateStatusMutation.mutate({ id: activeLog.id, status: "unresolved", adminNotes: editNotes });
                        setActiveLog(null);
                      }}
                      className="text-xs"
                    >
                      Reopen Issue
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
