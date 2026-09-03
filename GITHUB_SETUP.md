# GitHub Commit Sync Setup

This project uses GitHub Actions to automatically sync commits to project updates in Supabase.

## Required GitHub Secrets

Before the workflow can run, you need to add these secrets to your GitHub repository:

### 1. Add Secrets to GitHub

Go to: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add the following secrets:

#### `SUPABASE_URL`
- Your Supabase project URL
- Format: `https://your-project-id.supabase.co`
- Find it in: Supabase Dashboard → Settings → API

#### `SUPABASE_SERVICE_KEY`
- Your Supabase service role key (NOT the anon key!)
- Find it in: Supabase Dashboard → Settings → API → Service Role (secret)
- ⚠️ **Important**: Use the service role key, not the anon key. The service role key bypasses RLS.

### 2. Configure Projects to Track GitHub

In your admin dashboard:

1. Go to `/admin/projects/[id]` for each project you want to track
2. Scroll to the "GitHub Integration" section
3. Enter:
   - **Repository**: `paulhartman1/portfolio` (or your repo in format `owner/repo`)
   - **Branch**: `main` (or the branch you want to track)
4. Click "Save GitHub Config"

### 3. How It Works

When you push commits to the configured branch:

1. GitHub Action triggers automatically
2. Action fetches all projects tracking your repository
3. For each project:
   - Gets commits since `last_commit_sha`
   - Creates a `project_updates` record for each new commit
   - Updates `last_commit_sha` to the latest commit
4. Updates appear in:
   - Admin project view (`/admin/projects/[id]`)
   - Client portal (`/portal/[subdomain]`)

### 4. Testing

After setting up the secrets and configuring a project:

1. Make a test commit and push to main
2. Check the Actions tab in GitHub to see the workflow run
3. Visit the admin project view to see the new update
4. Visit the client portal to verify it shows there too

### 5. Troubleshooting

**Workflow is skipped because Supabase credentials are not configured**
- Verify both `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set in GitHub Secrets
- Make sure there are no extra spaces in the secret values

**No updates appear after commits**
- Check that at least one project has `github_repo` set to match your repository
- Verify the `github_branch` matches the branch you pushed to
- Check the Actions tab for any errors in the workflow run

**Updates appear in admin but not portal**
- Verify `is_internal` is set to `false` in the database
- Check that the client has access to the project via `project_clients` table

## Database Schema

The following columns were added:

### `projects` table
- `github_repo` (text, nullable) - Repository in format "owner/repo"
- `github_branch` (text, default: 'main') - Branch to track
- `last_commit_sha` (text, nullable) - Last processed commit SHA

### `project_updates` table
- `commit_sha` (text, nullable) - GitHub commit SHA
- `commit_url` (text, nullable) - Link to GitHub commit
- `author_role` updated to include 'github' option
