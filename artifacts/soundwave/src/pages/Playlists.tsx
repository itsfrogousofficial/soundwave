import { useListPlaylists, useCreatePlaylist } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Plus, ListMusic, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { getListPlaylistsQueryKey } from "@workspace/api-client-react";

export default function Playlists() {
  const { data: playlists, isLoading } = useListPlaylists();
  const createPlaylist = useCreatePlaylist();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) return;
    createPlaylist.mutate(
      { data: { name, isPrivate } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
          setIsOpen(false);
          setLocation(`/playlists/${res.id}`);
        }
      }
    );
  };

  return (
    <div className="p-8">
      <header className="flex items-center justify-between mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Your Playlists</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full gap-2">
              <Plus className="w-4 h-4" /> New Playlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Playlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Playlist Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Awesome Mix" autoFocus />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Private</Label>
                  <p className="text-xs text-muted-foreground">Only you can see this playlist</p>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!name.trim() || createPlaylist.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {[1,2,3,4].map(i => (
             <div key={i}>
               <Skeleton className="aspect-square rounded-md mb-4" />
               <Skeleton className="h-4 w-3/4 mb-2" />
               <Skeleton className="h-3 w-1/2" />
             </div>
          ))}
        </div>
      ) : playlists?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center text-muted-foreground border border-dashed border-border rounded-lg">
          <ListMusic className="w-12 h-12 mb-4 opacity-50" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No playlists yet</h3>
          <p className="mb-6">Create your first playlist and start saving your favorite tracks.</p>
          <Button variant="outline" onClick={() => setIsOpen(true)}>Create Playlist</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {playlists?.map(pl => (
            <Link key={pl.id} href={`/playlists/${pl.id}`}>
              <div className="group cursor-pointer">
                <div className="aspect-square rounded-md overflow-hidden bg-secondary mb-4 flex items-center justify-center shadow-md">
                  {pl.coverUrl ? (
                     <img src={`${import.meta.env.BASE_URL}api/storage/public-objects/${pl.coverUrl}`} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  ) : (
                     <ListMusic className="w-12 h-12 text-muted-foreground group-hover:scale-110 transition" />
                  )}
                </div>
                <h3 className="font-semibold text-sm truncate">{pl.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{pl.songCount} songs</span>
                  {pl.isPrivate ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Globe className="w-3 h-3 text-muted-foreground" />}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
