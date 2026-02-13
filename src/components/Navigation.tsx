import { Link, useLocation } from "react-router-dom";
import { Calendar, Car, User, Info, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserAuthorization } from "@/hooks/useUserAuthorization";
import { useUserRole } from "@/hooks/useUserRole";
import { NotificationBell } from "@/components/NotificationBell";
import { AboutSheet } from "@/components/AboutSheet";
import { Button } from "@/components/ui/button";

export const Navigation = () => {
  const location = useLocation();
  const { isBerkeleyUser } = useUserAuthorization();
  const { isAdmin } = useUserRole();

  const baseLinks = isBerkeleyUser
    ? [
        { href: "/events", icon: Calendar, label: "Events" },
        { href: "/my-rides", icon: Car, label: "My Rides" },
        { href: "/profile", icon: User, label: "Profile" },
      ]
    : [
        { href: "/my-rides", icon: Car, label: "My Rides" },
        { href: "/profile", icon: User, label: "Profile" },
      ];

  const links = isAdmin 
    ? [...baseLinks, { href: "/admin", icon: Shield, label: "Admin" }]
    : baseLinks;

  return (
    <>
      {/* Top right icons */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <AboutSheet
          trigger={
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="About Berkeley Rides">
              <Info className="h-5 w-5" />
            </Button>
          }
        />
        <NotificationBell />
      </div>
      
      <nav className="fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground border-t border-primary/20 z-40">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center justify-around py-3">
            {links.map(({ href, icon: Icon, label }) => {
              const isActive = location.pathname === href;
              return (
                <Link
                  key={href}
                  to={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
                    isActive
                      ? "text-accent"
                      : "text-primary-foreground/70 hover:text-primary-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};
