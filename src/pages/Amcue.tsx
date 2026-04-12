import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain, Send, Loader2, BookOpen, Sparkles, AlertCircle, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INTRO_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hey — I'm Amcue, your AI CMO.\n\nI have access to your SEO data, site performance, and everything you tell me about your business. Over time I'll build a complete picture of your brand so I can give you real strategic direction — not generic advice.\n\nTo start: what's the one marketing challenge you most want to crack right now?",
};

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 w-full", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary/20 text-primary"
            : "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm",
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-border text-foreground rounded-tl-sm",
        )}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const Amcue = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([INTRO_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);

    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      // Build history excluding the intro message (it's not real conversation history)
      const history = next
        .slice(1) // skip intro
        .slice(-20) // last 20 messages max
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error: fnErr } = await supabase.functions.invoke("amcue-chat", {
        body: {
          message: text,
          conversationHistory: history.slice(0, -1), // exclude the message we just added
        },
      });

      if (fnErr) throw new Error(fnErr.message || "Edge function error");
      if (data?.error) throw new Error(data.error);

      const reply = data?.reply;
      if (!reply) throw new Error("No response received");

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      console.error("[amcue] error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      // Remove the user message optimistically added on failure
      setMessages(messages);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]"> {/* 57px = top bar height */}

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight">Amcue</h1>
            <p className="text-[10px] text-muted-foreground">Your AI Chief Marketing Officer</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/amcue/brand-profile")}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Brand Profile
        </Button>
      </div>

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
              <Brain className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Amcue is thinking…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
      <div className="flex-shrink-0 border-t border-border bg-card/60 backdrop-blur-sm px-4 py-3">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <Textarea
            ref={textareaRef}
            placeholder="Ask Amcue anything about your marketing strategy…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 resize-none min-h-[42px] max-h-[160px] text-sm py-2.5 leading-relaxed"
            style={{ overflowY: input.split("\n").length > 4 ? "auto" : "hidden" }}
          />
          <Button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-[42px] w-[42px] flex-shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          Enter to send · Shift+Enter for new line · Amcue remembers your brand across sessions
        </p>
      </div>
    </div>
  );
};

export default Amcue;
