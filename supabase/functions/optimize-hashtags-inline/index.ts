import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { caption, current_hashtags, niche, platform, trend_name } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are a hashtag strategy expert for ${platform || "Instagram"}.

Given the following post details, generate the best 20 hashtags to maximise reach and discoverability.

Caption: ${caption || "(no caption)"}
Niche: ${niche || "general"}
Trend: ${trend_name || "general"}
Current hashtags already suggested: ${(current_hashtags || []).join(", ")}

Rules:
- Mix of sizes: 5 high-volume (1M+ posts), 8 medium (100k–1M), 7 niche (<100k).
- All must be directly relevant — no generic #love #instagood #photooftheday.
- Include the trend name as a hashtag if appropriate.
- No duplicates with current hashtags.
- Return ONLY a JSON array of hashtag strings, e.g. ["#fitnessgoals", "#morningroutine"].
- No markdown, no explanation.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`AI gateway error: ${res.status}`);

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "[]";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const hashtags: string[] = JSON.parse(cleaned);

    return new Response(JSON.stringify({ hashtags }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("optimize-hashtags-inline error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
