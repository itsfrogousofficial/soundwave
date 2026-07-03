import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { db, artistsTable, albumsTable, usersTable } from "@workspace/db";
import { getAuth, clerkClient } from "@clerk/express";
import { requireAuth } from "../lib/requireAuth";
import {
  ListArtistsQueryParams,
  ListArtistsResponseItem,
  GetArtistParams,
  GetArtistResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Helper: normalize name for comparison
function normalize(str: string) {
  return str.trim().toLowerCase();
}

router.get("/artists", async (req, res): Promise<void> => {
  const params = ListArtistsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { search, limit = 20, offset = 0 } = params.data;

  const albumCounts = db
    .$with("album_counts")
    .as(
      db
        .select({
          artistId: albumsTable.artistId,
          count: sql<number>`cast(count(*) as int)`.as("count"),
        })
        .from(albumsTable)
        .groupBy(albumsTable.artistId),
    );

  let query = db
    .with(albumCounts)
    .select({
      id: artistsTable.id,
      name: artistsTable.name,
      bio: artistsTable.bio,
      imageUrl: artistsTable.imageUrl,
      isVerified: artistsTable.isVerified,
      claimedByClerkId: artistsTable.claimedByClerkId,
      albumCount: sql<number>`coalesce(${albumCounts.count}, 0)`.as("albumCount"),
      createdAt: artistsTable.createdAt,
    })
    .from(artistsTable)
    .leftJoin(albumCounts, eq(artistsTable.id, albumCounts.artistId))
    .$dynamic();

  if (search) {
    query = query.where(ilike(artistsTable.name, `%${search}%`));
  }

  const artists = await query.limit(limit).offset(offset);
  res.json(
    artists.map((a) => ({
      ...ListArtistsResponseItem.parse({ ...a, albumCount: a.albumCount ?? 0 }),
      isClaimed: !!a.claimedByClerkId,
    })),
  );
});

router.get("/artists/:id", async (req, res): Promise<void> => {
  const params = GetArtistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select({
      artist: artistsTable,
      claimedUser: usersTable,
    })
    .from(artistsTable)
    .leftJoin(usersTable, eq(artistsTable.claimedByClerkId, usersTable.clerkId))
    .where(eq(artistsTable.id, params.data.id));

  if (!rows[0]) {
    res.status(404).json({ error: "Artist not found" });
    return;
  }

  const { artist, claimedUser } = rows[0];

  const albumCountResult = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(albumsTable)
    .where(eq(albumsTable.artistId, params.data.id));

  const albums = await db
    .select({
      album: albumsTable,
      uploaderUsername: usersTable.username,
    })
    .from(albumsTable)
    .leftJoin(usersTable, eq(albumsTable.uploaderClerkId, usersTable.clerkId))
    .where(eq(albumsTable.artistId, params.data.id));

  const base = GetArtistResponse.parse({
    id: artist.id,
    name: artist.name,
    bio: artist.bio ?? null,
    imageUrl: artist.imageUrl ?? null,
    isVerified: artist.isVerified,
    albumCount: albumCountResult[0]?.count ?? 0,
    albums: albums.map(({ album, uploaderUsername }) => ({
      id: album.id,
      title: album.title,
      artistId: album.artistId,
      artistName: artist.name,
      coverUrl: album.coverObjectPath ? `/api/storage${album.coverObjectPath}` : null,
      uploaderUsername: uploaderUsername ?? "",
      uploaderClerkId: album.uploaderClerkId,
      songCount: 0,
      createdAt: album.createdAt,
    })),
    createdAt: artist.createdAt,
  });

  res.json({
    ...base,
    isClaimed: !!artist.claimedByClerkId,
    claimedByClerkId: artist.claimedByClerkId ?? null,
    claimedByUsername: claimedUser?.username ?? null,
    spotifyArtistId: artist.spotifyArtistId ?? null,
  });
});

// POST /api/artists/:id/claim
// Claim an unclaimed artist profile.
// If the user has Spotify connected via Clerk and the Spotify display name matches the artist name,
// the profile is also marked as verified.
router.post("/artists/:id/claim", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;

  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid artist ID" });
    return;
  }

  const rows = await db.select().from(artistsTable).where(eq(artistsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Artist not found" });
    return;
  }

  if (rows[0].claimedByClerkId) {
    if (rows[0].claimedByClerkId === clerkId) {
      res.status(409).json({ error: "You already own this profile" });
    } else {
      res.status(409).json({ error: "This artist profile has already been claimed" });
    }
    return;
  }

  // Enforce one-claim-per-user
  const existingClaim = await db
    .select({ id: artistsTable.id, name: artistsTable.name })
    .from(artistsTable)
    .where(eq(artistsTable.claimedByClerkId, clerkId));
  if (existingClaim.length > 0) {
    res.status(409).json({
      error: `You already manage "${existingClaim[0].name}". Release that profile before claiming another.`,
    });
    return;
  }

  // Check if user has Spotify connected via Clerk
  let spotifyVerified = false;
  let spotifyArtistId: string | null = null;
  try {
    const clerkUser = await clerkClient.users.getUser(clerkId);
    const spotifyAccount = clerkUser.externalAccounts?.find(
      (a: any) => a.provider === "spotify" || a.provider === "oauth_spotify",
    );
    if (spotifyAccount) {
      const spotifyName = (spotifyAccount.username as string) || "";
      if (normalize(spotifyName) === normalize(rows[0].name)) {
        spotifyVerified = true;
      }
      // Store their Spotify user ID as the artist ID for future reference
      spotifyArtistId = spotifyAccount.externalId || null;
    }
  } catch {
    // Non-fatal: proceed without Spotify verification
  }

  const [updated] = await db
    .update(artistsTable)
    .set({
      claimedByClerkId: clerkId,
      isVerified: spotifyVerified ? true : rows[0].isVerified,
      spotifyArtistId: spotifyArtistId ?? rows[0].spotifyArtistId,
    })
    .where(eq(artistsTable.id, id))
    .returning();

  const claimedUserRows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));

  res.json({
    id: updated.id,
    name: updated.name,
    isClaimed: true,
    claimedByClerkId: updated.claimedByClerkId,
    claimedByUsername: claimedUserRows[0]?.username ?? null,
    isVerified: updated.isVerified,
    spotifyVerified,
  });
});

