import { Router, type IRouter } from "express";
import { desc, sql, eq } from "drizzle-orm";
import { db, albumsTable, artistsTable, songsTable, usersTable } from "@workspace/db";
import { GetFeaturedResponse, GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function coverUrl(path: string | null | undefined) {
  return path ? `/api/storage${path}` : null;
}

router.get("/featured", async (_req, res): Promise<void> => {
  const songCountsCte = db
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

  const recentAlbums = await db
    .with(songCountsCte)
    .select({
      id: albumsTable.id,
      title: albumsTable.title,
      artistId: albumsTable.artistId,
      artistName: artistsTable.name,
      coverObjectPath: albumsTable.coverObjectPath,
      uploaderClerkId: albumsTable.uploaderClerkId,
      uploaderUsername: usersTable.username,
      songCount: sql<number>`coalesce(${songCountsCte.count}, 0)`.as("songCount"),
      createdAt: albumsTable.createdAt,
    })
    .from(albumsTable)
    .leftJoin(artistsTable, eq(albumsTable.artistId, artistsTable.id))
    .leftJoin(songCountsCte, eq(albumsTable.id, songCountsCte.albumId))
    .leftJoin(usersTable, eq(albumsTable.uploaderClerkId, usersTable.clerkId))
    .orderBy(desc(albumsTable.createdAt))
    .limit(12);

  const albumCountsCte = db
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

  const popularArtists = await db
    .with(albumCountsCte)
    .select({
      id: artistsTable.id,
      name: artistsTable.name,
      bio: artistsTable.bio,
      imageUrl: artistsTable.imageUrl,
      isVerified: artistsTable.isVerified,
      albumCount: sql<number>`coalesce(${albumCountsCte.count}, 0)`.as("albumCount"),
      createdAt: artistsTable.createdAt,
    })
    .from(artistsTable)
    .leftJoin(albumCountsCte, eq(artistsTable.id, albumCountsCte.artistId))
    .orderBy(desc(albumCountsCte.count))
    .limit(8);

  res.json(
    GetFeaturedResponse.parse({
      recentAlbums: recentAlbums.map((a) => ({
        id: a.id,
        title: a.title,
        artistId: a.artistId,
        artistName: a.artistName ?? "",
        coverUrl: coverUrl(a.coverObjectPath),
        uploaderUsername: a.uploaderUsername ?? "",
        uploaderClerkId: a.uploaderClerkId,
        songCount: a.songCount ?? 0,
        createdAt: a.createdAt,
      })),
      popularArtists: popularArtists.map((a) => ({
        id: a.id,
        name: a.name,
        bio: a.bio ?? null,
        imageUrl: a.imageUrl ?? null,
        isVerified: a.isVerified,
        albumCount: a.albumCount ?? 0,
        createdAt: a.createdAt,
      })),
    }),
  );
});

router.get("/stats", async (_req, res): Promise<void> => {
  const [albumCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(albumsTable);
  const [songCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(songsTable);
  const [artistCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(artistsTable);
  const [userCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(usersTable);

  res.json(
    GetStatsResponse.parse({
      totalAlbums: albumCount?.count ?? 0,
      totalSongs: songCount?.count ?? 0,
      totalArtists: artistCount?.count ?? 0,
      totalUsers: userCount?.count ?? 0,
    }),
  );
});

export default router;
