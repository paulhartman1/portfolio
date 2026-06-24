Love On Dev portfolio site built with Next.js 15, React 19, Tailwind, and Supabase.

## Local Development

```bash
npm run dev
```

Requires a `.env.local` with Supabase credentials.

## Scripts

- `npm run dev` — start development server
- `npm run build` — production build
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint
- `npm run test` — Vitest watch mode
- `npm run test:run` — run tests once
- `npm run test:coverage` — run tests with coverage report

## Architecture Notes

- `src/types/journey.ts` — shared Note/Connector types and color constants
- `src/components/journey/` — JourneyCanvas and StickyNote (drag, connect, color-coded notes)
- `src/repositories/` — thin data access layer over static data and Supabase queries
- `src/utils/supabase/` — browser, server, and service-role clients
- Admin and client portal pages use server components with Supabase RLS

### Messaging System

**IMPORTANT: Messages are PROJECT-based, not client-based.**

- `client_messages` table has `project_id` (required)
- All clients associated with a project via `project_clients` can see all messages for that project
- Messages are NOT private between individual clients and admin
- This is a multi-tenant project communication system, not 1:1 DMs
- See `20260624_project_based_messages.sql` migration for RLS policies

## Gotchas

- `about.tsx` uses an IntersectionObserver that adds/removes a body class for visual blending
- Image assets limited; see project rules for display limits
- No commits without explicit approval