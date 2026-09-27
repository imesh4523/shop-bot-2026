import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, Save, Loader2, Edit2, Search, Ban, ShieldCheck, ChevronLeft, ChevronRight, Mail, Send, Globe, Key } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TelegramUser {
  id: number;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  balance: number;
  isBanned?: boolean;
  createdAt: string;
  email?: string;
  authProvider?: string;
  avatarUrl?: string;
}

const PAGE_SIZE = 20;

export default function TelegramUsersPage() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBalance, setEditBalance] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<"all" | "telegram" | "email">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">("all");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const { data: usersData, isLoading, isError, refetch } = useQuery<TelegramUser[]>({
    queryKey: ["/api/telegram-users"],
    retry: 1,
  });

  const users: TelegramUser[] = useMemo(() => Array.isArray(usersData) ? usersData : [], [usersData]);

  const isEmailUser = (u: TelegramUser) => Boolean(u.email || u.authProvider === "google" || u.authProvider === "email" || u.telegramId?.startsWith("google:"));
  const isTelegramUser = (u: TelegramUser) => !isEmailUser(u);

  const emailCount = useMemo(() => users.filter(isEmailUser).length, [users]);
  const telegramCount = useMemo(() => users.filter(isTelegramUser).length, [users]);

  const bannedCount = useMemo(() => users.filter(u => Boolean(u?.isBanned)).length, [users]);
  const activeCount = useMemo(() => users.length - bannedCount, [users, bannedCount]);

  const mutation = useMutation({
    mutationFn: async ({ id, balance }: { id: number; balance: number }) => {
      const res = await apiRequest("PATCH", `/api/telegram-users/${id}`, {
        balance: Math.round(balance * 100),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram-users"] });
      toast({
        title: "User Updated",
        description: "User balance has been updated.",
      });
      setEditingId(null);
    },
  });

  const banMutation = useMutation({
    mutationFn: async ({ id, isBanned }: { id: number; isBanned: boolean }) => {
      const res = await apiRequest("PATCH", `/api/telegram-users/${id}`, {
        isBanned,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram-users"] });
      toast({
        title: variables.isBanned ? "User Banned" : "User Unbanned",
        description: variables.isBanned
          ? "User has been banned from the platform."
          : "User has been unbanned and restored access.",
      });
    },
  });

  const filteredUsers = useMemo(() => {
    let result = users;

    // Account type filter (All / Telegram / Email & Google)
    if (accountTypeFilter === "email") {
      result = result.filter(isEmailUser);
    } else if (accountTypeFilter === "telegram") {
      result = result.filter(isTelegramUser);
    }

    // Status filter
    if (statusFilter === "banned") {
      result = result.filter(u => Boolean(u?.isBanned));
    } else if (statusFilter === "active") {
      result = result.filter(u => !u?.isBanned);
    }

    // Search filter
    const searchLower = (search || "").toLowerCase().trim();
    if (searchLower) {
      result = result.filter((user) => {
        if (!user) return false;
        const firstName = String(user.firstName || "");
        const lastName = String(user.lastName || "");
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        const username = String(user.username || "").toLowerCase();
        const telegramId = String(user.telegramId || "").toLowerCase();
        const email = String(user.email || "").toLowerCase();

        return (
          fullName.includes(searchLower) ||
          username.includes(searchLower) ||
          telegramId.includes(searchLower) ||
          email.includes(searchLower)
        );
      });
    }

    return result;
  }, [users, accountTypeFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const start = (validCurrentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, validCurrentPage]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleAccountTypeChange = (type: "all" | "telegram" | "email") => {
    setAccountTypeFilter(type);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status: "all" | "active" | "banned") => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleEdit = (user: TelegramUser) => {
    setEditingId(user.id);
    setEditBalance((user.balance || 0) / 100);
  };

  const handleSave = () => {
    if (editingId !== null) {
      mutation.mutate({ id: editingId, balance: editBalance });
    }
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-2xl">
            Users Management
          </h1>
          <p className="text-white/40 text-xs sm:text-sm font-medium mt-1">
            Manage Telegram bot & Web / Google users, balances & access status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-2 text-xs font-bold text-purple-300 shadow-sm">
            <Send className="w-3.5 h-3.5 text-sky-400" />
            <span>{telegramCount} Telegram</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-2 text-xs font-bold text-blue-300 shadow-sm">
            <Mail className="w-3.5 h-3.5 text-blue-400" />
            <span>{emailCount} Email / Google</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs font-bold text-white shadow-sm">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>{users.length} Total</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="space-y-3">
        {/* Tier 1: Platform Source Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center p-1.5 rounded-2xl bg-[#130d24] border border-white/10 gap-1 overflow-x-auto">
            <button
              onClick={() => handleAccountTypeChange("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                accountTypeFilter === "all"
                  ? "bg-purple-600 text-white shadow-lg"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              All Users ({users.length})
            </button>

            <button
              onClick={() => handleAccountTypeChange("telegram")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                accountTypeFilter === "telegram"
                  ? "bg-sky-600 text-white shadow-lg"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Send className="w-3.5 h-3.5 text-sky-300" />
              Telegram Users ({telegramCount})
            </button>

            <button
              onClick={() => handleAccountTypeChange("email")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                accountTypeFilter === "email"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-blue-300" />
              Email & Google Users ({emailCount})
            </button>
          </div>

          {/* Status Sub-Filters */}
          <div className="flex items-center p-1 rounded-xl bg-[#130d24] border border-white/10 gap-1 shrink-0">
            <button
              onClick={() => handleStatusFilterChange("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === "all"
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white"
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => handleStatusFilterChange("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === "active"
                  ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Active ({activeCount})
            </button>
            <button
              onClick={() => handleStatusFilterChange("banned")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === "banned"
                  ? "bg-red-600/30 text-red-400 border border-red-500/30"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <Ban className="w-3 h-3 text-red-400" />
              Banned ({bannedCount})
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <Input
            placeholder="Search by name, @username, email, or user ID..."
            className="pl-10 h-11 rounded-2xl border-white/10 bg-[#130d24] text-white text-xs placeholder:text-white/30 focus:border-purple-500/50 w-full"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Pagination Top controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40 font-medium">
            Showing {(validCurrentPage - 1) * PAGE_SIZE + 1} - {Math.min(validCurrentPage * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} filtered users
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              className="h-9 px-3 rounded-xl border-white/10 bg-[#130d24] text-white hover:bg-white/10 disabled:opacity-30 text-xs font-bold"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <span className="text-xs font-bold text-white/60 px-2">
              {validCurrentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              className="h-9 px-3 rounded-xl border-white/10 bg-[#130d24] text-white hover:bg-white/10 disabled:opacity-30 text-xs font-bold"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Users Card List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : isError ? (
          <Card className="border border-red-500/20 bg-red-950/20">
            <CardContent className="pt-6 text-center space-y-3">
              <p className="text-red-400 text-sm font-bold">Failed to load users.</p>
              <Button onClick={() => refetch()} variant="outline" className="border-red-500/30 text-white">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card className="border border-white/10 bg-[#130d24]">
            <CardContent className="pt-6">
              <p className="text-center text-white/50 text-sm">
                {accountTypeFilter === "email"
                  ? "No Email / Google users found"
                  : accountTypeFilter === "telegram"
                  ? "No Telegram users found"
                  : statusFilter === "banned"
                  ? "No banned users found"
                  : statusFilter === "active"
                  ? "No active users found"
                  : search
                  ? "No users found matching your search"
                  : "No users registered yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          paginatedUsers.map((user) => {
            const isUserBanned = Boolean(user.isBanned);
            const isUserEmail = isEmailUser(user);
            const userDisplayName = (user.firstName || user.lastName)
              ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
              : (user.username ? `@${user.username}` : user.email ? user.email.split("@")[0] : `User ${user.telegramId || user.id}`);

            return (
              <div
                key={`user-${user.id || user.telegramId}`}
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                  isUserBanned
                    ? 'border-red-500/30 bg-red-950/20'
                    : 'border-white/10 bg-[#130d24] hover:border-purple-500/30'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="font-bold text-white text-base sm:text-lg">
                        {userDisplayName}
                      </p>

                      {/* Source Platform Badge */}
                      {isUserEmail ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-blue-400" />
                          {user.authProvider === "google" || user.telegramId?.startsWith("google:") ? "Google Account" : "Email Account"}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                          <Send className="w-3 h-3 text-sky-400" /> Telegram Bot
                        </span>
                      )}

                      {/* Active / Banned Badge */}
                      {isUserBanned ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                          <Ban className="w-3 h-3" /> BANNED
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60 font-mono">
                      <span>DB ID: #{user.id}</span>
                      {user.email && (
                        <span className="text-blue-300 font-sans flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {user.email}
                        </span>
                      )}
                      {user.username && <span>@{user.username}</span>}
                      {user.telegramId && !user.telegramId.startsWith("google:") && (
                        <span>TG ID: {user.telegramId}</span>
                      )}
                    </div>

                    <p className="text-xs text-purple-300 font-bold">
                      Wallet Balance: ${(((user.balance || 0)) / 100).toFixed(2)} USD
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => banMutation.mutate({ id: user.id, isBanned: !isUserBanned })}
                      disabled={banMutation.isPending}
                      variant="outline"
                      size="sm"
                      className={
                        isUserBanned
                          ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 bg-emerald-950/20 h-9 rounded-xl text-xs font-bold"
                          : "border-red-500/30 text-red-400 hover:bg-red-500/20 bg-red-950/20 h-9 rounded-xl text-xs font-bold"
                      }
                    >
                      {isUserBanned ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Unban User
                        </>
                      ) : (
                        <>
                          <Ban className="w-3.5 h-3.5 mr-1.5 text-red-400" /> Ban User
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleEdit(user)}
                      variant="ghost"
                      size="icon"
                      className="text-purple-400 hover:bg-purple-500/10 h-9 w-9 rounded-xl"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <span className="text-xs font-medium text-white/40">
            Showing {(validCurrentPage - 1) * PAGE_SIZE + 1} - {Math.min(validCurrentPage * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              className="h-9 px-3 rounded-xl border-white/10 bg-[#130d24] text-white hover:bg-white/10 disabled:opacity-30 text-xs font-bold"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              className="h-9 px-3 rounded-xl border-white/10 bg-[#130d24] text-white hover:bg-white/10 disabled:opacity-30 text-xs font-bold"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Edit Balance Modal */}
      <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="border-white/10 bg-[#130d24] text-white rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-bold text-lg">Edit User Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-white/70 text-xs font-bold">Balance ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={editBalance}
                onChange={(e) => setEditBalance(parseFloat(e.target.value) || 0)}
                className="border-white/10 bg-black/40 text-white"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditingId(null)}
                className="border-white/10 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={mutation.isPending}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
