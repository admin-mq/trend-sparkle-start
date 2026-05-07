import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSavedBlueprints, type SavedBlueprint } from '@/hooks/useSavedBlueprints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Star,
  Trash2,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// ── Saved Blueprints list ────────────────────────────────────────────────
//
// The primary "My Drafts" surface. A row per blueprint the user has reached
// (auto-saved by TrendQuest after a successful generate-blueprint call).
// Click to expand and reveal the full concept / script / caption / hashtags
// — same payload the user saw in the workspace, just on a persistent page.
//
// We intentionally keep the row shape compact so a user with 30+ blueprints
// can scan them. The expensive content (script outline, full caption) only
// renders when expanded.

const PreviewCopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('Copied');
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-500" /> Copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" /> Copy
        </>
      )}
    </button>
  );
};

interface BlueprintCardProps {
  bp: SavedBlueprint;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

const BlueprintCard = ({
  bp,
  expanded,
  onToggleExpand,
  onToggleFavorite,
  onDelete,
}: BlueprintCardProps) => {
  const created = useMemo(
    () => formatDistanceToNow(new Date(bp.created_at), { addSuffix: true }),
    [bp.created_at]
  );
  const blueprint = bp.blueprint;

  return (
    <article
      className={`border border-border/40 rounded-xl bg-card/30 transition-shadow hover:shadow-card ${
        bp.is_favorite ? 'border-amber-500/30' : ''
      }`}
    >
      {/* Compact row — always visible */}
      <header
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        className="flex items-start justify-between gap-3 p-4 cursor-pointer"
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5 flex-shrink-0 text-muted-foreground">
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {bp.direction_title}
              </h3>
              {bp.trend_category && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/40">
                  {bp.trend_category}
                </span>
              )}
              {bp.region && (
                <span className="text-[10px] text-muted-foreground">· {bp.region}</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px] text-muted-foreground">
              <span>Trend: <span className="text-foreground/80">{bp.trend_name}</span></span>
              <span>·</span>
              <span>{created}</span>
              {bp.brand_name && (
                <>
                  <span>·</span>
                  <span>{bp.brand_name}</span>
                </>
              )}
            </div>
            {bp.direction_summary && !expanded && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {bp.direction_summary}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
            title={bp.is_favorite ? 'Unfavorite' : 'Favorite'}
            aria-label={bp.is_favorite ? 'Unfavorite blueprint' : 'Favorite blueprint'}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                bp.is_favorite ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'
              }`}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete blueprint "${bp.direction_title}"?`)) onDelete();
            }}
            className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
            title="Delete blueprint"
            aria-label="Delete blueprint"
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
          </button>
        </div>
      </header>

      {/* Expanded body — script + caption + hashtags */}
      {expanded && (
        <div className="border-t border-border/40 p-4 space-y-4 bg-secondary/10">
          {/* Concept */}
          {blueprint?.concept && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Concept
                </h4>
                <PreviewCopyButton text={blueprint.concept} />
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {blueprint.concept}
              </p>
            </section>
          )}

          {/* Script outline */}
          {blueprint?.script_outline && blueprint.script_outline.length > 0 && (
            <section>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Script outline
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/90">
                {blueprint.script_outline.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </section>
          )}

          {/* Full script (if generated) */}
          {blueprint?.full_script && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Full script
                </h4>
                <PreviewCopyButton text={blueprint.full_script} />
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {blueprint.full_script}
              </p>
            </section>
          )}

          {/* Visual brief (if image/carousel format) */}
          {blueprint?.visual_brief && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Visual brief
                </h4>
                <PreviewCopyButton text={blueprint.visual_brief} />
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {blueprint.visual_brief}
              </p>
            </section>
          )}

          {/* Caption */}
          {blueprint?.caption && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Caption
                </h4>
                <PreviewCopyButton
                  text={blueprint.long_caption || blueprint.caption}
                />
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {blueprint.long_caption || blueprint.caption}
              </p>
            </section>
          )}

          {/* Hashtags */}
          {blueprint?.recommended_hashtags && blueprint.recommended_hashtags.length > 0 && (
            <section>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Hash className="w-3 h-3" />
                Hashtags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {blueprint.recommended_hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] text-primary/80 font-medium px-2 py-0.5 rounded bg-primary/10 border border-primary/20"
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Extra tips */}
          {blueprint?.extra_tips && blueprint.extra_tips.length > 0 && (
            <section>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Tips
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-foreground/90">
                {blueprint.extra_tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </article>
  );
};

export const SavedBlueprintsList = () => {
  const navigate = useNavigate();
  const { blueprints, loading, error, toggleFavorite, removeBlueprint, refresh } =
    useSavedBlueprints();
  const [search, setSearch] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return blueprints.filter((b) => {
      if (favOnly && !b.is_favorite) return false;
      if (!q) return true;
      return (
        b.direction_title.toLowerCase().includes(q) ||
        b.trend_name.toLowerCase().includes(q) ||
        (b.direction_summary || '').toLowerCase().includes(q)
      );
    });
  }, [blueprints, search, favOnly]);

  const totalCount = blueprints.length;
  const favCount = blueprints.filter((b) => b.is_favorite).length;

  if (loading && blueprints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Loading your blueprints…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-red-500 mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Try again
        </Button>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border/40 rounded-xl">
        <FileText className="w-10 h-10 text-muted-foreground mb-4" />
        <h3 className="text-base font-semibold mb-1">No blueprints yet</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Head to Trend Quest, pick a trend, choose an idea, and reach the
          Blueprint stage — it'll auto-save here for you.
        </p>
        <Button onClick={() => navigate('/trend-quest')} className="gap-2">
          <ExternalLink className="w-4 h-4" />
          Open Trend Quest
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats + filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{totalCount}</span> blueprints
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-semibold text-foreground">{favCount}</span> favorited
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={favOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFavOnly((v) => !v)}
            className="gap-1 h-8"
          >
            <Star className={`w-3.5 h-3.5 ${favOnly ? 'fill-current' : ''}`} />
            Favorites
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search blueprints, trends, or ideas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Blueprint list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No blueprints match your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((bp) => (
            <BlueprintCard
              key={bp.id}
              bp={bp}
              expanded={expanded.has(bp.id)}
              onToggleExpand={() => toggleExpand(bp.id)}
              onToggleFavorite={async () => {
                await toggleFavorite(bp.id, !bp.is_favorite);
              }}
              onDelete={async () => {
                const result = await removeBlueprint(bp.id);
                if (result.ok) toast.success('Blueprint deleted');
                else toast.error('Delete failed');
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
