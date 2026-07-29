#!/usr/bin/env python3
import subprocess
import os
from pathlib import Path

# Get credentials from supabase config
config_path = Path(".supabase/config.toml")
if not config_path.exists():
    print("No .supabase/config.toml found, cannot auto-extract credentials")
    exit(1)

content = config_path.read_text()
for line in content.split('\n'):
    if "url" in line and "=" in line:
        url = line.split("=")[1].strip().strip('"')
        
# Extract database host
host = url.replace("https://", "").replace(".supabase.co", "")
db_host = f"db.{host}.supabase.co"

# Try to get password from environment or prompt
password = os.environ.get("DATABASE_PASSWORD")
if not password:
    print("\n⚠️  Need DATABASE_PASSWORD to connect")
    print("Get it from Settings → Database → Passwords in Supabase dashboard\n")
    print("Run once with:")
    print(f"  export DATABASE_PASSWORD='your_password'")
    print(f"  python3 {os.path.basename(__file__)}\n")
    exit(1)

conn = f"postgresql://postgres:{password}@{db_host}:5432/postgres"

print(f"\n📡 Connecting to {db_host}\n")

# Run both migrations
migrations = ["backend/database/000_initial_schema.sql", 
             "backend/database/002_rls_policies.sql"]

for migration in migrations:
    print(f"📄 Applying: {migration}")
    result = subprocess.run(["psql", conn, "-f", migration],
                           capture_output=True, text=True, timeout=60)
    
    if result.returncode == 0:
        print("   ✅ Success!")
    else:
        error_lines = result.stderr[:500].split('\n')
        for line in error_lines:
            if 'ERROR' in line or 'error' in line or 'relation already exists' in line.lower():
                print(f"   ⚠️  {line.strip()}")
            elif line.strip():
                print(f"   ℹ️  {line}")

# Verify tables created
print("\n🔍 Verifying tables...")
result = subprocess.run(["psql", conn, "-t"], 
                       capture_output=True, text=True,
                       input="SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")

if result.returncode == 0:
    tables = [t.strip() for t in result.stdout.strip().split('\n') if t.strip()]
    print(f"\n✅ Created {len(tables)} tables:")
    for table in sorted(tables):
        print(f"   ✓ {table}")
    print("\n🎉 MIGRATION COMPLETE!")
else:
    print(f"Error checking tables: {result.stderr[:200]}")
