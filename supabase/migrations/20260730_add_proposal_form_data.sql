-- Add proposal_form_data column to projects table for storing client form submissions
alter table projects add column if not exists proposal_form_data jsonb default '{}'::jsonb;

-- Add comment describing the column
comment on column projects.proposal_form_data is 'JSON data for proposal form submissions (e.g., Appendix A issues, selected priority pages). Separate from proposal document content which will be stored elsewhere.';

-- Create index for efficient JSON queries
create index if not exists idx_projects_proposal_form_data on projects using gin (proposal_form_data);
