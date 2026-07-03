import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, User, Music, ExternalLink, Save } from "lucide-react";

export default function Settings() {
  const { user: clerkUser } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: me, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey() },
  }) as { data: any; isLoading: boolean };

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (me) {
      setUsername(me.username ?? "");
      setDisplayName(me.displayName ?? "");
    }
  }, [me]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast({ title: "Failed to save", description: d.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profile saved!" });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      // Request presigned URL
      const urlRes = await fetch(`${import.meta.env.BASE_URL}api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Could not get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      // Upload to object storage
      const upRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!upRes.ok) throw new Error("Upload failed");

      // Save objectPath as avatarUrl
      const patchRes = await fetch(`${import.meta.env.BASE_URL}api/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: objectPath }),
      });
      if (!patchRes.ok) throw new Error("Could not update avatar");

      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Avatar updated!" });
    } catch (err: any) {
      toast({ title: "Avatar upload failed", description: err.message, variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-8 pt-12 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-32 rounded-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const avatarUrl = me?.avatarUrl
    ? `${import.meta.env.BASE_URL}api/storage/objects/${me.avatarUrl}`
    : clerkUser?.imageUrl ?? null;

  const claimedArtist = (me as any)?.claimedArtist ?? null;

  return (
    <div className="max-w-2xl mx-auto p-8 pt-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your profile and artist identity.</p>
      </header>

      {/* Profile section */}
      <section className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-6">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Your Profile</h2>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-6 mb-6">
          <div className="relative w-20 h-20 shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-secondary border-2 border-border flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition"
              title="Change avatar"
            >
              {avatarUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-white" />
              )}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{me?.displayName || me?.username}</p>
            <p>@{me?.username}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              className="bg-secondary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
              className="bg-secondary/30"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </section>

      {/* Artist profile section */}
      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Music className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Artist Profile</h2>
        </div>

        {claimedArtist ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {claimedArtist.imageUrl ? (
                <img
                  src={`${import.meta.env.BASE_URL}api/storage/public-objects/${claimedArtist.imageUrl}`}
                  alt={claimedArtist.name}
                  className="w-12 h-12 rounded-full object-cover bg-secondary"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  <Music className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-semibold">{claimedArtist.name}</p>
                <p className="text-xs text-muted-foreground">You manage this profile</p>
              </div>
            </div>
            <Link href={`/artists/${claimedArtist.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                View &amp; Edit
              </Button>
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You haven't claimed an artist profile yet. Visit any{" "}
            <Link href="/browse" className="text-primary hover:underline">
              artist page
            </Link>{" "}
            to claim it, or upload an album to auto-create one.
          </p>
        )}
      </section>
    </div>
  );
}
