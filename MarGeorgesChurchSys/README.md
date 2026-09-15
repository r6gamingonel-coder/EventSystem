# أخوية طريق المحبة — Digital Platform

الموقع الرسمي لأخوية طريق المحبة التابعة لكنيسة مار كوركيس الكلدانية: موقع عام (Public)
لعرض قصة الأخوية، فعالياتها، صورها، واستقبال طلبات الانضمام — ولوحة تحكم (Admin
Dashboard) كاملة لإدارة كل المحتوى.

## Tech Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **PostgreSQL** + **Prisma 6** (ORM & migrations)
- **Tailwind CSS 4** for styling (custom warm, church-inspired design system)
- Custom **JWT session auth** (`jose` + `bcryptjs`) for the admin — no third-party auth
  provider, no public user accounts (the public site needs no login at all)
- **sharp** for image optimization on upload, stored on local disk (`public/uploads`)
- `zod` for input validation on every API route

No CMS, no headless commerce, no payment/ticketing system — the project intentionally
stays small and focused: brotherhood site + activities + photos + story + join +
admin.

## Project Structure

```
prisma/schema.prisma       Database schema
prisma/seed.ts             Seed script (super admin, default categories, placeholders)
src/app/(site)/            Public website (Home, Story, Activities, Gallery, Join, Contact)
src/app/admin/             Admin login (public) + admin dashboard (protected)
src/app/api/               Public form endpoints (join, event registration) + all admin APIs
src/components/            UI primitives, site sections, admin widgets
src/lib/                   Prisma client, auth, timezone helpers, queries, media handling
```

## 1. Installation

Requirements: Node.js 20.9+, PostgreSQL 14+.

```bash
npm install
```

## 2. Environment Setup

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Long random secret used to sign admin session tokens (`openssl rand -base64 32`) |
| `SUPER_ADMIN_NAME` / `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Used once by `npm run db:seed` to create the first Super Admin — change the password after first login |
| `TIMEZONE` | IANA timezone (e.g. `Asia/Baghdad`) — all "today/upcoming/past" logic and date displays use this, independent of visitors' device clocks |
| `NEXT_PUBLIC_SITE_URL` | Public base URL, used for share links |

## 3. Database Setup

```bash
npm run db:migrate    # create the database schema
npm run db:seed       # create the Super Admin account, default activity categories,
                       # site settings, and placeholder story content
```

Re-run `npm run db:generate` after pulling schema changes if the Prisma client falls
out of sync.

## 4. Admin Setup

1. Run the seed step above (creates the account from `SUPER_ADMIN_EMAIL` /
   `SUPER_ADMIN_PASSWORD`).
2. Go to `/admin/login` and sign in.
3. **Immediately change the password** under لوحة التحكم → الإعدادات →
   تغيير كلمة المرور.
4. From لوحة التحكم → المشرفون (Super Admin only) you can invite additional admins.

Admin routes (`/admin/*` and `/api/admin/*`) are protected by session-checking
middleware (`src/proxy.ts`) — unauthenticated requests are redirected to
`/admin/login` (or receive a 401 for API calls).

## 5. Running locally

```bash
npm run dev
```

Visit `http://localhost:3000` for the public site and `http://localhost:3000/admin`
for the dashboard.

## 6. Deployment

```bash
npm run build
npm run start
```

- Set all variables from `.env.example` as real environment variables on the host.
- Run `npx prisma migrate deploy` (not `migrate dev`) as part of your deploy step —
  it applies pending migrations without prompting or generating new ones.
- `public/uploads` must be a **persistent, writable** directory across deploys —
  on a platform with an ephemeral filesystem (e.g. most serverless hosts), mount a
  persistent volume or point the storage adapter (`src/lib/media.ts`) at an
  object-storage bucket instead of local disk.
- Use a strong, unique `AUTH_SECRET` in production (never reuse the dev value).

## 7. Backups

The database is the single source of truth for all content (no hardcoded content in
the frontend). Back up regularly with your Postgres provider's tooling, e.g.:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
```

Also back up the `public/uploads` directory (or your object-storage bucket) — it
holds every uploaded image referenced by the database.

## Notes on architecture choices

- **Timezone-safe scheduling**: "Today's activity" logic never depends on a
  visitor's or admin's device timezone — it's computed against `TIMEZONE` on the
  server (`src/lib/timezone.ts`).
- **Soft-delete-friendly**: Activities and Albums use a `DRAFT / PUBLISHED /
  ARCHIVED` status instead of forcing immediate hard deletion, while hard delete
  is still available (with a confirmation dialog) for anything truly unwanted.
- **Audit log**: every admin mutation (create/update/delete/approve/reject/
  publish/archive/login) is recorded in `audit_logs` and visible under سجل
  العمليات.
- **Future-ready, not over-built**: the schema and API layer are shaped so
  push notifications, WhatsApp/email integrations, QR-based attendance, or
  member cards can be added later without a redesign — none of that is built
  now, per the brief.
