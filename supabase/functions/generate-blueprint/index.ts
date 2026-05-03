import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supabase credentials.
// Prefer explicit EXTERNAL_SUPABASE_* env vars (for cross-project setups
// where the trends DB lives in a different project from the edge functions).
// Otherwise fall back to the auto-injected SUPABASE_URL / SUPABASE_ANON_KEY
// that every Supabase Edge Function gets for free (same-project lookups).
// Never hardcode keys in source — they leak via git, Lovable previews, and
// the deployed function bundle.
const EXTERNAL_SUPABASE_URL =
  Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const EXTERNAL_SUPABASE_ANON_KEY =
  Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_ANON_KEY) {
  console.error("[generate-blueprint] Missing Supabase credentials. Set EXTERNAL_SUPABASE_URL/EXTERNAL_SUPABASE_ANON_KEY or rely on auto-injected SUPABASE_URL/SUPABASE_ANON_KEY.");
}

type BrandMemory = {
  user_id: string | null;
  brand_name: string;
  business_summary?: string | null;
  voice_profile_text?: string | null;
  do_list?: string[] | null;
  dont_list?: string[] | null;
  preferred_formats?: string[] | null;
  tone_preferences?: any | null;
};

async function getBrandMemory(
  supabase: any,
  userId: string | null,
  brandName: string
): Promise<BrandMemory | null> {
  if (userId) {
    const { data: userMemory } = await supabase
      .from("brand_memory")
      .select("*")
      .eq("user_id", userId)
      .eq("brand_name", brandName)
      .maybeSingle();

    if (userMemory) return userMemory;

    const { data: sharedMemory } = await supabase
      .from("brand_memory")
      .select("*")
      .is("user_id", null)
      .eq("brand_name", brandName)
      .maybeSingle();

    return sharedMemory;
  }

  const { data } = await supabase
    .from("brand_memory")
    .select("*")
    .is("user_id", null)
    .eq("brand_name", brandName)
    .maybeSingle();

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Director's-Cut structural validator
//
// A 1200-word shooting script is necessary but not sufficient. Without all
// the per-scene blocks the script can't actually be executed by another
// human; it's just a wall of text. This validator catches:
//   1. Word/char floor failures (script < 1100 words, long_caption < 1300 chars)
//   2. Missing per-scene blocks (e.g. no [SOUND DESIGN] in any scene)
//   3. Suspect [REFERENCE] blocks ("a popular ad", "an iconic scene") that
//      signal fabrication — the prompt explicitly forbids these
//
// Returns a list of human-readable issue strings. Empty list = ship.
// ─────────────────────────────────────────────────────────────────────────────
const VIDEO_REQUIRED_BLOCKS = [
  '[INTENT]',
  '[FRAME]',
  '[CAMERA]',
  '[LIGHTING]',
  '[WARDROBE & PROPS]',
  '[PERFORMANCE / VOICEOVER]',
  '[TEXT OVERLAY]',
  '[SOUND DESIGN]',
  '[B-ROLL / CUTAWAYS]',
  '[TRANSITION OUT]',
];

const STATIC_REQUIRED_BLOCKS = [
  '[INTENT]',
  '[SUBJECT & SCENE]',
  '[COMPOSITION]',
  '[LIGHTING]',
  '[COLOUR PALETTE]',
  '[TYPOGRAPHY]',
  '[LAYOUT & GRID]',
  '[TEXT COPY]',
  '[TEXTURE / FINISH]',
];

// Phrases that strongly suggest a fabricated [REFERENCE] block. The prompt
// tells the model to either name a real reference (with title/year/creator)
// or omit the block entirely. Vague claims like "a popular ad campaign" or
// "an iconic film scene" with no proper noun are exactly what we forbid.
const FAB_PATTERNS = [
  /\ba (popular|famous|well-known|classic|iconic|legendary|memorable) (ad|advert|advertisement|campaign|film|movie|scene|video|music video|song|brand)\b/i,
  /\ban? (iconic|popular|famous|well-known|classic|legendary) (ad|advert|advertisement|campaign|film|movie|scene|video|music video|song|brand)\b/i,
  /\b(reminiscent|inspired by) the (style|look|aesthetic|vibe|feel) of (popular|famous|iconic|classic) /i,
  /\bsimilar to (popular|famous|iconic|classic) /i,
];

function validateDetailedDirection(
  d: any,
  opts: { isVideo: boolean },
): string[] {
  const issues: string[] = [];
  if (!d || typeof d !== 'object') {
    return ['detailed_direction missing or not an object'];
  }

  const longField: string = opts.isVideo ? (d.full_script || '') : (d.visual_brief || '');
  const longFieldName = opts.isVideo ? 'full_script' : 'visual_brief';
  const wordCount = longField.trim().split(/\s+/).filter(Boolean).length;
  const captionLen = (d.long_caption || '').length;

  // 1) Length floors
  if (wordCount < 1100) {
    issues.push(`${longFieldName} is ${wordCount} words — must be ≥ 1200 (target 1200–1600).`);
  }
  if (captionLen < 1300) {
    issues.push(`long_caption is ${captionLen} characters — must be ≥ 1400 (target 1400–1700).`);
  }

  // 2) Per-scene/per-frame block presence
  const required = opts.isVideo ? VIDEO_REQUIRED_BLOCKS : STATIC_REQUIRED_BLOCKS;
  // Split on SCENE/FRAME headers — robust to variations like "SCENE 1 —"
  // or "[SCENE 2 — 5 seconds — Title]" or "FRAME 3:".
  const sceneSplitter = opts.isVideo
    ? /(?=\bSCENE\s*\d|\[SCENE\s*\d)/i
    : /(?=\bFRAME\s*\d|\[FRAME\s*\d)/i;
  const sections = longField.split(sceneSplitter).filter(s => s.trim().length > 50);

  if (sections.length < 3) {
    issues.push(`${longFieldName} has only ${sections.length} ${opts.isVideo ? 'SCENE' : 'FRAME'} section(s) — need at least 4 to form an escalation curve.`);
  }

  // For each scene/frame, count missing required blocks
  const blockMissCounts: Record<string, number> = {};
  for (const section of sections) {
    for (const block of required) {
      if (!section.includes(block)) {
        blockMissCounts[block] = (blockMissCounts[block] || 0) + 1;
      }
    }
  }
  for (const [block, count] of Object.entries(blockMissCounts)) {
    if (count > 0) {
      const pct = sections.length ? Math.round((count / sections.length) * 100) : 0;
      // Tolerate 1 missing block in 1 scene; flag systemic absence.
      if (count >= 2 || pct >= 50) {
        issues.push(`${block} is missing from ${count}/${sections.length} ${opts.isVideo ? 'scenes' : 'frames'} — every section must include it.`);
      }
    }
  }

  // 3) Fabrication-prone [REFERENCE] phrasing
  const refRegex = /\[REFERENCE\][^\[]*?(?=\[|$)/gi;
  const refBlocks = longField.match(refRegex) || [];
  let suspectRefs = 0;
  for (const ref of refBlocks) {
    if (FAB_PATTERNS.some(p => p.test(ref))) suspectRefs++;
  }
  if (suspectRefs > 0) {
    issues.push(`${suspectRefs} [REFERENCE] block(s) use vague generic phrasing ("a popular ad", "an iconic scene"). Either name a real reference with a specific title + year/creator/brand, or omit the [REFERENCE] block entirely.`);
  }

  return issues;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_profile, trend_id, chosen_direction, user_id, detailed } = await req.json();
    console.log('Received request for generate-blueprint:', { user_profile, trend_id, chosen_direction, user_id: user_id || 'anonymous', detailed: !!detailed });

    if (!user_profile || !user_profile.brand_name) {
      return new Response(
        JSON.stringify({ error: 'user_profile with brand_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!trend_id) {
      return new Response(
        JSON.stringify({ error: 'trend_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!chosen_direction) {
      return new Response(
        JSON.stringify({ error: 'chosen_direction is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize external Supabase client
    const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);

    // Fetch brand memory
    const userId = user_id || null;
    const brandName = user_profile.brand_name || "Unknown Brand";
    const brandMemory = await getBrandMemory(externalSupabase, userId, brandName);
    console.log('Brand memory:', brandMemory ? 'found' : 'not found');

    // Fetch the full trend record including description
    const { data: trendData, error: trendError } = await externalSupabase
      .from('trends')
      .select('trend_id, trend_name, description, hashtags, views_last_60h_millions, region, premium_only, active')
      .eq('trend_id', trend_id)
      .maybeSingle();

    if (trendError) {
      console.error('External Supabase error:', trendError);
      throw new Error('Failed to fetch trend from external database');
    }

    if (!trendData) {
      return new Response(
        JSON.stringify({ error: 'Trend not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched trend: ${trendData.trend_name}, description length: ${trendData.description?.length || 0}`);

    // Build the trend object
    const trend = {
      trend_id: trendData.trend_id,
      trend_name: trendData.trend_name,
      description: trendData.description || '',
      hashtags: trendData.hashtags || '',
      views_last_60h_millions: trendData.views_last_60h_millions
    };

    // Try to get Marketers Quest blueprint
    try {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      const isVideo = /video|reels|tiktok/i.test(user_profile.content_format || "");
      const isFaceless = user_profile.is_faceless === true;
      const isDetailed = detailed === true;
      const goal = (user_profile.primary_goal || "").toString();

      // ─── Persona ─────────────────────────────────────────────────────────────
      // Detailed mode swaps in a top-tier-creative persona. Standard mode keeps
      // the lighter "social media director" framing.
      const persona = isDetailed
        ? (isVideo
            ? `You are the in-house creative director the world's best brands fight to hire — a fusion of Christopher Nolan's structural rigour, Edgar Wright's kinetic editing, David Fincher's frame-by-frame discipline, and Casey Neistat's run-and-gun social-native instincts. You think in shot lists, in transitions, in 3-second pattern interrupts, in the difference a 35mm focal length makes versus a 50mm. You know when an overhead works and when it kills the energy. You know the trending audio of this week, last week, and the week before. You know which creators on this niche are nailing it right now. You know exactly when to break the fourth wall and when to stay observational. Your scripts are not "outlines" — they are production-ready shooting documents another human could pick up cold and execute today.`
            : `You are the in-house creative director the world's best brands fight to hire — a fusion of a Pentagram-level art director (think Paula Scher's typography sense), an Annie-Leibovitz-grade portrait photographer who understands light as language, a Stefan Sagmeister-level conceptual designer who turns ideas into objects, and a David Ogilvy / Ann Handley copywriter who knows that every word is paid for in attention. You think in grids, in negative space, in tonal palettes specified by hex code, in typeface pairings, in compositional rules and when to break them. You don't say "use bold colours" — you say "Pantone 185 C against a #F7F4EE matte ground, type set in Söhne Halbfett at 96/88, baseline-aligned to a 12-column grid". Your briefs are production-ready: a designer or photographer could pick one up cold and shoot it today.`)
        : `You are a high-level social media director turning ideas into shootable scripts.`;

      const systemPrompt = `${persona}

You receive:
- a creator/brand profile,
- ONE trend with a detailed description of why it is viral now,
- ONE selected creative direction (title, summary, hook, visual_idea, CTA),
- the content_format (${user_profile.content_format || "unspecified"}).

Creator context:
${isFaceless ? "⚠️ FACELESS ACCOUNT: This creator does NOT show their face. All shot/visual suggestions must use voiceover, text overlays, hands/objects only shots, b-roll, screen recordings, animations, product photography, or environmental shots. Never suggest selfie, talking-head, or on-camera presenter shots." : "✅ Face-on account: on-camera and talking-head content is fine."}

Primary goal: ${goal || "(not specified)"} — every creative decision must serve this goal. If the goal is "More engagement" the structure must invite reply/save/share. If "Followers" the structure must promise serialised value. If "Sales/Conversions" the CTA must lead to a specific next action. If "Awareness/Reach" the hook must be unskippable in 3 seconds.

Brand memory is the highest priority for voice and tone:
- Match the rhythm and attitude described in voice_profile_text.
- Follow do_list and avoid dont_list.
- If tone_preferences exist, use primary_tones and intensity_preference as extra guidance together with the current tone and tone_intensity controls.

Tone handling:
- The brand tone may include multiple styles (tones array). Use primary_tone as the main voice.
- Use tone_intensity (1–5) to control how strongly the tone is expressed:
  1–2 mild, 3 balanced, 4–5 strong, bold, creator-grade.
- If primary_tone is 'Naughty', allow premium A-rated innuendo but keep it non-explicit and brand-safe.

General rules:
- Use specifics from the trend description (names, scenes, rumours, emotional beats).
- Make the first 3 seconds / first slide absolutely unskippable.
- Avoid buzzwords ('drive engagement', 'resonate', 'compelling content', 'in today's fast-paced world').
- Be concrete. "Warm light" is wrong; "low-angle 3pm sun raking from camera-left at ~30°, no fill, deliberate shadow on the right cheek" is right.

═══════════════════════════════════════════════════════════════════════
FIELD REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

1) concept
- 3–5 sentences.
- Explain the story in plain language: emotional hook, how the trend is woven in, what viewers should feel or do.

2) script_outline
- 4–8 bullet points.
- Each bullet is ONE scene/shot/slide.
- Bring the hook in the first bullet.
- For video: mention framing (faceless/face-on respected), key on-screen text or dialogue, where the trend reference appears.
- For carousel/static: mention slide headline and what image is shown.

${isVideo
  ? (isDetailed
    ? `3) full_script  ⚙️ DETAILED MODE — DIRECTOR'S SHOOTING SCRIPT
This is the deliverable that justifies the entire feature. You MUST write 1200–1600 words.

Format: numbered SCENES, each one a self-contained mini-document. Per scene include EVERY one of these blocks (write proper paragraphs inside each, not bullets):

  [SCENE N — duration in seconds — one-line title]
  [INTENT] — in 1 sentence, what this scene must achieve for the viewer (hook, build curiosity, deliver payoff, drive CTA).
  [FRAME] — composition in detail. Foreground / midground / background. Where the eye lands. Negative space. Whether the rule of thirds, centre framing or symmetry is being used and why.
  [CAMERA] — body (phone vs DSLR vs cinema cam if relevant), focal length feel (wide / normal / tele), shot size (extreme close-up, close-up, medium, wide, drone, top-down), angle (low, eye-level, high, dutch), movement (static, slow push-in, whip pan, gimbal tracking, handheld energy, snorricam, lockoff).
  [LIGHTING] — quality (hard / soft), direction (key from where, fill yes/no, rim, practical), colour temperature (3200K tungsten / 5600K daylight / mixed), time of day if shooting natural. Specify mood — "moody, single source, deep falloff" beats "warm".
  [WARDROBE & PROPS] — exact items${isFaceless ? " (faceless account — no presenter wardrobe)" : ", outfit colour palette in plain language or hex"}. Props named, not "some food" → "a chipped white diner mug, half-full of black coffee, slight steam".
  [PERFORMANCE / VOICEOVER] — every spoken word verbatim. Prefix lines: "VO:" for voiceover, ${isFaceless ? "(no ON-CAM lines — faceless)" : "\"ON-CAM:\" for on-camera dialogue."} Indicate delivery (deadpan, conspiratorial whisper, breathless, dry-as-bone). For ON-CAM lines, note micro-expressions if they sell the line.
  [TEXT OVERLAY] — exact verbatim copy that appears on screen, in the order it appears, with rough timing (00:03–00:06). Include suggested typeface mood ("condensed sans, all caps, tracked tight" / "handwritten marker, slight tilt").
  [SOUND DESIGN] — trending audio name if you genuinely know one that's currently surfacing (do NOT invent). Otherwise: music mood + 2–3 named SFX (whoosh, riser, vinyl scratch, click, sub-drop).
  [B-ROLL / CUTAWAYS] — concrete cutaway shots needed and what they buy emotionally.
  [TRANSITION OUT] — exactly how this scene exits into the next (hard cut on word, match cut on motion, whip pan, J-cut audio bleed, freeze frame, smash cut).
  [REFERENCE] — name a specific film scene, ad, music video, or named creator's recent post that captures the look you're going for. Be concrete: "the diner scene aesthetic from Heat (1995)" or "Daniel Schiffer's product reveal grading". If you cannot name a real one with confidence, OMIT this block entirely — never invent.

Mandatory beats:
- Scene 1 must contain a 3-second pattern interrupt. State exactly what makes a thumb stop scrolling.
- A clear escalation curve across scenes — tension/payoff/release should be plotted, not accidental.
- Final scene must execute the CTA aligned to "${goal || "primary_goal"}" with a specific on-screen action.

${isFaceless ? "Faceless constraint: every shot must read without the creator's face — verify mentally per scene." : ""}

Length floor: 1200 words. Below that you have failed the deliverable. Aim for 1400–1500 if the story supports it.`
    : `3) full_script
- Write the complete spoken voiceover/script word-for-word.
- Include [SCENE] markers matching script_outline steps.
- Include [TEXT OVERLAY] notes where on-screen text appears.
- Total length: 60–90 seconds when read aloud (~150–225 words).
- Match the tone exactly.`)
  : (isDetailed
    ? `3) visual_brief  ⚙️ DETAILED MODE — ART DIRECTOR'S CREATIVE BRIEF
This is the deliverable that justifies the entire feature. You MUST write 1200–1600 words.

Format: numbered FRAMES (one per slide if carousel, or one per primary composition if single-image). Per frame include EVERY one of these blocks (proper paragraphs, not bullets):

  [FRAME N — purpose of this frame in 1 line]
  [INTENT] — what this frame must do for the viewer (hook, deliver insight, build, payoff, CTA).
  [SUBJECT & SCENE] — what the photo or graphic depicts in concrete detail. ${isFaceless ? "Faceless account — focus on objects, hands, environments, typography, not on-camera people." : "Subject's posture, expression, where they're looking."} Foreground / midground / background.
  [COMPOSITION] — rule of thirds / centred / symmetrical / golden ratio. Where the eye enters and exits. Leading lines. Negative space ratio. Crop ratio (1:1, 4:5, 9:16).
  [LIGHTING] — for photography: hard vs soft, direction (e.g. "key from camera-left at 45°, ½ stop fill from a white v-flat"), colour temperature, mood. For graphic frames: not applicable — say so.
  [COLOUR PALETTE] — 3–5 specific colours with named values OR hex codes (e.g. "off-white #F4F1EA, ink black #0E0E0C, accent ochre #C57B2A, ghost grey #C9C6BE"). Specify which colour does what (background, accent, type).
  [TYPOGRAPHY] — typeface family + weight + size hierarchy (e.g. "Headline: Söhne Breit Halbfett, 92pt; deck: Söhne Buch, 24pt/30pt; caption: GT America Mono Regular, 14pt"). Tracking, leading, alignment, casing. If using a free alternative, say so ("Inter Display works as a substitute for Söhne").
  [LAYOUT & GRID] — column count, gutters, baseline grid, where each element sits. Describe in words a designer can recreate without seeing it.
  [TEXT COPY] — every word that appears in the frame, verbatim, in reading order.
  [TEXTURE / FINISH] — film grain, paper stock feel, gradient mesh, halftone, glassmorphism, pure flat. Be specific.
  [REFERENCE] — name a specific designer / photographer / campaign / studio whose work nails this look. Concrete: "the editorial restraint of Apartamento magazine" / "Pentagram's MIT Media Lab identity system" / "Annie Leibovitz's 2008 Disney Dream Portraits". If you cannot name one with confidence, OMIT this block — never invent.

Mandatory beats:
- Frame 1 / cover slide must contain a 3-second pattern interrupt. State exactly what stops the scroll.
- For carousels: a clear escalation curve across slides — set up, build, payoff, CTA.
- Final frame must execute the CTA aligned to "${goal || "primary_goal"}" with a specific user action prompted (save / DM keyword / link in bio).

${isFaceless ? "Faceless constraint: no human face anywhere across the frames — verify mentally per frame." : ""}

Length floor: 1200 words. Below that you have failed the deliverable. Aim for 1400–1500 if the story supports it.`
    : `3) visual_brief
- A short visual brief covering: subject, composition, palette, typography hint, copy.
- Cover the cover slide / single image AND a one-line direction per subsequent slide if it's a carousel.
- Match the tone exactly.`)}

${isVideo ? "4)" : "4)"}) caption (short)
- 2–5 sentences.
- Strong opening line (pattern interrupt) → 1–2 concrete trend details → CTA aligned to primary_goal.
- Avoid generic phrases.

5) long_caption  ${isDetailed ? "⚙️ DETAILED MODE" : ""}
${isDetailed
  ? `- Target length: 1400–1700 characters. Count characters, not words. Below 1400 = failure.
- Structure: pattern-interrupt hook (1 sentence) → 3 substantive value paragraphs (story / insight / payoff) → explicit CTA aligned to "${goal || "primary_goal"}" → "You'll like this if you search for:" line with 8–12 long-tail phrases (comma-separated, no hashtags).
- Weave in niche keywords, the trend name, location (if relevant), creator pain points, and the 8–12 long-tail search phrases real humans type. Sound human, not SEO-stuffed.
- Treat it like an Instagram-search-optimised article.`
  : `- A keyword-rich extended version of the caption (150–250 words).
- Hook → 2–3 value paragraphs → CTA → keyword list at the end.`}

6) recommended_hashtags
- 5–10 hashtags. Trend tags + niche/goal tags. No duplicates, no generic #content or #marketing.

7) extra_tips
- 3–6 practical execution bullets — timing, production tricks, variations.

═══════════════════════════════════════════════════════════════════════
OUTPUT JSON SHAPE
═══════════════════════════════════════════════════════════════════════

{
  "trend_id": "...",
  "idea_id": number,
  "detailed_direction": {
    "concept": "...",
    "script_outline": ["...", "..."],
    ${isVideo ? '"full_script": "...",' : '"visual_brief": "...",'}
    "caption": "...",
    "long_caption": "...",
    "recommended_hashtags": ["#...", "#..."],
    "extra_tips": ["...", "..."]
  }
}

Respond ONLY with valid JSON. No markdown fences, no explanation outside the JSON.`;

      const userMessage = `
Here is the brand profile:
${JSON.stringify(user_profile, null, 2)}

Here is the brand memory (style guide):
${JSON.stringify(brandMemory, null, 2)}

Here is the trend (with a description of why it's currently viral):
${JSON.stringify(trend, null, 2)}

Here is the chosen creative direction:
${JSON.stringify(chosen_direction, null, 2)}

Please create a detailed execution blueprint for this idea.

Return a JSON object with:
- trend_id
- idea_id
- detailed_direction with these fields:
    - concept
    - script_outline
${isVideo
  ? (isDetailed
      ? "    - full_script  (REQUIRED — 1200–1600 words. Director's shooting script with numbered scenes, each containing [INTENT] [FRAME] [CAMERA] [LIGHTING] [WARDROBE & PROPS] [PERFORMANCE / VOICEOVER] [TEXT OVERLAY] [SOUND DESIGN] [B-ROLL / CUTAWAYS] [TRANSITION OUT] [REFERENCE] blocks)\n"
      : "    - full_script  (REQUIRED — full word-for-word voiceover with [SCENE] and [TEXT OVERLAY] markers, 60–90 seconds when read aloud)\n")
  : (isDetailed
      ? "    - visual_brief  (REQUIRED — 1200–1600 words. Art director's brief with numbered frames, each containing [INTENT] [SUBJECT & SCENE] [COMPOSITION] [LIGHTING] [COLOUR PALETTE] [TYPOGRAPHY] [LAYOUT & GRID] [TEXT COPY] [TEXTURE / FINISH] [REFERENCE] blocks)\n"
      : "    - visual_brief  (short visual brief — subject, composition, palette, type, copy)\n")}    - caption  (short, 2–5 sentences)
    - long_caption  (REQUIRED — ${isDetailed ? "1400–1700 character keyword-rich caption with 8–12 long-tail search phrases" : "150–250 word keyword-rich extended caption for discoverability"})
    - recommended_hashtags
    - extra_tips

Use specifics from the trend description – names, scenes, rumours, emotional beats.
Avoid buzzwords like 'drive engagement', 'resonate', 'compelling content'.
Make it something a creator could actually ${isVideo ? "shoot" : "shoot or design"} today.

${isDetailed
  ? `LENGTH ENFORCEMENT — non-negotiable:
${isVideo
  ? "- full_script: minimum 1200 words. Count them. Below 1200 = the deliverable failed and you must keep writing scenes / blocks until you cross 1200.\n"
  : "- visual_brief: minimum 1200 words. Count them. Below 1200 = the deliverable failed and you must keep writing frames / blocks until you cross 1200.\n"}- long_caption: minimum 1400 characters. Count characters, not words.

Verify your character/word counts before returning. If short, add more depth — additional scenes, deeper [REFERENCE] blocks, more granular [LIGHTING], more concrete [TEXT COPY], more long-tail search phrases. Never pad with filler — add information density.`
  : ""}
`;

      const callOpenAI = async (extraSystem: string | null = null) => {
        const messages: { role: string; content: string }[] = [
          { role: 'system', content: systemPrompt + (extraSystem ? `\n\n${extraSystem}` : '') },
          { role: 'user', content: userMessage },
        ];
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // gpt-4o-mini chronically truncates long-form fields. For detailed
            // mode (1200+ word shooting script / visual brief + 1400+ char
            // long_caption) we need the full gpt-4o model and a generous
            // output budget. gpt-4o supports up to 16,384 output tokens.
            model: isDetailed ? 'gpt-4o' : 'gpt-4o-mini',
            messages,
            response_format: { type: 'json_object' },
            temperature: isDetailed ? 0.85 : 0.7,
            max_tokens: isDetailed ? 16000 : 4000,
          }),
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Marketers Quest API error:', res.status, errorText);
          throw new Error(`Marketers Quest API call failed: ${res.status}`);
        }
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (!content) throw new Error('No content in Marketers Quest response');
        const finishReason = json.choices?.[0]?.finish_reason;
        if (finishReason === 'length') {
          console.warn('Marketers Quest response was truncated by max_tokens');
        }
        return JSON.parse(content);
      };

      console.log('Calling Marketers Quest API for execution blueprint...');
      let parsedResponse = await callOpenAI();
      let detailedDirection = parsedResponse.detailed_direction;

      // ── Structural + length validation (detailed mode only) ─────────────────
      // Length is necessary but not sufficient. A 1200-word script that's
      // missing [SOUND DESIGN] in every scene is unshippable. So we validate
      // ALL of: word/char floors, per-scene/per-frame block presence, and
      // [REFERENCE] honesty (fabrication-prone phrasing fails).
      //
      // If anything fails, do ONE retry with a precise itemised nudge so the
      // model knows exactly what to fix — not a generic "try harder" prompt.
      if (isDetailed && detailedDirection) {
        const issues = validateDetailedDirection(detailedDirection, { isVideo });
        if (issues.length > 0) {
          console.log(`Detailed output failed validation — ${issues.length} issue(s):\n  - ${issues.join('\n  - ')}`);
          const nudge = `Your previous draft did not meet the deliverable bar. Specific issues:

${issues.map((i, n) => `${n + 1}. ${i}`).join('\n')}

Rewrite the FULL JSON response. Address every issue above. Do NOT pad with filler — add information density (deeper [REFERENCE] blocks, more concrete [LIGHTING] / [COLOUR PALETTE], more long-tail search phrases). For [REFERENCE] blocks: name a specific real film/ad/creator/campaign with title and year/era, OR omit the [REFERENCE] block entirely. Generic phrasing like "a popular ad" or "an iconic film scene" is forbidden — it signals fabrication.

Previous draft for reference:
${JSON.stringify(detailedDirection, null, 2)}`;
          try {
            const retry = await callOpenAI(nudge);
            if (retry?.detailed_direction) {
              const retryIssues = validateDetailedDirection(retry.detailed_direction, { isVideo });
              detailedDirection = retry.detailed_direction;
              if (retryIssues.length > 0) {
                console.warn(`Retry still has ${retryIssues.length} issue(s) but shipping anyway: ${retryIssues.join('; ')}`);
              } else {
                console.log('Retry passed all structural checks.');
              }
            }
          } catch (retryErr) {
            console.error('Detailed-mode retry failed, keeping first draft:', retryErr);
          }
        } else {
          console.log('Detailed output passed all structural checks on first try.');
        }
      }


      console.log('Returning AI-powered execution blueprint');
      return new Response(
        JSON.stringify({
          trend_id: trend.trend_id,
          trend_hashtags: trend.hashtags,
          idea_id: chosen_direction.idea_id,
          detailed_direction: detailedDirection
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (aiError) {
      // Fallback: Return placeholder blueprint
      console.error('AI blueprint generation failed, using fallback:', aiError);

      const fallbackBlueprint = {
        concept: `High-level idea of how ${user_profile.brand_name} can use ${trend.trend_name} with the idea "${chosen_direction.title}". This approach combines the trending content style with your brand's unique voice to create engaging content that resonates with your audience.`,
        script_outline: [
          `Slide 1: Hook about ${trend.trend_name} that grabs attention for ${user_profile.brand_name}`,
          `Slide 2: Explain the connection between ${trend.trend_name} and your audience's needs`,
          `Slide 3: Show how ${user_profile.brand_name} uniquely approaches this trend`,
          `Slide 4: Present the main value proposition using ${chosen_direction.title}`,
          `Slide 5: Include social proof or results related to ${trend.trend_name}`,
          `Slide 6: End with a strong call-to-action: ${chosen_direction.suggested_cta}`
        ],
        caption: `🔥 ${trend.trend_name} is taking over, and here's how ${user_profile.brand_name} is making it work! ${chosen_direction.hook} Ready to see the results? Check out our approach and let us know what you think! ${chosen_direction.suggested_cta}`,
        recommended_hashtags: [
          `#${trend.trend_name.replace(/\s+/g, '')}`,
          '#marketing',
          '#content',
          `#${user_profile.brand_name.replace(/\s+/g, '')}`,
          '#trending',
          '#socialmedia'
        ],
        extra_tips: [
          `Post during peak engagement hours for your ${user_profile.audience} audience`,
          `Use the trending audio or format associated with ${trend.trend_name}`,
          `Keep the visual style consistent with your brand identity`,
          `Engage with comments quickly to boost algorithmic reach`,
          `Consider creating a series of posts around this trend for maximum impact`
        ]
      };

      return new Response(
        JSON.stringify({
          trend_id: trend.trend_id,
          trend_hashtags: trend.hashtags,
          idea_id: chosen_direction.idea_id,
          detailed_direction: fallbackBlueprint
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in generate-blueprint function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
