import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API = "https://graph.facebook.com/v22.0";

const ANALYSIS_PROMPT = `You are a content strategy analyst. Analyze the following Instagram creator's content and produce a structured style profile that another creator can use as inspiration.

You will be given:
- Their Instagram bio (if available)
- A sample of their recent post captions
- Why the user finds them inspiring

Produce a JSON object with these exact fields:
{
  "primary_tone": "one of: educational, entertaining, inspirational, humorous, raw/authentic, aspirational, informative, controversial",
  "secondary_tone": "a second tone or null",
  "writing_style": "short description of how they write (e.g. 'punchy one-liners with a hook', 'long-form storytelling', 'conversational and relatable')",
  "content_themes": ["array", "of", "3-5", "main", "topics/niches"],
  "hook_patterns": ["how they open posts", "e.g. 'starts with a bold statement'", "or 'asks a question'"],
  "caption_length": "one of: very short (under 20 words), short (20-50 words), medium (50-150 words), long (150+ words)",
  "emoji_usage": "one of: none, minimal, moderate, heavy",
  "cta_style": "how they end posts / drive action (e.g. 'asks followers to comment', 'saves-focused', 'no explicit CTA')",
  "hashtag_strategy": "description of their hashtag approach (e.g. 'niche-specific 10-15 tags', 'minimal 3-5 tags', 'broad trending tags')",
  "unique_voice": "what makes their voice distinctly theirs in 1-2 sentences",
  "what_to_borrow": "specific tactical advice for what the user could adopt from this creator",
  "summary": "2-3 sentence overall style summary a creator can use as a brief"
}

Return ONLY valid JSON, no markdown fences, no explanation.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instagram_handle, why_inspiring, manual_captions } = await req.json();

    if (!instagram_handle) {
      return new Response(JSON.stringify({ error: "instagram_handle is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const handle = instagram_handle.replace("@", "").toLowerCase().trim();

    // ── 1. Try fetching profile via Business Discovery API ────────────────────
    let bio: string | null = null;
    let displayName: string | null = null;
    let profilePic: string | null = null;
    let followerCount: number | null = null;
    let fetchedCaptions: string[] = [];

    const { data: igConn } = await supabase
      .from("instagram_connections")
      .select("instagram_user_id, access_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (igConn?.instagram_user_id && igConn?.access_token) {
      try {
        const fields = [
          "business_discovery.fields(",
          "username,name,biography,followers_count,profile_picture_url,",
          "media.limit(15){caption,media_type,timestamp}",
          ")",
        ].join("");

        const url = `${GRAPH_API}/${igConn.instagram_user_id}?fields=${fields}&access_token=${igConn.access_token}`;
        const res = await fetch(url);
        const data = await res.json();
        const bd = data?.business_discovery;

        if (bd && !data.error) {
          displayName = bd.name || null;
          bio = bd.biography || null;
          profilePic = bd.profile_picture_url || null;
          followerCount = bd.followers_count || null;
          fetchedCaptions = (bd.media?.data || [])
            .map((m: { caption?: string }) => m.caption)
            .filter((c: string | undefined): c is string => !!c && c.length > 10)
            .slice(0, 12);
        }
      } catch (e) {
        console.error("Business Discovery API error:", e);
      }
    }

    // ── 2. Combine fetched + manual captions ──────────────────────────────────
    const allCaptions = [
      ...fetchedCaptions,
      ...(Array.isArray(manual_captions) ? manual_captions : []),
    ].filter(Boolean).slice(0, 15);

    if (allCaptions.length === 0 && !why_inspiring) {
      return new Response(JSON.stringify({
        error: "No content to analyse. Connect Instagram or paste some example captions.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── 3. AI tone & style analysis ───────────────────────────────────────────
    const userContent = [
      bio ? `Bio: ${bio}` : null,
      allCaptions.length > 0
        ? `Recent captions:\n${allCaptions.map((c, i) => `${i + 1}. "${c}"`).join("\n")}`
        : null,
      why_inspiring ? `Why the user finds them inspiring: ${why_inspiring}` : null,
    ].filter(Boolean).join("\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: ANALYSIS_PROMPT },
          { role: "user", content: `Instagram handle: @${handle}\n\n${userContent}` },
        ],
      }),
    });

    if (!aiRes.ok) throw new Error(`AI gateway error: ${aiRes.status}`);

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const toneAnalysis = JSON.parse(cleaned);

    // ── 4. Upsert into creator_reference_accounts ─────────────────────────────
    const { error: upsertErr } = await supabase
      .from("creator_reference_accounts")
      .upsert(
        {
          user_id: user.id,
          instagram_handle: handle,
          display_name: displayName,
          bio,
          profile_picture_url: profilePic,
          follower_count: followerCount,
          why_inspiring: why_inspiring || null,
          recent_captions: allCaptions.length > 0 ? allCaptions : null,
          tone_analysis: toneAnalysis,
          last_analyzed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,instagram_handle" },
      );

    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({
      handle,
      display_name: displayName,
      profile_picture_url: profilePic,
      follower_count: followerCount,
      bio,
      tone_analysis: toneAnalysis,
      captions_analyzed: allCaptions.length,
      source: fetchedCaptions.length > 0 ? "instagram_api" : "manual",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("analyze-reference-account error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
