import { Router, type IRouter } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, songsTable, albumsTable, artistsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/requireAuth";
import { getAuth } from "@clerk/express";
import {
  ListSongsQueryParams,
  ListSongsResponseItem,
  GetSongParams,
  GetSongResponse,
  DeleteSongParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function coverUrl(path: string | null | undefined) {
  return path ? `/api/storage${path}` : null;
}

router.get("/songs", async (req, res): Promise<void> => {
  const params = ListSongsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { search, albumId, limit = 30, offset = 0 } = params.data;

  let query = db
    .select({
      song: songsTable,
      albumTitle: albumsTable.title,
      albumCoverObjectPath: albumsTable.coverObjectPath,
      artistId: albumsTable.artistId,
      artistName: artistsTable.name,
      uploaderUsername: usersTable.username,
    })
    .from(songsTable)
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .leftJoin(artistsTable, eq(albumsTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(songsTable.uploaderClerkId, usersTable.clerkId))
    .$dynamic();

  if (search) {
    query = query.where(
      or(ilike(songsTable.title, `%${search}%`), ilike(artistsTable.name, `%${search}%`)),
    );
  }
  if (albumId) {
    query = query.where(eq(songsTable.albumId, albumId));
  }

  const songs = await query.limit(limit).offset(offset);

  res.json(
    songs.map(({ song, albumTitle, albumCoverObjectPath, artistId, artistName, uploaderUsername }) =>
      ListSongsResponseItem.parse({
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
      }),
    ),
  );
});

router.get("/songs/:id", async (req, res): Promise<void> => {
  const params = GetSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select({
      song: songsTable,
      albumTitle: albumsTable.title,
      albumCoverObjectPath: albumsTable.coverObjectPath,
      artistId: albumsTable.artistId,
      artistName: artistsTable.name,
      uploaderUsername: usersTable.username,
    })
    .from(songsTable)
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .leftJoin(artistsTable, eq(albumsTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(songsTable.uploaderClerkId, usersTable.clerkId))
    .where(eq(songsTable.id, params.data.id));

  if (!rows[0]) {
    res.status(404).json({ error: "Song not found" });
    return;
  }

  const { song, albumTitle, albumCoverObjectPath, artistId, artistName, uploaderUsername } = rows[0];
  res.json(
    GetSongResponse.parse({
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
    }),
  );
});

router.delete("/songs/:id", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;
  const params = DeleteSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(songsTable).where(eq(songsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  if (existing[0].uploaderClerkId !== clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await db.delete(songsTable).where(eq(songsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
