# LoveOnDev Portfolio Database Schema

## Overview
This is the Supabase Postgres database for the LoveOnDev portfolio and client portal system. All tables use Row Level Security (RLS).

---

## Core Entities

### profiles
User profiles linked to Supabase auth.
- **id**: UUID (PK, references auth.users)
- **email, display_name, first_name, last_name, company, phone, pronouns**: User info
- **is_admin**: Boolean - admin access flag
- **has_seen_welcome**: Boolean - onboarding tracking

### projects
Client projects managed through the portal.
- **id**: UUID (PK)
- **client_id**: UUID (FK → profiles) - DEPRECATED, use project_clients
- **name, description**: Project details
- **subdomain**: Unique subdomain for client portal access
- **url**: Production URL
- **status**: Project status (default 'active')
- **github_repo, github_branch, last_commit_sha**: GitHub integration
- **proposal_slug**: URL slug for proposal documents

### project_clients (many-to-many)
Links projects to multiple client users.
- **project_id**: UUID (FK → projects)
- **client_id**: UUID (FK → profiles)

---

## Communication

### client_messages
Project-scoped messaging between clients and developer.
- **id**: UUID (PK)
- **project_id**: UUID (FK → projects)
- **sender_id**: UUID (FK → profiles)
- **message**: Text
- **is_read**: Boolean
- **client_id**: Nullable (DEPRECATED - now scoped by project_id)

### project_updates
Developer-to-client updates, including GitHub commits.
- **id**: UUID (PK)
- **project_id**: UUID (FK → projects)
- **title, body**: Update content
- **author_role**: Enum ('developer', 'client', 'system', 'github')
- **authored_by**: UUID (FK → profiles)
- **requires_client_action**: Boolean - flags updates needing response
- **is_internal**: Boolean - hides from client view
- **commit_sha, commit_url**: GitHub integration

### review_comments
Visual feedback on client portals - comments anchored to specific page locations.
- **id**: UUID (PK)
- **project_id**: UUID (FK → projects)
- **client_id**: UUID (FK → profiles)
- **url**: Page URL
- **x_position, y_position, viewport_width**: Position data
- **comment_text**: Comment content
- **priority**: Enum ('low', 'medium', 'high')
- **status**: Enum ('new', 'acknowledged', 'in-progress', 'resolved')

---

## Discovery & Methodology

### engagement_recordings
Audio recordings of discovery sessions.
- **id**: UUID (PK)
- **project_id**: UUID (FK → projects)
- **title, session_type**: Session metadata
- **created_by**: UUID (FK → profiles)
- **consent_given**: Boolean - recording consent
- **status**: Session status ('recording', 'paused', 'finalized', 'failed')
- **started_at, stopped_at, duration_seconds**: Timing
- **final_storage_path**: Storage location after finalization
- **total_chunks**: Number of audio chunks

### engagement_recording_chunks
Chunked audio uploads for recordings.
- **id**: UUID (PK)
- **recording_id**: UUID (FK → engagement_recordings)
- **chunk_index**: Integer - sequential chunk number
- **storage_path**: Storage bucket path
- **size_bytes**: Chunk size

### engagement_session_notes
**Discovery markers** - timestamped semantic captures during engagement sessions.

**Marker Types** (note_type):
- **question**: Something not yet understood
- **friction**: Something that makes work harder
- **decision**: A decision made during session
- **observation**: Something important noticed
- **action**: Something to do after session

**Columns**:
- **id**: UUID (PK)
- **recording_id**: UUID (FK → engagement_recordings)
- **note_type**: Text (CHECK: 'question', 'friction', 'decision', 'observation', 'action')
- **note_text**: Text (nullable) - optional context
- **timestamp_seconds**: Integer - marker timestamp
- **created_by**: UUID (FK → profiles)

**Philosophy**: Markers are breadcrumbs through organizational understanding. They're one-click captures that don't interrupt flow. Text is optional - the timestamp and semantic type are the core data.

