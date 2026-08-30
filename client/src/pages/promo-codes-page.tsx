import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Ticket, 
  Plus, 
  Trash, 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  Gift, 
  RefreshCw,
  Search,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PromoCode {
  id: number;
  code: string;
  reward: number; // in cents
  maxUses: number;
  usesCount: number;
  status: string;
  createdAt: string;
}

interface Redemption {
  id: number;
  telegramUserId: number;
  promoCodeId: number;
  createdAt: string;
  telegramUser?: {
    id: number;
    telegramId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  promoCode?: {
    id: number;
    code: string;
    reward: number;
  } | null;
}

export default function PromoCodesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form states
  const [code, setCode] = useState("");
  const [reward, setReward] = useState("");
  const [maxUses, setMaxUses] = useState("1");

  // Query Promo Codes
  const { data: promoCodes = [], isLoading: isCodesLoading, refetch: refetchCodes } = useQuery<PromoCode[]>({
    queryKey: ["/api/promo-codes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/promo-codes");
      return res.json();
    }
  });

  // Query Redemptions
  const { data: redemptions = [], isLoading: isRedemptionsLoading, refetch: refetchRedemptions } = useQuery<Redemption[]>({
    queryKey: ["/api/promo-codes-redemptions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/promo-codes-redemptions");
      return res.json();
    }
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (newPromo: { code: string; reward: number; maxUses: number }) => {
      const res = await apiRequest("POST", "/api/promo-codes", newPromo);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      toast({
        title: "Promo Code Created",
        description: `Code "${code}" created successfully!`,
      });
      setCode("");
      setReward("");
      setMaxUses("1");
    },
    onError: (err: any) => {
      toast({
        title: "Error Creating Promo Code",
        description: err.message || "Failed to create promo code.",
        variant: "destructive"
      });
    }
  });

  // Toggle Status Mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/promo-codes/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      toast({
        title: "Status Updated",
        description: "Promo code status toggled successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error updating status",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/promo-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes-redemptions"] });
      toast({
        title: "Promo Code Deleted",
        description: "Promo code has been removed.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error deleting promo code",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !reward || isNaN(parseFloat(reward)) || parseFloat(reward) <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid code and positive reward amount.",
        variant: "destructive"
      });
      return;
    }
    createMutation.mutate({
      code: code.trim().toUpperCase(),
      reward: parseFloat(reward),
      maxUses: parseInt(maxUses) || 1
    });
  };

  const handleRefresh = () => {
    refetchCodes();
    refetchRedemptions();
  };

  // Calculations for dashboard stats
  const activeCodesCount = promoCodes.filter(c => c.status === "active").length;
  const totalRedemptionsCount = redemptions.length;
  const totalRewardsGivenCents = redemptions.reduce((sum, r) => sum + (r.promoCode?.reward || 0), 0);
  const totalRewardsGivenUSD = (totalRewardsGivenCents / 100).toFixed(2);

  const filteredPromoCodes = promoCodes.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Ticket className="w-8 h-8 text-purple-400" />
            Promo Code Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create user-redeemable promo codes, toggle their status, and monitor redemption statistics.
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh Data
        </Button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card/50 border-white/10 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Promo Codes</CardTitle>
            <Ticket className="w-5 h-5 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promoCodes.length}</div>
            <p className="text-xs text-muted-foreground mt-1">created codes in system</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/10 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Promo Codes</CardTitle>
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{activeCodesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">active & redeemable</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/10 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Redemptions</CardTitle>
            <UserCheck className="w-5 h-5 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{totalRedemptionsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">successful applications</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/10 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Rewards Paid</CardTitle>
            <DollarSign className="w-5 h-5 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRewardsGivenUSD}</div>
            <p className="text-xs text-muted-foreground mt-1">credited to user balances</p>
          </CardContent>
        </Card>
      </div>

      {/* Main content split: Form vs Promo Codes list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left side: Create form */}
        <div className="lg:col-span-1">
          <Card className="border-white/10 bg-card/40 backdrop-blur-md sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-400" />
                Create Promo Code
              </CardTitle>
              <CardDescription>
                Issue new balance top-up coupons for Telegram bot users.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code (e.g. WELCOME5)</Label>
                  <Input 
                    id="code" 
                    placeholder="WELCOME5" 
                    value={code} 
                    onChange={e => setCode(e.target.value)} 
                    required
                    className="font-mono uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward">Reward Amount (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                    <Input 
                      id="reward" 
                      type="number"
                      step="0.01"
                      placeholder="5.00" 
                      value={reward} 
                      onChange={e => setReward(e.target.value)} 
                      required
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxUses">Max Allowed Redemptions</Label>
                  <Input 
                    id="maxUses" 
                    type="number" 
                    min="1"
                    value={maxUses} 
                    onChange={e => setMaxUses(e.target.value)} 
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending} 
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {createMutation.isPending ? "Creating..." : "Create Promo Code"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right side: Codes listing */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-white/10 bg-card/40 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle>Promo Codes</CardTitle>
                <CardDescription>Manage your active campaign codes.</CardDescription>
              </div>
              <div className="relative w-48 md:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search codes..."
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isCodesLoading ? (
                <div className="text-center py-8 text-muted-foreground animate-pulse">Loading promo codes...</div>
              ) : filteredPromoCodes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No promo codes found. Create one to get started!</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Reward</TableHead>
                        <TableHead>Uses</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPromoCodes.map(promo => {
                        const isExpired = promo.usesCount >= promo.maxUses;
                        return (
                          <TableRow key={promo.id}>
                            <TableCell className="font-mono font-bold text-white">{promo.code}</TableCell>
                            <TableCell>${(promo.reward / 100).toFixed(2)}</TableCell>
                            <TableCell>
                              <span className="text-white font-bold">{promo.usesCount}</span> / {promo.maxUses}
                            </TableCell>
                            <TableCell>
                              {isExpired ? (
                                <Badge variant="secondary" className="bg-red-950 text-red-400 border-red-900">
                                  Limit Reached
                                </Badge>
                              ) : promo.status === "active" ? (
                                <Badge className="bg-emerald-950 text-emerald-400 border-emerald-900">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              {!isExpired && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleMutation.mutate({
                                    id: promo.id,
                                    status: promo.status === "active" ? "inactive" : "active"
                                  })}
                                >
                                  {promo.status === "active" ? (
                                    <XCircle className="w-4 h-4 text-amber-500" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this promo code? This will also delete its redemptions log.")) {
                                    deleteMutation.mutate(promo.id);
                                  }
                                }}
                              >
                                <Trash className="w-4 h-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Redemptions Log */}
      <Card className="border-white/10 bg-card/40 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-400" />
            Redemption History
          </CardTitle>
          <CardDescription>
            Audit log of users who successfully redeemed promo codes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRedemptionsLoading ? (
            <div className="text-center py-8 text-muted-foreground animate-pulse">Loading redemptions history...</div>
          ) : redemptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No redemptions logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID / Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Code Used</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Date / Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-white">
                        {r.telegramUser?.firstName || 'User'} <code>({r.telegramUser?.telegramId || r.telegramUserId})</code>
                      </TableCell>
                      <TableCell className="text-purple-400">
                        {r.telegramUser?.username ? `@${r.telegramUser.username}` : "-"}
                      </TableCell>
                      <TableCell className="font-mono">{r.promoCode?.code || "Deleted Code"}</TableCell>
                      <TableCell className="text-emerald-400 font-bold">
                        +${((r.promoCode?.reward || 0) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(r.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
