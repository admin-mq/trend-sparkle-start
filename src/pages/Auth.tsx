import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, User, Loader2, AlertCircle, CheckCircle, Eye, EyeOff, ArrowLeft, TrendingUp, Users, Zap, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { AccountType } from '@/types/auth';
import { MQLogo } from '@/components/MQLogo';

const BLOCKED_EMAIL_DOMAINS = ['gmail.com', 'googlemail.com'];

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Argentina", "Australia",
  "Austria", "Bangladesh", "Belgium", "Brazil", "Canada",
  "Chile", "China", "Colombia", "Croatia", "Czech Republic",
  "Denmark", "Egypt", "Ethiopia", "Finland", "France",
  "Germany", "Ghana", "Greece", "Hungary", "India",
  "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
  "Italy", "Japan", "Jordan", "Kenya", "Malaysia",
  "Mexico", "Morocco", "Netherlands", "New Zealand", "Nigeria",
  "Norway", "Pakistan", "Peru", "Philippines", "Poland",
  "Portugal", "Romania", "Russia", "Saudi Arabia", "Serbia",
  "Singapore", "South Africa", "South Korea", "Spain", "Sweden",
  "Switzerland", "Taiwan", "Tanzania", "Thailand", "Turkey",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States", "Vietnam", "Zimbabwe",
];