### personas
CGT methodology personas - roles/people in client organizations.
- **id**: UUID (PK)
- **project_id**: UUID (FK → projects)
- **persona_data**: JSONB - flexible sticky-note-style capture
- **display_order**: Integer
- **created_by**: UUID (FK → auth.users)

### journey_maps
Visual workflow/process maps created during discovery.
- **id**: UUID (PK)
- **project_id**: UUID (FK → projects)
- **title, slug, description**: Map metadata
- **is_public**: Boolean
- **created_by**: UUID (FK → profiles)

### journey_map_notes
Sticky notes on journey maps.
- **id**: UUID (PK)
- **map_id**: UUID (FK → journey_maps)
- **content**: Text
- **color**: Text (default 'blue')
- **x_position, y_position, width, height, z_index**: Positioning

### journey_map_connectors
Lines connecting notes on journey maps.
- **id**: UUID (PK)
- **map_id**: UUID (FK → journey_maps)
- **from_note_id**: UUID (FK → journey_map_notes)
- **to_note_id**: UUID (FK → journey_map_notes)

### journey_map_history
Version control for journey maps.
- **id**: UUID (PK)
- **map_id**: UUID (FK → journey_maps)
- **edited_by**: UUID (FK → profiles)
- **snapshot**: JSONB - full map state
- **change_summary**: Text

---

## Payments

### payments
Centralized payment tracking for all LoveOnDev client projects.
- **id**: UUID (PK)
- **project_id**: UUID (FK → projects)
- **stripe_payment_id, stripe_session_id**: Stripe IDs
- **payment_type**: Enum ('donation', 'class', 'membership', 'retainer', 'project', 'other')
- **item_id**: UUID - generic FK to client-specific items
- **amount, currency**: Payment amount
- **status**: Enum ('pending', 'completed', 'failed', 'refunded')
- **customer_email, customer_name**: Customer info
- **metadata**: JSONB - flexible additional data
- **paid_at**: Timestamp

---

## Client-Specific: Firehouse Arts Chorale

### performances
Chorale performances/concerts.
- **id**: UUID (PK)
- **title, description**: Performance details
- **performance_date**: Date
- **sort_order**: Integer
- **is_published**: Boolean
- **created_by, updated_by**: UUID (FK → profiles)

### rehearsal_tracks
Audio rehearsal tracks for chorale members.
- **id**: UUID (PK)
- **performance_id**: UUID (FK → performances)
- **title, description, composer**: Track metadata
- **duration_seconds**: Integer
- **sort_order**: Integer
- **is_published**: Boolean
- **storage_bucket, storage_object_path**: Storage location (bucket: 'chorale-audio')
- **mime_type**: Audio file type
- **created_by, updated_by**: UUID (FK → profiles)

---

## Utility

### project_approvals
Client approval tracking for project milestones.
- **id**: UUID (PK)
- **project_id**: UUID (FK → projects)
- **title, description**: Approval request details
- **status**: Enum ('pending', 'approved', 'rejected', 'skipped')
- **due_at, responded_at**: Timestamps
- **response_note**: Text

### help_requests
General help/contact form submissions.
- **id**: UUID (PK)
- **name, phone, email, issue**: Request details
- **status**: Enum ('new', 'contacted', 'scheduled', 'completed', 'cancelled')
- **notes**: Text

### push_subscriptions
Web push notification subscriptions.
- **id**: UUID (PK)
- **user_id**: UUID (FK → auth.users)
- **endpoint**: Text (unique) - push service endpoint
- **p256dh, auth**: Push subscription keys
- **last_used_at**: Timestamp

---

## Key Patterns

1. **All tables use RLS** - security enforced at database level
2. **project_clients is the many-to-many** - use this, not projects.client_id
3. **Engagement markers are timestamped semantics** - not traditional notes
4. **JSONB for flexible data** - personas, payments metadata
5. **Client-specific tables coexist** - performances/rehearsal_tracks for Firehouse Arts
6. **GitHub integration** - commits flow into project_updates
