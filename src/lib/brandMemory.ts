// Brand memory types for frontend use
// Note: All database operations happen in edge functions against the external Supabase

export type BrandMemory = {
  user_id: string | null;
  brand_name: string;
  business_summary?: string | null;
  voice_profile_text?: string | null;
  do_list?: string[] | null;
  dont_list?: string[] | null;
  preferred_formats?: string[] | null;
  tone_preferences?: {
    primary_tones?: string[];
    intensity_preference?: number;
  } | null;
};

export type UpdateBrandMemoryParams = {
  brand_profile: Record<string, any>;
  current_memory: BrandMemory | null;
  new_output: string;
  output_type: "hook" | "caption" | "blueprint";
  user_feedback: "love" | "ok" | "dislike";
  user_note?: string;
  user_id?: string | null;
};

/**
 * Update brand memory via edge function
 */
export async function updateBrandMemory(
  params: UpdateBrandMemoryParams
): Promise<{ success: boolean; updated_memory?: BrandMemory; error?: string }> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-brand-memory`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || "Failed to update brand memory" };
    }

    const data = await response.json();
    return { success: true, updated_memory: data.updated_memory };
  } catch (error) {
    console.error("Error updating brand memory:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
