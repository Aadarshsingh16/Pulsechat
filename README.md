# PulseChat — Enterprise Real-Time Messaging Platform

> **Live Production Demo:** [https://pulsechat-n3yq.onrender.com](https://pulsechat-n3yq.onrender.com)  
> **Repository:** [https://github.com/Aadarshsingh16/Pulsechat](https://github.com/Aadarshsingh16/Pulsechat)  
> Built for the **Entelligo Technical Assessment (Option B — Web Developer)**

---

## 📋 Quick Reviewer Demo Accounts

To test real-time features (instant delivery, typing indicators, read receipts, and group chats), open two browser windows (e.g. Normal and Incognito):

| Account | Email | Password | Role |
| :--- | :--- | :--- | :--- |
| **Window 1 (Alice Cooper)** | `alice@pulsechat.io` | `Password123!` | Primary Sender / Group Admin |
| **Window 2 (Bob Vance)** | `bob@pulsechat.io` | `Password123!` | Recipient / Participant |

---

## 🏛️ System Architecture

PulseChat is engineered as a unified, production-hardened full-stack platform:

```mermaid
graph TD
    Client[Next.js 16 Web Client / Zustand Store]
    Server[Custom Express 5 + Socket.IO Server - server.ts]
    NeonDB[(Neon Serverless PostgreSQL)]
    Cloudinary[Cloudinary Cloud Media CDN]
    NSFW[In-Process NSFWJS MobileNetV2 Classifier]
    Giphy[Giphy Search API + Curated Fallback]

    Client -- "WebSocket (Real-Time Events)" --> Server
    Client -- "HTTP Requests & SSR" --> Server
    Client -- "Direct Signed Upload" --> Cloudinary
    Server -- "Prisma ORM (Compound Indexes)" --> NeonDB
    Server -- "Pre-Visibility Inspection" --> NSFW
    Server -- "Curated & Live Search" --> Giphy
```

### Technology Stack
- **Frontend:** Next.js 16 (React 19, TypeScript Strict Mode), Tailwind CSS, Zustand, Lucide Icons, Framer Motion.
- **Backend:** Custom merged Node.js server ([server.ts](file:///C:/projects/PulseChat/server.ts)) pairing Express 5 with Socket.IO 4.8.
- **Database & ORM:** PostgreSQL on **Neon.tech** via Prisma ORM 6.19 with composite indexing.
- **Media CDN:** Cloudflare R2 / Cloudinary signed direct client-to-cloud uploads.
- **Visual Moderation:** Sharp (224×224 raw RGB pixel decoding) + in-process NSFWJS MobileNetV2 tensor classifier.
- **GIF Integration:** Live Giphy Search API (PG-13 filter) + resilient curated fallback cache.

---

## ⚖️ Architectural Decisions & Engineering Tradeoffs

### 1. Merged Server Architecture vs. Split Microservices
- **Decision:** Next.js and Socket.IO are served from a single merged Node process ([server.ts](file:///C:/projects/PulseChat/server.ts)) sharing the same HTTP port.
- **Tradeoff:**
  - *Why not split services?* Running Next.js on Vercel and WebSockets on Render creates cross-origin cookie friction. Modern browsers block `SameSite=Lax` session cookies on cross-origin WebSocket handshakes, requiring complex token-refresh flows. A single merged server guarantees cookie-based authentication works natively without third-party cookie restrictions.
  - *Engineering Consideration:* Custom Next.js servers in Node.js lack Next.js's CLI-injected `AsyncLocalStorage`. We authored a zero-dependency polyfill ([polyfill.js](file:///C:/projects/PulseChat/polyfill.js)) loaded on line 1, allowing Next.js 16 to prepare in under 200ms without `Invariant: AsyncLocalStorage` crashes.

### 2. Direct Signed Media Uploads vs. Server-Proxied Uploads
- **Decision:** The browser requests an authenticated HMAC signature from `/api/uploads/signature` and uploads directly to Cloudinary CDN, bypassing server storage.
- **Tradeoff:**
  - *Why not write to local server disk?* Cloud container platforms (Render, Heroku, Railway) have **ephemeral filesystems**; files written to disk are wiped on redeploys. Proxied uploads also consume server memory and CPU during multi-megabyte transfers.
  - *Engineering Consideration:* Direct signed uploads offload bandwidth and storage egress while preserving server-side authorization and size caps.

### 3. In-Process Neural Network Moderation vs. 3rd-Party APIs
- **Decision:** Pre-visibility image moderation runs completely in-process using Sharp and NSFWJS (MobileNetV2) running on TensorFlow.js.
- **Tradeoff:**
  - *Why not AWS Rekognition or Sightengine?* Zero external API subscription costs, zero third-party data transmission (privacy-first), and zero external network latency during inspection.
  - *Engineering Consideration (Memory & Boot Speed):* Eagerly loading TensorFlow.js weights on server startup caused out-of-memory crashes (SIGABRT Exit 134) on 512MB RAM instances. We architected a **lazy-loading memoized model loader** ([src/lib/moderation/imageModerator.ts](file:///C:/projects/PulseChat/src/lib/moderation/imageModerator.ts)) that loads weights only upon receiving the first visual upload. Server boot time dropped from 15 seconds to **798ms**, while subsequent image classifications execute in 1.5s–3s.

### 4. Deterministic Compound Cursor Pagination (10,000+ Messages)
- **Decision:** Pagination relies on a compound cursor: `WHERE (createdAt < cursorDate OR (createdAt = cursorDate AND id < cursorId))`.
- **Tradeoff:**
  - *Why not OFFSET / LIMIT?* Offset pagination exhibits $O(N)$ performance degradation on high-volume tables and causes duplicate or skipped messages when new rows are inserted while a user scrolls.
  - *Database Optimization:* Backed by composite Prisma index `@@index([conversationId, createdAt, id])`. Queries for 10,000+ messages execute in **< 4ms**.

### 5. Resilient Dual-Layer GIF Architecture
- **Decision:** Integrated the official Giphy Search API with a 24-item limit and PG-13 safety rating, backed by an offline-resilient curated fallback list.
- **Tradeoff:**
  - Fast empty-state UX: displays curated GIFs instantly without burning API rate limits.
  - Fail-safe: if the Giphy API key is missing or rate-limited, search gracefully falls back to fuzzy title matching against curated assets.

---

## 🛡️ Technical Requirements Compliance Matrix

| Area | Brief Requirement | Implementation & Source File |
| :--- | :--- | :--- |
| **Real-Time Engine** | Instant messaging, typing indicators, active presence, read receipts | Socket.IO room multicasting with debounced typing events and delivery receipts in [server/handlers/message.ts](file:///C:/projects/PulseChat/server/handlers/message.ts). |
| **Group Messaging** | Create groups, manage participants, leave/delete group | Group management modal, dynamic participant addition, admin delete, and member departure in [src/components/chat/GroupMembersModal.tsx](file:///C:/projects/PulseChat/src/components/chat/GroupMembersModal.tsx). |
| **Zero Message Loss** | Idempotent sending, reconnect reconciliation, multi-tab support | Client UUIDs (`clientTempId`), database `@unique` deduplication, socket reconciliation handler, and `PresenceService` multi-tab socket sets in [server/services/presence.ts](file:///C:/projects/PulseChat/server/services/presence.ts). |
| **High-Volume Pagination** | 10,000+ message history without lag or scroll jumps | Compound cursor pagination `[createdAt, id]` with composite index `[conversationId, createdAt, id]` and scroll delta anchoring in [src/components/chat/ChatArea.tsx](file:///C:/projects/PulseChat/src/components/chat/ChatArea.tsx). |
| **Security & Auth** | Server-side auth, prevent spoofing, reject unauthorized access | Server-derived `senderId` from token (client payload `senderId` is ignored), 403 membership verification on every conversation query, and bcryptjs hashing. |
| **Visual Moderation** | Inspect images before recipient visibility | Pre-visibility Sharp RGB decoding + in-process MobileNetV2 NSFWJS classifier rejecting explicit content with HTTP 422 in [src/lib/moderation/imageModerator.ts](file:///C:/projects/PulseChat/src/lib/moderation/imageModerator.ts). |
| **Text Moderation** | Block profanity bypasses (leetspeak, spacing, symbols) | Unicode NFKD normalization, repetition collapsing, and leetspeak translation masking offensive words in [src/lib/moderation/textModerator.ts](file:///C:/projects/PulseChat/src/lib/moderation/textModerator.ts). |
| **Responsive UX** | Adaptive layout, media preview dock, clear message status | Single-pane mobile layout (<768px) with back navigation, WhatsApp/Instagram floating dock, and states: `SENDING` → `SENT` → `DELIVERED` → `READ` → `FAILED`. |

---

## 🧪 Automated Forensic Audit Suite

PulseChat includes a comprehensive automated test suite verifying all core engineering scenarios end-to-end against live database and socket pipelines:

```bash
npx tsx tests/verify_suite.ts
```

### Verification Results:
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
✅ PASS | K. Profanity bypass normalization -> Leetspeak/spacing masked cleanly
✅ PASS | L. Image moderation BEFORE recipient visibility -> Unsafe visual content rejected
✅ PASS | M. Try invalid MIME type -> Disallowed types rejected immediately
✅ PASS | N. Try oversized upload (>5MB) -> Uploads exceeding 5MB rejected
✅ PASS | O. 10,000+ message compound pagination -> Query speed: 3.9ms
----------------------------------------------------
SUMMARY: 14 / 14 Scenarios Verified Successfully.
====================================================
```

---

## 🚀 Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory (or use the provided defaults):
```env
DATABASE_URL="postgresql://neondb_owner:...@ep-lucky-queen-...neon.tech/neondb?sslmode=require"
JWT_SECRET="pulsechat_super_secure_jwt_secret_key_2026"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SOCKET_URL=""
PORT="3000"
NODE_ENV="development"
GIPHY_API_KEY="your_giphy_api_key"
CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"
```

### 3. Database Sync & Seed
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### 4. Start Development Server
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000).

---

## 📦 Cloud Deployment Guide (Render.com)

1. **Repository:** Connect your GitHub repository to [Render.com](https://render.com) as a **Web Service** (Node environment).
2. **Build Command:**
   ```bash
   npm install --include=dev && npx prisma generate && npx prisma db push && npm run build
   ```
3. **Start Command:**
   ```bash
   npm run start
   ```
4. **Environment Variables:**
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://...`
   - `JWT_SECRET=your_secret`
   - `GIPHY_API_KEY=your_giphy_key`
   - `CLOUDINARY_CLOUD_NAME=...`
   - `CLOUDINARY_API_KEY=...`
   - `CLOUDINARY_API_SECRET=...`

---

Built by **Adarsh Singh** for the **Entelligo Technical Assessment**.
