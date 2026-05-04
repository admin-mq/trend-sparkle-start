// ─────────────────────────────────────────────────────────────────────────────
// Per-platform format intelligence (Tier 2 / Fix #9).
//
// `content_format` alone ("video", "carousel", "static") is not enough.
// A 60-second TikTok and a 60-second YouTube Short are filmed completely
// differently: TikTok wants raw POV with a hook in the first 1.5s; a Short
// wants a hook-first edit with rapid cuts; a Reel wants a more polished
// cinematic feel. Today's prompts squash all of this into one generic
// "make video content" instruction — wasting the platform-specific edge.
//
// This module captures the format conventions per (platform, content_format)
// pair and returns a compact spec block that the prompt builder can paste
// directly into the system prompt as concrete constraints.
//
// Why a const map and not a config table:
//   - This is reference data, slowly-changing. A code-review-gated PR is
//     the right way to update it (so we have an audit trail of what
//     conventions were active when which content was generated).
//   - No DB round-trip per generate call.
//   - Easy to A/B test by branching the file.
//
// We can graduate to a DB-backed table later if/when:
//   1. Brands want to override conventions for their account, or
//   2. We A/B test different conventions live without redeploys.
// ─────────────────────────────────────────────────────────────────────────────

export type Platform =
  | 'TikTok'
  | 'Instagram'
  | 'YouTube'
  | 'Twitter'
  | 'LinkedIn';

export type ContentFormat =
  | 'video'
  | 'short_video'
  | 'long_video'
  | 'reel'
  | 'short'
  | 'carousel'
  | 'static'
  | 'image'
  | 'thread'
  | 'text';

export interface FormatSpec {
  /** Native length window the platform's algorithm rewards. */
  duration_window: string;
  /** Aspect ratio convention. */
  aspect: string;
  /** Where the hook must land. */
  hook_window: string;
  /** Pace, edit style, vibe. */
  edit_style: string;
  /** Audio convention. */
  audio: string;
  /** Caption / text overlay conventions. */
  text_overlays: string;
  /** Caption (description) conventions for the post itself. */
  post_caption: string;
  /** What the algorithm explicitly rewards / penalises. */
  algorithm_notes: string;
  /** One-line summary the prompt builder can put at the top of the spec. */
  one_liner: string;
}

