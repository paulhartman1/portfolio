-- Run this in Supabase SQL Editor to fix the infinite recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create a better policy that doesn't cause recursion
-- Admins can see all profiles by checking is_admin directly on their own row
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
  );

-- Fix the projects policies too
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
CREATE POLICY "Admins can view all projects"
  ON projects FOR SELECT
  USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
  );

DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
CREATE POLICY "Admins can manage all projects"
  ON projects FOR ALL
  USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
  );

-- Fix the review_comments policies
DROP POLICY IF EXISTS "Admins can view all comments" ON review_comments;
CREATE POLICY "Admins can view all comments"
  ON review_comments FOR SELECT
  USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
  );

DROP POLICY IF EXISTS "Admins can manage all comments" ON review_comments;
CREATE POLICY "Admins can manage all comments"
  ON review_comments FOR ALL
  USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
  );
