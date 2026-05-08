import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOCATIONS = ['UK', 'US', 'CA', 'AU', 'NZ', 'IN'] as const;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_ANON_KEY')!;

  const fetchTrendsUrl = `${supabaseUrl}/functions/v1/fetch-trends`;
  const results: Record<string, string> = {};

  for (const location of LOCATIONS) {
    console.log(`[fetch-trends-all-regions] Fetching trends for ${location}...`);
    try {
      const resp = await fetch(fetchTrendsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ location }),
      });

      if (resp.ok) {
        const json = await resp.json().catch(() => ({}));
        const count = json.inserted ?? json.upserted ?? json.count ?? '?';
        results[location] = `ok (${count} trends)`;
        console.log(`[fetch-trends-all-regions] ${location} done: ${results[location]}`);
      } else {
        const text = await resp.text().catch(() => resp.statusText);
        results[location] = `error ${resp.status}: ${text.slice(0, 200)}`;
        console.error(`[fetch-trends-all-regions] ${location} failed:`, results[location]);
      }
    } catch (err) {
      results[location] = `exception: ${String(err)}`;
      console.error(`[fetch-trends-all-regions] ${location} exception:`, err);
    }

    // Stagger calls to avoid rate-limiting downstream APIs
    await delay(3000);
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
