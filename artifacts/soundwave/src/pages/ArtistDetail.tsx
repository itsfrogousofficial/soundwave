import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { useGetArtist, getGetArtistQueryKey } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { BadgeCheck, ShieldCheck, Lock, Loader2, Music, LogIn, Pencil, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type ArtistWithClaim = {
  id: number;
  name: string;
  bio: string | null;
  imageUrl: string | null;
  isVerified: boolean;
  albumCount: number;
  albums: {
    id: number;
    title: string;
    coverUrl: string | null;
    artistId: number;
    artistName: string;
    uploaderUsername: string;
    uploaderClerkId: string;
    songCount: number;
    createdAt: string;
  }[];
  createdAt: string;
  isClaimed: boolean;
  claimedByClerkId: string | null;
  claimedByUsername: string | null;
  spotifyArtistId: string | null;
};

export default function ArtistDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isSignedIn } = useUser();

  const { data: artist, isLoading } = useGetArtist(Number(id), {
    query: { enabled: !!id, queryKey: getGetArtistQueryKey(Number(id)) },
  }) as { data: ArtistWithClaim | undefined; isLoading: boolean };

  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Edit state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const spotifyAccount = user?.externalAccounts?.find((a) => a.provider === "spotify");
  const spotifyDisplayName = spotifyAccount?.username ?? null;
  const spotifyNameMatches = spotifyDisplayName
    ? spotifyDisplayName.trim().toLowerCase() === (artist?.name ?? "").trim().toLowerCase()
    : false;

  const isOwner = isSignedIn && artist?.claimedByClerkId === user?.id;
  const canEdit = isSignedIn && (isOwner || !artist?.isClaimed);

  const openEditDialog = () => {
    setEditName(artist?.name ?? "");
    setEditBio(artist?.bio ?? "");
    setEditImageUrl(artist?.imageUrl ?? "");
    setShowEditDialog(true);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const urlRes = await fetch(`${import.meta.env.BASE_URL}api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type, isPublic: true }),
      });
      if (!urlRes.ok) throw new Error("Could not get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();
      const upRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!upRes.ok) throw new Error("Upload failed");
      setEditImageUrl(objectPath);
      toast({ title: "Image uploaded — save to apply." });
    } catch (err: any) {
      toast({ title: "Image upload failed", description: err.message, variant: "destructive" });
    } finally {
      setImageUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    setIsSavingEdit(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/artists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, bio: editBio, imageUrl: editImageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not save", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Artist profile updated!" });
      setShowEditDialog(false);
      queryClient.invalidateQueries({ queryKey: getGetArtistQueryKey(Number(id)) });
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleClaim = async () => {
    if (!isSignedIn) return;
    setIsClaiming(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/artists/${id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not claim profile", description: data.error, variant: "destructive" });
        return;
      }
      toast({
        title: data.spotifyVerified ? "Profile claimed and verified!" : "Profile claimed!",
        description: data.spotifyVerified
          ? "Your Spotify identity matched. The profile is now verified."
          : "You now own this artist profile. Only you can upload songs here.",
      });
      setShowClaimDialog(false);
      queryClient.invalidateQueries({ queryKey: getGetArtistQueryKey(Number(id)) });
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleRelease = async () => {
    if (!confirm("Release ownership of this profile? Anyone will be able to claim it again.")) return;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/artists/${id}/claim`, { method: "DELETE" });
      if (!res.ok) {
        toast({ title: "Error", description: "Could not release profile.", variant: "destructive" });
        return;
      }
      toast({ title: "Profile released", description: "This profile is now open for anyone to claim." });
      queryClient.invalidateQueries({ queryKey: getGetArtistQueryKey(Number(id)) });
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="w-48 h-48 rounded-full mb-8" />
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-4 w-96 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
    );
  }

  if (!artist) return <div className="p-8 text-muted-foreground">Artist not found.</div>;

  const imageUrl = artist.imageUrl
    ? `${import.meta.env.BASE_URL}api/storage/public-objects/${artist.imageUrl}`
    : null;

  const editPreviewUrl = editImageUrl
    ? `${import.meta.env.BASE_URL}api/storage/public-objects/${editImageUrl}`
    : null;

  return (
    <div className="relative min-h-full">
      {/* Blurred background */}
      <div className="absolute inset-0 h-[320px] overflow-hidden -z-10 pointer-events-none">
        {imageUrl ? (
          <img src={imageUrl} className="w-full h-full object-cover blur-3xl opacity-20" />
        ) : (
          <div className="w-full h-full bg-primary/20 blur-3xl opacity-20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="p-4 md:p-8">
        <header className="flex flex-col gap-6 pt-4 md:pt-10 mb-8">
          {/* Avatar */}
          <div className="w-36 h-36 md:w-48 md:h-48 rounded-full overflow-hidden shadow-2xl bg-secondary border-4 border-background flex items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt={artist.name} className="w-full h-full object-cover" />
            ) : (
              <Music className="w-16 h-16 text-muted-foreground" />
            )}
          </div>

          {/* Name + badges + actions */}
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 flex-wrap">
              <h1 className="text-4xl md:text-7xl font-extrabold tracking-tighter" data-testid="artist-name">
                {artist.name}
              </h1>
              {artist.isVerified && (
                <BadgeCheck className="w-9 h-9 text-primary mt-2 shrink-0" data-testid="verified-badge" />
              )}
            </div>

            {/* Claim status + action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {artist.isClaimed ? (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1.5 text-xs border-primary/30 text-primary"
                  data-testid="claimed-badge"
                >
                  <Lock className="w-3 h-3" />
                  Managed by @{artist.claimedByUsername}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1.5 text-xs border-muted-foreground/30 text-muted-foreground"
                  data-testid="unclaimed-badge"
                >
                  Unclaimed profile
                </Badge>
              )}

              {isSignedIn && !artist.isClaimed && (
                <Button size="sm" variant="outline" onClick={() => setShowClaimDialog(true)} data-testid="button-claim">
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  Claim this profile
                </Button>
              )}
              {isOwner && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRelease}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid="button-release-claim"
                >
                  Release ownership
                </Button>
              )}
              {!isSignedIn && !artist.isClaimed && (
                <Link href="/sign-in">
                  <Button size="sm" variant="ghost" className="text-muted-foreground text-xs gap-1.5">
                    <LogIn className="w-3.5 h-3.5" />
                    Sign in to claim
                  </Button>
                </Link>
              )}

              {/* Edit button — visible to owner or any signed-in user on unclaimed profile */}
              {canEdit && (
                <Button size="sm" variant="outline" onClick={openEditDialog} data-testid="button-edit-artist">
                  <Pencil className="w-4 h-4 mr-1.5" />
                  Edit Profile
                </Button>
              )}
            </div>

            {artist.bio && (
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">{artist.bio}</p>
            )}
          </div>
        </header>

        {/* Albums */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Albums</h2>
          {artist.albums.length === 0 ? (
            <p className="text-muted-foreground text-sm">No albums yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {artist.albums.map((album) => {
                const cover = album.coverUrl
                  ? album.coverUrl.startsWith("http")
                    ? album.coverUrl
                    : `${import.meta.env.BASE_URL}api/storage${album.coverUrl.replace(/^\/api\/storage/, "")}`
                  : null;
                return (
                  <Link key={album.id} href={`/albums/${album.id}`}>
                    <div className="group cursor-pointer" data-testid={`card-album-${album.id}`}>
                      <div className="aspect-square rounded-md overflow-hidden bg-secondary mb-3 shadow-md">
                        {cover ? (
                          <img
                            src={cover}
                            alt={album.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm truncate">{album.title}</h3>
                      <p className="text-xs text-muted-foreground">{new Date(album.createdAt).getFullYear()}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground mt-10">
          Individual songs are not shown on artist profiles. Browse albums above.
        </p>
      </div>

      {/* Edit Artist Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border-border max-w-md" data-testid="dialog-edit-artist">
          <DialogHeader>
            <DialogTitle>Edit Artist Profile</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {isOwner ? "Update your artist profile." : "This profile is unclaimed — anyone can edit it."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Image upload */}
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary flex items-center justify-center">
                  {editPreviewUrl ? (
                    <img src={editPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition"
                >
                  {imageUploading ? (
                    <Loader2 className="w-3 h-3 animate-spin text-white" />
                  ) : (
                    <Camera className="w-3 h-3 text-white" />
                  )}
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              </div>
              <p className="text-xs text-muted-foreground">Upload a photo for this artist profile.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Artist Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-secondary/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea
                id="edit-bio"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="A short description of this artist..."
                className="bg-secondary/30 resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit || !editName.trim()}>
              {isSavingEdit ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Claim dialog */}
      <Dialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
        <DialogContent className="bg-card border-border max-w-md" data-testid="dialog-claim">
          <DialogHeader>
            <DialogTitle>Claim "{artist.name}"</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Claiming this profile gives you exclusive upload rights. Once claimed, only you can add albums and songs here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {spotifyAccount ? (
              <div
                className={`rounded-lg p-4 text-sm flex gap-3 items-start ${
                  spotifyNameMatches
                    ? "bg-primary/10 border border-primary/30 text-primary"
                    : "bg-secondary border border-border text-muted-foreground"
                }`}
                data-testid="spotify-verification-status"
              >
                <ShieldCheck className={`w-5 h-5 mt-0.5 shrink-0 ${spotifyNameMatches ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  {spotifyNameMatches ? (
                    <>
                      <p className="font-semibold">Spotify identity matched</p>
                      <p className="text-xs mt-0.5 opacity-80">
                        Your Spotify account "{spotifyDisplayName}" matches this artist name. Claiming will also verify the profile.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Spotify connected as "{spotifyDisplayName}"</p>
                      <p className="text-xs mt-0.5">
                        Your Spotify display name doesn't match "{artist.name}", so the profile won't be auto-verified. You can still claim it.
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg p-4 text-sm flex gap-3 items-start bg-secondary border border-border text-muted-foreground" data-testid="spotify-connect-prompt">
                <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Connect Spotify to verify</p>
                  <p className="text-xs mt-0.5">
                    Link your Spotify account in your profile settings and your display name will be automatically matched to verify you are this artist.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowClaimDialog(false)} data-testid="button-cancel-claim">Cancel</Button>
            <Button onClick={handleClaim} disabled={isClaiming} data-testid="button-confirm-claim">
              {isClaiming ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Claiming...</> : "Claim Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
