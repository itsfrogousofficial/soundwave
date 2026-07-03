import { Link, useLocation } from "wouter";
import { Home, Compass, Library, PlusCircle, LogOut, Settings, X } from "lucide-react";
import { useClerk, Show } from "@clerk/react";

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { signOut } = useClerk();

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Browse", href: "/browse", icon: Compass },
    { label: "Playlists", href: "/playlists", icon: Library },
  ];

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href));

  const navLink = (href: string, icon: React.ElementType, label: string) => {
    const Icon = icon;
    return (
      <Link
        key={href}
        href={href}
        onClick={onClose}
        className={`flex items-center gap-4 px-3 py-2.5 rounded-md font-medium transition ${
          isActive(href)
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        <Icon className="w-5 h-5" />
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open !== undefined && (
        <div
          className={`md:hidden fixed inset-0 bg-black/60 z-40 transition-opacity ${
            open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border p-6 flex flex-col
          transition-transform duration-300
          ${open !== undefined
            ? open ? "translate-x-0" : "-translate-x-full"
            : "md:translate-x-0 translate-x-0"
          }
          md:translate-x-0
        `}
      >
        {/* Close button (mobile only) */}
        <button
          className="md:hidden absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-10 text-primary font-bold text-xl tracking-tight">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Soundwave" className="w-8 h-8" />
          Soundwave
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Menu</div>
          {navItems.map((item) => navLink(item.href, item.icon, item.label))}

          <Show when="signed-in">
            <div className="mt-8 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Library</div>
            {navLink("/upload", PlusCircle, "Upload Album")}
          </Show>
        </nav>

        <div className="mt-auto pt-6 border-t border-border flex flex-col gap-1">
          <Show when="signed-in">
            {navLink("/settings", Settings, "Settings")}
            <button
              onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || "/" })}
              className="flex items-center gap-4 px-3 py-2.5 rounded-md font-medium text-muted-foreground hover:text-foreground hover:bg-secondary w-full transition"
            >
              <LogOut className="w-5 h-5" />
              Log out
            </button>
          </Show>
        </div>
      </div>
    </>
  );
}