// Compact registry. Keyed by `${platform}:${normalizedFormat}` so the
// resolver can fall back from a specific format to a platform default.
const REGISTRY: Record<string, FormatSpec> = {
  // ── TikTok ──────────────────────────────────────────────────────────────
  'TikTok:video': {
    one_liner: 'TikTok native short — raw POV, ultra-fast hook, trending audio.',
    duration_window: '7–15s sweet spot, 21–34s for narrative builds. Avoid 60s+ unless mid-roll cliffhanger justifies it.',
    aspect: '9:16 vertical, full-bleed.',
    hook_window: 'Visual + verbal hook in the first 1.5s. The first frame must answer "why am I watching this".',
    edit_style: 'Cuts every 1–3s. Native handheld is preferred over polished. Whip pans, jump cuts, on-screen captions punching in on stressed words.',
    audio: 'Trending audio is non-negotiable when one fits. Voiceovers must feel POV — first-person, casual, no broadcaster cadence.',
    text_overlays: 'Burned-in captions essential (60% watch on mute). Use the TikTok-default sans typeface look. Place text in the upper-mid third (lower third gets covered by UI).',
    post_caption: '120–200 chars. Tease + question to invite comments. 3–5 hashtags max, mix of broad + niche.',
    algorithm_notes: 'Watch-through rate is the dominant signal. Loop-friendly endings boost replay count. Saves and shares > likes. Comments are the engagement currency — design for reply-bait.',
  },

  // ── Instagram Reels ─────────────────────────────────────────────────────
  'Instagram:reel': {
    one_liner: 'Instagram Reel — cinematic-leaning short, polished edit, hook in 2s.',
    duration_window: '15–30s ideal. 30–60s only when narrative arc earns it.',
    aspect: '9:16 vertical.',
    hook_window: 'Hook by 2s. Reels viewers swipe faster than TikTok — front-load payoff.',
    edit_style: 'Slightly more polished than TikTok. Beat-matched cuts on trending audio, cinematic transitions (whip pans, match cuts) welcome. Colour grade matters.',
    audio: 'Use IG-trending audio (different chart than TikTok). Original audio works for educational/founder content.',
    text_overlays: 'Sans-serif overlays with a slight outline/shadow for readability over varied footage. Keep text inside the safe zone (pie chart of safe zone: avoid bottom 18%).',
    post_caption: '125 chars before "more" cutoff. First line is a hook in itself. 3–5 hashtags integrated or in first comment.',
    algorithm_notes: 'Saves + sends are the highest-weighted signals. Profile visits from a Reel = strong follow conversion. Avoid covered-up text in lower third.',
  },
  'Instagram:video': {
    one_liner: 'Instagram Reel (default video) — see Reel spec.',
    duration_window: '15–30s ideal.',
    aspect: '9:16 vertical.',
    hook_window: 'Hook by 2s.',
    edit_style: 'Polished, cinematic transitions, beat-matched.',
    audio: 'IG-trending audio when fitting; original for educational.',
    text_overlays: 'Captions in safe zone, sans-serif with outline.',
    post_caption: '125 chars before cutoff; hook in first line.',
    algorithm_notes: 'Saves + sends weighted highest.',
  },
  'Instagram:carousel': {
    one_liner: 'Instagram carousel — 5–10 slide swipe story, slide 1 = scroll-stopper, slide 2 = "you need to swipe" promise.',
    duration_window: '5–10 slides. 7 is the empirical sweet spot.',
    aspect: '4:5 portrait or 1:1 square. NEVER landscape — kills feed real estate.',
    hook_window: 'Slide 1 in 1 second of glance. Title typography is the entire hook.',
    edit_style: 'Visual consistency across slides — same grid, same type rhythm, same colour palette. Slide design is information architecture: each slide is one beat.',
    audio: 'N/A — viewers swipe in silence.',
    text_overlays: 'Type IS the design. 1 idea per slide. Headline + at most 2 supporting lines per slide. Last slide = clear CTA + saveable summary.',
    post_caption: 'Long caption is acceptable here (300–800 chars) — readers who swipe to slide 7 will read. Lead with a hook line, then expand, then CTA.',
    algorithm_notes: 'Save rate is THE metric. Carousels saved at >2% of impressions go nuclear. Slide 2 has the highest drop-off — reward it with a cliffhanger.',
  },
  'Instagram:static': {
    one_liner: 'Instagram single-image post — one frame must do all the work.',
    duration_window: 'N/A',
    aspect: '4:5 portrait or 1:1 square.',
    hook_window: 'Glance test: stops the scroll in <0.5s.',
    edit_style: 'High contrast, intentional negative space, brand-recognisable in a feed grid.',
    audio: 'N/A',
    text_overlays: 'Either type-driven (poster style) or pure photographic — pick one, do not muddle.',
    post_caption: '125 chars before cutoff. Earn the read with the first line.',
    algorithm_notes: 'Single images underperform Reels and carousels for reach. Use only when the image itself is the asset.',
  },
  'Instagram:image': { /* alias to static — populated below */ } as unknown as FormatSpec,

  // ── YouTube Shorts ──────────────────────────────────────────────────────
  'YouTube:short': {
    one_liner: 'YouTube Short — hook-first edit, faster than TikTok, watch-time density wins.',
    duration_window: '30–60s sweet spot. Sub-30s underperforms (algorithm reads as "incomplete").',
    aspect: '9:16 vertical.',
    hook_window: 'Hook in <2s, payoff promise restated by 6s. Re-hook every 8–10s with a beat shift.',
    edit_style: 'Tight cuts, B-roll over A-roll talking head, on-screen text reinforcing every claim. Aim for 3+ visual changes every 5s.',
    audio: 'Voiceover or piece-to-camera with high-clarity mic. Music bed under for vibe; trending audio matters less than on TikTok.',
    text_overlays: 'Burned-in captions for every word. Bold sans, white with stroke. Position centre-frame, not bottom (mobile UI eats bottom).',
    post_caption: 'Title is everything (under 100 chars, keyword-loaded). Description: 1–2 sentences + relevant tags.',
    algorithm_notes: 'Watch-time (% completed × duration) is the primary signal. Longer Shorts that retain win over short Shorts that rate. Subscriber conversion is a long-tail bonus.',
  },
  'YouTube:video': {
    one_liner: 'YouTube long-form — front-loaded value, chaptered, retention-engineered.',
    duration_window: '8–15min sweet spot for most niches. 20+min for tutorial/deep-dive.',
    aspect: '16:9 horizontal.',
    hook_window: 'Cold open in <8s showing the payoff. Then "in this video you will…" promise within 30s.',
    edit_style: 'Clear chapter structure (use timestamps in description). B-roll over every concept. Pattern interrupts every 30–45s — zoom punches, music shifts, overlay graphics.',
    audio: 'High-quality lavalier or shotgun mic. Music bed shifting per chapter.',
    text_overlays: 'Lower-third callouts for facts. Chapter title cards. Burned-in captions optional but boost retention.',
    post_caption: 'Title is SEO-first (compelling + keyword). Description: 1st 150 chars are the snippet — make it earn the click. Then chapter timestamps, then resources.',
    algorithm_notes: 'Click-through rate × Average view duration = the formula. CTR is from thumbnail + title. AVD is from the cold open + retention engineering.',
  },
  'YouTube:long_video': {
    // alias to YouTube:video
    one_liner: 'YouTube long-form — front-loaded value, chaptered, retention-engineered.',
    duration_window: '8–15min sweet spot.',
    aspect: '16:9 horizontal.',
    hook_window: 'Cold open in <8s.',
    edit_style: 'Chapter structure, B-roll, pattern interrupts every 30–45s.',
    audio: 'Lavalier/shotgun mic, music bed shifting per chapter.',
    text_overlays: 'Lower-third callouts, chapter cards.',
    post_caption: 'SEO title; first 150 chars of desc earn the click; chapter timestamps.',
    algorithm_notes: 'CTR × AVD is the formula.',
  },

  // ── Twitter / X ─────────────────────────────────────────────────────────
  'Twitter:text': {
    one_liner: 'Tweet — single-tweet punch. Compression is craft.',
    duration_window: 'N/A',
    aspect: 'N/A',
    hook_window: 'First 6 words.',
    edit_style: 'Lines that earn line breaks. White space in a tweet is signal — use it.',
    audio: 'N/A',
    text_overlays: 'N/A',
    post_caption: '≤240 chars (leave room for a quote-tweet). 0–1 hashtags max — anything more reads as boomer.',
    algorithm_notes: 'Replies are the highest-weighted signal, then bookmarks, then retweets, then likes. Open with a take, not a question — questions get fewer engagements than declaratives.',
  },
  'Twitter:thread': {
    one_liner: 'Thread — first tweet must promise the whole arc; numbered or implied progression.',
    duration_window: '5–9 tweets sweet spot. 12+ is fatigue territory.',
    aspect: 'N/A',
    hook_window: 'Tweet 1 carries 80% of the engagement weight. Promise + payoff tease.',
    edit_style: 'One idea per tweet. White space matters. End with a CTA tweet (follow / bookmark / share).',
    audio: 'N/A',
    text_overlays: 'Optional embedded image in tweet 1 lifts CTR ~2×.',
    post_caption: 'Tweet 1: ≤240 chars, hook + payoff promise. Subsequent tweets: 200–280 chars each.',
    algorithm_notes: 'Bookmark rate on tweet 1 = thread will go viral. Quote-tweet count matters more than likes.',
  },
  'Twitter:image': {
    one_liner: 'Image tweet — visual is 70% of the signal, copy is the caption.',
    duration_window: 'N/A',
    aspect: '16:9 or 1:1 — never portrait (gets cropped in feed).',
    hook_window: 'Image must stop the scroll. Caption supports.',
    edit_style: 'High-contrast, screenshot-friendly, brand-recognisable.',
    audio: 'N/A',
    text_overlays: 'If text-on-image, must be readable at thumbnail size.',
    post_caption: '≤200 chars; tee up the image, do not duplicate it.',
    algorithm_notes: 'Image tweets get ~35% more engagement than text-only.',
  },
  'Twitter:video': {
    one_liner: 'Twitter video — captioned, looped clip; works without sound.',
    duration_window: '20–45s. Longer rarely earns its airtime here.',
    aspect: '16:9 or 1:1.',
    hook_window: 'First 3 seconds visually carry the entire post.',
    edit_style: 'Loop-friendly. Punchy. Caption-readable on mute.',
    audio: 'Optional — design for sound-off.',
    text_overlays: 'Burned-in captions essential.',
    post_caption: '≤200 chars; ending in a question raises reply rate.',
    algorithm_notes: 'Video views over 50% complete = strong amplification trigger.',
  },

  // ── LinkedIn ────────────────────────────────────────────────────────────
  'LinkedIn:text': {
    one_liner: 'LinkedIn post — declarative opener, line-broken body, CTA closing line.',
    duration_window: 'N/A',
    aspect: 'N/A',
    hook_window: 'First 2 lines (visible before "see more"). Make them earn the click.',
    edit_style: 'One sentence per line. White space is rhythm. End with a question or invitation.',
    audio: 'N/A',
    text_overlays: 'N/A',
    post_caption: '700–1300 chars optimal. 3 hashtags max, in-line or end.',
    algorithm_notes: 'Dwell time + comments are everything. Avoid external links in the body — drop them in first comment.',
  },
  'LinkedIn:carousel': {
    one_liner: 'LinkedIn document carousel (PDF) — slide deck of insights, professional gloss.',
    duration_window: '8–12 slides ideal.',
    aspect: '1:1 square or 4:5 portrait.',
    hook_window: 'Slide 1 = the bold claim or framework name. Slide 2 = "you should know this because…"',
    edit_style: 'Editorial, business-magazine feel. Real charts > stock illustrations. Brand colour disciplined.',
    audio: 'N/A',
    text_overlays: 'Type-driven. 30–60 words max per slide.',
    post_caption: 'Frame the document with a 700-char post. End with "DM me / comment X to get the full deck".',
    algorithm_notes: 'Document carousels currently get the highest organic reach on LinkedIn — the algorithm overweights them as "professional content".',
  },
  'LinkedIn:video': {
    one_liner: 'LinkedIn video — 30–90s, voiceover-led, captions burned in, business framing.',
    duration_window: '30–90s. Cap at 2min unless deeply technical.',
    aspect: '1:1 or 9:16.',
    hook_window: 'Hook by 3s. State the takeaway up-front, then back-fill.',
    edit_style: 'Calmer pacing than TikTok. Slight motion graphics, lower thirds, professional grade.',
    audio: 'Voiceover or talking head. Music bed minimal.',
    text_overlays: 'Captions essential — most LinkedIn watchers are on mute at work.',
    post_caption: '500–1000 chars framing the video. End with a question.',
    algorithm_notes: 'Comments from people in your second-degree network amplify hardest. Tag the right people once — never spam tags.',
  },
  'LinkedIn:image': {
    one_liner: 'LinkedIn image post — chart, screenshot, or framework graphic.',
    duration_window: 'N/A',
    aspect: '1:1 or 4:5.',
    hook_window: 'Image readable at thumbnail size.',
    edit_style: 'Editorial / data-viz feel preferred. Avoid stock photos.',
    audio: 'N/A',
    text_overlays: 'If a quote graphic, attribute properly.',
    post_caption: '500–900 chars unpacking the image.',
    algorithm_notes: 'Charts and data visualisations outperform stock photography ~3×.',
  },
};

