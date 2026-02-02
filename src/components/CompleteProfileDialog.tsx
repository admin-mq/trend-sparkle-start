import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, User, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AccountType } from '@/types/auth';
import { supabase } from '@/integrations/supabase/client';

const BLOCKED_EMAIL_DOMAINS = ['gmail.com', 'googlemail.com'];

interface CompleteProfileDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
}

export function CompleteProfileDialog({ 
  open, 
  onClose, 
  userId, 
  userEmail 
}: CompleteProfileDialogProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('brand');
  const [brandName, setBrandName] = useState('');
  const [fullName, setFullName] = useState('');
  const [brandEmail, setBrandEmail] = useState('');
  const [location, setLocation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (accountType === 'brand') {
      if (!brandName.trim()) {
        newErrors.brandName = 'Brand name is required';
      }
      if (!brandEmail.trim()) {
        newErrors.brandEmail = 'Brand email is required';
      } else {
        const emailDomain = brandEmail.split('@')[1]?.toLowerCase();
        if (BLOCKED_EMAIL_DOMAINS.includes(emailDomain)) {
          newErrors.brandEmail = 'Please use your work email (Gmail not allowed for brand accounts).';
        }
      }
    } else {
      if (!fullName.trim()) {
        newErrors.fullName = 'Name is required';
      }
    }

    if (!location.trim()) {
      newErrors.location = 'Location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          account_type: accountType,
          brand_name: accountType === 'brand' ? brandName : null,
          full_name: accountType === 'creator' ? fullName : null,
          email: accountType === 'brand' ? brandEmail : userEmail,
          location,
        });

      if (error) throw error;

      toast.success('Profile completed successfully!');
      onClose();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Tell us a bit about yourself to get started with Marketers Quest.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account Type Selector */}
          <div className="space-y-3">
            <Label>I am a...</Label>
            <RadioGroup
              value={accountType}
              onValueChange={(v) => setAccountType(v as AccountType)}
              className="grid grid-cols-2 gap-3"
            >
              <Label
                htmlFor="profile-type-brand"
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  accountType === 'brand'
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value="brand" id="profile-type-brand" className="sr-only" />
                <Building2 className={cn("w-6 h-6", accountType === 'brand' ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-medium", accountType === 'brand' ? "text-foreground" : "text-muted-foreground")}>
                  Brand / Company
                </span>
              </Label>
              <Label
                htmlFor="profile-type-creator"
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  accountType === 'creator'
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value="creator" id="profile-type-creator" className="sr-only" />
                <User className={cn("w-6 h-6", accountType === 'creator' ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-medium", accountType === 'creator' ? "text-foreground" : "text-muted-foreground")}>
                  Creator
                </span>
              </Label>
            </RadioGroup>
          </div>

          {/* Brand-specific fields */}
          {accountType === 'brand' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="profile-brand-name">Brand Name *</Label>
                <Input
                  id="profile-brand-name"
                  placeholder="Your company name"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  disabled={loading}
                />
                {errors.brandName && (
                  <p className="text-sm text-destructive">{errors.brandName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-brand-email">Brand Email *</Label>
                <Input
                  id="profile-brand-email"
                  type="email"
                  placeholder="you@company.com"
                  value={brandEmail}
                  onChange={(e) => setBrandEmail(e.target.value)}
                  disabled={loading}
                />
                {errors.brandEmail && (
                  <p className="text-sm text-destructive">{errors.brandEmail}</p>
                )}
              </div>
            </>
          )}

          {/* Creator-specific field */}
          {accountType === 'creator' && (
            <div className="space-y-2">
              <Label htmlFor="profile-full-name">Name *</Label>
              <Input
                id="profile-full-name"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="profile-location">Location *</Label>
            <Input
              id="profile-location"
              placeholder="City, Country"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={loading}
            />
            {errors.location && (
              <p className="text-sm text-destructive">{errors.location}</p>
            )}
          </div>

          {errors.submit && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.submit}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Complete Profile
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
