---
name: Soundwave platform architecture
description: Key decisions and wiring for the Soundwave music upload/streaming platform.
---

# Soundwave Architecture

## Stack
- Frontend: `artifacts/soundwave` — React + Vite + Tailwind v4 + Wouter + Clerk
- Backend: `artifacts/api-server` — Express + Clerk middleware + Object Storage
- DB: Replit PostgreSQL via Drizzle ORM (`lib/db`)
- Auth: Replit-managed Clerk (Google SSO), secrets: CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, VITE_CLERK_PUBLISHABLE_KEY
- File storage: Replit Object Storage, secrets: DEFAULT_OBJECT_STORAGE_BUCKET_ID, PRIVATE_OBJECT_DIR, PUBLIC_OBJECT_SEARCH_PATHS

## DB Schema (lib/db/src/schema/)
- users: id, clerkId (unique), username, displayName, avatarUrl, spotifyId, spotifyDisplayName
- artists: id, name (unique), bio, imageUrl, isVerified, claimedByClerkId (→ users), spotifyArtistId
- albums: id, title, artistId → artists, coverObjectPath, uploaderClerkId → users
- songs: id, title, albumId → albums, uploaderClerkId → users, objectPath, duration, trackNumber
- playlists: id, name, ownerClerkId → users, isPrivate
- playlist_songs: id, playlistId → playlists, songId → songs

## Object Storage — Public vs Private
- **Private uploads**: POST /api/storage/uploads/request-url (default) → stored under PRIVATE_OBJECT_DIR
  - Served via GET /api/storage/objects/* (requires Clerk auth)
  - objectPath format: `/objects/uploads/{uuid}`
  - Use for: audio files, user avatars, album covers
- **Public uploads**: POST /api/storage/uploads/request-url with `{ isPublic: true }` in body → stored under PUBLIC_OBJECT_SEARCH_PATHS[0]
  - Served via GET /api/storage/public-objects/* (no auth required)
  - objectPath format: `uploads/{uuid}` (relative, no leading slash)
  - Use for: artist profile images (must be visible to unauthenticated users)
- **Why**: Artist profile pages are public; their images must serve without auth. Private endpoint requires Clerk session.

## Artist Claiming System
- Anyone can upload to an unclaimed artist profile (claimedByClerkId IS NULL)
- One claim per user enforced in backend (409 if user already has another claimed artist)
- POST /api/artists/:id/claim — sets claimedByClerkId; checks Spotify externalAccounts; if username matches, sets isVerified=true
- DELETE /api/artists/:id/claim — owner can release the profile
- PATCH /api/artists/:id — edit name/bio/imageUrl; allowed if owner OR unclaimed; 409 on duplicate name
- Once claimed, only the owner can upload albums/songs for that artist (enforced in POST /albums)
- GET /api/artists/by-name/:name — client-side claim check on upload page (debounced, 500ms)
- clerkClient.users.getUser(userId) — NOT clerkClient() — use without parentheses

## Settings & Profile Editing
- GET /users/me now returns `claimedArtist: { id, name, imageUrl } | null` via a join on artistsTable
- PATCH /users/me — update username, displayName, avatarUrl
- /settings page shows profile editor (avatar upload, username, displayName) + claimed artist card
- Avatar upload uses private storage; display via /api/storage/objects/ (auth required)

## Key Wiring
- Users JIT-provisioned on first /api/users/me call
- Artists auto-created on album upload (by name, upsert)
- Upload flow: POST /api/storage/uploads/request-url → PUT to GCS presigned URL
- Clerk externalAccounts provider for Spotify is "spotify" only (not "oauth_spotify") — type-safe

## Responsive Layout
- AppLayout: desktop shows fixed sidebar; mobile shows hamburger top bar + overlay sidebar
- Sidebar accepts `open` / `onClose` props; renders backdrop overlay on mobile
- Desktop: hidden md:block spacer div + md:translate-x-0 keeps sidebar always visible at md+

## Tailwind v4 CSS Rules
- Google Fonts @import url(...) MUST be the FIRST line in index.css (before @import 'tailwindcss')
- Cannot use `dark` as a @apply utility class in Tailwind v4
- CSS custom property values are space-separated HSL (no hsl() wrapper): --primary: 270 100% 65%

## Frontend Query Hooks
- When passing `enabled` option, must also pass `queryKey`: { query: { enabled: !!id, queryKey: getGetXQueryKey(id) } }
- BASE_URL already has trailing slash — use `${import.meta.env.BASE_URL}api/...` not `/api/...`

## Object Storage Web Lib
- lib/object-storage-web tsconfig requires `"composite": true` for TypeScript project references to work.
