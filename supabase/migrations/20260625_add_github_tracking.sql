-- Add GitHub tracking columns to projects table
ALTER TABLE projects
ADD COLUMN github_repo TEXT,
ADD COLUMN github_branch TEXT DEFAULT 'main',
ADD COLUMN last_commit_sha TEXT;

-- Add commit tracking columns to project_updates table
ALTER TABLE project_updates
ADD COLUMN commit_sha TEXT,
ADD COLUMN commit_url TEXT;

-- Update the author_role check constraint to include 'github'
ALTER TABLE project_updates
DROP CONSTRAINT IF EXISTS project_updates_author_role_check;

ALTER TABLE project_updates
ADD CONSTRAINT project_updates_author_role_check
CHECK (author_role = ANY (ARRAY['developer'::text, 'client'::text, 'system'::text, 'github'::text]));

-- Create index for faster commit lookups
CREATE INDEX IF NOT EXISTS idx_project_updates_commit_sha ON project_updates(commit_sha);
CREATE INDEX IF NOT EXISTS idx_projects_github_repo ON projects(github_repo);

-- Add helpful comment
COMMENT ON COLUMN projects.github_repo IS 'GitHub repository in format owner/repo (e.g., paulhartman1/portfolio)';
COMMENT ON COLUMN projects.github_branch IS 'Git branch to track for updates (default: main)';
COMMENT ON COLUMN projects.last_commit_sha IS 'SHA of the last processed commit from GitHub';
COMMENT ON COLUMN project_updates.commit_sha IS 'GitHub commit SHA if this update originated from a commit';
COMMENT ON COLUMN project_updates.commit_url IS 'Direct link to the GitHub commit';
