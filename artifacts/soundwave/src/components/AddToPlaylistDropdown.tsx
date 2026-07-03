import { useState } from "react";
import { useListPlaylists, useAddSongToPlaylist, useCreatePlaylist } from "@workspace/api-client-react";
import { Plus, Check, PlusCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPlaylistQueryKey, getListPlaylistsQueryKey } from "@workspace/api-client-react";

export function AddToPlaylistDropdown({ songId }: { songId: number }) {
  const { data: playlists } = useListPlaylists();
  const addSong = useAddSongToPlaylist();
  const createPlaylist = useCreatePlaylist();
  const queryClient = useQueryClient();
  
  const handleAdd = (playlistId: number) => {
    addSong.mutate({ id: playlistId, data: { songId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(playlistId) });
        queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
      }
    });
  };

  const handleCreateAndAdd = () => {
    createPlaylist.mutate({ data: { name: "New Playlist", isPrivate: true } }, {
      onSuccess: (res) => {
        handleAdd(res.id);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Plus className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCreateAndAdd}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Create playlist
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">
          {playlists?.map(pl => (
            <DropdownMenuItem key={pl.id} onClick={() => handleAdd(pl.id)}>
              {pl.name}
            </DropdownMenuItem>
          ))}
          {playlists?.length === 0 && (
            <div className="p-2 text-xs text-muted-foreground text-center">No playlists yet</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