// DELETE /api/artists/:id/claim — release ownership
router.delete("/artists/:id/claim", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;

  const id = Number(req.params.id);
  const rows = await db.select().from(artistsTable).where(eq(artistsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Artist not found" });
    return;
  }
  if (rows[0].claimedByClerkId !== clerkId) {
    res.status(403).json({ error: "You do not own this profile" });
    return;
  }

  await db
    .update(artistsTable)
    .set({ claimedByClerkId: null, isVerified: false })
    .where(eq(artistsTable.id, id));

  res.sendStatus(204);
});

// PATCH /api/artists/:id — edit artist profile (owner or unclaimed)
router.patch("/artists/:id", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;

  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid artist ID" }); return; }

  const rows = await db.select().from(artistsTable).where(eq(artistsTable.id, id));
  if (!rows[0]) { res.status(404).json({ error: "Artist not found" }); return; }

  const isOwner = rows[0].claimedByClerkId === clerkId;
  const isUnclaimed = !rows[0].claimedByClerkId;
  if (!isOwner && !isUnclaimed) {
    res.status(403).json({ error: "Only the profile owner can edit this artist." });
    return;
  }

  const { name, bio, imageUrl } = req.body as { name?: string; bio?: string; imageUrl?: string };
  const updateData: Partial<{ name: string; bio: string | null; imageUrl: string | null }> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (bio !== undefined) updateData.bio = bio || null;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" }); return;
  }
  if ("name" in updateData && !updateData.name?.trim()) {
    res.status(400).json({ error: "Artist name cannot be empty." }); return;
  }

  try {
    const [updated] = await db
      .update(artistsTable)
      .set(updateData)
      .where(eq(artistsTable.id, id))
      .returning();
    res.json({
      id: updated.id, name: updated.name, bio: updated.bio ?? null,
      imageUrl: updated.imageUrl ?? null, isVerified: updated.isVerified,
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "An artist with that name already exists." });
    } else {
      throw err;
    }
  }
});

// GET /api/artists/by-name/:name — check if artist exists and claim status (used by upload page)
router.get("/artists/by-name/:name", async (req, res): Promise<void> => {
  const name = decodeURIComponent(req.params.name);
  const rows = await db
    .select({
      artist: artistsTable,
      claimedUser: usersTable,
    })
    .from(artistsTable)
    .leftJoin(usersTable, eq(artistsTable.claimedByClerkId, usersTable.clerkId))
    .where(eq(artistsTable.name, name));

  if (!rows[0]) {
    res.json({ exists: false });
    return;
  }

  const { artist, claimedUser } = rows[0];
  res.json({
    exists: true,
    id: artist.id,
    name: artist.name,
    isClaimed: !!artist.claimedByClerkId,
    claimedByClerkId: artist.claimedByClerkId ?? null,
    claimedByUsername: claimedUser?.username ?? null,
    isVerified: artist.isVerified,
  });
});

export { normalize };
export default router;
