-- Drop self-referencing RLS policy on users that breaks authenticated
-- PostgREST queries with 42P17 (infinite recursion detected in policy
-- for relation "users"). Its USING clause queries the same table, so any
-- authenticated access to skills/scans/skill_chunks/products (whose
-- expert/admin policies subquery users) recurses at plan time.
-- Recreated nowhere: public.users has no rows and no app code reads it;
-- backend writes go through the service role, which bypasses RLS.
drop policy if exists "authenticated_manage_users" on public.users;
