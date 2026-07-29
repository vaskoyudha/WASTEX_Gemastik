#!/usr/bin/env python3
import os
import subprocess
import json
from pathlib import Path

def main():
    print("=" * 70)
    print("WASTEX Database Deployment")
    print("=" * 70)
    
    project_ref = "ibxnycomuwbloqaninji"
    contexts_file = Path.home() / ".config" / "supabase" / "contexts.json"
    
    if not contexts_file.exists():
        print("❌ Supabase context file not found")
        return False
    
    with open(contexts_file) as f:
        contexts = json.load(f)
    
    for ctx in contexts:
        if ctx.get("project_id") == project_ref:
            url = ctx["supabaseUrl"]
            password = ctx.get("dbPassword", "")
            
            print(f"\n✅ Found project config: {ctx['name']}")
            print(f"   URL: {url}")
            
            # Extract host
            host = url.replace("https://", "").replace(".supabase.co", "")
            conn_string = f"postgresql://postgres:{password}@db.{host}.supabase.co:5432/postgres"
            
            migrations = ["backend/database/000_initial_schema.sql", 
                         "backend/database/002_rls_policies.sql"]
            
            success = True
            for migration in migrations:
                print(f"\n📄 Applying: {migration}")
                result = subprocess.run(
                    ["psql", conn_string, "-f", migration],
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                if result.returncode != 0:
                    print(f"   ❌ Error:\n{result.stderr[:300]}")
                    success = False
            
            if success:
                print("\n" + "="*70)
                print("✅ MIGRATIONS DEPLOYED!")
                print("="*70)
                
                # Verify tables
                result = subprocess.run(
                    ["psql", conn_string, "-t", "-c", 
                     "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"],
                    capture_output=True, text=True
                )
                
                if result.returncode == 0:
                    tables = [t.strip() for t in result.stdout.strip().split('\n') if t.strip()]
                    print(f"\nCreated {len(tables)} tables:")
                    for table in sorted(tables):
                        print(f"  ✓ {table}")
                
                return True
                
    print("❌ Project not found in context")
    return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
