import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MusicPlayer } from "./MusicPlayer";

export function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground dark flex">
      {/* Desktop sidebar — always visible md+ */}
      <div className="hidden md:block w-64 shrink-0" />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 pb-24 overflow-y-auto h-[100dvh] min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-background/90 backdrop-blur border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 text-primary font-bold text-lg tracking-tight">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Soundwave" className="w-6 h-6" />
            Soundwave
          </div>
        </div>

        {children}
      </main>

      <MusicPlayer />
    </div>
  );
}
