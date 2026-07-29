#!/usr/bin/env python3
from supabase import create_client
from pathlib import Path

# Load credentials
env_path = Path("backend/database/.env")
credentials = {}
with open(env_path) as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            key, value = line.strip().split('=', 1)
            credentials[key] = value

url = credentials['SUPABASE_URL']
key = credentials['SUPABASE_ANON_KEY']
supabase = create_client(url, key)

print("🔍 Checking actual table columns...")

tables = ['users', 'products', 'scans', 'skills', 'skill_chunks', 'agent_runs']
for table in tables:
    try:
        result = supabase.table(table).select("*").limit(0).execute()
        columns = list(result.data[0].keys()) if result.data else "No rows yet"
        print(f"\n{table}:")
        print(f"   Columns: {columns}")
    except Exception as e:
        print(f"\n❌ {table}: {str(e)[:100]}")
