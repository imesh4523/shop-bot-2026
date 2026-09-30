import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { 
  Search, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Mail, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Coins, 
  RefreshCw,
  Copy,
  User,
  ShieldCheck,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type PaymentUser = {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  authProvider: string | null;
  balance: number;
  balanceLkr: number | null;
};

type PaymentRecord = {
  id: number;
  telegramUserId: number;
  amount: number;
  currency: string | null;
  paymentMethod: string;
  status: string;
  externalId: string | null;
  cryptomusUuid: string | null;
  txid: string | null;
  createdAt: string;
  updatedAt: string | null;
  telegramUser?: PaymentUser | null;
};

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const { toast } = useToast();

  const { data: payments, isLoading } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/payments"],
    refetchInterval: 10000,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: `${label}: ${text}`,
    });
  };

  const filteredPayments = payments?.filter((payment) => {
    const searchLower = search.toLowerCase();
    const email = payment.telegramUser?.email?.toLowerCase() || "";
    const username = payment.telegramUser?.username?.toLowerCase() || "";
    const telegramId = payment.telegramUser?.telegramId?.toLowerCase() || "";
    const fullName = `${payment.telegramUser?.firstName || ""} ${payment.telegramUser?.lastName || ""}`.toLowerCase();
    const method = payment.paymentMethod?.toLowerCase() || "";
    const txid = payment.txid?.toLowerCase() || "";
    const externalId = payment.externalId?.toLowerCase() || "";
    const id = payment.id.toString();

    const matchesSearch =
      email.includes(searchLower) ||
      username.includes(searchLower) ||
      telegramId.includes(searchLower) ||
      fullName.includes(searchLower) ||
      method.includes(searchLower) ||
      txid.includes(searchLower) ||
      externalId.includes(searchLower) ||
      id.includes(searchLower);

    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    const paymentCurr = (payment.currency || "USD").toUpperCase();
    const matchesCurrency = currencyFilter === "all" || paymentCurr === currencyFilter;

    return matchesSearch && matchesStatus && matchesCurrency;
  });

  // Calculate summary metrics
  const totalCompleted = payments?.filter(p => p.status === "completed") || [];
  const totalUsdAmount = totalCompleted
    .filter(p => (p.currency || "USD").toUpperCase() === "USD")
    .reduce((acc, p) => acc + (p.amount / 100), 0);
  const totalLkrAmount = totalCompleted
    .filter(p => (p.currency || "").toUpperCase() === "LKR")
    .reduce((acc, p) => acc + (p.amount / 100), 0);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-semibold gap-1">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-semibold gap-1">
            <XCircle className="w-3 h-3" /> Failed
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 font-semibold gap-1">
            <Clock className="w-3 h-3" /> Expired
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 font-semibold gap-1">
            <Clock className="w-3 h-3" /> Pending
          </Badge>
        );
    }
  };

  const formatPaymentMethod = (method: string) => {
    const m = (method || "").toLowerCase();
    if (m === "admin_topup") {
      return {
        label: "YouuHost Team Added",
        badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        icon: <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
      };
    }
    if (m === "admin_deduction") {
      return {
        label: "Team Balance Deduction",
        badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/30",
        icon: <ArrowDownLeft className="w-3.5 h-3.5 text-orange-400" />
      };
    }
    if (m === "frimi" || m.includes("frimi")) {
      return {
        label: "FriMi",
        badgeClass: "bg-red-500/20 text-red-300 border-red-500/30",
        icon: <CreditCard className="w-3.5 h-3.5 text-red-400" />
      };
    }
    if (m === "ipay" || m.includes("ipay")) {
      return {
        label: "iPay (Sri Lanka)",
        badgeClass: "bg-teal-500/20 text-teal-300 border-teal-500/30",
        icon: <CreditCard className="w-3.5 h-3.5 text-teal-400" />
      };
    }
    if (m === "qplus" || m.includes("q+")) {
      return {
        label: "Q+ Payment",
        badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        icon: <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
      };
    }
    if (m === "mastercard" || m.includes("master")) {
      return {
        label: "Mastercard",
        badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        icon: <CreditCard className="w-3.5 h-3.5 text-amber-400" />
      };
    }
    if (m === "visa" || m.includes("visa")) {
      return {
        label: "Visa Card",
        badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        icon: <CreditCard className="w-3.5 h-3.5 text-blue-400" />
      };
    }
    if (m === "payhere" || m === "card" || m === "card_payment") {
      return {
        label: "Credit / Debit Card",
        badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        icon: <CreditCard className="w-3.5 h-3.5 text-purple-400" />
      };
    }
    if (m === "binance_pay" || m === "binance") {
      return {
        label: "Binance Pay",
        badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
        icon: <Coins className="w-3.5 h-3.5 text-yellow-400" />
      };
    }
    if (m === "cryptomus" || m === "crypto") {
      return {
        label: "Cryptomus",
        badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        icon: <Coins className="w-3.5 h-3.5 text-emerald-400" />
      };
    }
    if (m === "bep20") {
      return {
        label: "USDT (BEP-20)",
        badgeClass: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
        icon: <Coins className="w-3.5 h-3.5 text-cyan-400" />
      };
    }
    if (m === "trc20") {
      return {
        label: "USDT (TRC-20)",
        badgeClass: "bg-green-500/20 text-green-300 border-green-500/30",
        icon: <Coins className="w-3.5 h-3.5 text-green-400" />
      };
    }
    return {
      label: method || "Standard",
      badgeClass: "bg-white/10 text-white/70 border-white/10",
      icon: <Wallet className="w-3.5 h-3.5 text-white/50" />
    };
  };

  const renderAmount = (amountInCents: number, currencyRaw?: string | null) => {
    const isLkr = (currencyRaw || "").toUpperCase() === "LKR";
    const isNegative = amountInCents < 0;
    const absVal = Math.abs(amountInCents) / 100;

    if (isLkr) {
      return (
        <div className="flex items-center gap-1.5 font-bold">
          <span className={isNegative ? "text-red-400" : "text-white"}>
            {isNegative ? "-" : ""}Rs. {absVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <Badge variant="outline" className="text-[10px] py-0 px-1 border-blue-400/30 text-blue-300 bg-blue-500/10">
            LKR
          </Badge>
        </div>
      );
    }

    // Default USD
    return (
      <div className="flex items-center gap-1.5 font-bold">
        <span className={isNegative ? "text-red-400" : "text-white"}>
          {isNegative ? "-" : ""}${absVal.toFixed(2)}
        </span>
        <Badge variant="outline" className="text-[10px] py-0 px-1 border-green-400/30 text-green-300 bg-green-500/10">
          USD
        </Badge>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter">Payments & Deposits</h1>
          <p className="text-white/40 mt-1 font-medium">
            Manage customer deposits, top-ups, and transaction history
          </p>
        </div>
        <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-3">
          <Wallet className="w-5 h-5 text-purple-400" />
          <span className="text-white font-bold">Live Gateway Ledger</span>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="glass-card border-0 p-5 bg-gradient-to-br from-green-500/10 via-transparent to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Total LKR Volume</span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              Rs. {totalLkrAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-blue-300/80 mt-1">Sri Lanka Rupee deposits</p>
          </div>
        </Card>

        <Card className="glass-card border-0 p-5 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Total USD Volume</span>
            <div className="p-2 rounded-xl bg-green-500/20 text-green-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              ${totalUsdAmount.toFixed(2)}
            </div>
            <p className="text-xs text-green-300/80 mt-1">USDT & USD Card payments</p>
          </div>
        </Card>

        <Card className="glass-card border-0 p-5 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Total Transactions</span>
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {payments?.length || 0}
            </div>
            <p className="text-xs text-purple-300/80 mt-1">
              {totalCompleted.length} Completed Successfully
            </p>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <Input
            placeholder="Search by customer email, @username, ID, method, or TXID..."
            className="glass-panel pl-12 h-12 rounded-xl border-white/10 text-white placeholder:text-white/30 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            className="glass-panel border-white/10 bg-white/5 text-white h-12 rounded-xl px-4 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-400"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
          >
            <option value="all" className="bg-[#121225] text-white">All Currencies</option>
            <option value="LKR" className="bg-[#121225] text-white">LKR (Rs.)</option>
            <option value="USD" className="bg-[#121225] text-white">USD ($)</option>
          </select>

          <select
            className="glass-panel border-white/10 bg-white/5 text-white h-12 rounded-xl px-4 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-400"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all" className="bg-[#121225] text-white">All Statuses</option>
            <option value="completed" className="bg-[#121225] text-white">Completed</option>
            <option value="pending" className="bg-[#121225] text-white">Pending</option>
            <option value="expired" className="bg-[#121225] text-white">Expired</option>
            <option value="failed" className="bg-[#121225] text-white">Failed</option>
          </select>
        </div>
      </div>

      {/* Transactions Table Card */}
      <Card className="glass-card border-0 overflow-hidden shadow-2xl">
        <CardHeader className="border-b border-white/5 py-4">
          <CardTitle className="text-xl font-bold text-white flex items-center justify-between">
            <span>Transaction History</span>
            <span className="text-xs text-white/40 font-normal">
              Showing {filteredPayments?.length || 0} of {payments?.length || 0} records
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/50 font-bold text-xs">Customer (Email / User)</TableHead>
                <TableHead className="text-white/50 font-bold text-xs">Amount</TableHead>
                <TableHead className="text-white/50 font-bold text-xs">Payment Method & Reference</TableHead>
                <TableHead className="text-white/50 font-bold text-xs">Status</TableHead>
                <TableHead className="text-white/50 font-bold text-xs">Date & Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-white/40">
                    Loading payment records...
                  </TableCell>
                </TableRow>
              ) : !filteredPayments || filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-white/40">
                    No payment transactions found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => {
                  const methodInfo = formatPaymentMethod(payment.paymentMethod);
                  const email = payment.telegramUser?.email;
                  const username = payment.telegramUser?.username;
                  const tgId = payment.telegramUser?.telegramId;
                  const isGoogleUser = payment.telegramUser?.authProvider === "google" || (tgId && tgId.startsWith("google:"));

                  return (
                    <TableRow key={payment.id} className="border-white/5 hover:bg-white/5 transition-colors">
                      {/* Customer Column */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {email ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-white font-bold text-sm tracking-tight flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                {email}
                              </span>
                              {isGoogleUser && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400/30 text-blue-300 bg-blue-500/10">
                                  Google
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                              <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              {username ? `@${username}` : "Telegram User"}
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-xs text-white/40">
                            {email && username && (
                              <span>@{username}</span>
                            )}
                            {tgId && (
                              <span 
                                onClick={() => copyToClipboard(tgId, "Customer ID")}
                                className="cursor-pointer hover:text-white/70 font-mono text-[11px] truncate max-w-[160px]"
                                title={tgId}
                              >
                                ID: {tgId}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Amount Column */}
                      <TableCell>
                        {renderAmount(payment.amount, payment.currency)}
                      </TableCell>

                      {/* Payment Method & Reference Column */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={`w-fit font-bold text-xs gap-1.5 ${methodInfo.badgeClass}`}>
                            {methodInfo.icon}
                            {methodInfo.label}
                          </Badge>
                          {(payment.txid || payment.externalId) && (
                            <div className="flex items-center gap-1 text-[11px] text-white/40 font-mono">
                              <span className="truncate max-w-[150px]">
                                {payment.txid || payment.externalId}
                              </span>
                              <Copy 
                                className="w-3 h-3 cursor-pointer hover:text-white/80 shrink-0"
                                onClick={() => copyToClipboard(payment.txid || payment.externalId || "", "Reference ID")}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Status Column */}
                      <TableCell>
                        {getStatusBadge(payment.status)}
                      </TableCell>

                      {/* Date Column */}
                      <TableCell className="text-white/50 text-xs">
                        {payment.createdAt ? format(new Date(payment.createdAt), "MMM d, yyyy HH:mm") : "N/A"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