// Populate aliases
REGISTRY['Instagram:image'] = REGISTRY['Instagram:static'];

/**
 * Normalise the user's content_format string into one of the canonical
 * format keys. The brand profile's content_format is free-form-ish, so
 * we tolerate variants.
 */
function normalizeFormat(raw: string | undefined | null): ContentFormat {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return 'video';
  if (/short[-_ ]?(form)?[-_ ]?video|short$|youtube\s*short/.test(s)) return 'short';
  if (/long[-_ ]?(form)?|long\s*video/.test(s)) return 'long_video';
  if (/reel/.test(s)) return 'reel';
  if (/carousel|swipe|slide/.test(s)) return 'carousel';
  if (/static|single\s*image|photo/.test(s)) return 'static';
  if (/image|graphic/.test(s)) return 'image';
  if (/thread/.test(s)) return 'thread';
  if (/text|post|caption/.test(s)) return 'text';
  if (/video|tiktok|clip/.test(s)) return 'video';
  return 'video';
}

/**
 * Resolve the right FormatSpec for a (platform, content_format) pair.
 *
 * Lookup order:
 *   1. Exact platform:format match.
 *   2. Platform:video (catch-all video for that platform).
 *   3. Platform:text (catch-all post for that platform).
 *   4. NULL (caller falls back to format-agnostic guidance).
 */
