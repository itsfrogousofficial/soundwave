import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden dark">
      {/* Decorative gradient blur */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

      <header className="flex items-center justify-between p-6 z-10">
        <div className="flex items-center gap-2 text-primary font-bold text-2xl tracking-tight">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Soundwave" className="w-8 h-8" />
          Soundwave
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Sign Up</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 z-10">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter max-w-4xl leading-[1.1] mb-6">
          Upload music <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">you love.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
          A community-driven platform built for listeners, by listeners. Upload your favorite albums, discover new artists, and curate the perfect playlist.
        </p>
        <div className="flex items-center gap-4">
          <Button size="lg" className="h-14 px-8 text-lg font-semibold rounded-full" asChild>
            <Link href="/sign-up">Get Started</Link>
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold rounded-full bg-secondary/50 border-0" asChild>
            <Link href="/browse">Browse Music</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
