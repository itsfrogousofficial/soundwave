import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const artistsTable = pgTable("artists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  bio: text("bio"),
  imageUrl: text("image_url"),
  isVerified: boolean("is_verified").notNull().default(false),
  // Claiming
  claimedByClerkId: text("claimed_by_clerk_id").references(() => usersTable.clerkId, { onDelete: "set null" }),
  // Spotify artist ID stored when owner links Spotify to verify the claim
  spotifyArtistId: text("spotify_artist_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertArtistSchema = createInsertSchema(artistsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertArtist = z.infer<typeof insertArtistSchema>;
export type Artist = typeof artistsTable.$inferSelect;
