-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(64) NOT NULL,
    first_name VARCHAR(64),
    last_name VARCHAR(64),
    bio TEXT,
    phone VARCHAR(24),
    avatar_url VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at trigger (reuse existing if available, else define)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles can be read by anyone authenticated (for discoverability), but writes are restricted
-- Allow authenticated users to read their own profile
CREATE POLICY "authenticated_users_read_own_profile" ON profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = auth_user_id);

-- Allow any authenticated user to insert their own profile (triggered after signup or explicit creation)
CREATE POLICY "authenticated_users_create_own_profile" ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = auth_user_id);

-- Users can update their own profile
CREATE POLICY "authenticated_users_update_own_profile" ON profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

-- Users can delete their own profile (cascade deletes row when auth.user deleted via cascade above)
CREATE POLICY "authenticated_users_delete_own_profile" ON profiles
    FOR DELETE
    TO authenticated
    USING (auth.uid() = auth_user_id);

-- Service role bypasses RLS (existing pattern: use service key in headers)
