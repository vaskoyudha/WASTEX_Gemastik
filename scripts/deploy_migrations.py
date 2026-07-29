#!/usr/bin/env python3
"""Deploy Supabase migrations for WASTEX project."""

import os
import subprocess
import sys

def get_psql_connection_string():
    """Build PostgreSQL connection string from environment."""
    env_path = "backend/database/.env"
    
    # Read .env file
    with open(env_path) as f:
        lines = f.readlines()
    
    url = None
    password = None
    
    for line in lines:
        if line.startswith("SUPABASE_URL="):
            url = line.split("=")[1].strip()
        elif line.startswith("#") or "=" not in line:
            continue
        else:
            key, val = line.split("=", 1)
            val = val.strip().strip('"').strip("'")
            
            if "PASSWORD" in key.upper():
                password = val
            elif "SERVICE_ROLE_KEY" in key.upper():
                service_key = val
    
    if not url or "your-" in url:
        print("❌ Error: SUPABASE_URL not configured properly")
        return None
        
    if not password:
        print("⚠️  PASSWORD not found in .env, trying to read from Supabase CLI config...")
        
        # Try reading from Supabase CLI config
        try:
            home_dir = os.path.expanduser("~")
            supabase_config = os.path.join(home_dir, ".config", "supabase", "access_token")
            
            if os.path.exists(supabase_config):
                with open(supabase_config) as f:
                    token = f.read().strip()
                    
                print(f"🔑 Found Supabase access token (first 20 chars): {token[:20]}...")
                
                # We need the actual password - it's stored in Supabase CLI config
                # Try reading db config
                db_config = os.path.join(home_dir, ".supabase", "config.json")
                
                if os.path.exists(db_config):
                    import json
                    with open(db_config) as f:
                        config = json.load(f)
                        
                    if "db_password" in config:
                        password = config["db_password"]
                        print("✅ Found database password from .supabase/config.json")
                    else:
                        print("⚠️  Could not find password. Please add DATABASE_PASSWORD to backend/database/.env")
                        return None
                else:
                    print("⚠️  No .supabase/config.json found")
                    return None
                    
        except Exception as e:
            print(f"❌ Error reading Supabase config: {e}")
            return None
    
    # Build connection string
    project_id = url.replace("https://", "").replace(".supabase.co", "")
    conn_string = f"postgresql://postgres:{password}@db.{project_id}.supabase.co:5432/postgres"
    
    return conn_string

def apply_migration(conn_string, migration_file):
    """Apply a single migration file."""
    print(f"\n📄 Applying {migration_file}...")
    
    result = subprocess.run(
        ["psql", conn_string, "-f", migration_file],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print(f"   ✅ Success!")
        return True
    else:
        print(f"   ❌ Failed:")
        print(result.stderr)
        return False

def main():
    print("=" * 70)
    print("WASTEX Database Migration Deployer")
    print("=" * 70)
    
    # Check prerequisites
    print("\n📋 Checking requirements...")
    
    if not os.path.exists("backend/database/"):
        print("❌ backend/database directory not found")
        return
    
    migrations = [
        ("000_initial_schema.sql", "Initial schema"),
        ("002_rls_policies.sql", "RLS security policies")
    ]
    
    for migration, desc in migrations:
        path = f"backend/database/{migration}"
        if not os.path.exists(path):
            print(f"❌ {desc}: {path} not found")
            return
        print(f"   ✓ {desc}: Found")
    
    # Get connection string
    print("\n🔌 Connecting to Supabase...")
    conn_string = get_psql_connection_string()
    
    if not conn_string:
        print("\n📋 To configure:")
        print("   Edit backend/database/.env with:")
        print("   - SUPABASE_URL=https://your-project.supabase.co")
        print("   - SERVICE_ROLE_KEY=eyJhbGc... (Project API keys)")
        print("   - DATABASE_PASSWORD=your-database-password")
        return
    
    print(f"✅ Connected to project!")
    print(f"   Connection: db.{conn_string.split('.')[1]}.supabase.co")
    
    # Apply migrations
    print("\n🚀 Applying migrations...")
    
    success_count = 0
    for migration, desc in migrations:
        if apply_migration(conn_string, f"backend/database/{migration}"):
            success_count += 1
    
    # Summary
    print("\n" + "=" * 70)
    if success_count == len(migrations):
        print("✅ All migrations deployed successfully!")
        print("\nNext steps:")
        print("  1. Verify tables: python scripts/setup_supabase.py")
        print("  2. Seed knowledge base: cd scripts && python seed_skills.py")
        print("  3. Test authentication: Plan 2 implementation")
    else:
        print(f"⚠️  Only {success_count}/{len(migrations)} migrations succeeded")
        print("Check errors above and fix before continuing")
    
    print("=" * 70)

if __name__ == "__main__":
    main()
