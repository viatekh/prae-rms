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

Run these in the Supabase SQL editor, in order:

1. `supabase/schema.sql` — core tables
2. `supabase/setup.sql` — seed data, profiles, base RLS
3. `supabase/migrate-002.sql` — activity/crew/maintenance tables, line-item rate
   columns, role-aware RLS, and `delete_user()`

`supabase/migrate.sql` holds older incremental changes and
`supabase/drop_all.sql` tears everything down.

**Do not leave any table on `using (true)`.** The anon key ships inside the
browser bundle, so `true` makes that table world-readable and world-writable.

For new users to sign in immediately, disable **Enable email confirmations**
under Authentication → Settings in the Supabase dashboard.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run lint` | ESLint over `src/` |
| `npm test` | Vitest over the pure logic modules |
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

### Pricing

Items carry a daily rate plus optional weekly and monthly rates. A line is
charged the cheapest way of making up its duration from whichever rates are
set — straight days, whole blocks rounded up, or blocks plus leftover days —
and the kit list and quote show which was used ("1 wk + 3 days"). A line with no
weekly or monthly rate is billed at `days x day rate`, exactly as before.

Lines snapshot all three rates when they are added, so re-pricing the catalogue
never rewrites a quote that has already gone out.

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
