import { Button } from "@/components/ui/button";

export const MOCK_TEST_URL = "https://dub.link/Bwm29xf";

export function MockTestPromo() {
  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 shadow-sm">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-primary tracking-wide uppercase">
            Practice JEE Mock Test
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            All PYQ&apos;s included
          </p>
        </div>
        <Button
          asChild
          className="w-full bg-primary hover:bg-primary/90 shadow-md"
          size="sm"
        >
          <a href={MOCK_TEST_URL} target="_blank" rel="noopener noreferrer">
            Attempt Now
          </a>
        </Button>
      </div>
    </div>
  );
}

