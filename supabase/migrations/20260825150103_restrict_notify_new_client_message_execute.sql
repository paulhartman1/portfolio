-- The `revoke all ... from public` in the previous migration did not strip
-- EXECUTE from `anon`/`authenticated`, since Supabase grants those roles
-- direct EXECUTE privileges on public schema functions by default. Revoke
-- explicitly so this SECURITY DEFINER function can't be called directly via
-- PostgREST (it should only ever run as a trigger).
revoke execute on function public.notify_new_client_message() from public, anon, authenticated;
