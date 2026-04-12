import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, ArrowRight } from "lucide-react";

export const ProfileMissingCard = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-6">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <User className="w-7 h-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Complete your Profile</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Set up your brand profile once to enable 1-click Trend Quest and other tools.
      </p>
      <Link to="/profile">
        <Button className="gap-2">
          Set up Profile
          <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
};
