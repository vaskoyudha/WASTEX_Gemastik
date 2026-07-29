#!/usr/bin/env python3
"""Setup script to initialize WASTEX Supabase database."""

import os
import sys

def check_env():
    """Check if .env file exists and has required values."""
    env_path = "backend/database/.env"
    
    if not os.path.exists(env_path):
        print(f"❌ Error: {env_path} not found")
        print("Run: cp backend/database/.env.example backend/database/.env")
        return False
    
    with open(env_path) as f:
        content = f.read()
        
    checks = [
        ("SUPABASE_URL", "Supabase Project URL"),
        ("SUPABASE_SERVICE_ROLE_KEY", "Service Role Key"),
        ("SUPABASE_ANON_KEY", "Anon Key"),
    ]
    
    all_good = True
    for key, desc in checks:
        if key not in content or "your-" in content.split(key)[-1].split("\n")[0]:
            print(f"⚠️  Missing/empty {desc} ({key})")
            all_good = False
            
    if all_good:
        print("✅ Environment variables are configured")
        
    return all_good

def main():
    print("=" * 60)
    print("WASTEX Supabase Setup")
    print("=" * 60)
    
    if not check_env():
        print("\n📋 Next Steps:")
        print("1. Visit https://supabase.com/dashboard")
        print("2. Find your project settings (API > Project API keys)")
        print("3. Edit backend/database/.env with actual values:")
        print("   - SUPABASE_URL: https://xxxxx.supabase.co")
        print("   - SUPABASE_SERVICE_ROLE_KEY: eyJhbGc...")
        print("   - SUPABASE_ANON_KEY: eyJhbGc...")
        print("\n4. Then run this script again")
        sys.exit(1)
    
    # Try to connect via psycopg2
    try:
        import psycopg2
        from dotenv import load_dotenv
        load_dotenv("backend/database/.env")
        
        url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        # Parse connection string
        host = url.replace("https://", "").replace(".supabase.co", "")
        
        conn_string = f"postgresql://postgres:{service_key}@db.{host}.supabase.co:5432/postgres"
        
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        print(f"\n✅ Connected to Supabase project!")
        print(f"   Project ID: {host}")
        
        # Check if tables exist
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        """)
        table_count = cursor.fetchone()[0]
        
        if table_count == 0:
            print(f"\n📦 No tables found. Ready to apply migrations.")
            print("\nTo apply migrations, run:")
            print("  cd backend/database")
            print("  psql 'postgresql://postgres:SUPABASE_SERVICE_ROLE_KEY@db.xxx.supabase.co:5432/postgres' -f 000_initial_schema.sql")
            print("  psql 'postgresql://postgres:SUPABASE_SERVICE_ROLE_KEY@db.xxx.supabase.co:5432/postgres' -f 002_rls_policies.sql")
        else:
            print(f"\n📊 Database already has {table_count} tables")
            cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
            tables = [row[0] for row in cursor.fetchall()]
            print(f"   Tables: {', '.join(tables)}")
        
        conn.close()
        
    except ImportError as e:
        print(f"\n⚠️  Missing dependency: {e}")
        print("Install it with: pip install psycopg2-binary python-dotenv")
    except Exception as e:
        print(f"\n❌ Connection failed: {e}")
        print("\nMake sure your credentials in backend/database/.env are correct!")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
