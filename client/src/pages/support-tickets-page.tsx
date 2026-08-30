import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  LifeBuoy, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  User, 
  ExternalLink,
  Copy,
  Check,
  Image as ImageIcon
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { SupportTicket } from "@shared/schema";

export default function SupportTicketsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support-tickets"],
    refetchInterval: 5000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/support-tickets/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update ticket status");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-tickets"] });
      toast({
        title: "Status Updated & Customer Notified",
        description: `Support ticket #${variables.id} status changed to ${variables.status}. Customer was notified via Telegram!`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const copyTemplate = (ticket: SupportTicket) => {
    const template = `Order ID:\nPayment method:\nAmount sent:\nScreenshot attached: Yes/No\nProblem details: ${ticket.details || ticket.issueType}`;
    navigator.clipboard.writeText(template);
    setCopiedId(ticket.id);
    toast({
      title: "Template Copied",
      description: "Support template details copied to clipboard.",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      (t.username || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.userTelegramId || "").includes(searchTerm) ||
      (t.issueType || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.details || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && t.status === statusFilter;
  });

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;
  const closedCount = tickets.filter((t) => t.status === "closed").length;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <LifeBuoy className="w-8 h-8 text-purple-400" />
            Support Requests & Tickets
          </h1>
          <p className="text-white/60 mt-1">
            Manage customer support requests submitted via Telegram bot.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="glass-card border-0 bg-purple-950/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Total Tickets</p>
                <h3 className="text-3xl font-black text-white mt-1">{tickets.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 bg-yellow-950/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-yellow-400/70 uppercase tracking-wider">Open</p>
                <h3 className="text-3xl font-black text-yellow-400 mt-1">{openCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 bg-blue-950/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-400/70 uppercase tracking-wider">In Progress</p>
                <h3 className="text-3xl font-black text-blue-400 mt-1">{inProgressCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 bg-emerald-950/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-400/70 uppercase tracking-wider">Resolved</p>
                <h3 className="text-3xl font-black text-emerald-400 mt-1">{resolvedCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 bg-rose-950/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-400/70 uppercase tracking-wider">Closed</p>
                <h3 className="text-3xl font-black text-rose-400 mt-1">{closedCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400">
                <XCircle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <Input
            placeholder="Search username, ID, issue or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 glass-panel border-white/10 text-white rounded-xl"
          />
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
          <TabsList className="glass-panel border-white/10 p-1 rounded-xl">
            <TabsTrigger value="all" className="rounded-lg font-bold">All</TabsTrigger>
            <TabsTrigger value="open" className="rounded-lg font-bold text-yellow-400">Open ({openCount})</TabsTrigger>
            <TabsTrigger value="in_progress" className="rounded-lg font-bold text-blue-400">In Progress ({inProgressCount})</TabsTrigger>
            <TabsTrigger value="resolved" className="rounded-lg font-bold text-emerald-400">Resolved ({resolvedCount})</TabsTrigger>
            <TabsTrigger value="closed" className="rounded-lg font-bold text-rose-400">Closed ({closedCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="py-20 text-center text-white/40">Loading support tickets...</div>
      ) : filteredTickets.length === 0 ? (
        <Card className="glass-card border-0 py-16 text-center">
          <CardContent className="space-y-3">
            <LifeBuoy className="w-12 h-12 text-white/20 mx-auto" />
            <h3 className="text-xl font-bold text-white">No Support Tickets Found</h3>
            <p className="text-white/40 max-w-sm mx-auto">
              When users select support issues in the Telegram Bot, tickets will appear here automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTickets.map((ticket) => {
            const cleanUser = (ticket.username || ticket.userTelegramId || "Customer").replace("@", "");

            return (
              <Card key={ticket.id} className="glass-card border-0 hover:border-purple-500/30 transition-all">
                <CardContent className="p-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    {/* User & Issue Header */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 font-bold px-3 py-1 text-sm">
                          #{ticket.id}
                        </Badge>

                        {ticket.status === "open" && (
                          <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 font-bold">
                            Open Request
                          </Badge>
                        )}
                        {ticket.status === "in_progress" && (
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 font-bold">
                            In Progress
                          </Badge>
                        )}
                        {ticket.status === "resolved" && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold">
                            Resolved
                          </Badge>
                        )}
                        {ticket.status === "closed" && (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold">
                            Closed
                          </Badge>
                        )}

                        <span className="text-xs text-white/40">
                          {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ""}
                        </span>
                      </div>

                      <h4 className="text-xl font-black text-white">
                        {ticket.issueType}
                      </h4>

                      <div className="flex items-center gap-4 text-sm text-white/60">
                        <span className="flex items-center gap-1.5 font-bold text-purple-300">
                          <User className="w-4 h-4" />
                          @{cleanUser}
                        </span>
                        <span>Telegram ID: <code className="text-white/80 bg-white/5 px-2 py-0.5 rounded font-mono">{ticket.userTelegramId}</code></span>
                      </div>
                    </div>

                    {/* Quick Link & Template Actions */}
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyTemplate(ticket)}
                        className="glass-panel border-white/10 hover:bg-white/10 text-white gap-2 rounded-xl"
                      >
                        {copiedId === ticket.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        Copy Template
                      </Button>

                      <Button
                        variant="default"
                        size="sm"
                        asChild
                        className="bg-gradient-to-r from-purple-500 to-blue-600 font-bold text-white rounded-xl gap-2"
                      >
                        <a href={`https://t.me/${cleanUser}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                          Chat on Telegram
                        </a>
                      </Button>
                    </div>
                  </div>

                  {/* Customer Details / Message Text Box */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Customer Details / Message:
                    </p>
                    {ticket.details ? (
                      <p className="text-sm text-white font-mono whitespace-pre-wrap leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">
                        {ticket.details}
                      </p>
                    ) : (
                      <p className="text-sm text-white/40 italic">
                        Waiting for customer to send message details in Telegram chat...
                      </p>
                    )}
                  </div>

                  {/* Customer Screenshot Attachment */}
                  {ticket.attachmentUrl && (
                    <div className="bg-white/5 border border-purple-500/20 rounded-2xl p-4 space-y-2">
                      <p className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-purple-400" />
                        Attached Screenshot / Proof:
                      </p>
                      <div className="relative group max-w-md overflow-hidden rounded-xl border border-white/10 bg-black/40">
                        <img 
                          src={ticket.attachmentUrl} 
                          alt="Customer Screenshot Proof" 
                          className="w-full max-h-80 object-contain hover:scale-105 transition-transform duration-300 cursor-pointer"
                          onClick={() => window.open(ticket.attachmentUrl!, "_blank")}
                        />
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            className="bg-black/70 hover:bg-black text-white text-xs gap-1.5 backdrop-blur-md"
                            onClick={() => window.open(ticket.attachmentUrl!, "_blank")}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open Fullscreen
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status Change Buttons */}
                  <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                    <span className="text-xs font-bold text-white/40 uppercase mr-auto">Change Ticket Status:</span>

                    {ticket.status !== "resolved" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: "resolved" })}
                        className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-xl font-bold border border-emerald-500/30 gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Mark Resolved
                      </Button>
                    )}

                    {ticket.status !== "closed" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: "closed" })}
                        className="bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-xl font-bold border border-rose-500/30 gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        Close Ticket
                      </Button>
                    )}

                    {(ticket.status === "resolved" || ticket.status === "closed") && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: "open" })}
                        className="bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 rounded-xl font-bold border border-yellow-500/30 gap-1.5"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Reopen Ticket
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
