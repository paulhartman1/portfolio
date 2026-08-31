-- Harden proposal acceptance. Clients no longer get a direct UPDATE grant on
-- proposals (which would allow altering any column of a sent proposal). Instead
-- the /api/portal/proposals/respond route proves membership via the client's
-- RLS-scoped SELECT and then performs the state change with the service role.
-- This reduces client write surface on the proposals table to zero.

DROP POLICY IF EXISTS "Clients can respond to sent proposals on their projects" ON proposals;
