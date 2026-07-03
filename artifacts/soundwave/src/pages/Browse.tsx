import { useListAlbums, useGetFeatured, useGetStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function Browse() {
  const [search, setSearch] = useState("");
  
  const { data: featured, isLoading: loadingFeatured } = useGetFeatured();
  const { data: stats } = useGetStats();
  const { data: albums, isLoading: loadingAlbums } = useListAlbums({ search });

  return (
    <div className="p-8 pb-20">
      <header className="mb-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <h1 className="text-4xl font-bold tracking-tight">Browse</h1>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search albums, artists..." 
            className="pl-10 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary rounded-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {!search && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Featured Discoveries</h2>
          {loadingFeatured ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {[1,2,3,4,5].map(i => <AlbumSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {featured?.recentAlbums?.slice(0, 5).map(album => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-2xl font-bold mb-6">{search ? "Search Results" : "All Albums"}</h2>
        {loadingAlbums ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[1,2,3,4,5,6,7,8].map(i => <AlbumSkeleton key={i} />)}
          </div>
        ) : albums?.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No albums found. Try a different search.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {albums?.map(album => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        )}
      </section>

      {!search && stats && (
        <section className="mt-20 pt-10 border-t border-border">
          <h2 className="text-lg font-semibold text-muted-foreground mb-4">Platform Stats</h2>
          <div className="flex gap-8">
            <div>
              <div className="text-3xl font-bold text-primary">{stats.totalAlbums}</div>
              <div className="text-sm text-muted-foreground">Albums</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">{stats.totalSongs}</div>
              <div className="text-sm text-muted-foreground">Songs</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">{stats.totalArtists}</div>
              <div className="text-sm text-muted-foreground">Artists</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function AlbumCard({ album }: { album: any }) {
  const coverUrl = album.coverUrl 
    ? `${import.meta.env.BASE_URL}api/storage/public-objects/${album.coverUrl}` 
    : null;

  return (
    <Link href={`/albums/${album.id}`}>
      <div className="group cursor-pointer">
        <div className="aspect-square rounded-md overflow-hidden bg-secondary mb-4 relative shadow-md">
          {coverUrl ? (
            <img src={coverUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground group-hover:scale-105 transition duration-500 bg-secondary">
              No Cover
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
            {/* Hover state play icon indication */}
          </div>
        </div>
        <h3 className="font-semibold text-sm truncate">{album.title}</h3>
        <p className="text-xs text-muted-foreground truncate hover:text-primary transition">
          {album.artistName}
        </p>
      </div>
    </Link>
  );
}

function AlbumSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square rounded-md mb-4" />
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
