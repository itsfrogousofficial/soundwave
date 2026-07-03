import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, artistsTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../lib/requireAuth";
import { GetMeResponse, UpdateMeBody, UpdateMeResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// JIT provision a user record from Clerk session
async function getOrCreateUser(clerkId: string, fallbackUsername?: string) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (existing[0]) return existing[0];
  const username = fallbackUsername || `user_${clerkId.slice(-8)}`;
  const [created] = await db.insert(usersTable).values({ clerkId, username }).returning();
  return created;
}

router.get("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;
  const user = await getOrCreateUser(clerkId);

  // Attach claimed artist info if any
  const claimedArtistRows = await db
    .select({ id: artistsTable.id, name: artistsTable.name, imageUrl: artistsTable.imageUrl })
    .from(artistsTable)
    .where(eq(artistsTable.claimedByClerkId, clerkId));

  const base = GetMeResponse.parse({
    id: user.id,
    clerkId: user.clerkId,
    username: user.username,
    displayName: user.displayName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
  });

  res.json({
    ...base,
    claimedArtist: claimedArtistRows[0]
      ? { id: claimedArtistRows[0].id, name: claimedArtistRows[0].name, imageUrl: claimedArtistRows[0].imageUrl ?? null }
      : null,
  });
});

router.patch("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId!;
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.clerkId, clerkId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(UpdateMeResponse.parse({
    id: user.id,
    clerkId: user.clerkId,
    username: user.username,
    displayName: user.displayName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
  }));
});

export { getOrCreateUser };
export default router;
