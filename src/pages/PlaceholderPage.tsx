import { LucideIcon, Clock } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const PlaceholderPage = ({ title, description, icon: Icon }: PlaceholderPageProps) => {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-6">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground mb-6">{description}</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Clock className="w-4 h-4" />
          Coming soon
        </div>
      </div>
    </div>
  );
};
