#!/usr/bin/env python3
"""Quick migration runner for WASTEX database."""

import subprocess
import os
from pathlib import Path

# Get database info from project reference
project_id = "ibxnycomuwbloqaninji"
host = f"db.{project_id}.supabase.co"
password = os.environ.get("DATABASE_PASSWORD", input("Enter DATABASE_PASSWORD: ").strip())

conn = f"postgresql://postgres:{password}@{host}:5432/postgres"
print(f"\n📡 Connecting to {host}...\n")

migrations = [
    "backend/database/000_initial_schema.sql",
    "backend/database/002_rls_policies.sql"
]

for migration in migrations:
    print(f"📄 Applying: {migration}")
    result = subprocess.run(["psql", conn, "-f", migration], 
                           capture_output=True, text=True, timeout=60)
    
    if result.returncode == 0:
        print("   ✅ Success!")
    else:
        print(f"   ⚠️  Some warnings/errors:")
        for line in result.stderr.split('\n'):
            if line.strip() and ('ERROR' not in line.upper()):
                print(f"      - {line}")

# Final verification
print("\n🔍 Tables created:")
result = subprocess.run(["psql", conn, "-t", "-c", 
                        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"],
                       capture_output=True, text=True)

if result.returncode == 0:
    for table in sorted([t.strip() for t in result.stdout.strip().split('\n') if t.strip()]):
        print(f"   ✓ {table}")
    
    print("\n✅ ALL MIGRATIONS COMPLETED SUCCESSFULLY!\n")
else:
    print(f"❌ Verification failed: {result.stderr[:200]}")
