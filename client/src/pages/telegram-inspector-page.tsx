import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Smile, 
  Code, 
  Copy, 
  Trash2, 
  RefreshCw, 
  Sparkles, 
  Share2, 
  Check, 
  Hash, 
  Tag, 
  Bot, 
  Terminal, 
  Layers,
  Calendar,
  User,
  ArrowRight
} from "lucide-react";
import { io } from "socket.io-client";

interface InspectionTrace {
  id: string;
  timestamp: string;
  chatId: string;
  userId: string;
  username?: string;
  userFirstName?: string;
  rawText: string;
  reconstructedHtml: string;
  customEmojis: Array<{
    id: string;
    char: string;
    offset: number;
    length: number;
  }>;
  entitySummary: Array<{
    type: string;
    count: number;
    samples: string[];
  }>;
  forwardInfo?: {
    isForwarded: boolean;
    fromName?: string;
    fromUsername?: string;
    fromId?: string | number;
    chatTitle?: string;
    chatUsername?: string;
    chatId?: string | number;
    messageId?: number;
    date?: number;
  };
}

export default function TelegramInspectorPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: traces = [], isLoading, refetch } = useQuery<InspectionTrace[]>({
    queryKey: ["/api/telegram-inspector/traces"],
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // Socket.io for real-time live updates
  useEffect(() => {
    const socket = io();
    socket.on("telegram_inspector_new_trace", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram-inspector/traces"] });
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/telegram-inspector/traces");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram-inspector/traces"] });
      toast({ title: "Cleared Traces", description: "All inspector trace logs cleared successfully." });
    },
  });

  const deleteSingleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/telegram-inspector/traces/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram-inspector/traces"] });
      toast({ title: "Trace Deleted", description: "Selected trace entry deleted." });
    },
  });

  const copyToClipboard = (text: string, label: string, key?: string) => {
    navigator.clipboard.writeText(text);
    if (key) {
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2000);
    }
    toast({
      title: "Copied to Clipboard!",
      description: `${label} has been copied to your clipboard.`,
    });
  };

  // Filter traces
  const filteredTraces = traces.filter((trace) => {
    const query = searchTerm.toLowerCase();
    if (!query) return true;
    const matchText = trace.rawText?.toLowerCase() || "";
    const matchUser = trace.username?.toLowerCase() || trace.userFirstName?.toLowerCase() || trace.userId || "";
    const matchEmoji = trace.customEmojis?.some((e) => e.id.includes(query) || e.char.includes(query));
    const matchHtml = trace.reconstructedHtml?.toLowerCase() || "";
    return matchText.includes(query) || matchUser.includes(query) || matchEmoji || matchHtml;
  });

  // Stats calculation
  const totalTraces = traces.length;
  const uniqueCustomEmojis = Array.from(
    new Set(traces.flatMap((t) => t.customEmojis?.map((e) => e.id) || []))
  );
  const totalEntityTypes = Array.from(
    new Set(traces.flatMap((t) => t.entitySummary?.map((e) => e.type) || []))
  );

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-[1600px] mx-auto min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/[0.02] backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="space-y-2 relative">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-purple-400">
              <Smile className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                Telegram Entity & Emoji Inspector
                <span className="text-xs px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full font-semibold border border-purple-500/30">
                  Live Tracer
                </span>
              </h1>
              <p className="text-sm text-white/50 font-medium">
                Auto-detect custom emoji IDs, Telegram HTML formatting codes, quotes, spoilers & forwarded sources
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="destructive"
            onClick={() => clearAllMutation.mutate()}
            disabled={clearAllMutation.isPending || traces.length === 0}
            className="rounded-2xl font-bold gap-2 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
          >
            <Trash2 className="w-4 h-4" />
            Clear Traces
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/[0.02] border-white/10 rounded-3xl backdrop-blur-xl p-6 relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Traces Captured</p>
              <h3 className="text-3xl font-black text-white">{totalTraces}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Terminal className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-white/[0.02] border-white/10 rounded-3xl backdrop-blur-xl p-6 relative overflow-hidden group hover:border-yellow-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Custom Emoji IDs</p>
              <h3 className="text-3xl font-black text-yellow-400">{uniqueCustomEmojis.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 group-hover:scale-110 transition-transform">
              <Smile className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-white/[0.02] border-white/10 rounded-3xl backdrop-blur-xl p-6 relative overflow-hidden group hover:border-blue-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Format Types</p>
              <h3 className="text-3xl font-black text-blue-400">{totalEntityTypes.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Code className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-white/[0.02] border-white/10 rounded-3xl backdrop-blur-xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Bot Status</p>
              <h3 className="text-xl font-black text-emerald-400 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                Active Polling
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/[0.02] border border-white/10 p-4 rounded-3xl backdrop-blur-xl">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <Input
            placeholder="Search by Emoji ID, text content, formatting, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/30 h-12 text-sm focus:border-purple-500/50"
          />
        </div>
        {searchTerm && (
          <Button
            variant="ghost"
            onClick={() => setSearchTerm("")}
            className="text-white/50 hover:text-white rounded-xl text-xs font-bold"
          >
            Clear Search
          </Button>
        )}
      </div>

      {/* Traces Feed */}
      <div className="space-y-6">
        {filteredTraces.length === 0 ? (
          <Card className="bg-white/[0.02] border-white/10 rounded-3xl p-12 text-center backdrop-blur-xl">
            <div className="w-16 h-16 bg-purple-500/10 rounded-full border border-purple-500/20 flex items-center justify-center mx-auto mb-4 text-purple-400">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Telegram Traces Found</h3>
            <p className="text-sm text-white/40 max-w-md mx-auto">
              Forward any formatted message or send custom emojis to your Telegram Bot. The trace and extracted emoji IDs will appear here instantly!
            </p>
          </Card>
        ) : (
          filteredTraces.map((trace) => (
            <Card
              key={trace.id}
              className="bg-white/[0.02] border-white/10 rounded-3xl backdrop-blur-xl p-6 relative overflow-hidden transition-all duration-300 hover:border-purple-500/30 space-y-6"
            >
              {/* Card Top Metadata Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-sm">
                    {trace.userFirstName ? trace.userFirstName[0].toUpperCase() : <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">
                        {trace.userFirstName || trace.username || "Telegram User"}
                      </span>
                      {trace.username && (
                        <span className="text-xs text-purple-400 font-medium">@{trace.username}</span>
                      )}
                      <span className="text-xs px-2 py-0.5 bg-white/5 text-white/40 rounded-lg border border-white/10">
                        ID: {trace.userId}
                      </span>
                    </div>
                    <p className="text-xs text-white/30 font-medium flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-white/30" />
                      {new Date(trace.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {trace.forwardInfo?.isForwarded && (
                    <span className="text-xs px-3 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-xl font-bold flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5" />
                      Forwarded From: {trace.forwardInfo.chatTitle || trace.forwardInfo.fromName || "Telegram Channel"}
                    </span>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSingleMutation.mutate(trace.id)}
                    className="text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Extracted Custom Emoji IDs Section */}
              {trace.customEmojis && trace.customEmojis.length > 0 && (
                <div className="space-y-3 bg-yellow-500/[0.03] border border-yellow-500/20 p-4 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-yellow-400 flex items-center gap-2">
                      <Smile className="w-4 h-4" />
                      Extracted Premium Custom Emoji IDs ({trace.customEmojis.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {trace.customEmojis.map((emoji) => {
                      const tagCode = `<tg-emoji emoji-id="${emoji.id}">${emoji.char || "⭐"}</tg-emoji>`;
                      return (
                        <div
                          key={emoji.id}
                          className="flex items-center justify-between gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:border-yellow-500/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-lg bg-white/10 px-2 py-0.5 rounded-lg shrink-0">
                              {emoji.char || "⭐"}
                            </span>
                            <div className="truncate">
                              <p className="text-xs font-mono font-bold text-yellow-300 truncate">
                                ID: {emoji.id}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(emoji.id, `Emoji ID ${emoji.id}`, `id-${emoji.id}`)}
                              className="h-8 px-2.5 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 font-bold rounded-lg gap-1 border border-yellow-500/20"
                            >
                              {copiedId === `id-${emoji.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              Copy ID
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(tagCode, `<tg-emoji> tag for ${emoji.id}`, `tag-${emoji.id}`)}
                              className="h-8 px-2.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold rounded-lg gap-1 border border-purple-500/20"
                            >
                              {copiedId === `tag-${emoji.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code className="w-3.5 h-3.5" />}
                              Tag
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detected Formatting Badges */}
              {trace.entitySummary && trace.entitySummary.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-white/40 uppercase tracking-wider mr-2">
                    Detected Formats:
                  </span>
                  {trace.entitySummary.map((entity) => (
                    <span
                      key={entity.type}
                      className="text-xs px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-purple-300 font-semibold flex items-center gap-1.5"
                    >
                      <Tag className="w-3 h-3 text-purple-400" />
                      {entity.type} ({entity.count})
                    </span>
                  ))}
                </div>
              )}

              {/* Reconstructed HTML Code Box */}
              {trace.reconstructedHtml && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
                      <Code className="w-4 h-4 text-purple-400" />
                      Reconstructed Telegram HTML Code (Ready to Copy for ShopBot)
                    </span>

                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(trace.reconstructedHtml, "Telegram HTML Code", `html-${trace.id}`)}
                      className="h-8 px-3 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-xl font-bold gap-1.5"
                    >
                      {copiedId === `html-${trace.id}` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Telegram HTML
                        </>
                      )}
                    </Button>
                  </div>

                  <pre className="p-4 bg-black/40 border border-white/10 rounded-2xl overflow-x-auto text-xs font-mono text-purple-200 leading-relaxed select-all">
                    <code>{trace.reconstructedHtml}</code>
                  </pre>
                </div>
              )}

              {/* Raw Text Content */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-white/30 uppercase tracking-wider">
                  Raw Text / Caption:
                </span>
                <p className="text-sm text-white/80 bg-white/[0.01] p-3 rounded-xl border border-white/5 font-sans whitespace-pre-wrap">
                  {trace.rawText}
                </p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
