# Backend

Node/Express API + WebSocket sync server for the collaborative document editor. Owns
the database — the frontend never connects to MongoDB directly, only to this API.

See the root [`README.md`](../README.md) for full architecture and the root
[`TECH_STACK.md`](../TECH_STACK.md) for the complete list of libraries and why.

## Folder structure

```
src/
├── server.ts               # entrypoint: connects DB, starts createApp() listening
├── create-app.ts            # builds the Express app + WS server (no side effects — testable)
├── auth/
│   ├── verify-token.ts       # verifies the bridge JWT from the frontend
│   └── get-role.ts           # resolves a user's role on a document
├── middleware/
│   ├── auth.ts                # requireAuth / requireDocumentRole Express middleware
│   └── rate-limit.ts          # express-rate-limit configs (REST)
├── models/                  # Mongoose schemas: User, Document, DocumentPermission,
│                             # DocumentSnapshot, DocumentUpdate
├── routes/
│   ├── auth.ts                # POST /auth/register, /auth/login
│   ├── documents.ts           # document CRUD, sync REST fallback, snapshots/restore
│   └── health.ts              # GET /health
├── sync/
│   ├── merge.ts                # the core CRDT sync-doc helper (state-vector exchange)
│   ├── merge.test.ts           # unit tests: CRDT convergence, in isolation
│   └── snapshot.ts             # version snapshot capture + compaction + restore
├── ws/
│   ├── connection.ts           # per-socket message handler (auth, sync, updates)
│   ├── registry.ts             # in-memory Room registry (one Y.Doc per open document)
│   ├── apply-update.ts         # apply + persist + broadcast an update
│   └── rate-limit.ts           # per-connection WS message token bucket
├── db/
│   ├── mongoose.ts             # connection singleton
│   └── seed.ts                 # dev seed script (demo owner/viewer + document)
├── shared/                  # Zod schemas (sync protocol, roles) — mirrored in
│                             # frontend/src/lib/shared, kept in sync manually
└── integration/
    └── sync.integration.test.ts  # boots a real server + real MongoDB, drives it with ws clients
```

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `PORT` | Port to listen on (default 4000) |
| `CORS_ORIGIN` | The frontend's origin, allowed to call this API |
| `NEXTAUTH_SECRET` | Must match the frontend's — used to verify the bridge JWT |

## Running locally

```bash
npm install
cp .env.example .env
npm run db:seed     # creates demo owner/viewer users + a demo document
npm run dev         # tsx watch — auto-restarts on file changes
```

## API surface

**REST** (all except `/health` and `/auth/*` require `Authorization: Bearer <token>`):
- `POST /auth/register`, `POST /auth/login` — credential verification for NextAuth
- `GET /documents`, `POST /documents` — list / create documents
- `GET /documents/:id` — metadata + your role
- `GET/POST /documents/:id/updates` — Yjs sync REST fallback (state-vector diff / push)
- `GET/POST /documents/:id/snapshots` — version history
- `POST /documents/:id/restore/:snapshotId` — restore a version (as a new forward update)

**WebSocket** (`/sync`): JSON message protocol — `auth`, `sync-step1`/`sync-step2`,
`update`, `error`. See `src/shared/sync-protocol.ts` for the exact shapes.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Start in watch mode |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled build (`dist/server.js`) |
| `npm test` | Unit + integration tests (Vitest — the integration suite needs a reachable MongoDB) |
| `npm run db:seed` | Seed demo data |


