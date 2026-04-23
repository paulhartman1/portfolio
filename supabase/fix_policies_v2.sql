-- Better fix for infinite recursion - use security definer function

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create a security definer function to check admin status
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin FROM profiles WHERE id = user_id;
$$;

-- Now create policies using the function (no recursion)
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR is_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (is_admin(auth.uid()));

-- Fix projects policies
DROP POLICY IF EXISTS "Clients can view their own projects" ON projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;

CREATE POLICY "Users can view projects"
  ON projects FOR SELECT
  USING (auth.uid() = client_id OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage projects"
  ON projects FOR ALL
  USING (is_admin(auth.uid()));

-- Fix review_comments policies
DROP POLICY IF EXISTS "Clients can view comments on their projects" ON review_comments;
DROP POLICY IF EXISTS "Clients can create comments on their projects" ON review_comments;
DROP POLICY IF EXISTS "Admins can view all comments" ON review_comments;
DROP POLICY IF EXISTS "Admins can manage all comments" ON review_comments;

CREATE POLICY "Users can view comments"
  ON review_comments FOR SELECT
  USING (
    client_id = auth.uid() OR is_admin(auth.uid())
  );

CREATE POLICY "Clients can create comments"
  ON review_comments FOR INSERT
  WITH CHECK (
    client_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = review_comments.project_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage comments"
  ON review_comments FOR ALL
  USING (is_admin(auth.uid()));
