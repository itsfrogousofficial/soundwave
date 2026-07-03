import { Router, type IRouter } from "express";
import { eq, ilike, sql, or } from "drizzle-orm";
import { db, albumsTable, artistsTable, songsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/requireAuth";
import { getOrCreateUser } from "./users";
import { getAuth } from "@clerk/express";
import {
  ListAlbumsQueryParams,
  ListAlbumsResponseItem,
  CreateAlbumBody,
  CreateAlbumResponse,
  GetAlbumParams,
  GetAlbumResponse,
  DeleteAlbumParams,
  AddSongToAlbumParams,
  AddSongToAlbumBody,
  AddSongToAlbumResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getOrCreateArtist(name: string) {
  const existing = await db.select().from(artistsTable).where(eq(artistsTable.name, name));
  if (existing[0]) return existing[0];
  const [created] = await db.insert(artistsTable).values({ name }).returning();
  return created;
}

function coverUrl(path: string | null | undefined) {
  return path ? `/api/storage${path}` : null;
}

router.get("/albums", async (req, res): Promise<void> => {
  const params = ListAlbumsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { search, artistId, limit = 24, offset = 0 } = params.data;

  const songCounts = db
    .$with("song_counts")
    .as(
      db
        .select({
          albumId: songsTable.albumId,
          count: sql<number>`cast(count(*) as int)`.as("count"),
        })
        .from(songsTable)
        .groupBy(songsTable.albumId),
    );

  let query = db
    .with(songCounts)
    .select({
      id: albumsTable.id,
      title: albumsTable.title,
      artistId: albumsTable.artistId,
      artistName: artistsTable.name,
      coverObjectPath: albumsTable.coverObjectPath,
      uploaderClerkId: albumsTable.uploaderClerkId,
      uploaderUsername: usersTable.username,
      songCount: sql<number>`coalesce(${songCounts.count}, 0)`.as("songCount"),
      createdAt: albumsTable.createdAt,
    })
    .from(albumsTable)
    .leftJoin(artistsTable, eq(albumsTable.artistId, artistsTable.id))
    .leftJoin(songCounts, eq(albumsTable.id, songCounts.albumId))
    .leftJoin(usersTable, eq(albumsTable.uploaderClerkId, usersTable.clerkId))
    .$dynamic();

  if (search) {
    query = query.where(
      or(ilike(albumsTable.title, `%${search}%`), ilike(artistsTable.name, `%${search}%`)),
    );
  }
  if (artistId) {
    query = query.where(eq(albumsTable.artistId, artistId));
  }

  const albums = await query.limit(limit).offset(offset);

  res.json(
    albums.map((a) =>
      ListAlbumsResponseItem.parse({
        id: a.id,
        title: a.title,
        artistId: a.artistId,
        artistName: a.artistName ?? "",
        coverUrl: coverUrl(a.coverObjectPath),
        uploaderUsername: a.uploaderUsername ?? "",
        uploaderClerkId: a.uploaderClerkId,
        songCount: a.songCount ?? 0,
        createdAt: a.createdAt,
      }),
    ),
  );
});

router.post("/albums", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;
  const parsed = CreateAlbumBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getOrCreateUser(clerkId);
  const artist = await getOrCreateArtist(parsed.data.artistName);

  // If this artist profile is claimed by someone else, only the owner can upload
  if (artist.claimedByClerkId && artist.claimedByClerkId !== clerkId) {
    res.status(403).json({
      error: `This artist profile has been claimed by its owner. Only they can upload to it.`,
    });
    return;
  }

  const [album] = await db
    .insert(albumsTable)
    .values({
      title: parsed.data.title,
      artistId: artist.id,
      coverObjectPath: parsed.data.coverObjectPath ?? null,
      uploaderClerkId: clerkId,
    })
    .returning();

  // Insert songs
  const songsData = parsed.data.songs ?? [];
  if (songsData.length > 0) {
    await db.insert(songsTable).values(
      songsData.map((s: any) => ({
        title: s.title,
        albumId: album.id,
        uploaderClerkId: clerkId,
        objectPath: s.objectPath,
        duration: s.duration ?? null,
        trackNumber: s.trackNumber ?? null,
      })),
    );
  }

  res.status(201).json(
    CreateAlbumResponse.parse({
      id: album.id,
      title: album.title,
      artistId: artist.id,
      artistName: artist.name,
      coverUrl: coverUrl(album.coverObjectPath),
      uploaderUsername: user.username,
      uploaderClerkId: clerkId,
      songCount: songsData.length,
      createdAt: album.createdAt,
    }),
  );
});

router.get("/albums/:id", async (req, res): Promise<void> => {
  const params = GetAlbumParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select({
      album: albumsTable,
      artist: artistsTable,
      uploader: usersTable,
    })
    .from(albumsTable)
    .leftJoin(artistsTable, eq(albumsTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(albumsTable.uploaderClerkId, usersTable.clerkId))
    .where(eq(albumsTable.id, params.data.id));

  if (!rows[0]) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  const { album, artist, uploader } = rows[0];

  const songs = await db
    .select({
      song: songsTable,
      songUploader: usersTable,
    })
    .from(songsTable)
    .leftJoin(usersTable, eq(songsTable.uploaderClerkId, usersTable.clerkId))
    .where(eq(songsTable.albumId, params.data.id));

  res.json(
    GetAlbumResponse.parse({
      id: album.id,
      title: album.title,
      artistId: album.artistId,
      artistName: artist?.name ?? "",
      coverUrl: coverUrl(album.coverObjectPath),
      uploaderUsername: uploader?.username ?? "",
      uploaderClerkId: album.uploaderClerkId,
      songs: songs.map(({ song, songUploader }) => ({
        id: song.id,
        title: song.title,
        albumId: song.albumId,
        albumTitle: album.title,
        artistId: album.artistId,
        artistName: artist?.name ?? "",
        coverUrl: coverUrl(album.coverObjectPath),
        uploaderUsername: songUploader?.username ?? "",
        uploaderClerkId: song.uploaderClerkId,
        duration: song.duration ?? null,
        objectPath: song.objectPath,
        trackNumber: song.trackNumber ?? null,
        createdAt: song.createdAt,
      })),
      createdAt: album.createdAt,
    }),
  );
});

router.delete("/albums/:id", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;
  const params = DeleteAlbumParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(albumsTable).where(eq(albumsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Album not found" });
    return;
  }
  if (existing[0].uploaderClerkId !== clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await db.delete(albumsTable).where(eq(albumsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/albums/:id/songs", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;
  const params = AddSongToAlbumParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddSongToAlbumBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const albumRows = await db
    .select({ album: albumsTable, artist: artistsTable })
    .from(albumsTable)
    .leftJoin(artistsTable, eq(albumsTable.artistId, artistsTable.id))
    .where(eq(albumsTable.id, params.data.id));
  if (!albumRows[0]) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  const user = await getOrCreateUser(clerkId);
  const { album, artist } = albumRows[0];

  const [song] = await db
    .insert(songsTable)
    .values({
      title: parsed.data.title,
      albumId: album.id,
      uploaderClerkId: clerkId,
      objectPath: parsed.data.objectPath,
      duration: parsed.data.duration ?? null,
      trackNumber: parsed.data.trackNumber ?? null,
    })
    .returning();

  res.status(201).json(
    AddSongToAlbumResponse.parse({
      id: song.id,
      title: song.title,
      albumId: song.albumId,
      albumTitle: album.title,
      artistId: album.artistId,
      artistName: artist?.name ?? "",
      coverUrl: coverUrl(album.coverObjectPath),
      uploaderUsername: user.username,
      uploaderClerkId: song.uploaderClerkId,
      duration: song.duration ?? null,
      objectPath: song.objectPath,
      trackNumber: song.trackNumber ?? null,
      createdAt: song.createdAt,
    }),
  );
});

export { getOrCreateArtist };
export default router;
