import { Link } from "wouter";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MusicPlayer() {
  const { currentSong, isPlaying, togglePlayPause, progress, duration, seek, volume, setVolume } = usePlayer();

  if (!currentSong) return null;

  const coverUrl = currentSong.coverUrl 
    ? `${import.meta.env.BASE_URL}api/storage/public-objects/${currentSong.coverUrl}`
    : null; // Could have default cover

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-card border-t border-border px-4 flex items-center justify-between z-50">
      {/* Track Info */}
      <div className="flex items-center gap-4 w-1/3 min-w-0">
        <div className="h-14 w-14 rounded-md bg-muted flex-shrink-0 overflow-hidden">
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-secondary" />
          )}
        </div>
        <div className="min-w-0 flex flex-col">
          <Link href={`/albums/${currentSong.albumId}`} className="text-sm font-semibold truncate hover:underline">
            {currentSong.title}
          </Link>
          <Link href={`/artists/${currentSong.artistId}`} className="text-xs text-muted-foreground truncate hover:underline">
            {currentSong.artistName}
          </Link>
        </div>
      </div>

      {/* Player Controls */}
      <div className="flex flex-col items-center gap-2 w-1/3 max-w-md">
        <div className="flex items-center gap-4">
          <button className="text-muted-foreground hover:text-foreground transition">
            <SkipBack className="w-5 h-5" />
          </button>
          <button 
            className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 transition"
            onClick={togglePlayPause}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
          </button>
          <button className="text-muted-foreground hover:text-foreground transition">
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
        <div className="w-full flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>{formatTime(progress)}</span>
          <Slider 
            value={[progress]} 
            max={duration || 100} 
            step={1} 
            onValueChange={([val]) => seek(val)}
            className="flex-1"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center justify-end gap-2 w-1/3 text-muted-foreground">
        <button onClick={() => setVolume(volume === 0 ? 1 : 0)}>
          {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <div className="w-24">
          <Slider 
            value={[volume * 100]} 
            max={100} 
            step={1} 
            onValueChange={([val]) => setVolume(val / 100)}
          />
        </div>
      </div>
    </div>
  );
}
