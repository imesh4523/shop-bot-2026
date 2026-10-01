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
  Sparkles,
  Send,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Download,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
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

interface SoftwareUpdateLog {
  id: number;
  version: string;
  title: string | null;
  description: string | null;
  recipientCount: number;
  sentAt: string;
  adminChatId: string | null;
  updatedCount?: number;
}

interface SoftwareUpdateInteraction {
  id: number;
  version: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  updatedAt: string;
}

export default function SoftwareUpdatesPage() {
  const { toast } = useToast();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [newVersionInput, setNewVersionInput] = useState("4.2v");

  // Fetch Releases / Broadcast Logs
  const {
    data: releases = [],
    isLoading: isReleasesLoading,
    refetch: refetchReleases,
  } = useQuery<SoftwareUpdateLog[]>({
    queryKey: ["/api/admin/software-updates"],
  });

  // Fetch Interacted Users for selected version
  const {
    data: versionUsers = [],
    isLoading: isUsersLoading,
    refetch: refetchUsers,
  } = useQuery<SoftwareUpdateInteraction[]>({
    queryKey: [`/api/admin/software-updates/${selectedVersion}/users`],
    enabled: !!selectedVersion,
  });

  // Broadcast Mutation
  const broadcastMutation = useMutation({
    mutationFn: async (version: string) => {
      const res = await fetch("/api/settings/broadcast-software-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to broadcast software update");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🚀 Software Update Broadcast Sent!",
        description: `Delivered version ${data.version} to ${data.count} active bot users with confetti effect.`,
      });
      setIsBroadcastModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/software-updates"] });
    },
    onError: (err: any) => {
      toast({
        title: "Broadcast Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Computed summary metrics
  const totalReleases = releases.length;
  const totalRecipients = releases.reduce((sum, r) => sum + (r.recipientCount || 0), 0);
  const totalUpdatedUsers = releases.reduce((sum, r) => sum + (r.updatedCount || 0), 0);
  const latestRelease = releases[0]?.version || "4.1v";

  // Filter users inside the detail dialog
  const filteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) return versionUsers;
    const term = userSearchTerm.toLowerCase();
    return versionUsers.filter(
      (u) =>
        u.telegramId.toLowerCase().includes(term) ||
        (u.username && u.username.toLowerCase().includes(term)) ||
        (u.firstName && u.firstName.toLowerCase().includes(term)) ||
        (u.lastName && u.lastName.toLowerCase().includes(term))
    );
  }, [versionUsers, userSearchTerm]);

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredUsers.length === 0) return;
    const headers = ["Version", "Telegram ID", "Username", "First Name", "Last Name", "Updated At"];
    const rows = filteredUsers.map((u) => [
      `"${u.version}"`,
      `"${u.telegramId}"`,
      `"${u.username || ''}"`,
      `"${u.firstName || ''}"`,
      `"${u.lastName || ''}"`,
      `"${new Date(u.updatedAt).toLocaleString()}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `software_update_${selectedVersion}_users.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-purple-950/80 via-[#18112c]/90 to-indigo-950/80 border border-purple-500/20 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Software Update Reports & Tracking
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px] font-mono">
                  LIVE TRACE
                </Badge>
              </h1>
              <p className="text-xs text-purple-200/70">
                Track Telegram bot software update releases, delivery logs, and inspect which users tapped "Update now".
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchReleases()}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsBroadcastModalOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold gap-1.5 shadow-lg shadow-purple-500/25"
          >
            <Send className="w-3.5 h-3.5" /> Broadcast New Version
          </Button>
        </div>
      </div>

      {/* KPI Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#120B2E]/70 border-purple-500/20 rounded-2xl backdrop-blur-sm shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
                Latest Release
              </span>
              <span className="text-2xl font-black text-white mt-1 block">
                {latestRelease}
              </span>
              <span className="text-[10px] text-purple-200/60 mt-0.5 block">Active Version</span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#120B2E]/70 border-purple-500/20 rounded-2xl backdrop-blur-sm shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
                Total Releases
              </span>
              <span className="text-2xl font-black text-white mt-1 block">
                {totalReleases}
              </span>
              <span className="text-[10px] text-purple-200/60 mt-0.5 block">Software broadcasts</span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#120B2E]/70 border-purple-500/20 rounded-2xl backdrop-blur-sm shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
                Total Delivered
              </span>
              <span className="text-2xl font-black text-white mt-1 block">
                {totalRecipients.toLocaleString()}
              </span>
              <span className="text-[10px] text-purple-200/60 mt-0.5 block">Bot users received</span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#120B2E]/70 border-purple-500/20 rounded-2xl backdrop-blur-sm shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
                Users Updated
              </span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">
                {totalUpdatedUsers.toLocaleString()}
              </span>
              <span className="text-[10px] text-purple-200/60 mt-0.5 block">Tapped "Update now"</span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Software Update Broadcasts Table */}
      <Card className="bg-[#120B2E]/70 border-purple-500/20 rounded-3xl backdrop-blur-sm shadow-xl overflow-hidden">
        <CardHeader className="border-b border-white/5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-black text-white flex items-center gap-2">
                Broadcast Releases History
              </CardTitle>
              <CardDescription className="text-xs text-purple-200/60 mt-0.5">
                All software updates delivered to bot users with recipient counts and interaction tracking.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isReleasesLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <span className="text-xs text-purple-300 font-medium">Loading software update logs...</span>
            </div>
          ) : releases.length === 0 ? (
            <div className="text-center py-16 text-purple-300/60 text-xs">
              No software update broadcasts found. Click "Broadcast New Version" above to send one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-[11px] font-bold text-purple-300 uppercase">Version</TableHead>
                    <TableHead className="text-[11px] font-bold text-purple-300 uppercase">Title & Details</TableHead>
                    <TableHead className="text-[11px] font-bold text-purple-300 uppercase">Recipients</TableHead>
                    <TableHead className="text-[11px] font-bold text-purple-300 uppercase">Users Updated</TableHead>
                    <TableHead className="text-[11px] font-bold text-purple-300 uppercase">Broadcasted At</TableHead>
                    <TableHead className="text-[11px] font-bold text-purple-300 uppercase text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releases.map((rel) => (
                    <TableRow key={rel.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                      <TableCell className="font-mono font-black text-sm text-purple-300">
                        <Badge className="bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border-purple-500/30 text-purple-300 font-bold px-2.5 py-1">
                          {rel.version}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-bold text-white">{rel.title || `Update ${rel.version}`}</div>
                        <div className="text-[11px] text-purple-200/60 mt-0.5">{rel.description || "Official update release"}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono font-bold text-white">
                          {rel.recipientCount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-purple-200/50 block">Delivered</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-black text-emerald-400">
                            {(rel.updatedCount || 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-emerald-400/80 font-bold">tapped</span>
                        </div>
                        {rel.recipientCount > 0 && (
                          <span className="text-[10px] text-purple-200/50 block">
                            {Math.round(((rel.updatedCount || 0) / rel.recipientCount) * 100)}% interaction
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-purple-200/70 font-mono">
                        {new Date(rel.sentAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedVersion(rel.version);
                            setUserSearchTerm("");
                          }}
                          className="h-8 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 rounded-xl text-xs font-bold gap-1 transition-all"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Trace Users</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Trace Modal for Selected Version */}
      <Dialog open={!!selectedVersion} onOpenChange={(open) => !open && setSelectedVersion(null)}>
        <DialogContent className="max-w-3xl w-full bg-[#120B2E] border border-purple-500/30 text-white rounded-3xl p-6 shadow-2xl backdrop-blur-2xl">
          <DialogHeader className="border-b border-white/10 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Users Traced for Version: <span className="text-purple-300 font-mono">{selectedVersion}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-purple-200/70 mt-1">
                  List of bot users who tapped "Update now" on Telegram for version {selectedVersion}.
                </DialogDescription>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-2.5 py-1">
                {versionUsers.length} Users Interacted
              </Badge>
            </div>

            {/* Search and Export Toolbar */}
            <div className="flex items-center gap-2.5 mt-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-purple-300 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search by Telegram ID, name, or @username..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="pl-9 bg-white/5 border-purple-500/20 text-white placeholder:text-purple-300/40 rounded-xl text-xs h-9 focus:border-purple-400"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={filteredUsers.length === 0}
                className="h-9 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 rounded-xl text-xs gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </div>
          </DialogHeader>

          {/* User List Table */}
          <div className="max-h-[50vh] overflow-y-auto mt-2">
            {isUsersLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                <span className="text-xs text-purple-300">Fetching traced user records...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-purple-300/60 text-xs">
                {userSearchTerm ? "No users matching your search." : "No users have interacted with this update yet."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-[11px] font-bold text-purple-300 uppercase">Telegram User</TableHead>
                    <TableHead className="text-[11px] font-bold text-purple-300 uppercase">Telegram ID</TableHead>
                    <TableHead className="text-[11px] font-bold text-purple-300 uppercase">Interaction Date & Time</TableHead>
                    <TableHead className="text-[11px] font-bold text-purple-300 uppercase text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell>
                        <div className="font-bold text-xs text-white">
                          {[u.firstName, u.lastName].filter(Boolean).join(" ") || "Telegram User"}
                        </div>
                        {u.username && (
                          <div className="text-[11px] text-purple-400 font-mono">@{u.username}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-purple-200/80">
                        {u.telegramId}
                      </TableCell>
                      <TableCell className="text-xs text-purple-200/70 font-mono">
                        {new Date(u.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold">
                          Updated ✅
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Broadcast New Version Modal */}
      <Dialog open={isBroadcastModalOpen} onOpenChange={setIsBroadcastModalOpen}>
        <DialogContent className="max-w-md w-full bg-[#120B2E] border border-purple-500/30 text-white rounded-3xl p-6 shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Broadcast Software Update
            </DialogTitle>
            <DialogDescription className="text-xs text-purple-200/70">
              Sends an interactive software update announcement with the official celebration confetti effect and a green "Update now" button to all bot users.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-purple-300 block mb-1.5">
                Version Tag (e.g. 4.1v, 4.2v, 5.0v)
              </label>
              <Input
                value={newVersionInput}
                onChange={(e) => setNewVersionInput(e.target.value)}
                placeholder="4.2v"
                className="bg-white/5 border-purple-500/20 text-white placeholder:text-purple-300/40 rounded-xl text-sm font-mono focus:border-purple-400"
              />
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3.5 text-[11px] text-purple-200/80 space-y-1">
              <span className="font-bold text-white block">Preview Details:</span>
              <p>• Message Effect: Official Telegram Confetti (5046509860389126442)</p>
              <p>• Action Button: "Update now" (reloads session & logs user interaction)</p>
              <p>• Audience: All registered Telegram bot users</p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!newVersionInput.trim()) {
                    toast({ title: "Version required", variant: "destructive" });
                    return;
                  }
                  broadcastMutation.mutate(newVersionInput.trim());
                }}
                disabled={broadcastMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold gap-1.5 shadow-lg shadow-purple-500/25"
              >
                {broadcastMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Broadcasting...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Send Broadcast Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
