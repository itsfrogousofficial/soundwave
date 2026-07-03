import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useUpload } from "@workspace/object-storage-web";
import { useCreateAlbum } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload as UploadIcon, Music, Image as ImageIcon, Loader2, X, PlusCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { getListAlbumsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";

interface DraftSong {
  id: string;
  file: File;
  title: string;
  objectPath?: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

type ArtistClaimStatus = {
  exists: boolean;
  isClaimed: boolean;
  claimedByUsername: string | null;
  isOwner: boolean;
};

export default function Upload() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createAlbum = useCreateAlbum();
  const { user } = useUser();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  
  const [songs, setSongs] = useState<DraftSong[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Artist claim checking — debounced lookup as user types artist name
  const [artistClaimStatus, setArtistClaimStatus] = useState<ArtistClaimStatus | null>(null);
  const [checkingArtist, setCheckingArtist] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!artistName.trim()) {
      setArtistClaimStatus(null);
      return;
    }
    setCheckingArtist(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}api/artists/by-name/${encodeURIComponent(artistName.trim())}`,
        );
        if (res.ok) {
          const data = await res.json();
          setArtistClaimStatus({
            exists: data.exists,
            isClaimed: data.isClaimed ?? false,
            claimedByUsername: data.claimedByUsername ?? null,
            isOwner: data.claimedByClerkId === user?.id,
          });
        }
      } catch {
        // non-fatal
      } finally {
        setCheckingArtist(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [artistName, user?.id]);

  const isBlockedByOwner =
    artistClaimStatus?.exists &&
    artistClaimStatus.isClaimed &&
    !artistClaimStatus.isOwner;
  
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSongsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newSongs = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        title: file.name.replace(/\.[^/.]+$/, ""), // strip extension
        status: 'pending' as const
      }));
      setSongs(prev => [...prev, ...newSongs]);
    }
  };

  const updateSongTitle = (id: string, newTitle: string) => {
    setSongs(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const removeSong = (id: string) => {
    setSongs(prev => prev.filter(s => s.id !== id));
  };

  const uploadFile = async (file: File): Promise<string> => {
    const res = await fetch(`${import.meta.env.BASE_URL}api/storage/uploads/request-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type || 'application/octet-stream',
      }),
    });
    
    if (!res.ok) throw new Error("Failed to get upload URL");
    
    const { uploadURL, objectPath } = await res.json();
    
    const uploadRes = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": file.type || 'application/octet-stream' },
      body: file,
    });
    
    if (!uploadRes.ok) throw new Error("Failed to upload file");
    
    return objectPath;
  };

  const handleSubmit = async () => {
    if (!title || !artistName || songs.length === 0) return;
    setIsSubmitting(true);
    
    try {
      let coverObjectPath = null;
      
      // 1. Upload Cover
      if (coverFile) {
        setUploadProgress(5);
        coverObjectPath = await uploadFile(coverFile);
      }
      
      // 2. Upload Songs sequentially
      const uploadedSongs = [];
      for (let i = 0; i < songs.length; i++) {
        const s = songs[i];
        setSongs(prev => prev.map(x => x.id === s.id ? { ...x, status: 'uploading' } : x));
        
        const objPath = await uploadFile(s.file);
        
        uploadedSongs.push({
          title: s.title,
          objectPath: objPath,
          trackNumber: i + 1,
          duration: null // Could parse duration with Audio context, but skipping for simplicity
        });
        
        setSongs(prev => prev.map(x => x.id === s.id ? { ...x, status: 'done', objectPath: objPath } : x));
        setUploadProgress(10 + Math.floor((i + 1) / songs.length * 80));
      }
      
      // 3. Create Album Record
      setUploadProgress(95);
      
      createAlbum.mutate({
        data: {
          title,
          artistName,
          coverObjectPath,
          songs: uploadedSongs
        }
      }, {
        onSuccess: (newAlbum) => {
          setUploadProgress(100);
          queryClient.invalidateQueries({ queryKey: getListAlbumsQueryKey() });
          setLocation(`/albums/${newAlbum.id}`);
        },
        onError: () => {
          setIsSubmitting(false);
          alert("Failed to save album to database.");
        }
      });
      
    } catch (err) {
      console.error(err);
      alert("An error occurred during upload. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 pt-12">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Upload Album</h1>
        <p className="text-muted-foreground">Share your music with the community.</p>
      </header>

      <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
        {step === 1 ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="space-y-4">
              <Label className="text-lg">Album Cover</Label>
              <div className="flex gap-6 items-start">
                <div 
                  className="w-40 h-40 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-secondary/50 relative overflow-hidden group cursor-pointer hover:border-primary/50 transition"
                  onClick={() => document.getElementById('cover-upload')?.click()}
                >
                  {coverPreview ? (
                    <img src={coverPreview} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-muted-foreground group-hover:text-primary transition" />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <span className="text-sm font-medium">{coverPreview ? 'Change' : 'Upload'}</span>
                  </div>
                  <input id="cover-upload" type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                </div>
                <div className="flex-1 space-y-2 text-sm text-muted-foreground py-4">
                  <p>Recommended: Square image, at least 1000x1000px.</p>
                  <p>JPEG, PNG, or WEBP.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Album Title</Label>
                <Input 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="e.g. Midnight City"
                  className="bg-secondary/30"
                />
              </div>
              <div className="space-y-2">
                <Label>Artist Name</Label>
                <div className="relative">
                  <Input 
                    value={artistName} 
                    onChange={e => setArtistName(e.target.value)} 
                    placeholder="e.g. The Synthetics"
                    className={`bg-secondary/30 pr-8 ${isBlockedByOwner ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    data-testid="input-artist-name"
                  />
                  {checkingArtist && (
                    <Loader2 className="w-4 h-4 animate-spin absolute right-2.5 top-2.5 text-muted-foreground" />
                  )}
                  {!checkingArtist && artistClaimStatus?.isClaimed && artistClaimStatus.isOwner && (
                    <ShieldCheck className="w-4 h-4 absolute right-2.5 top-2.5 text-primary" />
                  )}
                </div>

                {/* Claim status feedback */}
                {artistClaimStatus && !checkingArtist && (
                  <div className={`rounded-md px-3 py-2 text-xs flex items-start gap-2 ${
                    isBlockedByOwner
                      ? "bg-destructive/10 border border-destructive/30 text-destructive"
                      : artistClaimStatus.isClaimed && artistClaimStatus.isOwner
                      ? "bg-primary/10 border border-primary/30 text-primary"
                      : "bg-secondary border border-border text-muted-foreground"
                  }`} data-testid="artist-claim-status">
                    {isBlockedByOwner ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          This artist profile is claimed by{" "}
                          <strong>@{artistClaimStatus.claimedByUsername}</strong>. Only they can upload here.
                        </span>
                      </>
                    ) : artistClaimStatus.isClaimed && artistClaimStatus.isOwner ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>You own this artist profile. Only you can upload here.</span>
                      </>
                    ) : artistClaimStatus.exists ? (
                      <>
                        <span>Artist profile found — unclaimed. Anyone can upload.</span>
                      </>
                    ) : (
                      <>
                        <span>New artist — a profile will be created when you publish.</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                size="lg"
                onClick={() => setStep(2)}
                disabled={!title || !artistName || isBlockedByOwner || checkingArtist}
                data-testid="button-next-step"
              >
                Next: Add Tracks
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Tracks for {title}</h2>
              <Button variant="outline" onClick={() => document.getElementById('audio-upload')?.click()}>
                <PlusCircle className="w-4 h-4 mr-2" /> Add Files
              </Button>
              <input id="audio-upload" type="file" accept="audio/*" multiple className="hidden" onChange={handleSongsSelect} />
            </div>

            {songs.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg py-20 flex flex-col items-center justify-center text-muted-foreground bg-secondary/20">
                <Music className="w-12 h-12 mb-4 opacity-50" />
                <p>Upload your audio files here.</p>
                <p className="text-sm mt-1">Supports MP3, WAV, FLAC</p>
                <Button variant="secondary" className="mt-6" onClick={() => document.getElementById('audio-upload')?.click()}>
                  Browse Files
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {songs.map((song, idx) => (
                  <div key={song.id} className="flex gap-4 items-center bg-secondary/30 p-3 rounded-lg border border-border/50">
                    <span className="text-muted-foreground w-6 text-center text-sm">{idx + 1}</span>
                    <Input 
                      value={song.title} 
                      onChange={e => updateSongTitle(song.id, e.target.value)} 
                      className="flex-1 bg-background"
                      disabled={isSubmitting}
                    />
                    <div className="w-24 text-right">
                      {song.status === 'uploading' && <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />}
                      {song.status === 'done' && <span className="text-primary text-sm font-medium">Ready</span>}
                      {song.status === 'pending' && !isSubmitting && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeSong(song.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isSubmitting && (
              <div className="space-y-2 mt-8">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-sm text-center text-muted-foreground">Uploading... {uploadProgress}%</p>
              </div>
            )}

            <div className="pt-8 flex justify-between border-t border-border">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={isSubmitting}>
                Back
              </Button>
              <Button size="lg" onClick={handleSubmit} disabled={songs.length === 0 || isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...</>
                ) : (
                  <><UploadIcon className="w-5 h-5 mr-2" /> Publish Album</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
