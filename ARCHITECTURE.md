# Portfolio Architecture

## Multi-Tenant Project System

This application uses a **many-to-many relationship** between projects and clients via the `project_clients` junction table.

### Key Principles

1. **Projects are the primary organizing unit**
2. **Multiple clients can be assigned to a single project**
3. **All project features are scoped by `project_id`, NOT `client_id`**

### Data Model

```
projects (1) ----< (many) project_clients (many) >---- (1) profiles
                              ↓
                    All project-scoped tables
                    reference project_id
```

## Messaging System

### ⚠️ CRITICAL: Messages Are Project-Based

**Messages are scoped to PROJECTS, not individual clients.**

```sql
client_messages {
  id: uuid
  project_id: uuid  -- REQUIRED, references projects(id)
  sender_id: uuid   -- Who sent the message
  message: text
  is_read: boolean
  created_at: timestamptz
  updated_at: timestamptz
}
```

### How It Works

1. **Admin sends a message from `/admin/projects/[id]`**
   - Message is inserted with `project_id`
   - All clients assigned to that project can see it

2. **Clients view messages at `/portal/[subdomain]/messages`**
   - Query filters by `project_id` (derived from subdomain)
   - All clients on the project see the same message thread

3. **Clients send messages from the portal**
   - Message is inserted with `project_id`
   - Admin and all other clients on the project can see it

### RLS Policies

```sql
-- Clients can view messages on projects they're assigned to
CREATE POLICY "Clients can view messages on assigned projects"
  ON client_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = client_messages.project_id
      AND project_clients.client_id = auth.uid()
    )
  );
```

### Why Project-Based?

- **Transparency**: All stakeholders on a project see the same conversation
- **Context**: Messages are tied to project work, not individual relationships
- **Simplicity**: One message thread per project, not N×M threads
- **Multi-tenant**: Multiple clients can collaborate on a project

### ❌ What This Is NOT

- **NOT** private 1:1 DMs between admin and individual clients
- **NOT** filtered by `client_id`
- **NOT** siloed per-client communication

### Migration History

- `20260619230744_add_client_messages.sql` — Created table (originally client-based)
- `20260624_project_based_messages.sql` — **Migrated to project-based messaging**
  - Added `project_id` column
  - Updated RLS policies to check `project_clients` junction table
  - Deprecated `client_id` (kept for backward compatibility)

## Other Project-Scoped Features

All of these follow the same pattern: scoped by `project_id`, accessible via `project_clients`:

- `review_comments` — visual feedback on project pages
- `journey_maps` — project planning/flow diagrams
- `journey_map_notes` — sticky notes within journey maps
- `journey_map_connectors` — arrows between notes

## Client Portal Routing

- URL pattern: `/portal/[subdomain]`
- `subdomain` maps to `projects.subdomain`
- Access control via `project_clients` junction table

**NOT** `/portal/[clientId]` — the portal is project-centric, not client-centric.
