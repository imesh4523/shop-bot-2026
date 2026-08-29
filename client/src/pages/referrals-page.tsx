import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Gift, 
  Clock, 
  CheckCircle, 
  DollarSign, 
  Save, 
  RefreshCw, 
  Search,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function ReferralsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch Referral System Settings
  const { data: settingsData, isLoading: isSettingsLoading } = useQuery<{ key: string; value: string }[]>({
    queryKey: ["/api/settings"],
  });

  // Fetch All Referrals List
  const { data: referralsData, isLoading: isReferralsLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/referrals"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/referrals");
      return res.json();
    }
  });

  const getSetting = (key: string, defaultValue: string) => {
    return settingsData?.find((s) => s.key === key)?.value || defaultValue;
  };

  const [rewardAmount, setRewardAmount] = useState<string>("0.15");
  const [minWithdraw, setMinWithdraw] = useState<string>("3.00");
  const [pendingHours, setPendingHours] = useState<string>("24");
  const [requiredChannel, setRequiredChannel] = useState<string>("@imesh_cloud_bot");

  // Sync local form states when settings query data is loaded/updated
  useEffect(() => {
    if (settingsData) {
      setRewardAmount(getSetting("REFERRAL_REWARD_USDT", "0.15"));
      setMinWithdraw(getSetting("REFERRAL_MIN_WITHDRAW_USDT", "3.00"));
      setPendingHours(getSetting("REFERRAL_PENDING_HOURS", "24"));
      setRequiredChannel(getSetting("REFERRAL_REQUIRED_CHANNEL", "@imesh_cloud_bot"));
    }
  }, [settingsData]);

  // Update Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settingsToSave: Record<string, string>) => {
      for (const [key, value] of Object.entries(settingsToSave)) {
        await apiRequest("POST", "/api/settings", { key, value });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Saved",
        description: "Referral program parameters updated successfully!",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to save referral settings",
        variant: "destructive"
      });
    }
  });

  // Confirm / Approve Referral Mutation
  const confirmReferralMutation = useMutation({
    mutationFn: async (referralId: number) => {
      const res = await apiRequest("POST", `/api/referrals/${referralId}/confirm`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      toast({
        title: "Referral Confirmed",
        description: "Referral reward confirmed and balance credited!",
      });
    }
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettingsMutation.mutate({
      REFERRAL_REWARD_USDT: rewardAmount,
      REFERRAL_MIN_WITHDRAW_USDT: minWithdraw,
      REFERRAL_PENDING_HOURS: pendingHours,
      REFERRAL_REQUIRED_CHANNEL: requiredChannel
    });
  };

  const referrals = referralsData || [];
  const totalPending = referrals.filter(r => r.status === 'pending').length;
  const totalConfirmed = referrals.filter(r => r.status === 'confirmed').length;
  const totalPaidCents = referrals.filter(r => r.status === 'confirmed').reduce((acc, r) => acc + (r.rewardAmount || 15), 0);
  const totalPaidUSD = (totalPaidCents / 100).toFixed(2);

  const filteredReferrals = referrals.filter(r => 
    r.referrerTelegramId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.referredTelegramId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-400" />
            Referral Program Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure referral rewards, monitor pending 24h verifications, and approve user payouts.
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh Data
        </Button>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card/50 border-white/10 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Reward</CardTitle>
            <Gift className="w-5 h-5 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getSetting("REFERRAL_REWARD_USDT", "0.15")} USDT</div>
            <p className="text-xs text-muted-foreground mt-1">per confirmed referral</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/10 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending (24h Timer)</CardTitle>
            <Clock className="w-5 h-5 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{totalPending}</div>
            <p className="text-xs text-muted-foreground mt-1">awaiting channel retention</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/10 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Confirmed Referrals</CardTitle>
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{totalConfirmed}</div>
            <p className="text-xs text-muted-foreground mt-1">verified & credited</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/10 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid Out</CardTitle>
            <DollarSign className="w-5 h-5 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPaidUSD} USDT</div>
            <p className="text-xs text-muted-foreground mt-1">credited to referral balances</p>
          </CardContent>
        </Card>
      </div>

      {/* Program Settings Panel */}
      <Card className="border-white/10 bg-card/40 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            Program Parameters & Reward Rules
          </CardTitle>
          <CardDescription>
            Adjust the referral amounts, minimum withdrawal thresholds, and required Telegram channel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label htmlFor="rewardAmount">Reward Amount (USDT)</Label>
              <Input
                id="rewardAmount"
                placeholder="0.15"
                value={rewardAmount}
                onChange={(e) => setRewardAmount(e.target.value)}
                className="bg-black/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minWithdraw">Min Withdrawal (USDT)</Label>
              <Input
                id="minWithdraw"
                placeholder="3.00"
                value={minWithdraw}
                onChange={(e) => setMinWithdraw(e.target.value)}
                className="bg-black/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pendingHours">Pending Verification (Hours)</Label>
              <Input
                id="pendingHours"
                placeholder="24"
                value={pendingHours}
                onChange={(e) => setPendingHours(e.target.value)}
                className="bg-black/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="requiredChannel">Required Channel Link / Username</Label>
              <Input
                id="requiredChannel"
                placeholder="@imesh_cloud_bot"
                value={requiredChannel}
                onChange={(e) => setRequiredChannel(e.target.value)}
                className="bg-black/20"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-4 flex justify-end">
              <Button type="submit" disabled={saveSettingsMutation.isPending} className="bg-purple-600 hover:bg-purple-700 gap-2">
                <Save className="w-4 h-4" /> Save Program Parameters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Referrals & Withdrawals Table */}
      <Card className="border-white/10 bg-card/40 backdrop-blur-md">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Referral Trace Log & Verification History</CardTitle>
            <CardDescription>
              View all user invitations, pending 24-hour retention statuses, and confirm manual rewards.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search Telegram ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-black/20"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-white/10 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 bg-white/5">
                  <TableHead>Inviter Telegram ID</TableHead>
                  <TableHead>Referred User ID</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferrals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No referral records found yet. Users will appear here when invited via referral link.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReferrals.map((ref) => (
                    <TableRow key={ref.id} className="border-white/10">
                      <TableCell className="font-mono text-purple-300">
                        {ref.referrerTelegramId}
                      </TableCell>
                      <TableCell className="font-mono">
                        {ref.referredTelegramId}
                      </TableCell>
                      <TableCell className="font-bold text-emerald-400">
                        ${((ref.rewardAmount || 15) / 100).toFixed(2)} USDT
                      </TableCell>
                      <TableCell>
                        {ref.status === 'confirmed' ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                            <CheckCircle className="w-3 h-3" /> Confirmed
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                            <Clock className="w-3 h-3" /> Pending (24h)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ref.createdAt ? new Date(ref.createdAt).toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {ref.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => confirmReferralMutation.mutate(ref.id)}
                            disabled={confirmReferralMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs gap-1"
                          >
                            <CheckCircle className="w-3 h-3" /> Confirm & Credit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
