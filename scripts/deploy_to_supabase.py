#!/usr/bin/env python3
"""Direct deployment script for WASTEX database migrations."""

import os
import sys
import re
from pathlib import Path

def read_env_file():
    """Extract credentials from .env file."""
    env_path = Path("backend/database/.env")
    
    if not env_path.exists():
        print("❌ Error: backend/database/.env not found")
        return None
    
    env_vars = {}
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env_vars[key.strip()] = value.strip().strip('"').strip("'")
    
    required_keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_PASSWORD"]
    
    missing = [k for k in required_keys if k not in env_vars]
    if missing:
        print(f"❌ Missing environment variables: {', '.join(missing)}")
        print("\nPlease edit backend/database/.env with actual values:")
        print("  1. Visit https://supabase.com/dashboard")
        print("  2. Go to Settings → API")
        print("  3. Copy URLs and keys into .env file")
        print("  4. Also add DATABASE_PASSWORD from Settings → Database → Passwords")
        return None
    
    # Validate URL format
    url = env_vars["SUPABASE_URL"]
    if "your-" in url or "xxx" in url:
        print("❌ SUPABASE_URL still contains placeholder value")
        print("   Please replace 'https://xxx.supabase.co' with your actual project URL")
        return None
    
    return env_vars

def build_connection_string(env_vars):
    """Build PostgreSQL connection string from credentials."""
    project_id = env_vars["SUPABASE_URL"].replace("https://", "").replace(".supabase.co", "")
    host = f"db.{project_id}.supabase.co"
    password = env_vars["DATABASE_PASSWORD"]
    
    conn_string = f"postgresql://postgres:{password}@{host}:5432/postgres"
    return conn_string

def execute_migration(conn_string, migration_file):
    """Execute a single SQL migration file."""
    print(f"\n📄 Applying: {os.path.basename(migration_file)}")
    
    try:
        import subprocess
        
        result = subprocess.run(
            ["psql", conn_string, "-f", str(migration_file)],
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")[-3:] if result.stdout else []
            if lines[0] if lines else False else True:
                print(f"   ✅ Success!")
                return True
            else:
                print(f"   ✅ Migrations applied successfully")
                return True
        else:
            print(f"   ❌ Failed:")
            print(result.stderr[:500])
            return False
            
    except FileNotFoundError:
        print("   ⚠️  psql not found, trying alternative method...")
        return execute_via_python(conn_string, migration_file)
    except Exception as e:
        print(f"   ❌ Error executing migration: {e}")
        return False

def execute_via_python(conn_string, migration_file):
    """Fallback: Execute migration using Python's psycopg2."""
    import psycopg2
    
    print(f"📄 Applying: {os.path.basename(migration_file)} (via Python)")
    
    try:
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        with open(migration_file) as f:
            sql = f.read()
        
        cursor.execute(sql)
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"   ✅ Success via Python!")
        return True
        
    except Exception as e:
        print(f"   ❌ Python execution failed: {e}")
        return False

def verify_deployment(conn_string):
    """Verify all tables were created successfully."""
    print("\n🔍 Verifying deployment...")
    
    try:
        import psycopg2
        
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        # Check pgvector extension
        cursor.execute("SELECT * FROM pg_extension WHERE extname='vector';")
        if cursor.fetchone():
            print("   ✅ pgvector extension enabled")
        else:
            print("   ⚠️  pgvector extension NOT enabled")
        
        # Check tables
        cursor.execute("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
        """)
        
        tables = [row[0] for row in cursor.fetchall()]
        expected_tables = ['users', 'scans', 'products', 'skills', 'skill_chunks', 'agent_runs']
        
        print(f"\n📊 Tables created: {len(tables)}")
        for table in sorted(tables):
            print(f"   ✓ {table}")
        
        missing = set(expected_tables) - set(tables)
        if missing:
            print(f"\n⚠️  Missing tables: {missing}")
            return False
        
        # Test RLS policies
        cursor.execute("""
            SELECT tablename, rowsecurity 
            FROM pg_tables 
            WHERE rowsecurity = true;
        """)
        rls_enabled = cursor.fetchall()
        print(f"\n🔒 Row Level Security enabled on {len(rls_enabled)} tables")
        
        cursor.close()
        conn.close()
        
        print("\n✅ Deployment verified successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Verification error: {e}")
        return False

def main():
    print("=" * 70)
    print("WASTEX Database Migration Deployer")
    print("=" * 70)
    
    # Step 1: Read environment
    print("\n🔑 Reading configuration...")
    env_vars = read_env_file()
    
    if not env_vars:
        sys.exit(1)
    
    print(f"   ✅ Found project: {env_vars['SUPABASE_URL']}")
    
    # Step 2: Build connection string
    conn_string = build_connection_string(env_vars)
    print(f"   📡 Connection configured")
    
    # Step 3: Check migrations exist
    migrations = [
        ("backend/database/000_initial_schema.sql", "Schema migrations"),
        ("backend/database/002_rls_policies.sql", "RLS security policies")
    ]
    
    for migration_path, description in migrations:
        if not os.path.exists(migration_path):
            print(f"❌ Missing: {migration_path}")
            sys.exit(1)
        print(f"   ✓ {description} ready")
    
    # Step 4: Execute migrations
    print("\n🚀 Executing migrations...")
    
    success_count = 0
    for migration_path, description in migrations:
        if execute_migration(conn_string, migration_path):
            success_count += 1
        else:
            break
    
    if success_count != len(migrations):
        print(f"\n❌ Only {success_count}/{len(migrations)} migrations succeeded")
        sys.exit(1)
    
    # Step 5: Verify deployment
    if verify_deployment(conn_string):
        print("\n" + "=" * 70)
        print("✅ ALL MIGRATIONS DEPLOYED SUCCESSFULLY!")
        print("=" * 70)
        
        print("\n🎉 Next steps:")
        print("  1. Seed knowledge base (optional):")
        print("     cd scripts && python seed_skills.py")
        print("  \n  2. Plan 2: Implement authentication system")
        print("  3. Start building mobile app features")
        
        return 0
    
    return 1

if __name__ == "__main__":
    sys.exit(main())
