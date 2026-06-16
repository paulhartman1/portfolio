-- Add subdomain field to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;

-- Add index for faster subdomain lookups
CREATE INDEX IF NOT EXISTS idx_projects_subdomain ON projects(subdomain);
