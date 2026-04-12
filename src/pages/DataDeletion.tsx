import { useSearchParams } from "react-router-dom";
import { CheckCircle, Mail, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DataDeletion = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Data Deletion</h1>
          <p className="text-muted-foreground text-sm">Marketers Quest · MQAIS Technologies LLP</p>
        </div>

        {/* Confirmation code (shown after Meta callback) */}
        {code && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Deletion request received</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Your data deletion request has been logged and will be processed within 7 days.
                </p>
                <div className="mt-3 px-3 py-2 rounded-md bg-secondary text-xs font-mono">
                  Confirmation code: <span className="font-bold text-foreground">{code}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* What gets deleted */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What data we delete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>When you request deletion, we permanently remove:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Your account and login credentials</li>
              <li>All brand profiles you created</li>
              <li>AI-generated trend recommendations and content</li>
              <li>Brand memory and feedback history</li>
              <li>Any other data associated with your account</li>
            </ul>
            <p className="mt-3 text-xs">
              We do not store any personal Instagram user data. Trend data (hashtag signals) is anonymous
              and shared across all users — it is not deleted on a per-user basis.
            </p>
          </CardContent>
        </Card>

        {/* How to request deletion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How to delete your data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="font-medium">Option 1 — From the platform</p>
              <p className="text-muted-foreground">
                Log in to Marketers Quest and go to <strong>Settings → Delete Account</strong>. Your data will be deleted immediately.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Option 2 — By email</p>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>
                  Email <a href="mailto:contact@marketers.quest" className="text-primary underline underline-offset-2">contact@marketers.quest</a> with
                  subject <strong>"Delete My Account"</strong>. We will process within 7 days and confirm by email.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Full details in our{" "}
          <a href="https://marketers.quest/privacy-policy/" className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};

export default DataDeletion;
