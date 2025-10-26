import { Link, useLocation } from "react-router-dom";
import { Calendar, Car, User } from "lucide-react";
import { cn } from "@/lib/utils";
import berkeleyLogo from "@/assets/berkeley-rides-logo.png";

export const Navigation = () => {
  const location = useLocation();

  const links = [
    { href: "/events", icon: Calendar, label: "Events" },
    { href: "/my-rides", icon: Car, label: "My Rides" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground border-t border-primary/20">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center justify-center px-4 py-2 border-b border-primary/20">
          <img src={berkeleyLogo} alt="Berkeley Rides" className="h-10 w-auto" />
        </div>
        <div className="flex items-center justify-around py-3">
          {links.map(({ href, icon: Icon, label }) => {
            const isActive = location.pathname === href;
            return (
              <Link
                key={href}
                to={href}
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
  );
};
