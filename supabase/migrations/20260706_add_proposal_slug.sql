-- Add proposal_slug column to projects table
alter table projects add column if not exists proposal_slug text;

-- Add comment describing the column
comment on column projects.proposal_slug is 'URL slug for the proposal document (e.g., "firehouse-2026"). Proposal is accessible at /portal/{subdomain}/proposal/{proposal_slug}';