type Step = 'select-type' | 'auth';
type AuthMode = 'login' | 'signup';

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp, signInWithGoogle } = useAuthContext();

  const [step, setStep] = useState<Step>('select-type');
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup form state
  const [accountType, setAccountType] = useState<AccountType>('brand');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [brandName, setBrandName] = useState('');
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const validateSignupForm = () => {
    const errors: Record<string, string> = {};

    if (!signupEmail.trim()) {
      errors.email = 'Email is required';
    } else {
      const emailDomain = signupEmail.split('@')[1]?.toLowerCase();
      if (accountType === 'brand' && BLOCKED_EMAIL_DOMAINS.includes(emailDomain)) {
        errors.email = 'Please use your work email (Gmail not allowed for brand accounts).';
      }
    }

    if (!signupPassword) {
      errors.password = 'Password is required';
    } else if (signupPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (signupPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (accountType === 'brand') {
      if (!brandName.trim()) errors.brandName = 'Brand name is required';
    } else {
      if (!fullName.trim()) errors.fullName = 'Name is required';
    }

    if (!location.trim()) errors.location = 'Location is required';

    setSignupErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Please enter your email and password');
      return;
    }

    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);

    if (error) {
      setLoginError(error.message || 'Invalid email or password');
    } else {
      toast.success('Welcome back!');
      navigate('/dashboard', { replace: true });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateSignupForm()) return;

    setLoading(true);
    const { error } = await signUp({
      email: signupEmail,
      password: signupPassword,
      accountType,
      fullName: accountType === 'creator' ? fullName : undefined,
      brandName: accountType === 'brand' ? brandName : undefined,
      location,
    });
    setLoading(false);

    if (error) {
      setSignupErrors({ submit: error.message });
    } else {
      setSignupSuccess(true);
      toast.success('Account created! Please check your email to verify.');
    }
  };

  const selectType = (type: AccountType) => {
    setAccountType(type);
    setStep('auth');
    setAuthMode('signup');
  };

  const goBack = () => {
    setStep('select-type');
    setSignupErrors({});
    setLoginError('');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (signupSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
            <p className="text-muted-foreground">
              We've sent a verification link to <strong className="text-foreground">{signupEmail}</strong>.<br />
              Click the link to activate your account.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => { setSignupSuccess(false); setAuthMode('login'); }}
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step 1: Type Selection ──────────────────────────────────────────────────
  if (step === 'select-type') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-3xl space-y-10">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-3 mb-1">
              <MQLogo size={44} showBackground={true} />
              <h1 className="text-3xl font-bold text-foreground">Marketers Quest</h1>
            </div>
            <p className="text-base text-muted-foreground">Your AI-powered marketing platform</p>
            <p className="text-lg font-medium text-foreground pt-2">How will you use Marketers Quest?</p>
          </div>

          {/* Type Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Brand Card */}
            <button
              disabled
              className={cn(
                "group relative text-left rounded-2xl border-2 p-8 transition-all duration-200",
                "border-border bg-card opacity-60 cursor-not-allowed"
              )}
            >
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border">
                  Coming Soon
                </span>
              </div>
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center transition-colors">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-foreground">Brand / Company</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Run campaigns, discover creators, and track performance — all in one place.
                  </p>
                </div>
                <ul className="space-y-2 pt-1">
                  {[
                    { icon: Users, label: 'Find & manage creators' },
                    { icon: BarChart3, label: 'Campaign analytics' },
                    { icon: TrendingUp, label: 'Trend-driven content strategy' },
                  ].map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </button>

            {/* Creator Card */}
            <button
              onClick={() => selectType('creator')}
              className={cn(
                "group relative text-left rounded-2xl border-2 p-8 transition-all duration-200",
                "border-border bg-card hover:border-primary hover:shadow-lg hover:shadow-primary/10",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              )}
            >
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-foreground">Creator</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Grow your audience, connect with brands, and monetize your content effortlessly.
                  </p>
                </div>
                <ul className="space-y-2 pt-1">
                  {[
                    { icon: Zap, label: 'AI-powered content generation' },
                    { icon: TrendingUp, label: 'Trending topics & insights' },
                    { icon: Users, label: 'Brand collaboration tools' },
                  ].map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs font-medium text-primary">Get started →</span>
              </div>
            </button>
          </div>

          {/* Already have account */}
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              onClick={() => { setStep('auth'); setAuthMode('login'); }}
              className="text-primary font-medium hover:underline underline-offset-4"
            >
              Log in
            </button>
          </p>

          {/* Footer */}
          <div className="text-center space-y-1 pt-2">
            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our{' '}
              <Link to="/terms-and-conditions" className="underline underline-offset-4 hover:text-foreground">Terms</Link>
              {' '}and{' '}
              <Link to="/privacy-policy" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 2: Auth Forms ──────────────────────────────────────────────────────
  const isLogin = authMode === 'login';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Back + Header */}
        <div className="space-y-4">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Change account type
          </button>

          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-3 mb-1">
              <MQLogo size={36} showBackground={true} />
              <h1 className="text-2xl font-bold text-foreground">Marketers Quest</h1>
            </div>
            {/* Account type badge */}
            {!isLogin && (
              <div className="flex justify-center pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {accountType === 'brand' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                  {accountType === 'brand' ? 'Brand / Company' : 'Creator'} account
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Login / Signup toggle */}
        <div className="flex rounded-xl border border-border bg-muted/40 p-1 gap-1">
          <button
            onClick={() => setAuthMode('login')}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
              isLogin
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Log in
          </button>
          <button
            onClick={() => setAuthMode('signup')}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
              !isLogin
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sign up
          </button>
        </div>

        {/* ── Login Form ── */}
        {isLogin && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  tabIndex={-1}
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            {loginError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Log in
            </Button>

            <Divider />

            <GoogleButton loading={loading} onClick={() => signInWithGoogle(accountType)} />
          </form>
        )}

        {/* ── Signup Form ── */}
        {!isLogin && (
          <form onSubmit={handleSignup} className="space-y-4">
            {accountType === 'brand' ? (
              <div className="space-y-2">
                <Label htmlFor="brand-name">Brand Name *</Label>
                <Input
                  id="brand-name"
                  placeholder="Your company name"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  disabled={loading}
                />
                {signupErrors.brandName && <FieldError msg={signupErrors.brandName} />}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="full-name">Your Name *</Label>
                <Input
                  id="full-name"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                />
                {signupErrors.fullName && <FieldError msg={signupErrors.fullName} />}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="signup-email">
                {accountType === 'brand' ? 'Work Email *' : 'Email *'}
              </Label>
              <Input
                id="signup-email"
                type="email"
                placeholder={accountType === 'brand' ? 'you@company.com' : 'you@example.com'}
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                disabled={loading}
              />
              {signupErrors.email && <FieldError msg={signupErrors.email} />}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Country *</Label>
              <Select value={location} onValueChange={setLocation} disabled={loading}>
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {signupErrors.location && <FieldError msg={signupErrors.location} />}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">Password *</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showSignupPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  tabIndex={-1}
                >
                  {showSignupPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {signupErrors.password && <FieldError msg={signupErrors.password} />}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password *</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {signupErrors.confirmPassword && <FieldError msg={signupErrors.confirmPassword} />}
            </div>

            {signupErrors.submit && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{signupErrors.submit}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Account
            </Button>

            <Divider />

            <GoogleButton loading={loading} onClick={() => signInWithGoogle(accountType)} />
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-2">
          By continuing, you agree to our{' '}
          <Link to="/terms-and-conditions" className="underline underline-offset-4 hover:text-foreground">Terms</Link>
          {' '}and{' '}
          <Link to="/privacy-policy" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="relative my-1">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">or</span>
      </div>
    </div>
  );
}

function GoogleButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <div className="relative">
      <Button type="button" variant="outline" className="w-full opacity-50 cursor-not-allowed" disabled>
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </Button>
      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border whitespace-nowrap">
        Coming Soon
      </span>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <p className="text-sm text-destructive">{msg}</p>;
}
