import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, X, Plus, Send, MessageSquare, ChevronLeft, Brain, Pencil, Check, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

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

interface Nudge {
  headline: string;
  body: string;
  cta: string;
}

const NUDGE_CACHE_KEY = "mq_amcue_nudge_v1";
const NUDGE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface PersonaForm {
  niche: string;
  sub_niches: string;
  content_style: string;
  audience_type: string;
  platform_focus: string;
  is_faceless: boolean;
  location_normalized: string;
}

const CREATOR_STARTER_PROMPTS = [
  "What's the best content strategy for my niche right now?",
  "Review my recent hashtag analysis — what would you change?",
  "Which trends from my watchlist should I act on this week?",
  "How do I grow faster on Instagram as a creator?",
];

const BRAND_STARTER_PROMPTS = [
  "What's my biggest SEO opportunity right now?",
  "How can I improve my Google ranking?",
  "What trends should my brand be using?",
  "Give me a 30-day marketing plan",
];

const PLATFORM_OPTIONS = ["Instagram", "TikTok", "YouTube", "LinkedIn", "Pinterest"];

function PersonaField({
  label,
  value,
  hint,
  onSave,
}: {
  label: string;
  value: string;
  hint?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    onSave(draft.trim());
    setEditing(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {!editing && (
          <button onClick={() => { setDraft(value); setEditing(true); }} className="text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 bg-secondary border border-primary/30 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={commit} className="text-primary hover:text-primary/80 transition-colors">
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <p className={cn("text-xs", value ? "text-foreground" : "text-muted-foreground italic")}>
          {value || (hint ?? "Not set — click edit to add")}
        </p>
      )}
    </div>
  );
}

export function AmcueChat() {
  const { user, session, profile } = useAuthContext();
  const isCreator = profile?.account_type === "creator";

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history" | "persona">("chat");

  // Proactive nudge
  const [nudge, setNudge] = useState<Nudge | null>(() => {
    try {
      const raw = sessionStorage.getItem(NUDGE_CACHE_KEY);
      if (!raw) return null;
      const { nudge: cached, generatedAt } = JSON.parse(raw);
      if (Date.now() - generatedAt > NUDGE_TTL_MS) return null;
      return cached ?? null;
    } catch { return null; }
  });
  const [nudgeSeen, setNudgeSeen] = useState(false);
  const nudgeFetchedRef = useRef(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingPersona, setSavingPersona] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Local persona form — initialised from profile, updated on save
  const [persona, setPersona] = useState<PersonaForm>(() => {
    const p = profile?.creator_persona;
    return {
      niche: p?.niche ?? profile?.industry ?? "",
      sub_niches: Array.isArray(p?.sub_niches) ? p.sub_niches.join(", ") : "",
      content_style: p?.content_style ?? "",
      audience_type: p?.audience_type ?? "",
      platform_focus: Array.isArray(p?.platform_focus) ? p.platform_focus.join(", ") : "",
      is_faceless: p?.is_faceless ?? false,
      location_normalized: p?.location_normalized ?? profile?.geography ?? profile?.location ?? "",
    };
  });

  // Re-sync persona form when profile loads/changes
  useEffect(() => {
    const p = profile?.creator_persona;
    setPersona({
      niche: p?.niche ?? profile?.industry ?? "",
      sub_niches: Array.isArray(p?.sub_niches) ? p.sub_niches.join(", ") : "",
      content_style: p?.content_style ?? "",
      audience_type: p?.audience_type ?? "",
      platform_focus: Array.isArray(p?.platform_focus) ? p.platform_focus.join(", ") : "",
      is_faceless: p?.is_faceless ?? false,
      location_normalized: p?.location_normalized ?? profile?.geography ?? profile?.location ?? "",
    });
  }, [profile]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (open && view === "chat" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, view]);

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

  // Fetch nudge once per session when panel first opens (creators only)
  useEffect(() => {
    if (!open || !user || !isCreator || nudgeFetchedRef.current) return;

    // Check if we already have a fresh cached nudge
    try {
      const raw = sessionStorage.getItem(NUDGE_CACHE_KEY);
      if (raw) {
        const { generatedAt } = JSON.parse(raw);
        if (Date.now() - generatedAt < NUDGE_TTL_MS) {
          nudgeFetchedRef.current = true;
          return;
        }
      }
    } catch { /* ignore */ }

    nudgeFetchedRef.current = true;
    supabase.functions.invoke("amcue-nudge").then(({ data }) => {
      const incoming = data?.nudge ?? null;
      setNudge(incoming);
      try {
        sessionStorage.setItem(NUDGE_CACHE_KEY, JSON.stringify({ nudge: incoming, generatedAt: Date.now() }));
      } catch { /* ignore */ }
    }).catch(() => { /* non-critical, fail silently */ });
  }, [open, user, isCreator]);

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from("amcue_messages")
      .select("id, role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data as Message[]);
      setConversationId(convId);
      setView("chat");
    }
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setView("chat");
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading || !session) return;

    setInput("");
    const userMsg: Message = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("amcue-chat", {
        body: {
          conversation_id: conversationId || null,
          message: msg,
          context_page: window.location.pathname,
        },
      });

      if (error) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I ran into an error. Please try again." }]);
        return;
      }

      if (data.conversation_id) setConversationId(data.conversation_id);
      if (!conversationId && data.conversation_id) loadConversations();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || data.content || "No response received." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Please check your connection and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const actOnNudge = (cta: string) => {
    setNudgeSeen(true);
    sendMessage(cta);
  };

  const updatePersonaField = (field: keyof PersonaForm, value: string | boolean) => {
    setPersona((prev) => ({ ...prev, [field]: value }));
  };

  const savePersona = async () => {
    if (!user) return;
    setSavingPersona(true);
    try {
      const updated = {
        ...(profile?.creator_persona ?? {}),
        niche: persona.niche,
        sub_niches: persona.sub_niches.split(",").map((s) => s.trim()).filter(Boolean),
        content_style: persona.content_style,
        audience_type: persona.audience_type,
        platform_focus: persona.platform_focus.split(",").map((s) => s.trim()).filter(Boolean),
        is_faceless: persona.is_faceless,
        location_normalized: persona.location_normalized,
      };
      const { error } = await supabase
        .from("user_profiles")
        .update({ creator_persona: updated })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Profile saved — Amcue will use this in your next conversation.");
    } catch {
      toast.error("Couldn't save profile. Please try again.");
    } finally {
      setSavingPersona(false);
    }
  };

  const personaIsEmpty = !persona.niche && !persona.content_style && !persona.audience_type;
  const starterPrompts = isCreator ? CREATOR_STARTER_PROMPTS : BRAND_STARTER_PROMPTS;

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
        {/* Badge dot — shows when there's an unseen nudge */}
        {nudge && !nudgeSeen && !open && (
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-background animate-pulse" />
        )}
        <span className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
          {nudge && !nudgeSeen ? "Amcue noticed something" : "Amcue"}
        </span>
      </button>

      {/* Overlay */}
      {open && <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />}

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
            {view !== "chat" && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView("chat")}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[#7C3AED] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground leading-tight">Amcue</h2>
              <p className="text-[10px] text-muted-foreground">
                {view === "persona" ? "Your creator profile" : view === "history" ? "Conversation history" : "Your AI CMO"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isCreator && (
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", view === "persona" && "bg-primary/10 text-primary")}
                onClick={() => setView(view === "persona" ? "chat" : "persona")}
                title="My creator profile"
              >
                <Brain className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", view === "history" && "bg-primary/10 text-primary")}
              onClick={() => setView(view === "history" ? "chat" : "history")}
              title="Conversation history"
            >
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

        {/* ── History view ────────────────────────────────────────────────────── */}
        {view === "history" && (
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
        )}

        {/* ── Persona view (creator only) ──────────────────────────────────────── */}
        {view === "persona" && isCreator && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-5">

              {/* Header block */}
              <div className="text-center space-y-1.5 pb-1">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">What Amcue knows about you</h3>
                <p className="text-xs text-muted-foreground leading-snug">
                  Amcue builds this from your chats and platform activity. Correct anything that's off — better info means sharper advice.
                </p>
              </div>

              {/* Empty state nudge */}
              {personaIsEmpty && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-snug">
                    Amcue doesn't know much about you yet. Fill in a few fields below or just start chatting — it'll learn as you go.
                  </p>
                </div>
              )}

              {/* Profile summary (from creator_persona.summary) */}
              {profile?.creator_persona?.summary && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/15 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Amcue's read on you</p>
                  <p className="text-xs text-muted-foreground leading-snug">{profile.creator_persona.summary}</p>
                </div>
              )}

              {/* Editable fields */}
              <div className="space-y-4">
                <PersonaField
                  label="Niche"
                  value={persona.niche}
                  hint="e.g. fashion, fitness, finance, food"
                  onSave={(v) => updatePersonaField("niche", v)}
                />
                <PersonaField
                  label="Sub-niches"
                  value={persona.sub_niches}
                  hint="e.g. streetwear, sustainable fashion — comma-separated"
                  onSave={(v) => updatePersonaField("sub_niches", v)}
                />
                <PersonaField
                  label="Content Style"
                  value={persona.content_style}
                  hint="e.g. educational, entertaining, aspirational, raw & honest"
                  onSave={(v) => updatePersonaField("content_style", v)}
                />
                <PersonaField
                  label="Audience Type"
                  value={persona.audience_type}
                  hint="e.g. Gen Z women interested in fashion, 25–35 fitness enthusiasts"
                  onSave={(v) => updatePersonaField("audience_type", v)}
                />
                <PersonaField
                  label="Location"
                  value={persona.location_normalized}
                  hint="e.g. United States, UK, India"
                  onSave={(v) => updatePersonaField("location_normalized", v)}
                />

                {/* Platform focus */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Platforms</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PLATFORM_OPTIONS.map((p) => {
                      const active = persona.platform_focus.toLowerCase().includes(p.toLowerCase());
                      return (
                        <button
                          key={p}
                          onClick={() => {
                            const current = persona.platform_focus
                              .split(",").map((s) => s.trim()).filter(Boolean);
                            const next = active
                              ? current.filter((s) => s.toLowerCase() !== p.toLowerCase())
                              : [...current, p];
                            updatePersonaField("platform_focus", next.join(", "));
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            active
                              ? "bg-primary/15 text-primary border-primary/30"
                              : "bg-secondary text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                          )}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Faceless toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Faceless Creator</span>
                    <p className="text-xs text-muted-foreground">Content doesn't show your face</p>
                  </div>
                  <button
                    onClick={() => updatePersonaField("is_faceless", !persona.is_faceless)}
                    className={cn(
                      "relative w-9 h-5 rounded-full transition-colors",
                      persona.is_faceless ? "bg-primary" : "bg-secondary border border-border"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      persona.is_faceless ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </button>
                </div>
              </div>

              {/* Save button */}
              <Button
                onClick={savePersona}
                disabled={savingPersona}
                className="w-full bg-gradient-to-r from-[hsl(var(--primary))] to-[#7C3AED] text-white hover:opacity-90"
                size="sm"
              >
                {savingPersona ? "Saving…" : "Save profile"}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center pb-2">
                Amcue also builds this automatically from your chats over time.
              </p>
            </div>
          </div>
        )}

        {/* ── Chat view ────────────────────────────────────────────────────────── */}
        {view === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-6">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[#7C3AED] flex items-center justify-center mx-auto shadow-lg shadow-purple-500/20">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {isCreator ? "Your personal CMO is ready." : "How can I help your marketing?"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {isCreator
                        ? "Ask me about your content strategy, trends, or what to post next."
                        : "Ask me anything about SEO, strategy, or growth"
                      }
                    </p>
                  </div>
                  {/* Proactive nudge card */}
                  {nudge && !nudgeSeen && (
                    <div className="w-full max-w-[320px] rounded-xl border border-amber-500/25 bg-amber-500/6 overflow-hidden">
                      <div className="px-3 pt-3 pb-2 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">Amcue noticed</span>
                        </div>
                        <p className="text-xs font-semibold text-foreground leading-snug">{nudge.headline}</p>
                        <p className="text-xs text-muted-foreground leading-snug">{nudge.body}</p>
                      </div>
                      <button
                        onClick={() => actOnNudge(nudge.cta)}
                        className="w-full flex items-center justify-between px-3 py-2 border-t border-amber-500/20 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors font-medium"
                      >
                        <span className="truncate pr-2">{nudge.cta}</span>
                        <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                      </button>
                    </div>
                  )}

                  {/* Creator persona nudge for empty profiles */}
                  {isCreator && personaIsEmpty && (
                    <button
                      onClick={() => setView("persona")}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-primary/20 bg-primary/5 text-xs text-primary hover:bg-primary/10 transition-colors w-full max-w-[320px]"
                    >
                      <Brain className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-left">Tell Amcue about yourself for better advice</span>
                    </button>
                  )}
                  <div className="grid gap-2 w-full max-w-[320px]">
                    {starterPrompts.map((prompt) => (
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
                  placeholder={isCreator ? "Ask your CMO anything..." : "Ask me anything..."}
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
              <p className="text-[9px] text-muted-foreground text-center mt-2">
                {isCreator ? "Amcue learns your style across every session" : "Amcue remembers your brand across sessions"}
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
