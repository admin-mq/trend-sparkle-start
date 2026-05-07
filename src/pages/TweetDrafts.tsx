import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTweetDrafts } from '@/hooks/useTweetDrafts';
import { useSavedBlueprints } from '@/hooks/useSavedBlueprints';
import { SavedBlueprintsList } from '@/components/SavedBlueprintsList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Twitter,
  Copy,
  Check,
  Star,
  Trash2,
  Search,
  Heart,
  ExternalLink,
  Sparkles,
  RotateCcw,
  Send,
  AlertTriangle,
  Filter,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SavedTweetDraft, DraftGeneration } from '@/types/trends';
import { formatDistanceToNow } from 'date-fns';

// ── Angle color map (matches TwitterContent.tsx) ─────────────────────────────
const ANGLE_COLORS: Record<string, string> = {
  'Hot take':    'bg-red-500/15 text-red-500 border-red-500/30',
  'Humour':      'bg-amber-500/15 text-amber-500 border-amber-500/30',
  'Educational': 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  'Opinion':     'bg-purple-500/15 text-purple-500 border-purple-500/30',
  'Relatable':   'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
};

function getAngleColor(angle: string | null) {
  if (!angle) return 'bg-secondary text-muted-foreground border-border';
  for (const [key, val] of Object.entries(ANGLE_COLORS)) {
    if (angle.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return 'bg-secondary text-muted-foreground border-border';
}

// ── Char bar (compact, reused inline) ────────────────────────────────────────
const CharBar = ({ count, limit }: { count: number; limit: number }) => {
  const pct = Math.min(100, (count / limit) * 100);
  const remaining = limit - count;
  const isOver = count > limit;
  const isWarning = !isOver && remaining <= Math.round(limit * 0.1);
  const barColor = isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-muted-foreground';
  return (
    <div className="space-y-1">
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`text-[10px] font-medium text-right ${textColor}`}>
        {isOver ? `${Math.abs(remaining)} over limit` : `${remaining} chars left`}
      </div>
    </div>
  );
};

// ── Single draft card ────────────────────────────────────────────────────────
interface DraftCardProps {
  draft: SavedTweetDraft;
  onCopy: (d: SavedTweetDraft) => void;
  onToggleFavorite: (d: SavedTweetDraft) => void;
  onTogglePosted: (d: SavedTweetDraft) => void;
  onDelete: (d: SavedTweetDraft) => void;
  copiedId: string | null;
}

const DraftCard = ({
  draft,
  onCopy,
  onToggleFavorite,
  onTogglePosted,
  onDelete,
  copiedId,
}: DraftCardProps) => {
  const isCopied = copiedId === draft.id;
  const isPosted = !!draft.posted_at;

  return (
    <div
      className={`post-card p-4 ${draft.over_limit ? 'border-red-500/30 bg-red-500/5' : ''} ${
        isPosted ? 'opacity-75' : ''
      }`}
    >
      {/* Header: angle + actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getAngleColor(
              draft.angle
            )}`}
          >
            {draft.angle || `Draft ${draft.draft_id}`}
          </span>
          {isPosted && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              Posted
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleFavorite(draft)}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
            title={draft.is_favorite ? 'Unfavorite' : 'Favorite'}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                draft.is_favorite ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'
              }`}
            />
          </button>
          <button
            onClick={() => onCopy(draft)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={() => onTogglePosted(draft)}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
            title={isPosted ? 'Mark as not posted' : 'Mark as posted'}
          >
            <Send
              className={`w-3.5 h-3.5 ${isPosted ? 'text-emerald-500' : 'text-muted-foreground'}`}
            />
          </button>
          <button
            onClick={() => onDelete(draft)}
            className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
            title="Delete draft"
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* Tweet body */}
      <div className="bg-secondary/30 rounded-lg p-3 border border-border/40">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-[system-ui]">
          {draft.tweet_text}
        </p>
      </div>

      {/* Char meter */}
      <div className="mt-3">
        <CharBar count={draft.char_count} limit={draft.char_limit} />
      </div>

      {/* Over-limit warning */}
      {draft.over_limit && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
          <AlertTriangle className="w-3.5 h-3.5" />
          Exceeds the character limit — trim before posting
        </div>
      )}

      {/* Hashtags */}
      {draft.hashtags?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {draft.hashtags.map((tag) => (
            <span key={tag} className="text-[11px] text-primary/70 font-medium">
              {tag.startsWith('#') ? tag : `#${tag}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ── One generation card (groups its 3 drafts) ────────────────────────────────
interface GenerationCardProps {
  generation: DraftGeneration;
  copiedId: string | null;
  onCopy: (d: SavedTweetDraft) => void;
  onToggleFavorite: (d: SavedTweetDraft) => void;
  onTogglePosted: (d: SavedTweetDraft) => void;
  onDelete: (d: SavedTweetDraft) => void;
  onDeleteGeneration: (g: DraftGeneration) => void;
  onRegenerate: (g: DraftGeneration) => void;
}

const GenerationCard = ({
  generation,
  copiedId,
  onCopy,
  onToggleFavorite,
  onTogglePosted,
  onDelete,
  onDeleteGeneration,
  onRegenerate,
}: GenerationCardProps) => {
  const created = useMemo(
    () => formatDistanceToNow(new Date(generation.created_at), { addSuffix: true }),
    [generation.created_at]
  );
  const sourceLabel =
    generation.live_context_source === 'live'
      ? 'Live context'
      : generation.live_context_source === 'stale'
      ? 'Weak context'
      : 'No live context';
  const sourceColor =
    generation.live_context_source === 'live'
      ? 'text-emerald-500'
      : generation.live_context_source === 'stale'
      ? 'text-amber-500'
      : 'text-muted-foreground';

  return (
    <section className="border border-border/40 rounded-xl p-4 bg-card/30 space-y-4">
      {/* Generation header */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Twitter className="w-4 h-4 text-[#1DA1F2]" />
            <h3 className="text-sm font-semibold text-foreground">{generation.trend_name}</h3>
            {generation.trend_category && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/40">
                {generation.trend_category}
              </span>
            )}
            {generation.region && (
              <span className="text-[10px] text-muted-foreground">· {generation.region}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
            <span>{created}</span>
            {generation.brand_name && (
              <>
                <span>·</span>
                <span>{generation.brand_name}</span>
              </>
            )}
            <span>·</span>
            <span className={sourceColor}>{sourceLabel}</span>
            {generation.topic_angle && (
              <>
                <span>·</span>
                <span>angle: {generation.topic_angle}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRegenerate(generation)}
            className="h-7 gap-1.5 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Regenerate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteGeneration(generation)}
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-red-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete all
          </Button>
        </div>
      </header>

      {/* Drafts grid */}
      <div className="grid gap-3 md:grid-cols-3">
        {generation.drafts.map((d) => (
          <DraftCard
            key={d.id}
            draft={d}
            copiedId={copiedId}
            onCopy={onCopy}
            onToggleFavorite={onToggleFavorite}
            onTogglePosted={onTogglePosted}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
};

// ── Tweet drafts inner panel ─────────────────────────────────────────────
// Pulled out of the previous default export so the page can host both the
// Blueprints tab (primary) and the original tweet drafts grid (secondary).
const TweetDraftsPanel = () => {
  const navigate = useNavigate();
  const {
    generations,
    drafts,
    loading,
    error,
    refetch,
    toggleFavorite,
    markPosted,
    deleteDraft,
    deleteGeneration,
  } = useTweetDrafts();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'unposted' | 'posted'>('all');
  const [trendFilter, setTrendFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const trendOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of drafts) set.add(d.trend_name);
    return ['all', ...Array.from(set).sort()];
  }, [drafts]);

  // Filter generations: a generation is included if ANY of its drafts match.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return generations
      .map((g) => ({
        ...g,
        drafts: g.drafts.filter((d) => {
          if (q && !d.tweet_text.toLowerCase().includes(q) && !g.trend_name.toLowerCase().includes(q)) {
            return false;
          }
          if (filter === 'favorites' && !d.is_favorite) return false;
          if (filter === 'unposted' && d.posted_at) return false;
          if (filter === 'posted' && !d.posted_at) return false;
          return true;
        }),
      }))
      .filter((g) => {
        if (trendFilter !== 'all' && g.trend_name !== trendFilter) return false;
        return g.drafts.length > 0;
      });
  }, [generations, search, filter, trendFilter]);

  // Counts for header badges
  const totalDrafts = drafts.length;
  const favoritesCount = drafts.filter((d) => d.is_favorite).length;
  const postedCount = drafts.filter((d) => d.posted_at).length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCopy = async (d: SavedTweetDraft) => {
    await navigator.clipboard.writeText(d.tweet_text);
    setCopiedId(d.id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleFavorite = async (d: SavedTweetDraft) => {
    const result = await toggleFavorite(d.id, !d.is_favorite);
    if (!result.success) toast.error(result.error || 'Could not update favorite');
  };

  const handleTogglePosted = async (d: SavedTweetDraft) => {
    const next = !d.posted_at;
    const result = await markPosted(d.id, next);
    if (result.success) {
      toast.success(next ? 'Marked as posted' : 'Unmarked as posted');
    } else {
      toast.error(result.error || 'Could not update posted status');
    }
  };

  const handleDelete = async (d: SavedTweetDraft) => {
    const result = await deleteDraft(d.id);
    if (result.success) toast.success('Draft deleted');
    else toast.error(result.error || 'Delete failed');
  };

  const handleDeleteGeneration = async (g: DraftGeneration) => {
    if (!confirm(`Delete all ${g.drafts.length} drafts for "${g.trend_name}"?`)) return;
    const result = await deleteGeneration(g.generation_id);
    if (result.success) toast.success('Generation deleted');
    else toast.error(result.error || 'Delete failed');
  };

  const handleRegenerate = (g: DraftGeneration) => {
    // Hand off to TrendQuest so it can refetch / regenerate. We pass the
    // trend name + region as URL state and let TrendQuest decide how to
    // pre-populate inputs.
    navigate('/trend-quest', {
      state: { regenerateTrend: g.trend_name, region: g.region },
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg border border-border/40 bg-card/30 p-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Total drafts</div>
          <div className="text-xl font-semibold mt-1">{totalDrafts}</div>
        </div>
        <div className="rounded-lg border border-border/40 bg-card/30 p-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-500" /> Favorites
          </div>
          <div className="text-xl font-semibold mt-1">{favoritesCount}</div>
        </div>
        <div className="rounded-lg border border-border/40 bg-card/30 p-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Send className="w-3 h-3 text-emerald-500" /> Posted
          </div>
          <div className="text-xl font-semibold mt-1">{postedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search drafts or trends…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All drafts</SelectItem>
            <SelectItem value="favorites">Favorites only</SelectItem>
            <SelectItem value="unposted">Unposted</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={trendFilter} onValueChange={setTrendFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {trendOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t === 'all' ? 'All trends' : t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3" />
          <p className="text-sm text-muted-foreground">Loading your drafts…</p>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch}>
            Try again
          </Button>
        </div>
      ) : totalDrafts === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border/40 rounded-xl">
          <Heart className="w-10 h-10 text-muted-foreground mb-4" />
          <h3 className="text-base font-semibold mb-1">No drafts yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Head to Trend Quest, pick a Twitter/X trend, and click "Generate tweets" — your drafts
            will land here automatically.
          </p>
          <Button onClick={() => navigate('/trend-quest')} className="gap-2">
            <Sparkles className="w-4 h-4" />
            Open Trend Quest
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No drafts match your filters.
        </div>
      ) : (
        <div className="space-y-5">
          {filtered.map((g) => (
            <GenerationCard
              key={g.generation_id}
              generation={g}
              copiedId={copiedId}
              onCopy={handleCopy}
              onToggleFavorite={handleToggleFavorite}
              onTogglePosted={handleTogglePosted}
              onDelete={handleDelete}
              onDeleteGeneration={handleDeleteGeneration}
              onRegenerate={handleRegenerate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────
//
// The "My Drafts" surface in the sidebar. Two tabs:
//   • Blueprints (primary) — auto-saved Execution Blueprints from
//     Trend Quest. The user reaches Blueprint stage → it lands here.
//     This is the headline thing — real, structured drafts of full
//     posts, with caption + script + hashtags.
//   • Tweet drafts (secondary) — the 3-up tweet variants generated
//     from Twitter / Social Pulse trends. Same data we always had,
//     just no longer the only thing on this page.
export default function TweetDrafts() {
  const navigate = useNavigate();
  // We use these counters in the tab labels — the user should be able
  // to see "Blueprints (3)" / "Tweet drafts (12)" without clicking through.
  const { blueprints } = useSavedBlueprints();
  const { drafts: tweetDraftsList } = useTweetDrafts();
  const blueprintsCount = blueprints.length;
  const tweetDraftsCount = tweetDraftsList.length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            My Drafts
          </h1>
          <p className="text-sm text-muted-foreground">
            Your auto-saved Execution Blueprints and tweet drafts. Persist across sessions.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/trend-quest')}
          className="gap-2"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Trend Quest
        </Button>
      </div>

      <Tabs defaultValue="blueprints" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="blueprints" className="gap-2">
            <FileText className="w-3.5 h-3.5" />
            Blueprints
            {blueprintsCount > 0 && (
              <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                {blueprintsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tweet-drafts" className="gap-2">
            <Twitter className="w-3.5 h-3.5" />
            Tweet drafts
            {tweetDraftsCount > 0 && (
              <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                {tweetDraftsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blueprints" className="m-0">
          <SavedBlueprintsList />
        </TabsContent>

        <TabsContent value="tweet-drafts" className="m-0">
          <TweetDraftsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
