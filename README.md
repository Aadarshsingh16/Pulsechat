# PulseChat — Enterprise Real-Time Messaging Platform

> **Live Demo:** [https://pulsechat-demo.onrender.com](https://pulsechat-demo.onrender.com) *(Update with your deployed URL)*

> [!NOTE]
> **Reviewer Note on Cold Starts**: On free-tier cloud hosts (e.g. Render), the web service spins down after 15 minutes of inactivity. First load after spin-down may take **20–30 seconds** while the container provisions and the in-process MobileNetV2 moderation model preloads its weights (~12.7s one-time initialization). Subsequent requests and WebSocket messages respond instantly.

---

PulseChat is an enterprise-grade real-time messaging application built with **Next.js 16 (App Router)**, **TypeScript (Strict Mode)**, **Tailwind CSS**, **Prisma ORM**, and a dedicated **Socket.IO Real-Time Engine**.

Designed with an editorial luxury aesthetic (warm ivory paper `#FAF8F5`, obsidian `#18181B`, warm amber `#C08426`), PulseChat satisfies every requirement of the technical assessment — including guaranteed zero-message-loss delivery, pre-visibility image moderation, deterministic compound cursor pagination for 10,000+ messages, and an adaptive single-pane mobile layout.

---

## 📋 Assignment Requirements & Compliance Matrix

| Requirement Area | Specification from Brief | Implementation & Code Location |
| :--- | :--- | :--- |
| **1. Real-Time Communication** | Bi-directional messaging, typing indicators, active presence, read receipts | Dedicated Socket.IO engine on port `3001` with room multicasting, typing debounce, and read sync in `server/index.ts`. |
| **2. Group Messaging** | Support group chats, member management, invite/leave/delete | Interactive creation modal, member drawer, dynamic participant invite, leave group, and delete group options in `src/components/chat/GroupMembersModal.tsx`. |
| **3. Messaging Reliability** | Zero message loss on disconnect/reconnect, idempotency, multi-tab support | Client temporary UUIDs (`clientTempId`), database `UNIQUE` constraint preventing duplicate retries, and multi-tab socket tracking per user in `server/services/presence.ts`. |
| **4. High-Volume Pagination** | 10,000+ messages, no bulk loading, cursor-based pagination, database indexes | Compound cursor pagination on `[createdAt DESC, id DESC]` with composite index `[conversationId, createdAt, id]` in `prisma/schema.prisma`. Query speed < 4ms for 10k messages. |
| **5. Security & Authorization** | Server-side auth, prevent reading foreign chats, reject spoofed sender IDs, rate limiting | HttpOnly JWT session verification, server-derived `senderId` from token (never trust client payload), strict 403 membership verification on all routes, sliding-window rate limiting. |
| **6. Content Moderation** | Pre-visibility image moderation, multi-pass profanity bypass defense | Sharp pixel decoding + in-process NSFWJS MobileNetV2 neural network (rejects unsafe media before storage/broadcast with HTTP 422). Unicode NFKD + leetspeak + repetition text masking. |
| **7. Media Performance** | Lazy loading, non-blocking GIFs/images, file type & magic byte checks | Pre-send preview with cancel and captioning, asynchronous decoding (`decoding="async"`), deferred loading (`loading="lazy"`), 5MB file cap, and magic-byte header validation. |
| **8. Responsive UI/UX** | Mobile-responsive layout, media picker behavior, clear message states | Single-pane mobile layout (`< 768px`) with `<ChevronLeft>` back button, WhatsApp/Instagram floating dock, and states: `SENDING` → `SENT` → `DELIVERED` → `READ` → `FAILED` (1-click retry). |

---

## 🛠️ Technology Stack & Architecture Decisions

| Layer | Technology | Architectural Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16 (React 19, TypeScript)** | Modern App Router with server components, streaming SSR, and strict type safety across all components and API routes. |
| **Styling & Design System** | **Tailwind CSS** | Custom editorial paper palette (`#FAF8F5`, `#18181B`, `#C08426`) with responsive breakpoints (`md: 768px`) and glassmorphism. |
| **Real-Time WebSockets** | **Socket.IO (Node.js)** | Dedicated real-time WebSocket server on port `3001` with handshake cookie/JWT authentication, room multicasting, heartbeats, and reconnection reconciliation. |
| **State Management** | **Zustand** | Lightweight, reactive client stores for authentication, active conversations, real-time message streams, and typing indicators. |
| **Database & ORM** | **Prisma ORM + SQLite / PostgreSQL** | Zero-config SQLite (`dev.db`) for frictionless local evaluation, 100% ANSI SQL compatible with PostgreSQL for production. Compound indexes: `[conversationId, createdAt, id]` and `[clientTempId]`. |
| **Media & Object Storage** | **Cloudflare R2 / Local Disk** | Pluggable `IObjectStorageService` with local disk fallback (`public/uploads/`), featuring magic-byte validation and 5MB size limits. |
| **Image Moderation** | **Sharp + NSFWJS (MobileNetV2)** | True in-process neural network inference on raw 224×224 RGB decoded pixels. Zero external API dependencies, zero network egress. |
| **Authentication** | **JWT & HttpOnly Cookies** | Secure `SameSite=Lax; HttpOnly` session cookies with bcryptjs password hashing and strict server-derived `senderId`. |

---

## 🌟 Core Engineering Deep-Dives

### 1. Messaging Reliability & Idempotency
- **Optimistic Dispatch with Temporary IDs**: Every sent message instantly creates an optimistic item in client state with a unique `clientTempId` and a `SENDING` clock state.
- **Database Idempotency**: The `Message` schema enforces `@unique` on `clientTempId`. If a client retries or reconnects, the database rejects duplicates at the constraint level without creating duplicate rows.
- **Reconnection Reconciliation**: When the socket reconnects after a network drop, pending unacknowledged messages are reconciled against the database, flipping status to `SENT` or `FAILED`.
- **Multi-Tab Presence**: The `PresenceService` maintains a `Set<string>` of active socket IDs for each `userId`. A user is only marked offline when their last browser tab disconnects (with a 3-second grace period).

### 2. High-Volume Pagination (10,000+ Messages)
- **Deterministic Compound Ordering**: Simple auto-increment ID pagination fails under concurrent writes or non-monotonic timestamps. PulseChat uses compound cursor pagination sorting on:
  ```sql
  WHERE (conversationId = :id) AND (createdAt < :cursorDate OR (createdAt = :cursorDate AND id < :cursorId))
  ORDER BY createdAt DESC, id DESC
  LIMIT 50
  ```
- **Composite Database Indexing**: Covered by Prisma composite index `@@index([conversationId, createdAt, id])`. Tested with **10,000 seeded messages**, Page 1 and Page 2 queries execute in **< 4ms**.
- **Scroll Position Preservation**: Prepending older message pages calculates the DOM height delta before and after render, keeping the user's scroll position anchored without visual jumps.

### 3. Media Picker with Pre-Send Preview & Async Rendering
- **Pre-Send Image Preview Card**: Clicking the image picker displays a floating preview card showing the image thumbnail, file name, and size with an `(X)` cancel button.
- **Caption Support**: Users can add an optional caption in the input dock; captions are saved to the database and displayed beneath the media.
- **Async Decoding without Lazyload Deadlocks**: Images use `decoding="async"` to prevent main-thread stuttering. Unlike naive implementations that use `display: none` before load (which breaks browser lazy loading), images maintain DOM layout presence (`opacity-0 absolute` until loaded) with an explicit fallback card on network error.

### 4. Single-Pane Responsive Mobile Layout
- **Desktop (`>= 768px`)**: Split-pane view with fixed sidebar (`md:w-96`) and chat viewport (`flex-1 min-w-0`).
- **Mobile (`< 768px`)**: Single-pane view showing either the conversation list or the active chat pane.
- **Mobile Header Back Button**: A `<ChevronLeft>` button in the header resets the active conversation, returning the user to the chat list.
- **Touch-Friendly Sheets**: Group management modals automatically transition to native bottom sheets on mobile viewports.

---

## 🛡️ Image Moderation

**Model:** NSFWJS (MobileNetV2-based classifier), running via `@tensorflow/tfjs`.

**Where inference runs:** Fully in-process on the Node.js application server — no external API calls, no third-party service, no image data leaves the server at inference time. Images are decoded to raw RGB pixels with `sharp` (resized to 224×224, the model's expected input geometry) before being passed to the classifier as a tensor.

**Model size:** ~4.5MB (MobileNetV2 weights). Loaded once at server startup via a cached promise and background-preloaded so the first user upload doesn't pay a cold-start penalty.

**Measured latency (local dev machine, CPU inference via `@tensorflow/tfjs`, not `tfjs-node`):**
- Model cold load (startup, one-time): ~12.7s
- Per-image inference (decode + classify): ~1.6s – 3.1s

We chose the pure-JS `tfjs` backend over `tfjs-node` specifically for Windows/Node 24 compatibility — `tfjs-node`'s native bindings require a C++ build toolchain that fails to compile in that environment. The tradeoff is slower CPU-only inference (~3s/image) in exchange for a dependency-free install and zero external API cost or data-sharing. This is visible to the user as the existing `SENDING` state (spinner) during upload, so the delay reads as "processing," not as the app hanging.

**Decision rule:** Images are classified into five categories (`porn`, `hentai`, `sexy`, `neutral`, `drawings`). An upload is rejected before storage or broadcast if:

| Category | Threshold |
| :--- | :--- |
| **Pornography** | P > 0.60 |
| **Hentai** | P > 0.60 |
| **Sexy** | P > 0.80 |

Rejected uploads return `HTTP 422` with a clear message to the sender. The image is never written to storage and never broadcast to any recipient — moderation happens strictly before visibility, and this is enforced server-side (bypassing the check by calling the API directly is not possible, since the check runs in the same code path regardless of client).

**Known limitation:** ~3s/image inference is acceptable for a single-user demo but would need either a GPU-backed environment or a swap to `tfjs-node`/a hosted API (e.g. Sightengine, AWS Rekognition) to scale to production-level concurrent uploads.

---

## 🧪 Automated Forensic Audit Suite

PulseChat includes a comprehensive automated test suite verifying all 14 grading scenarios end-to-end:

```bash
npx tsx tests/verify_suite.ts
```

### Audit Results:
```text
====================================================
🧪 PULSECHAT AUTOMATED FORENSIC ENGINEERING AUDIT
====================================================
✅ PASS | A. Alice sends Bob a text message -> Persisted with status SENT
✅ PASS | B. Bob replies -> Persisted with status DELIVERED
✅ PASS | C. Alice types and Bob sees typing -> Broadcasts typing:update
✅ PASS | D. Bob reads Alice message -> State updated to READ, lastReadAt synced
✅ PASS | E & F. Disconnect before ACK & Reconnect -> Reconciles to SENT
✅ PASS | G. Retry the same clientTempId -> Database UNIQUE constraint blocks duplicate
✅ PASS | H. Open Alice in two tabs -> PresenceService tracks multi-tab socket set
✅ PASS | I. Access conversation without membership -> 403 Forbidden strictly enforced
✅ PASS | J. Attempt to spoof senderId -> Server derives senderId from token
✅ PASS | K. Profanity bypass normalization -> Leetspeak/spacing masked to '****'
✅ PASS | L. Image moderation BEFORE recipient visibility -> Sharp decoded 224x224 RGB; unsafe/corrupt rejected
✅ PASS | M. Try invalid MIME type -> Disallowed types rejected immediately
✅ PASS | N. Try oversized upload (>5MB) -> Uploads exceeding 5MB rejected
✅ PASS | O. 10,000+ message compound pagination -> Query speed: 3.9ms
----------------------------------------------------
SUMMARY: 14 / 14 Scenarios Verified Successfully.
====================================================
```

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database & Seed Accounts
```bash
# Push Prisma schema to SQLite dev database
npx prisma db push

# Seed demo users (Alice Cooper & Bob Vance) and initial conversation
npx tsx prisma/seed.ts
```

### 3. Start Development Servers
Runs Next.js on port `3000` and Socket.IO on port `3001`:
```bash
npm run dev
```

---

## 👥 Demo Test Accounts

Open two browser windows to test real-time delivery and read receipts:

| Window | Account | Email | Password |
| :--- | :--- | :--- | :--- |
| **Window 1 (Normal)** | **Alice Cooper** | `alice@pulsechat.io` | `Password123!` |
| **Window 2 (Incognito)** | **Bob Vance** | `bob@pulsechat.io` | `Password123!` |

---

## ☁️ Free Cloud Deployment Guide ($0 / Month)

PulseChat can be deployed completely free using modern cloud tiers:

### Option A: Render.com (Recommended — Single Host, 100% Free)

This is the recommended deployment path because running both Next.js and Socket.IO on the same host avoids cross-origin cookie restrictions.

1. **Database Setup**:
   - Create a free PostgreSQL instance on [Render.com](https://render.com).
   - In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
   - Add the `DATABASE_URL` environment variable in your Render dashboard.
2. **Persistent Media Storage (Cloudflare R2)**:
   - *Note*: Render's free web service disk is **ephemeral** — local file storage (`public/uploads/`) is cleared on container restarts or redeploys.
   - For permanent media persistence across redeploys, configure Cloudflare R2 (10GB free tier, $0 egress fees) by setting the following environment variables:
     ```env
     R2_ACCOUNT_ID=your_cloudflare_account_id
     R2_ACCESS_KEY_ID=your_access_key
     R2_SECRET_ACCESS_KEY=your_secret_key
     R2_BUCKET_NAME=your_bucket_name
     R2_PUBLIC_URL=https://your-custom-or-r2-domain.com
     ```
3. **Web Service Configuration**:
   - Connect your GitHub repository to Render as a **Web Service** (Node environment).
   - **Build Command**:
     ```bash
     npm install && npx prisma generate && npx prisma db push && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
     *(Executes `concurrently` running the pre-compiled `next start` production server on port 3000 and the real-time Socket.IO daemon on port 3001).*
   - Set environment variables:
     - `NODE_ENV=production`
     - `JWT_SECRET=your_super_secret_jwt_key`
     - `NEXT_PUBLIC_APP_URL=https://your-service-name.onrender.com`
     - `NEXT_PUBLIC_SOCKET_URL=https://your-service-name.onrender.com`

---

### Option B: Split Architecture (Vercel + Render / Railway — Advanced)

> [!WARNING]
> **Cross-Origin Cookie Requirement**: The application uses `HttpOnly; SameSite=Lax` cookies for session management. In a split deployment where the frontend is on Vercel (`.vercel.app`) and the WebSocket server is on Render/Railway (`.onrender.com`), browsers will **not** send the `SameSite=Lax` cookie in cross-origin WebSocket handshakes.
>
> To use this architecture, you must:
> 1. Set `SameSite=None; Secure` on the session cookie in `src/lib/auth.ts`.
> 2. Configure the Socket.IO server CORS with the explicit Vercel origin and `credentials: true` (wildcards `*` are disallowed with credentials).
> 3. Ensure the client initializes Socket.IO with `withCredentials: true`.
>
> For a simple, zero-friction setup, **Option A** is strongly recommended.

1. **Frontend**: Deploy Next.js to **Vercel** (Free Hobby plan).
2. **WebSockets**: Deploy `server/index.ts` to **Render** or **Railway** (free tier with persistent connections). Set `NEXT_PUBLIC_SOCKET_URL` in Vercel to your WebSocket URL.
3. **Database**: Free serverless PostgreSQL on **Neon.tech** or **Supabase**.
4. **Media Storage**: **Cloudflare R2** (10GB free tier, 0 egress fees).

---

Built by **Adarsh Singh** for the **Entelligo Technical Assessment (Option B — Web Developer)**.
