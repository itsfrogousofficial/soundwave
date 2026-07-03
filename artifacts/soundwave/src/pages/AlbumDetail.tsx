import { useParams, Link } from "wouter";
import { useGetAlbum, useGetMe, getGetAlbumQueryKey } from "@workspace/api-client-react";
import { Play, Pause, MoreHorizontal, Plus } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AddToPlaylistDropdown } from "@/components/AddToPlaylistDropdown";

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: album, isLoading } = useGetAlbum(Number(id), { query: { enabled: !!id, queryKey: getGetAlbumQueryKey(Number(id)) } });
  const { currentSong, isPlaying, playSong, togglePlayPause } = usePlayer();

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex gap-8 items-end mb-12">
          <Skeleton className="w-64 h-64 shadow-2xl rounded-md" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!album) return <div className="p-8">Album not found</div>;

  const coverUrl = album.coverUrl 
    ? `${import.meta.env.BASE_URL}api/storage/public-objects/${album.coverUrl}` 
    : null;

  const isAlbumPlaying = currentSong?.albumId === album.id && isPlaying;
  
  const handlePlayAlbum = () => {
    if (album.songs.length > 0) {
      if (currentSong?.albumId === album.id) {
        togglePlayPause();
      } else {
        playSong(album.songs[0]);
      }
    }
  };

  return (
    <div className="relative min-h-full">
      {/* Background blur using cover art */}
      <div className="absolute inset-0 h-[400px] overflow-hidden -z-10 pointer-events-none">
        {coverUrl && <img src={coverUrl} className="w-full h-full object-cover blur-3xl opacity-20" />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="p-8">
        <header className="flex flex-col md:flex-row gap-8 items-end mb-10 pt-10">
          <div className="w-48 h-48 md:w-64 md:h-64 flex-shrink-0 shadow-2xl rounded-md overflow-hidden bg-secondary">
            {coverUrl ? (
              <img src={coverUrl} alt={album.title} className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-widest">Album</span>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-tight">{album.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Link href={`/artists/${album.artistId}`} className="font-bold hover:underline">{album.artistName}</Link>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{album.songs.length} songs</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground text-sm">Uploaded by @{album.uploaderUsername}</span>
            </div>
          </div>
        </header>

        <div className="mb-8 flex items-center gap-4">
          <button 
            onClick={handlePlayAlbum}
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 hover:bg-primary/90 transition shadow-xl"
          >
            {isAlbumPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
          </button>
        </div>

        <div className="mt-8">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2 text-sm text-muted-foreground border-b border-border/50 mb-4">
            <div className="w-8 text-center">#</div>
            <div>Title</div>
            <div className="w-12 text-right">Time</div>
            <div className="w-10"></div>
          </div>

          <div className="space-y-1">
            {album.songs.map((song, i) => {
              const isThisSongPlaying = currentSong?.id === song.id;
              
              return (
                <div 
                  key={song.id} 
                  className={`group grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 items-center rounded-md hover:bg-secondary/50 transition ${isThisSongPlaying ? 'bg-secondary/30' : ''}`}
                >
                  <div className="w-8 text-center text-muted-foreground text-sm relative">
                    <span className={`group-hover:hidden ${isThisSongPlaying ? 'hidden' : 'block'}`}>{song.trackNumber || i + 1}</span>
                    <button 
                      className={`absolute inset-0 flex items-center justify-center text-foreground ${isThisSongPlaying ? 'block text-primary' : 'hidden group-hover:flex'}`}
                      onClick={() => playSong(song)}
                    >
                      {isThisSongPlaying && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                  </div>
                  
                  <div className="flex flex-col min-w-0">
                    <div className={`truncate ${isThisSongPlaying ? 'text-primary font-medium' : 'text-foreground'}`}>
                      {song.title}
                    </div>
                    <Link href={`/artists/${song.artistId}`} className="text-xs text-muted-foreground truncate hover:underline hover:text-foreground">
                      {song.artistName}
                    </Link>
                  </div>
                  
                  <div className="w-12 text-right text-sm text-muted-foreground font-mono">
                    {formatDuration(song.duration)}
                  </div>
                  
                  <div className="w-10 flex justify-end">
                    <AddToPlaylistDropdown songId={song.id} />
                  </div>
                </div>
              );
            })}
            {album.songs.length === 0 && (
              <div className="text-muted-foreground text-center py-10">No tracks uploaded for this album.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
