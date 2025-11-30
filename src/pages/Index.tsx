import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Header Section */}
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Trend Test
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            This app will show trending topics for different brands.
          </p>
        </div>

        {/* Placeholder Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-foreground">
              Trending Topics
            </h2>
            <span className="text-sm text-muted-foreground">
              Coming soon
            </span>
          </div>

          {/* Empty State Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((index) => (
              <Card 
                key={index} 
                className="bg-card border-border shadow-card hover:shadow-lg transition-all duration-300"
              >
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
                    Brand Trend #{index}
                  </CardTitle>
                  <CardDescription>
                    Trend data will appear here
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded-full w-full animate-pulse" />
                    <div className="h-3 bg-muted rounded-full w-5/6 animate-pulse" />
                    <div className="h-3 bg-muted rounded-full w-4/6 animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Info Card */}
          <Card className="mt-8 bg-gradient-soft border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Ready for Data</CardTitle>
              <CardDescription>
                Connect your database to start displaying real-time trending topics
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default Index;
