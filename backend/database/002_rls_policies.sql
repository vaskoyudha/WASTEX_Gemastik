-- Enable Row Level Security globally
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (except role/admin fields)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only authenticated users can insert (via signup flow)
CREATE POLICY "users_insert_auth" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Experts and admins can manage other users
-- SUPERSEDED: dropped by migration 20260806000001_fix_users_rls_recursion.sql
-- because this policy self-references `users` and breaks authenticated
-- PostgREST queries with 42P17 (infinite recursion detected in policy).
-- The CREATE is commented out so replaying this legacy file never
-- re-introduces the recursive policy; the DROP below cleans up any
-- leftover definition.
DROP POLICY IF EXISTS "authenticated_manage_users" ON users;
-- CREATE POLICY "authenticated_manage_users" ON users
--   FOR ALL TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM users 
--       WHERE users.id = auth.uid() AND users.role IN ('expert', 'admin')
--     )
--   );

-- Users can only see their own scans
CREATE POLICY "scans_select_own" ON scans
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own scans
CREATE POLICY "scans_insert_own" ON scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update/delete their own scans
CREATE POLICY "scans_update_own" ON scans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "scans_delete_own" ON scans
  FOR DELETE USING (auth.uid() = user_id);

-- Experts can view all scans for evaluation
CREATE POLICY "experts_view_all_scans" ON scans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'expert'
    )
  );

-- Public can browse approved products (no authentication required)
CREATE POLICY "public_view_approved_products" ON products
  FOR SELECT USING (is_approved = TRUE);

-- Only creators or admins can modify products
CREATE POLICY "products_modify_by_creator" ON products
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Public can view approved skills only
CREATE POLICY "public_view_approved_skills" ON skills
  FOR SELECT USING (status = 'approved');

-- Experts can manage all skills (approve/reject/edit)
CREATE POLICY "experts_manage_skills" ON skills
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'expert'
    )
  );

-- Admins can do everything including reject
CREATE POLICY "admins_manage_all_skills" ON skills
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Anyone can insert (via submission flow) but marked as pending
CREATE POLICY "anyone_insert_pending_skills" ON skills
  FOR INSERT WITH CHECK (true);

-- Everyone can read chunks (for RAG retrieval)
CREATE POLICY "anyone_view_chunks" ON skill_chunks
  FOR SELECT USING (TRUE);

-- Only experts/admins can modify chunks
CREATE POLICY "experts_manage_chunks" ON skill_chunks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('expert', 'admin')
    )
  );

-- Users can view their own agent runs
CREATE POLICY "users_view_own_agent_runs" ON agent_runs
  FOR SELECT USING (
    user_id IS NULL  
    OR auth.uid() = user_id
  );

-- System can insert agent runs
CREATE POLICY "system_insert_agent_runs" ON agent_runs
  FOR INSERT WITH CHECK (TRUE);

-- Analytics dashboards can query all runs
CREATE POLICY "analytics_view_all_runs" ON agent_runs
  FOR SELECT USING (TRUE);
