#!/usr/bin/env python3
"""Setup and deploy Supabase database."""

import os
import sys
from pathlib import Path

# Create context manually since CLI isn't in PATH
CONTEXT_DIR = Path.home() / ".config" / "supabase"
CONTEXT_DIR.mkdir(exist_ok=True)

# We'll use environment variables instead of context file
import subprocess

# Check if DATABASE_PASSWORD is set
db_password = os.environ.get("DATABASE_PASSWORD")

if not db_password:
    print("ERROR: Please set DATABASE_PASSWORD environment variable:")
    print("  export DATABASE_PASSWORD='your_actual_db_password'")
    print("  Then run: python3 setup_and_deploy.py")
    sys.exit(1)

project_ref = "ibxnycomuwbloqaninji"
host = f"db.{project_ref}.supabase.co"
conn_string = f"postgresql://postgres:{db_password}@{host}:5432/postgres"

print(f"Connecting to: {conn_string.split(':@')[-1]}")

migrations = [
    "backend/database/000_initial_schema.sql",
    "backend/database/002_rls_policies.sql"
]

for migration in migrations:
    print(f"\n📄 Applying: {migration}")
    result = subprocess.run(["psql", conn_string, "-f", migration], 
                           capture_output=True, text=True, timeout=120)
    
    if result.returncode == 0:
        print(f"   ✅ Success!")
    else:
        print(f"   ❌ Failed:\n{result.stderr[:200]}")
        sys.exit(1)

# Verify
print("\n🔍 Verifying tables...")
result = subprocess.run(["psql", conn_string, "-t"], 
                       capture_output=True, text=True, 
                       command="SELECT tablename FROM pg_tables WHERE schemaname = 'public';")

if result.returncode == 0:
    print(result.stdout)
    print("\n✅ DEPLOYMENT COMPLETE!")
else:
    print(f"Error verifying: {result.stderr}")
    sys.exit(1)
