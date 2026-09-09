# PRAE — Rental Management

Equipment rental management for AV / production hire: inventory, quotes,
kit lists, availability, scheduling and PDF paperwork.

Built with React 19, TypeScript, Vite, Tailwind v4, TanStack Query and Supabase.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase project details
npm run dev
```

`.env.local` needs:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

### Database

Run `supabase/schema.sql` in the Supabase SQL editor to create the tables, then
`supabase/setup.sql` for seed data. `supabase/migrate.sql` holds incremental
changes and `supabase/drop_all.sql` tears everything down.

For new users to sign in immediately, disable **Enable email confirmations**
under Authentication → Settings in the Supabase dashboard.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run lint` | ESLint over `src/` |
| `npm run preview` | Serve the production build locally |

## How it fits together

```
src/
  pages/        one file per route
  components/
    shared/     Button, Input, Select, Modal, Toast, Layout, guards
    inventory/  item form, CSV import, category manager
  hooks/        one module per resource; all data access goes through TanStack Query
  lib/          supabase client, auth + toast contexts, PDF documents, CSV, maths
  types/        database row types
```

Key conventions:

- **Data access lives in `hooks/`.** Pages don't call `supabase` directly; if you
  need a new query, add it to the relevant hook module so caching and
  invalidation stay in one place.
- **Auth is a single context.** `AuthProvider` holds the only `onAuthStateChange`
  subscription; read it with `useAuth()` from `lib/auth-context`.
- **Mutations strip joined relations.** Supabase rows come back with `client`,
  `line_items`, `category` etc. attached; those must never be sent back in an
  `update`, so the update hooks destructure them off.
- **List views keep filters in the URL** (`?q=`, `?status=`, `?tab=`, `?view=`)
  so a view is shareable and survives navigating into a record and back.

### Availability

`useItemTypeAvailability` groups inventory by item *name* to get a unit count per
type, then subtracts quantities committed to other projects whose dates overlap.
Only `sent`, `confirmed` and `invoiced` projects hold stock — drafts don't.
Comparisons are day-precision, since project dates are stored as both plain
dates and full timestamps.

### Kit list editing

The kit list on a project is edited in local state and saved explicitly. While
edits are pending the page shows an "Unsaved changes" badge and blocks
navigation. The project *details* panel to its left autosaves on a debounce and
flushes any pending write when it unmounts.
