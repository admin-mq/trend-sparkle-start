import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// External Supabase credentials (user's own project with brand data)
const EXTERNAL_SUPABASE_URL = "https://njnnpdrevbkhbhzwccuz.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qbm5wZHJldmJraGJoendjY3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTg3ODQsImV4cCI6MjA3OTk3NDc4NH0.WKuei-3pR2TphEKjSOOhvNlECrX93Jt9NE5SK2TcD-M";

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
    // Try user-specific first
    const { data: userMemory } = await supabase
      .from("brand_memory")
      .select("*")
      .eq("user_id", userId)
      .eq("brand_name", brandName)
      .maybeSingle();

    if (userMemory) return userMemory;

    // Fallback to shared
    const { data: sharedMemory } = await supabase
      .from("brand_memory")
      .select("*")
      .is("user_id", null)
      .eq("brand_name", brandName)
      .maybeSingle();

    return sharedMemory;
  }

  // Anonymous: shared only
  const { data } = await supabase
    .from("brand_memory")
    .select("*")
    .is("user_id", null)
    .eq("brand_name", brandName)
    .maybeSingle();

  return data;
}

async function upsertBrandMemory(
  supabase: any,
  memory: BrandMemory
): Promise<BrandMemory | null> {
  const { data, error } = await supabase
    .from("brand_memory")
    .upsert(memory, { onConflict: "user_id,brand_name" })
    .select()
    .single();

  if (error) {
    console.error("Error upserting brand memory:", error);
    return null;
  }
  return data;
}

async function addBrandExample(
  supabase: any,
  params: {
    userId: string | null;
    brandName: string;
    outputType: string;
    text: string;
    rating?: number;
  }
): Promise<boolean> {
  const { error } = await supabase.from("brand_examples").insert({
    user_id: params.userId,
    brand_name: params.brandName,
    output_type: params.outputType,
    text_content: params.text,
    rating: params.rating,
  });

  if (error) {
    console.error("Error adding brand example:", error);
    return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      brand_profile,
      current_memory,
      new_output,
      output_type,
      user_feedback,
      user_note,
      user_id
    } = await req.json();

    console.log('Received update-brand-memory request:', {
      brand_name: brand_profile?.brand_name,
      output_type,
      user_feedback,
      user_id: user_id || 'anonymous'
    });

    if (!brand_profile) {
      return new Response(
        JSON.stringify({ error: 'brand_profile is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!new_output || !output_type || !user_feedback) {
      return new Response(
        JSON.stringify({ error: 'new_output, output_type, and user_feedback are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user_id || null;
    const brandName = brand_profile.brand_name || "Unknown Brand";

    // Initialize external Supabase client
    const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);

    // Get latest server-side memory
    const latestMemory = await getBrandMemory(externalSupabase, userId, brandName);
    console.log('Current memory:', latestMemory ? 'found' : 'not found');

    // Call OpenAI to update memory
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const systemPrompt = `You are a brand voice librarian. Your job is to maintain a concise, useful memory of how a brand likes to sound on social media.

You receive:
- brand_profile (raw info from the user)
- current_memory (may be null)
- new_output (a hook, caption, or blueprint the brand just saw)
- output_type (hook/caption/blueprint)
- user_feedback (love/ok/dislike)
- user_note (optional extra guidance from the user)

You must return a JSON object describing the UPDATED brand memory.

Rules:
- If current_memory is null, initialise it from brand_profile and the new_output.
- If user_feedback is 'love', move the memory closer to the style of this output.
- If 'dislike', move the memory away from this style.
- Keep voice_profile_text short (2–4 sentences).
- do_list: bullet points of things the brand LIKES (tone, phrases, structures).
- dont_list: bullet points of things to avoid.
- preferred_formats: formats or structures they seem to like (e.g. 'POV reels', '3-slide carousels').
- tone_preferences: include primary_tones and a rough intensity_preference (1–5).

Respond ONLY with JSON in this exact shape:
{
  "voice_profile_text": "string",
  "do_list": ["string"],
  "dont_list": ["string"],
  "preferred_formats": ["string"],
  "tone_preferences": {
    "primary_tones": ["string"],
    "intensity_preference": number
  }
}`;

    const userMessage = JSON.stringify({
      brand_profile,
      current_memory: latestMemory,
      new_output,
      output_type,
      user_feedback,
      user_note
    });

    console.log('Calling OpenAI API for memory update...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API call failed: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    console.log('OpenAI response received, parsing...');
    const parsedResponse = JSON.parse(content);

    // Build the BrandMemory object
    const updatedMemory: BrandMemory = {
      user_id: userId,
      brand_name: brandName,
      business_summary: brand_profile.business_summary ?? null,
      voice_profile_text: parsedResponse.voice_profile_text,
      do_list: parsedResponse.do_list,
      dont_list: parsedResponse.dont_list,
      preferred_formats: parsedResponse.preferred_formats,
      tone_preferences: parsedResponse.tone_preferences
    };

    // Upsert the memory
    const savedMemory = await upsertBrandMemory(externalSupabase, updatedMemory);
    console.log('Memory upserted:', savedMemory ? 'success' : 'failed');

    // Add brand example
    const rating = user_feedback === "love" ? 5 : user_feedback === "ok" ? 3 : 1;
    await addBrandExample(externalSupabase, {
      userId,
      brandName,
      outputType: output_type,
      text: new_output,
      rating
    });
    console.log('Brand example added with rating:', rating);

    return new Response(
      JSON.stringify({ 
        success: true,
        updated_memory: savedMemory || updatedMemory 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-brand-memory function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
