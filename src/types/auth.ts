export type AccountType = 'brand' | 'creator';

export interface UserProfile {
  user_id: string;
  account_type: AccountType;
  full_name: string | null;
  brand_name: string | null;
  email: string | null;
  location: string | null;
  created_at: string;
  updated_at: string | null;
  // Legacy fields from existing table
  industry?: string | null;
  industry_other?: string | null;
  geography?: string | null;
  business_summary?: string | null;
  logo_url?: string | null;
  website?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
}

export interface SignUpData {
  email: string;
  password: string;
  accountType: AccountType;
  fullName?: string;
  brandName?: string;
  location: string;
}

export interface AuthContextType {
  user: import('@supabase/supabase-js').User | null;
  session: import('@supabase/supabase-js').Session | null;
  profile: UserProfile | null;
  loading: boolean;
  needsProfileCompletion: boolean;
  setNeedsProfileCompletion: (value: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (data: SignUpData) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
}
