import { useParams, Link, useLocation } from "wouter";
import { useGetPlaylist, useRemoveSongFromPlaylist, useDeletePlaylist, useUpdatePlaylist } from "@workspace/api-client-react";
import { Play, Pause, Trash2, Lock, Globe, MoreVertical, Edit2 } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPlaylistQueryKey, getListPlaylistsQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: playlist, isLoading } = useGetPlaylist(Number(id), { query: { enabled: !!id, queryKey: getGetPlaylistQueryKey(Number(id)) } });
  const { currentSong, isPlaying, playSong, togglePlayPause } = usePlayer();
  const removeSong = useRemoveSongFromPlaylist();
  const deletePlaylist = useDeletePlaylist();
  const updatePlaylist = useUpdatePlaylist();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPrivate, setEditPrivate] = useState(false);

  if (isLoading) {
    return <div className="p-8"><Skeleton className="w-64 h-64 shadow-2xl rounded-md" /></div>;
  }

  if (!playlist) return <div className="p-8">Playlist not found</div>;

  const isPlaylistPlaying = playlist.songs.some(s => s.id === currentSong?.id) && isPlaying;
  
  const handlePlayPlaylist = () => {
    if (playlist.songs.length > 0) {
      if (playlist.songs.some(s => s.id === currentSong?.id)) {
        togglePlayPause();
      } else {
        playSong(playlist.songs[0]);
      }
    }
  };

  const handleRemove = (songId: number) => {
    removeSong.mutate({ id: playlist.id, songId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(playlist.id) });
      }
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this playlist?")) {
      deletePlaylist.mutate({ id: playlist.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
          setLocation("/playlists");
        }
      });
    }
  };

  const openEdit = () => {
    setEditName(playlist.name);
    setEditPrivate(playlist.isPrivate);
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!editName.trim()) return;
    updatePlaylist.mutate({ id: playlist.id, data: { name: editName, isPrivate: editPrivate } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(playlist.id) });
        queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
        setEditOpen(false);
      }
    });
  };

  return (
    <div className="relative min-h-full">
      <div className="absolute inset-0 h-[300px] overflow-hidden -z-10 pointer-events-none bg-primary/10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="p-8">
        <header className="flex flex-col md:flex-row gap-8 items-end mb-10 pt-10">
          <div className="w-48 h-48 md:w-64 md:h-64 flex-shrink-0 shadow-2xl rounded-md overflow-hidden bg-secondary flex items-center justify-center text-muted-foreground text-5xl font-light">
            {playlist.coverUrl ? (
               <img src={`${import.meta.env.BASE_URL}api/storage/public-objects/${playlist.coverUrl}`} className="w-full h-full object-cover" />
            ) : playlist.name.substring(0,2).toUpperCase()}
          </div>
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              Playlist
              {playlist.isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-tight truncate">{playlist.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="font-bold">@{playlist.ownerUsername}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{playlist.songs.length} songs</span>
            </div>
          </div>
        </header>

        <div className="mb-8 flex items-center gap-4">
          <button 
            onClick={handlePlayPlaylist}
            disabled={playlist.songs.length === 0}
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 hover:bg-primary/90 transition shadow-xl disabled:opacity-50 disabled:hover:scale-100"
          >
            {isPlaylistPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
                <MoreVertical className="w-6 h-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={openEdit}>
                <Edit2 className="w-4 h-4 mr-2" /> Edit details
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete playlist
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-8">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2 text-sm text-muted-foreground border-b border-border/50 mb-4">
            <div className="w-8 text-center">#</div>
            <div>Title</div>
            <div className="w-12 text-right">Time</div>
            <div className="w-10"></div>
          </div>

          <div className="space-y-1">
            {playlist.songs.map((song, i) => {
              const isThisSongPlaying = currentSong?.id === song.id;
              
              return (
                <div 
                  key={`${song.id}-${i}`} 
                  className={`group grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 items-center rounded-md hover:bg-secondary/50 transition ${isThisSongPlaying ? 'bg-secondary/30' : ''}`}
                >
                  <div className="w-8 text-center text-muted-foreground text-sm relative">
                    <span className={`group-hover:hidden ${isThisSongPlaying ? 'hidden' : 'block'}`}>{i + 1}</span>
                    <button 
                      className={`absolute inset-0 flex items-center justify-center text-foreground ${isThisSongPlaying ? 'block text-primary' : 'hidden group-hover:flex'}`}
                      onClick={() => playSong(song)}
                    >
                      {isThisSongPlaying && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 bg-secondary rounded flex-shrink-0 overflow-hidden hidden sm:block">
                       {song.coverUrl && <img src={`${import.meta.env.BASE_URL}api/storage/public-objects/${song.coverUrl}`} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className={`truncate ${isThisSongPlaying ? 'text-primary font-medium' : 'text-foreground'}`}>
                        {song.title}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        <Link href={`/artists/${song.artistId}`} className="hover:underline hover:text-foreground">
                          {song.artistName}
                        </Link>
                        <span>•</span>
                        <Link href={`/albums/${song.albumId}`} className="hover:underline hover:text-foreground">
                          {song.albumTitle}
                        </Link>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-12 text-right text-sm text-muted-foreground font-mono">
                    {formatDuration(song.duration)}
                  </div>
                  
                  <div className="w-10 flex justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleRemove(song.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {playlist.songs.length === 0 && (
              <div className="text-muted-foreground text-center py-20 border border-dashed border-border rounded-md mt-4">
                This playlist is empty. Browse albums to add some tracks!
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Private</Label>
                <p className="text-xs text-muted-foreground">Only you can see this playlist</p>
              </div>
              <Switch checked={editPrivate} onCheckedChange={setEditPrivate} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={!editName.trim() || updatePlaylist.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
