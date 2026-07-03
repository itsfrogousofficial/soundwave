import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { albumsTable } from "./albums";
import { usersTable } from "./users";

export const songsTable = pgTable("songs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  albumId: integer("album_id").notNull().references(() => albumsTable.id, { onDelete: "cascade" }),
  uploaderClerkId: text("uploader_clerk_id").notNull().references(() => usersTable.clerkId),
  objectPath: text("object_path").notNull(),
  duration: integer("duration"), // seconds
  trackNumber: integer("track_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSongSchema = createInsertSchema(songsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songsTable.$inferSelect;
