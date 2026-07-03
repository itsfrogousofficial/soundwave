import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, playlistsTable, playlistSongsTable, songsTable, albumsTable, artistsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/requireAuth";
import { getOrCreateUser } from "./users";
import { getAuth } from "@clerk/express";
import {
  ListPlaylistsResponseItem,
  CreatePlaylistBody,
  CreatePlaylistResponse,
  GetPlaylistParams,
  GetPlaylistResponse,
  UpdatePlaylistParams,
  UpdatePlaylistBody,
  UpdatePlaylistResponse,
  DeletePlaylistParams,
  AddSongToPlaylistParams,
  AddSongToPlaylistBody,
  AddSongToPlaylistResponse,
  RemoveSongFromPlaylistParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function coverUrl(path: string | null | undefined) {
  return path ? `/api/storage${path}` : null;
}

router.get("/playlists", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;

  const songCountsCte = db
    .$with("song_counts")
    .as(
      db
        .select({
          playlistId: playlistSongsTable.playlistId,
          count: sql<number>`cast(count(*) as int)`.as("count"),
        })
        .from(playlistSongsTable)
        .groupBy(playlistSongsTable.playlistId),
    );

  const playlists = await db
    .with(songCountsCte)
    .select({
      id: playlistsTable.id,
      name: playlistsTable.name,
      isPrivate: playlistsTable.isPrivate,
      ownerClerkId: playlistsTable.ownerClerkId,
      ownerUsername: usersTable.username,
      songCount: sql<number>`coalesce(${songCountsCte.count}, 0)`.as("songCount"),
      createdAt: playlistsTable.createdAt,
    })
    .from(playlistsTable)
    .leftJoin(songCountsCte, eq(playlistsTable.id, songCountsCte.playlistId))
    .leftJoin(usersTable, eq(playlistsTable.ownerClerkId, usersTable.clerkId))
    .where(eq(playlistsTable.ownerClerkId, clerkId));

  res.json(
    playlists.map((p) =>
      ListPlaylistsResponseItem.parse({
        id: p.id,
        name: p.name,
        isPrivate: p.isPrivate,
        songCount: p.songCount ?? 0,
        ownerUsername: p.ownerUsername ?? "",
        coverUrl: null,
        createdAt: p.createdAt,
      }),
    ),
  );
});

router.post("/playlists", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;
  const parsed = CreatePlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getOrCreateUser(clerkId);
  const [playlist] = await db
    .insert(playlistsTable)
    .values({ name: parsed.data.name, ownerClerkId: clerkId, isPrivate: parsed.data.isPrivate ?? false })
    .returning();

  res.status(201).json(
    CreatePlaylistResponse.parse({
      id: playlist.id,
      name: playlist.name,
      isPrivate: playlist.isPrivate,
      songCount: 0,
      ownerUsername: user.username,
      coverUrl: null,
      createdAt: playlist.createdAt,
    }),
  );
});

router.get("/playlists/:id", async (req, res): Promise<void> => {
  const params = GetPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const playlists = await db
    .select({ playlist: playlistsTable, owner: usersTable })
    .from(playlistsTable)
    .leftJoin(usersTable, eq(playlistsTable.ownerClerkId, usersTable.clerkId))
    .where(eq(playlistsTable.id, params.data.id));

  if (!playlists[0]) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }

  // Enforce privacy: private playlists are only visible to the owner
  if (playlists[0].playlist.isPrivate) {
    const auth = getAuth(req);
    const requestingUserId = (auth?.sessionClaims?.userId as string | undefined) || auth?.userId;
    if (!requestingUserId || requestingUserId !== playlists[0].playlist.ownerClerkId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  if (!playlists[0]) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }

  const { playlist, owner } = playlists[0];

  const songRows = await db
    .select({
      song: songsTable,
      albumTitle: albumsTable.title,
      albumCoverObjectPath: albumsTable.coverObjectPath,
      artistId: albumsTable.artistId,
      artistName: artistsTable.name,
      uploaderUsername: usersTable.username,
    })
    .from(playlistSongsTable)
    .innerJoin(songsTable, eq(playlistSongsTable.songId, songsTable.id))
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .leftJoin(artistsTable, eq(albumsTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(songsTable.uploaderClerkId, usersTable.clerkId))
    .where(eq(playlistSongsTable.playlistId, params.data.id));

  res.json(
    GetPlaylistResponse.parse({
      id: playlist.id,
      name: playlist.name,
      isPrivate: playlist.isPrivate,
      ownerUsername: owner?.username ?? "",
      coverUrl: null,
      songs: songRows.map(({ song, albumTitle, albumCoverObjectPath, artistId, artistName, uploaderUsername }) => ({
        id: song.id,
        title: song.title,
        albumId: song.albumId,
        albumTitle: albumTitle ?? "",
        artistId: artistId ?? 0,
        artistName: artistName ?? "",
        coverUrl: coverUrl(albumCoverObjectPath),
        uploaderUsername: uploaderUsername ?? "",
        uploaderClerkId: song.uploaderClerkId,
        duration: song.duration ?? null,
        objectPath: song.objectPath,
        trackNumber: song.trackNumber ?? null,
        createdAt: song.createdAt,
      })),
      createdAt: playlist.createdAt,
    }),
  );
});

router.patch("/playlists/:id", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;
  const params = UpdatePlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(playlistsTable).where(eq(playlistsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  if (existing[0].ownerClerkId !== clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await getOrCreateUser(clerkId);
  const [updated] = await db.update(playlistsTable).set(parsed.data).where(eq(playlistsTable.id, params.data.id)).returning();
  const countResult = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(playlistSongsTable)
    .where(eq(playlistSongsTable.playlistId, params.data.id));
  res.json(
    UpdatePlaylistResponse.parse({
      id: updated.id,
      name: updated.name,
      isPrivate: updated.isPrivate,
      songCount: countResult[0]?.count ?? 0,
      ownerUsername: user.username,
      coverUrl: null,
      createdAt: updated.createdAt,
    }),
  );
});

router.delete("/playlists/:id", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;
  const params = DeletePlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(playlistsTable).where(eq(playlistsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  if (existing[0].ownerClerkId !== clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await db.delete(playlistsTable).where(eq(playlistsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/playlists/:id/songs", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;
  const params = AddSongToPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddSongToPlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(playlistsTable).where(eq(playlistsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  if (existing[0].ownerClerkId !== clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await db.insert(playlistSongsTable).values({ playlistId: params.data.id, songId: parsed.data.songId }).onConflictDoNothing();
  const user = await getOrCreateUser(clerkId);
  const countResult = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(playlistSongsTable)
    .where(eq(playlistSongsTable.playlistId, params.data.id));
  res.status(201).json(
    AddSongToPlaylistResponse.parse({
      id: existing[0].id,
      name: existing[0].name,
      isPrivate: existing[0].isPrivate,
      songCount: countResult[0]?.count ?? 0,
      ownerUsername: user.username,
      coverUrl: null,
      createdAt: existing[0].createdAt,
    }),
  );
});

router.delete("/playlists/:id/songs/:songId", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;
  const params = RemoveSongFromPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(playlistsTable).where(eq(playlistsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  if (existing[0].ownerClerkId !== clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await db.delete(playlistSongsTable).where(
    and(eq(playlistSongsTable.playlistId, params.data.id), eq(playlistSongsTable.songId, params.data.songId)),
  );
  res.sendStatus(204);
});

export default router;
