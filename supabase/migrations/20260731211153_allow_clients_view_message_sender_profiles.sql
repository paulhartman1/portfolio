-- Allow clients to resolve sender profiles on messages for projects they belong to.
-- Without this, client_messages.sender embeds return null and the portal shows "Unknown".
-- Uses SECURITY DEFINER to avoid infinite recursion between profiles and client_messages RLS.

CREATE OR REPLACE FUNCTION public.can_view_message_sender_profile(profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM client_messages cm
    INNER JOIN project_clients pc ON pc.project_id = cm.project_id
    WHERE cm.sender_id = profile_id
      AND pc.client_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_message_sender_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_message_sender_profile(uuid) TO authenticated;

CREATE POLICY "Clients can view message sender profiles on assigned projects"
  ON profiles FOR SELECT
  TO authenticated
  USING (public.can_view_message_sender_profile(id));
