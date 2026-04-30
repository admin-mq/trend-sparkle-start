import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Amcue, the AI Chief Marketing Officer (CMO) for Marketers Quest. You are an expert in digital marketing, SEO, social media strategy, content marketing, paid advertising, influencer marketing, PR, and brand strategy.

Your personality:
- Professional but approachable
- Data-driven and strategic
- Proactive with actionable recommendations
- You speak in clear, concise marketing language
- You reference real marketing frameworks and best practices

When users ask about their website or marketing:
- Give specific, actionable advice
- Suggest metrics to track
- Recommend tools and strategies
- Create frameworks and plans when asked
- Reference current marketing trends

Keep responses concise but thorough. Use bullet points and structure for readability. Always end with a clear next step or action item.`;

const EXTRACT_SYSTEM_PROMPT = `You are a brand data extractor. Given a user message in a marketing chat, extract any brand or company information the user mentions. Return ONLY a valid JSON object — no markdown, no explanation. Only include fields where the information is clearly stated. Omit fields not mentioned (do not include them at all, not even as null).

Fields to extract (use exact key names):
- company_name (string)
- company_description (string)
- industry (string)
- business_model (string, e.g. B2C, B2B, SaaS, D2C, Marketplace)
- usp (string, unique selling proposition or what makes them different)
- target_audience (string)
- geographic_markets (array of strings, countries or regions)
- products_services (string, what they sell)
- marketing_goals (array of strings)
- biggest_marketing_challenge (string)
- current_channels (object, keys are channel names e.g. "instagram", "google_ads", values are brief descriptions)
- monthly_marketing_budget_usd (number, only if a USD amount is clearly stated)
- average_order_value_usd (number)
- customer_ltv_usd (number)
- competitors (array of strings, competitor brand or company names)
- brand_voice (string, tone/personality description)`;

async function extractBrandInfo(
  userMessage: string,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<void> {
  try {
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: EXTRACT_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!extractResponse.ok) return;

    const extractData = await extractResponse.json();
    const raw = extractData.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const extracted: Record<string, unknown> = JSON.parse(cleaned);

    // Keep only non-empty values
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(extracted)) {
      if (value === null || value === undefined || value === "") continue;
      if (Array.isArray(value) && value.length === 0) continue;
      updates[key] = value;
    }

    if (Object.keys(updates).length === 0) return;

    await supabase.from("amcue_brand_memory").upsert(
      { user_id: userId, ...updates, last_updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  } catch (e) {
    console.error("Brand extraction error:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversation_id, message, context_page } = await req.json();

    let convId = conversation_id;

    // Create new conversation if needed
    if (!convId) {
      const title = message.length > 50 ? message.substring(0, 50) + "..." : message;
      const { data: conv, error: convErr } = await supabase
        .from("amcue_conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      if (convErr) throw convErr;
      convId = conv.id;
    }

    // Save user message
    await supabase.from("amcue_messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
      context_page,
    });

    // Fetch conversation history (last 20 messages)
    const { data: history } = await supabase
      .from("amcue_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Run main AI call and brand extraction in parallel
    const [aiResponse] = await Promise.all([
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
        }),
      }),
      extractBrandInfo(message, user.id, supabase, LOVABLE_API_KEY),
    ]);

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    // Save assistant message
    await supabase.from("amcue_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: reply,
    });

    return new Response(JSON.stringify({
      conversation_id: convId,
      content: reply,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("amcue-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
