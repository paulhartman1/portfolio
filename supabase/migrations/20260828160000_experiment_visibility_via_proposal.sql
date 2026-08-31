-- Fix: an experiment's client visibility must not depend solely on its own
-- status column staying in sync with a proposal that authorizes it.
--
-- Symptom: an experiment can have status='draft' (e.g. after an admin
-- manually reverts it, or before a status-sync bug is fixed) while a
-- proposal authorizing it is already status='sent'. The client-facing
-- proposal page then tries to load the experiment under the client's RLS
-- session, finds nothing (draft is hidden from clients), and 404s — even
-- though the client was legitimately sent a proposal referencing it.
--
-- Fix: an experiment (and its conditions) is client-visible if EITHER its own
-- status is non-draft, OR it is linked via proposal_experiments to a
-- proposal that is itself sent/accepted/declined for that client's project.
-- This makes "you were sent a proposal about it" sufficient to see the
-- experiment behind it, regardless of a status field drifting out of sync.

CREATE OR REPLACE FUNCTION experiment_visible_to_client(exp_id UUID, client UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM experiments e
    WHERE e.id = exp_id
      AND e.project_id IN (
        SELECT project_clients.project_id FROM project_clients
        WHERE project_clients.client_id = client
      )
      AND (
        e.status IN ('proposed', 'approved', 'active', 'completed')
        OR EXISTS (
          SELECT 1 FROM proposal_experiments pe
          JOIN proposals p ON p.id = pe.proposal_id
          WHERE pe.experiment_id = e.id
            AND p.status IN ('sent', 'accepted', 'declined')
        )
      )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Clients can view non-draft experiments for their projects" ON experiments;
CREATE POLICY "Clients can view experiments visible via status or proposal"
  ON experiments FOR SELECT TO authenticated
  USING (experiment_visible_to_client(id, auth.uid()));

DROP POLICY IF EXISTS "Clients can view conditions for visible experiments" ON experiment_conditions;
CREATE POLICY "Clients can view conditions for visible experiments"
  ON experiment_conditions FOR SELECT TO authenticated
  USING (experiment_visible_to_client(experiment_id, auth.uid()));

DROP POLICY IF EXISTS "Clients can view links for visible experiments" ON experiment_links;
CREATE POLICY "Clients can view links for visible experiments"
  ON experiment_links FOR SELECT TO authenticated
  USING (experiment_visible_to_client(experiment_id, auth.uid()));

DROP POLICY IF EXISTS "Clients can view findings for visible experiments" ON experiment_findings;
CREATE POLICY "Clients can view findings for visible experiments"
  ON experiment_findings FOR SELECT TO authenticated
  USING (experiment_visible_to_client(experiment_id, auth.uid()));

-- One-time data fix: EXP-002 was, in fact, sent to the client via PROP-002.
-- Its status column had drifted back to 'draft'; correct it so the admin UI
-- and lifecycle actions reflect reality.
UPDATE experiments e
SET status = 'proposed',
    proposed_at = COALESCE(e.proposed_at, now())
WHERE e.status = 'draft'
  AND EXISTS (
    SELECT 1 FROM proposal_experiments pe
    JOIN proposals p ON p.id = pe.proposal_id
    WHERE pe.experiment_id = e.id
      AND p.status IN ('sent', 'accepted', 'declined')
  );
