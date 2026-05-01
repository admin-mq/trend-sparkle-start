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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

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
- Return JSON in the form { "hashtags": ["#tag1", "#tag2", ...] }.
- Each item starts with '#'. No spaces inside tags.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("OpenAI error", res.status, errBody);
      throw new Error(`OpenAI error: ${res.status}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    let hashtags: string[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.hashtags)
        ? parsed.hashtags
        : [];

    // Sanitise: ensure starts with '#', no spaces, dedupe
    hashtags = Array.from(new Set(
      hashtags
        .map((t: any) => String(t).trim().replace(/\s+/g, ""))
        .filter(Boolean)
        .map((t: string) => (t.startsWith("#") ? t : `#${t}`))
    ));

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
