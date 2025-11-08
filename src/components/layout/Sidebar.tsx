import { Home, TrendingUp, Compass, Grid, GraduationCap, Plus } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MockTestPromo } from "@/components/common/MockTestPromo";

const navItems = [
  { icon: Home, label: "Home Page", path: "/" },
  { icon: TrendingUp, label: "Trending", path: "/trending" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Grid, label: "All", path: "/all" },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleAddEntranceExam = () => {
    navigate('/auth');
  };

  return (
    <aside className="hidden lg:block w-72 border-r bg-card h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
      <div className="p-4 space-y-6">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary border-l-4 border-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:translate-x-1"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Entrance Exams</h3>
          
          <div className="text-sm text-muted-foreground mb-3">
            Sign in to add and manage your entrance exams
          </div>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleAddEntranceExam}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Entrance Exam
          </Button>
        </div>

        <MockTestPromo />
      </div>
    </aside>
  );
};
