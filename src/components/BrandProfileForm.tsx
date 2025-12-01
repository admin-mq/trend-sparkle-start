import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { UserProfile, RecommendedTrend } from "@/types/trends";

interface BrandProfileFormProps {
  onRecommendationsReceived: (recommendations: RecommendedTrend[]) => void;
  onBrandNameChange: (brandName: string) => void;
}

export const BrandProfileForm = ({ onRecommendationsReceived, onBrandNameChange }: BrandProfileFormProps) => {
  const [userProfile, setUserProfile] = useState<UserProfile>({
    brand_name: '',
    industry: '',
    niche: '',
    audience: '',
    geography: '',
    tone: '',
    content_format: '',
    primary_goal: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setUserProfile(prev => ({ ...prev, [field]: value }));
    if (field === 'brand_name') {
      onBrandNameChange(value);
    }
  };

  const handleSubmit = async () => {
    if (!userProfile.brand_name.trim()) {
      setError('Please enter a brand name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch top 5 trends from Supabase
      const { data: trends, error: trendsError } = await supabase
        .from('trends')
        .select('trend_id, trend_name, views_last_60h_millions')
        .eq('region', 'Global')
        .eq('premium_only', false)
        .eq('active', true)
        .order('views_last_60h_millions', { ascending: false })
        .limit(5);

      if (trendsError) {
        throw trendsError;
      }

      // Generate mock recommendations with placeholder text
      const recommendedTrends: RecommendedTrend[] = (trends || []).map((trend) => ({
        ...trend,
        why_good_fit: `This is a strong fit for ${userProfile.brand_name} because it is a high-attention global trend.`,
        example_hook: `Example hook using ${trend.trend_name} for ${userProfile.brand_name}`,
        angle_summary: `Short summary of how ${userProfile.brand_name} could use ${trend.trend_name} in their content.`
      }));

      onRecommendationsReceived(recommendedTrends);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Brand Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="brand_name">Brand name</Label>
            <Input
              id="brand_name"
              value={userProfile.brand_name}
              onChange={(e) => handleInputChange('brand_name', e.target.value)}
              placeholder="Enter brand name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={userProfile.industry}
              onChange={(e) => handleInputChange('industry', e.target.value)}
              placeholder="e.g., Fashion, Tech, Food"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="niche">Niche</Label>
            <Input
              id="niche"
              value={userProfile.niche}
              onChange={(e) => handleInputChange('niche', e.target.value)}
              placeholder="e.g., Sustainable fashion"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience">Audience</Label>
            <Input
              id="audience"
              value={userProfile.audience}
              onChange={(e) => handleInputChange('audience', e.target.value)}
              placeholder="e.g., Gen Z, Millennials"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="geography">Geography</Label>
            <Input
              id="geography"
              value={userProfile.geography}
              onChange={(e) => handleInputChange('geography', e.target.value)}
              placeholder="e.g., US, Europe, Global"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <Input
              id="tone"
              value={userProfile.tone}
              onChange={(e) => handleInputChange('tone', e.target.value)}
              placeholder="e.g., Professional, Casual"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content_format">Content format</Label>
            <Input
              id="content_format"
              value={userProfile.content_format}
              onChange={(e) => handleInputChange('content_format', e.target.value)}
              placeholder="e.g., Video, Images, Text"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary_goal">Primary goal</Label>
            <Input
              id="primary_goal"
              value={userProfile.primary_goal}
              onChange={(e) => handleInputChange('primary_goal', e.target.value)}
              placeholder="e.g., Brand awareness, Sales"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <Button 
          onClick={handleSubmit} 
          disabled={loading}
          className="w-full md:w-auto"
        >
          {loading ? 'Loading...' : 'Get AI trend suggestions'}
        </Button>
      </CardContent>
    </Card>
  );
};
