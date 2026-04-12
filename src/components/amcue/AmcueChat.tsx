import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, X, Plus, Send, MessageSquare, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

const STARTER_PROMPTS = [
  "What's my biggest SEO opportunity right now?",
  "How can I improve my Google ranking?",
  "What trends should my brand be using?",
  "Give me a 30-day marketing plan",
];

export function AmcueChat() {
  const { user, session } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("amcue_conversations")
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (data) setConversations(data);
  }, [user]);

  useEffect(() => {
    if (open && user) loadConversations();
  }, [open, user, loadConversations]);

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from("amcue_messages")
      .select("id, role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data as Message[]);
      setConversationId(convId);
      setShowHistory(false);
    }
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading || !session) return;

    setInput("");
    const userMsg: Message = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('amcue-chat', {
        body: {
          conversation_id: conversationId || null,
          message: msg,
          context_page: window.location.pathname,
        },
      });

      if (error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I ran into an error. Please try again.',
        }]);
        return;
      }

      const reply = data.reply;
      if (data.conversation_id) setConversationId(data.conversation_id);

      if (!conversationId && data.conversation_id) {
        loadConversations();
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply || data.content || "No response received." },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Please check your connection and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 group",
          "w-14 h-14 rounded-full",
          "bg-gradient-to-br from-[hsl(var(--primary))] to-[#7C3AED]",
          "shadow-lg shadow-purple-500/25",
          "flex items-center justify-center",
          "hover:scale-110 transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-background",
          open && "hidden"
        )}
        aria-label="Open Amcue AI assistant"
      >
        <Sparkles className="w-6 h-6 text-white" />
        <span className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
          Amcue
        </span>
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[400px] max-w-full",
          "bg-card border-l border-border",
          "flex flex-col",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            {showHistory && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(false)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[#7C3AED] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground leading-tight">Amcue</h2>
              <p className="text-[10px] text-muted-foreground">Your AI CMO</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(!showHistory)} title="Conversation history">
              <MessageSquare className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startNewConversation} title="New conversation">
              <Plus className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* History sidebar */}
        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <p className="text-xs text-muted-foreground px-2 pb-2">Recent Conversations</p>
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground px-2">No conversations yet</p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => loadMessages(c.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
                  c.id === conversationId
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <p className="truncate font-medium text-xs">{c.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(c.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Chat area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-6">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[#7C3AED] flex items-center justify-center mx-auto shadow-lg shadow-purple-500/20">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">How can I help your marketing?</h3>
                    <p className="text-xs text-muted-foreground">Ask me anything about SEO, strategy, or growth</p>
                  </div>
                  <div className="grid gap-2 w-full max-w-[320px]">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendMessage(prompt)}
                        className="text-left px-3 py-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[#7C3AED] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-white">A</span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-secondary text-foreground rounded-bl-sm"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_li]:mb-0.5 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[#7C3AED] flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-white">A</span>
                  </div>
                  <div className="bg-secondary rounded-xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Ask your CMO anything..."
                  disabled={loading}
                  className="flex-1 bg-secondary border-0 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  size="icon"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="h-10 w-10 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[#7C3AED] hover:opacity-90"
                >
                  <Send className="w-4 h-4 text-white" />
                </Button>
              </div>
              <p className="text-[9px] text-muted-foreground text-center mt-2">Amcue remembers your brand across sessions</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