export function resolveFormatSpec(
  platform: Platform | string | undefined | null,
  contentFormat: string | undefined | null,
): FormatSpec | null {
  const p = (platform || '').toString();
  if (!p) return null;
  const f = normalizeFormat(contentFormat);

  return REGISTRY[`${p}:${f}`]
    || REGISTRY[`${p}:video`]
    || REGISTRY[`${p}:text`]
    || null;
}

/**
 * Render a FormatSpec as a compact prompt block. Designed to slot into
 * a system prompt as a hard constraint section.
 */
export function formatSpecPromptBlock(
  spec: FormatSpec | null,
  platform: Platform | string | null,
  contentFormat: string | null,
): string {
  if (!spec) {
    return `Platform & format: ${platform || 'unspecified'} / ${contentFormat || 'unspecified'}. (No platform-specific format spec available — apply general best practices.)`;
  }
  return `Platform & format: ${platform} / ${contentFormat}
► ${spec.one_liner}
- Duration: ${spec.duration_window}
- Aspect: ${spec.aspect}
- Hook window: ${spec.hook_window}
- Edit style: ${spec.edit_style}
- Audio: ${spec.audio}
- Text overlays: ${spec.text_overlays}
- Post caption: ${spec.post_caption}
- Algorithm notes: ${spec.algorithm_notes}

Treat the above as hard constraints. Do not violate the duration window or aspect ratio. The hook window and algorithm notes are the difference between native and cringe — engineer the script around them, not despite them.`;
}
