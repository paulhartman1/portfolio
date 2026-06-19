-- Allow review clients to delete comments they created.
-- Without this policy, RLS can make DELETE a no-op even after the API verifies ownership.

DROP POLICY IF EXISTS "Clients can delete own comments" ON public.review_comments;

CREATE POLICY "Clients can delete own comments"
  ON public.review_comments FOR DELETE
  USING (client_id = auth.uid());
