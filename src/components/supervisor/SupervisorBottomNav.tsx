import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Briefcase, Clock, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePendingApprovalsCount } from "@/hooks/usePendingApprovalsCount";
import { Badge } from "@/components/ui/badge";

const SupervisorBottomNav = () => {
  const location = useLocation();
  const { pendingCount } = usePendingApprovalsCount();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/supervisor" },
    { icon: Briefcase, label: "Jobs", path: "/supervisor/jobs" },
    { icon: MapPin, label: "Team Map", path: "/supervisor/tracking" },
    { icon: Clock, label: "Timesheets", path: "/supervisor/timesheets", badge: pendingCount },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map(({ icon: Icon, label, path, badge }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors relative",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className="h-6 w-6 mb-1" />
                {badge && badge > 0 && (
                  <Badge 
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-destructive"
                  >
                    {badge > 99 ? '99+' : badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default SupervisorBottomNav;
