import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles, Building2, User, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AccountType } from '@/types/auth';

const BLOCKED_EMAIL_DOMAINS = ['gmail.com', 'googlemail.com'];

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp } = useAuthContext();

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Signup form state
  const [accountType, setAccountType] = useState<AccountType>('brand');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [brandName, setBrandName] = useState('');
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const validateSignupForm = () => {
    const errors: Record<string, string> = {};

    // Email validation
    if (!signupEmail.trim()) {
      errors.email = 'Email is required';
    } else {
      const emailDomain = signupEmail.split('@')[1]?.toLowerCase();
      if (accountType === 'brand' && BLOCKED_EMAIL_DOMAINS.includes(emailDomain)) {
        errors.email = 'Please use your work email (Gmail not allowed for brand accounts).';
      }
    }

    // Password validation
    if (!signupPassword) {
      errors.password = 'Password is required';
    } else if (signupPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    // Account type specific validation
    if (accountType === 'brand') {
      if (!brandName.trim()) {
        errors.brandName = 'Brand name is required';
      }
    } else {
      if (!fullName.trim()) {
        errors.fullName = 'Name is required';
      }
    }

    // Location validation
    if (!location.trim()) {
      errors.location = 'Location is required';
    }

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

    if (!validateSignupForm()) {
      return;
    }

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
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We've sent a verification link to <strong>{signupEmail}</strong>. 
              Please click the link to verify your account and get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setSignupSuccess(false);
                setActiveTab('login');
              }}
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Marketers Quest</h1>
          </div>
          <p className="text-sm text-muted-foreground">Your AI-powered marketing toolkit</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Log in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-6">
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
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  {loginError && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Log in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <form onSubmit={handleSignup} className="space-y-4">
                  {/* Account Type Selector */}
                  <div className="space-y-3">
                    <Label>I am a...</Label>
                    <RadioGroup
                      value={accountType}
                      onValueChange={(v) => setAccountType(v as AccountType)}
                      className="grid grid-cols-2 gap-3"
                    >
                      <Label
                        htmlFor="type-brand"
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all",
                          accountType === 'brand'
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <RadioGroupItem value="brand" id="type-brand" className="sr-only" />
                        <Building2 className={cn("w-6 h-6", accountType === 'brand' ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-sm font-medium", accountType === 'brand' ? "text-foreground" : "text-muted-foreground")}>
                          Brand / Company
                        </span>
                      </Label>
                      <Label
                        htmlFor="type-creator"
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all",
                          accountType === 'creator'
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <RadioGroupItem value="creator" id="type-creator" className="sr-only" />
                        <User className={cn("w-6 h-6", accountType === 'creator' ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-sm font-medium", accountType === 'creator' ? "text-foreground" : "text-muted-foreground")}>
                          Creator
                        </span>
                      </Label>
                    </RadioGroup>
                  </div>

                  {/* Brand-specific field */}
                  {accountType === 'brand' && (
                    <div className="space-y-2">
                      <Label htmlFor="brand-name">Brand Name *</Label>
                      <Input
                        id="brand-name"
                        placeholder="Your company name"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        disabled={loading}
                      />
                      {signupErrors.brandName && (
                        <p className="text-sm text-destructive">{signupErrors.brandName}</p>
                      )}
                    </div>
                  )}

                  {/* Creator-specific field */}
                  {accountType === 'creator' && (
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Name *</Label>
                      <Input
                        id="full-name"
                        placeholder="Your name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={loading}
                      />
                      {signupErrors.fullName && (
                        <p className="text-sm text-destructive">{signupErrors.fullName}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">
                      {accountType === 'brand' ? 'Brand Email *' : 'Email *'}
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder={accountType === 'brand' ? 'you@company.com' : 'you@example.com'}
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={loading}
                    />
                    {signupErrors.email && (
                      <p className="text-sm text-destructive">{signupErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      placeholder="City, Country"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      disabled={loading}
                    />
                    {signupErrors.location && (
                      <p className="text-sm text-destructive">{signupErrors.location}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password *</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Min 8 characters"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={loading}
                    />
                    {signupErrors.password && (
                      <p className="text-sm text-destructive">{signupErrors.password}</p>
                    )}
                  </div>

                  {signupErrors.submit && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      <span>{signupErrors.submit}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
