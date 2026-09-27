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
  Image as ImageIcon,
  Camera,
  Send,
  Loader2,
  Zap,
  Bot
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { SupportTicket } from "@shared/schema";

interface TicketMessage {
  sender: 'user' | 'admin' | 'staff';
  text: string;
  attachmentUrl?: string;
  timestamp?: string;
}

const QUICK_REPLIES = [
  "⚡ Checking your issue now, please wait...",
  "✅ Payment verified! Your order is processing.",
  "⏳ Please wait 5-10 minutes for activation.",
  "📷 Please send a clear screenshot of your payment receipt.",
  "👍 Your issue has been resolved. Thank you!"
];

// Canvas Image Compression Helper (< 300KB)
async function compressImageToDataUrl(file: File, maxDim = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function SupportTicketsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({});
  const [replyAttachments, setReplyAttachments] = useState<Record<number, string>>({});
  const [isCompressingMap, setIsCompressingMap] = useState<Record<number, boolean>>({});

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support-tickets"],
    refetchInterval: 3000,
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
        description: `Support ticket #${variables.id < 2000 ? variables.id + 2000 : variables.id} status changed to ${variables.status}. Customer was notified via Telegram!`,
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

  const sendReplyMutation = useMutation({
    mutationFn: async ({ id, replyText, attachmentUrl }: { id: number; replyText: string; attachmentUrl?: string }) => {
      const res = await fetch(`/api/support-tickets/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText, attachmentUrl }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to send reply to customer");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-tickets"] });
      setReplyTexts(prev => ({ ...prev, [variables.id]: "" }));
      setReplyAttachments(prev => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      toast({
        title: "Reply Sent to Customer",
        description: `Your reply was sent to Telegram user for ticket #${variables.id < 2000 ? variables.id + 2000 : variables.id}`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Reply Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleQuickReply = (ticketId: number, preset: string) => {
    setReplyTexts(prev => ({
      ...prev,
      [ticketId]: preset
    }));
  };

  const handleSendReply = (ticketId: number) => {
    const text = replyTexts[ticketId]?.trim() || "";
    const attach = replyAttachments[ticketId];
    if (!text && !attach) {
      toast({
        title: "Empty Reply",
        description: "Please enter a reply message or attach a photo first.",
        variant: "destructive"
      });
      return;
    }
    sendReplyMutation.mutate({ id: ticketId, replyText: text, attachmentUrl: attach });
  };

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
    <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 md:space-y-8 max-w-7xl mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5 sm:gap-3">
            <LifeBuoy className="w-7 h-7 sm:w-8 sm:h-8 text-purple-400 shrink-0" />
            Support Requests & Tickets
          </h1>
          <p className="text-xs sm:text-sm text-white/60 mt-1">
            Manage customer support requests submitted via Telegram bot. Reply directly to users from here!
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
        <Card className="glass-card border-0 bg-purple-950/20">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-white/50 uppercase tracking-wider">Total Tickets</p>
                <h3 className="text-2xl sm:text-3xl font-black text-white mt-0.5 sm:mt-1">{tickets.length}</h3>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 bg-yellow-950/20">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-yellow-400/70 uppercase tracking-wider">Open</p>
                <h3 className="text-2xl sm:text-3xl font-black text-yellow-400 mt-0.5 sm:mt-1">{openCount}</h3>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400 shrink-0">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 bg-blue-950/20">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-blue-400/70 uppercase tracking-wider">In Progress</p>
                <h3 className="text-2xl sm:text-3xl font-black text-blue-400 mt-0.5 sm:mt-1">{inProgressCount}</h3>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 bg-emerald-950/20">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-emerald-400/70 uppercase tracking-wider">Resolved</p>
                <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5 sm:mt-1">{resolvedCount}</h3>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 bg-rose-950/20 col-span-2 sm:col-span-1">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-rose-400/70 uppercase tracking-wider">Closed</p>
                <h3 className="text-2xl sm:text-3xl font-black text-rose-400 mt-0.5 sm:mt-1">{closedCount}</h3>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-white/40" />
          <Input
            placeholder="Search username, ID, issue or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 sm:pl-12 h-10 sm:h-12 text-xs sm:text-sm glass-panel border-white/10 text-white rounded-xl"
          />
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto overflow-x-auto">
          <TabsList className="glass-panel border-white/10 p-1 rounded-xl flex overflow-x-auto w-full md:w-auto justify-start md:justify-center no-scrollbar">
            <TabsTrigger value="all" className="rounded-lg font-bold text-xs px-2.5 py-1.5 shrink-0">All</TabsTrigger>
            <TabsTrigger value="open" className="rounded-lg font-bold text-yellow-400 text-xs px-2.5 py-1.5 shrink-0">Open ({openCount})</TabsTrigger>
            <TabsTrigger value="in_progress" className="rounded-lg font-bold text-blue-400 text-xs px-2.5 py-1.5 shrink-0">In Progress ({inProgressCount})</TabsTrigger>
            <TabsTrigger value="resolved" className="rounded-lg font-bold text-emerald-400 text-xs px-2.5 py-1.5 shrink-0">Resolved ({resolvedCount})</TabsTrigger>
            <TabsTrigger value="closed" className="rounded-lg font-bold text-rose-400 text-xs px-2.5 py-1.5 shrink-0">Closed ({closedCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="py-20 text-center text-white/40">Loading support tickets...</div>
      ) : filteredTickets.length === 0 ? (
        <Card className="glass-card border-0 py-16 text-center">
          <CardContent className="space-y-3 p-4">
            <LifeBuoy className="w-12 h-12 text-white/20 mx-auto" />
            <h3 className="text-xl font-bold text-white">No Support Tickets Found</h3>
            <p className="text-white/40 max-w-sm mx-auto text-xs sm:text-sm">
              When users select support issues in the Telegram Bot, tickets will appear here automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6">
          {filteredTickets.map((ticket) => {
            const cleanUser = (ticket.username || ticket.userTelegramId || "Customer").replace("@", "");
            const displayId = ticket.id < 2000 ? ticket.id + 2000 : ticket.id;

            // Parse conversation messages
            let parsedMessages: TicketMessage[] = [];
            if (ticket.messages) {
              try {
                parsedMessages = JSON.parse(ticket.messages);
              } catch (e) {
                parsedMessages = [];
              }
            }
            if (parsedMessages.length === 0 && ticket.details) {
              parsedMessages = [{ sender: 'user', text: ticket.details }];
            }

            const isReplyingThis = sendReplyMutation.isPending && sendReplyMutation.variables?.id === ticket.id;

            return (
              <Card key={ticket.id} className="glass-card border-0 hover:border-purple-500/30 transition-all overflow-hidden">
                <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* User & Issue Header */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 font-bold px-2.5 py-0.5 text-xs">
                          #{displayId}
                        </Badge>

                        {ticket.status === "open" && (
                          <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 font-bold text-xs">
                            Open Request
                          </Badge>
                        )}
                        {ticket.status === "in_progress" && (
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 font-bold text-xs">
                            In Progress
                          </Badge>
                        )}
                        {ticket.status === "resolved" && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold text-xs">
                            Resolved
                          </Badge>
                        )}
                        {ticket.status === "closed" && (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold text-xs">
                            Closed
                          </Badge>
                        )}

                        <span className="text-[11px] sm:text-xs text-white/40">
                          {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ""}
                        </span>
                      </div>

                      <h4 className="text-lg sm:text-xl font-black text-white break-words">
                        {ticket.issueType}
                      </h4>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm text-white/60">
                        <span className="flex items-center gap-1.5 font-bold text-purple-300 break-all">
                          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                          @{cleanUser}
                        </span>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="shrink-0">Telegram ID:</span>
                          <code className="text-white/80 bg-white/5 px-2 py-0.5 rounded font-mono break-all text-[11px] sm:text-xs">
                            {ticket.userTelegramId}
                          </code>
                        </div>
                      </div>
                    </div>

                    {/* Quick Link & Actions */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyTemplate(ticket)}
                        className="flex-1 lg:flex-initial glass-panel border-white/10 hover:bg-white/10 text-white gap-1.5 rounded-xl text-xs sm:text-sm h-9"
                      >
                        {copiedId === ticket.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        Copy Template
                      </Button>

                      <Button
                        variant="default"
                        size="sm"
                        asChild
                        className="flex-1 lg:flex-initial bg-gradient-to-r from-purple-500 to-blue-600 font-bold text-white rounded-xl gap-1.5 text-xs sm:text-sm h-9"
                      >
                        <a href={`https://t.me/${cleanUser}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Chat on Telegram
                        </a>
                      </Button>
                    </div>
                  </div>

                  {/* Customer Screenshot Attachment */}
                  {ticket.attachmentUrl && (
                    <div className="bg-white/5 border border-purple-500/20 rounded-2xl p-3 sm:p-4 space-y-2">
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

                  {/* Conversation History Thread */}
                  <div className="bg-black/30 border border-white/10 rounded-2xl p-3 sm:p-4 space-y-3">
                    <p className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Ticket Conversation Thread:
                    </p>

                    {parsedMessages.length === 0 ? (
                      <p className="text-xs sm:text-sm text-white/40 italic">Waiting for details from customer...</p>
                    ) : (
                      <div className="space-y-2.5 sm:space-y-3 max-h-96 overflow-y-auto pr-1">
                        {parsedMessages.map((msg, index) => {
                          const msgAttach = msg.attachmentUrl || (msg as any).attachment_url || (msg as any).image;
                          const isAdmin = msg.sender === 'admin' || msg.sender === 'staff';
                          return (
                            <div 
                              key={index} 
                              className={`p-3 sm:p-3.5 rounded-xl text-xs sm:text-sm leading-relaxed border space-y-1.5 ${
                                isAdmin
                                  ? 'bg-purple-600/15 border-purple-500/30 text-purple-100 ml-2 sm:ml-6' 
                                  : 'bg-white/5 border-white/10 text-white mr-2 sm:mr-6'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[11px] sm:text-xs font-bold flex items-center gap-1.5 ${
                                  isAdmin ? 'text-purple-300' : 'text-yellow-400'
                                }`}>
                                  {isAdmin ? (
                                    <>
                                      <Bot className="w-3.5 h-3.5" />
                                      Admin Reply:
                                    </>
                                  ) : (
                                    <>
                                      <User className="w-3.5 h-3.5" />
                                      Submitted Message (Customer):
                                    </>
                                  )}
                                </span>
                                {msg.timestamp && (
                                  <span className="text-[10px] text-white/40">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              {msg.text && (
                                <p className="whitespace-pre-wrap font-mono text-xs break-words">{msg.text}</p>
                              )}
                              {msgAttach && (
                                <div className="pt-1">
                                  <img 
                                    src={msgAttach} 
                                    alt="Message Attachment" 
                                    className="max-h-48 max-w-full sm:max-w-xs object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(msgAttach, "_blank")}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quick Replies & Admin Reply Form */}
                  <div className="bg-purple-950/20 border border-purple-500/20 rounded-2xl p-3 sm:p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-400" />
                        Reply to Customer:
                      </label>
                      <span className="text-[11px] text-white/40">Quick preset response chips:</span>
                    </div>

                    {/* Quick Reply Preset Chips */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {QUICK_REPLIES.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleQuickReply(ticket.id, preset)}
                          className="text-[11px] sm:text-xs bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 text-white/80 hover:text-white px-2.5 py-1 rounded-lg transition-all text-left leading-tight"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {replyAttachments[ticket.id] && (
                      <div className="relative inline-block rounded-xl border border-white/10 bg-black/40 p-1">
                        <img 
                          src={replyAttachments[ticket.id]} 
                          alt="Reply attachment" 
                          className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setReplyAttachments(prev => {
                            const next = { ...prev };
                            delete next[ticket.id];
                            return next;
                          })}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-end">
                      <div className="flex gap-2.5 items-end flex-1">
                        <label className="h-10 sm:h-12 w-10 sm:w-12 rounded-xl bg-white/5 border border-white/10 hover:bg-purple-500/20 text-purple-300 flex items-center justify-center cursor-pointer shrink-0 transition-colors">
                          {isCompressingMap[ticket.id] ? (
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                          ) : (
                            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isCompressingMap[ticket.id]}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setIsCompressingMap(prev => ({ ...prev, [ticket.id]: true }));
                              try {
                                const compressed = await compressImageToDataUrl(file, 1200, 1200, 0.75);
                                setReplyAttachments(prev => ({ ...prev, [ticket.id]: compressed }));
                              } catch (err) {
                                toast({
                                  title: "Image Upload Failed",
                                  description: "Could not compress image.",
                                  variant: "destructive"
                                });
                              } finally {
                                setIsCompressingMap(prev => ({ ...prev, [ticket.id]: false }));
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>

                        <Textarea
                          placeholder="Type reply message to send to customer..."
                          value={replyTexts[ticket.id] || ""}
                          onChange={(e) => setReplyTexts(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                          className="glass-panel border-white/10 text-white min-h-[60px] sm:min-h-[70px] rounded-xl text-xs sm:text-sm flex-1"
                        />
                      </div>

                      <Button
                        onClick={() => handleSendReply(ticket.id)}
                        disabled={isReplyingThis || (!(replyTexts[ticket.id]?.trim()) && !replyAttachments[ticket.id]) || isCompressingMap[ticket.id]}
                        className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl px-4 sm:px-5 flex items-center justify-center gap-2 h-10 sm:h-12 shrink-0 cursor-pointer text-xs sm:text-sm"
                      >
                        {isReplyingThis ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Send Reply
                      </Button>
                    </div>
                  </div>

                  {/* Status Change Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 border-t border-white/10 pt-4">
                    <span className="text-xs font-bold text-white/40 uppercase">Change Ticket Status:</span>

                    <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end">
                      {ticket.status !== "resolved" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: "resolved" })}
                          className="flex-1 sm:flex-initial bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-xl font-bold border border-emerald-500/30 gap-1.5 text-xs h-8 sm:h-9"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Resolved
                        </Button>
                      )}

                      {ticket.status !== "closed" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: "closed" })}
                          className="flex-1 sm:flex-initial bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-xl font-bold border border-rose-500/30 gap-1.5 text-xs h-8 sm:h-9"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Close Ticket
                        </Button>
                      )}

                      {(ticket.status === "resolved" || ticket.status === "closed") && (
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: "open" })}
                          className="flex-1 sm:flex-initial bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 rounded-xl font-bold border border-yellow-500/30 gap-1.5 text-xs h-8 sm:h-9"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          Reopen Ticket
                        </Button>
                      )}
                    </div>
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
