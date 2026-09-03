-- Pin search_path on the numbering triggers introduced by
-- 20260903120000_work_items_and_decisions.sql.
--
-- A mutable search_path in a function that resolves unqualified table names
-- (work_items, decisions) lets a caller-controlled search_path shadow those
-- tables. Flagged by the Supabase security advisor as
-- `function_search_path_mutable`.
--
-- The fix is also folded into the CREATE OR REPLACE statements in the source
-- migration, so a fresh `supabase db reset` produces the pinned definition
-- directly and these ALTERs are a harmless no-op. This file exists so the
-- repository's migration ledger matches the applied remote ledger.
ALTER FUNCTION public.assign_work_item_number() SET search_path = public;
ALTER FUNCTION public.assign_decision_number() SET search_path = public;
