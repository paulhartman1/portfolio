-- Wrap auth.uid() in a scalar subquery in the work-item / decision policies.
--
-- Postgres then evaluates it once per query instead of once per row. Flagged
-- by the Supabase performance advisor as `auth_rls_initplan`. Semantics are
-- identical; only the query plan changes.
--
-- The fix is also folded into 20260903120000_work_items_and_decisions.sql, so
-- a fresh `supabase db reset` creates the optimized policies directly and
-- this file is a harmless replay. It exists so the repository's migration
-- ledger matches the applied remote ledger.

DROP POLICY IF EXISTS "Admins can manage all work_items" ON work_items;
CREATE POLICY "Admins can manage all work_items"
  ON work_items FOR ALL TO authenticated
  USING (is_admin((SELECT auth.uid()))) WITH CHECK (is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can manage all decisions" ON decisions;
CREATE POLICY "Admins can manage all decisions"
  ON decisions FOR ALL TO authenticated
  USING (is_admin((SELECT auth.uid()))) WITH CHECK (is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can manage all work_item_events" ON work_item_events;
CREATE POLICY "Admins can manage all work_item_events"
  ON work_item_events FOR ALL TO authenticated
  USING (is_admin((SELECT auth.uid()))) WITH CHECK (is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can manage all evidence_links" ON evidence_links;
CREATE POLICY "Admins can manage all evidence_links"
  ON evidence_links FOR ALL TO authenticated
  USING (is_admin((SELECT auth.uid()))) WITH CHECK (is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Clients can view visible work_items for their projects" ON work_items;
CREATE POLICY "Clients can view visible work_items for their projects"
  ON work_items FOR SELECT TO authenticated
  USING (
    client_visible = TRUE
    AND project_id IN (
      SELECT project_clients.project_id FROM project_clients
      WHERE project_clients.client_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clients can view shared decisions for their projects" ON decisions;
CREATE POLICY "Clients can view shared decisions for their projects"
  ON decisions FOR SELECT TO authenticated
  USING (
    client_visible = TRUE
    AND project_id IN (
      SELECT project_clients.project_id FROM project_clients
      WHERE project_clients.client_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clients can view evidence_links for visible subjects" ON evidence_links;
CREATE POLICY "Clients can view evidence_links for visible subjects"
  ON evidence_links FOR SELECT TO authenticated
  USING (
    (
      subject_work_item_id IS NOT NULL
      AND subject_work_item_id IN (
        SELECT wi.id FROM work_items wi
        WHERE wi.client_visible = TRUE
          AND wi.project_id IN (
            SELECT project_clients.project_id FROM project_clients
            WHERE project_clients.client_id = (SELECT auth.uid())
          )
      )
    )
    OR (
      subject_decision_id IS NOT NULL
      AND subject_decision_id IN (
        SELECT d.id FROM decisions d
        WHERE d.client_visible = TRUE
          AND d.project_id IN (
            SELECT project_clients.project_id FROM project_clients
            WHERE project_clients.client_id = (SELECT auth.uid())
          )
      )
    )
  );
