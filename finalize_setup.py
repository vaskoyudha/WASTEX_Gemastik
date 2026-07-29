#!/usr/bin/env python3
"""Finalize WASTEX database deployment."""

import subprocess
from pathlib import Path

# Database credentials
password = "WASTEX_gemastik"
project_id = "ibxnycomuwbloqaninji"
host = f"db.{project_id}.supabase.co"
conn = f"postgresql://postgres:{password}@{host}:5432/postgres"

print("="*70)
print("🚀 WASTEX Database Deployment")
print("="*70)
print(f"\n📍 Project: {project_id}")
print(f"🔗 Host: {host}")

migrations = [
    "backend/database/000_initial_schema.sql",
    "backend/database/002_rls_policies.sql"
]

for migration in migrations:
    print(f"\n📄 Applying: {migration}")
    result = subprocess.run(["psql", conn, "-f", migration], 
                           capture_output=True, text=True, timeout=60)
    
    if result.returncode == 0:
        print("   ✅ Success!")
    else:
        # Filter warnings from actual errors
        for line in result.stderr.split('\n'):
            if 'ERROR' in line.upper():
                print(f"   ❌ Error: {line.strip()}")
                exit(1)
            elif line.strip():
                print(f"   ⚠️  {line.strip()}")

# Verify final tables
print("\n" + "="*70)
print("🔍 Verifying deployment...")
result = subprocess.run(["psql", conn, "-t", "-c", 
                        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"],
                       capture_output=True, text=True)

if result.returncode == 0:
    tables = [t.strip() for t in result.stdout.strip().split('\n') if t.strip()]
    print(f"\n✅ Created {len(tables)} tables:")
    for table in sorted(tables):
        print(f"   ✓ {table}")
    
    # Check extension
    result = subprocess.run(["psql", conn, "-t", "-c", 
                            "SELECT extname FROM pg_extension WHERE extname = 'vector';"],
                           capture_output=True, text=True)
    if result.stdout.strip():
        print(f"\n✅ PostgreSQL vector extension enabled")
    
    print("\n" + "="*70)
    print("🎉 SETUP COMPLETE!")
    print("="*70)
    print("\nYour WASTEX database is ready!")
    print("\nNext steps you can do:")
    print("  • Build your mobile app (API connections available)")
    print("  • Test with sample data")
    print("  • Implement authentication system (Plan 2)")
    print("  • Deploy to production\n")
else:
    print(f"❌ Verification failed")
