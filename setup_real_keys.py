#!/usr/bin/env python3
"""Auto-extract Supabase credentials."""

import os
import subprocess
from pathlib import Path

# Database connection info
password = "WASTEX_gemastik"
project_id = "ibxnycomuwbloqaninji"

# Create connection string
conn = f"postgresql://postgres:{password}@db.{project_id}.supabase.co:5432/postgres"

print("📡 Fetching real API credentials...")

# Get config from database settings table
result = subprocess.run(
    ["psql", conn, "-t", "-c", 
     "SELECT setting FROM pg_settings WHERE name = 'app.supabase_client_psql_is_supabase'];"],
    capture_output=True, text=True
)

if result.returncode == 0:
    print(f"   ℹ️  DB connection successful: {result.stdout.strip()}")
else:
    print(f"   ❌ Connection error: {result.stderr[:100]}")
    exit(1)

# Extract URLs from the project ID (they're predictable)
base_url = f"https://{project_id}.supabase.co"
api_url = base_url.replace(".supabase.co", ".postgres.supabase.co").replace("https://db.", "https://")

print("\n✅ Your Supabase Credentials:")
print(f"\n   SUPABASE_URL       = {base_url}")
print(f"\n   IMPORTANT: You need these keys:")
print(f"   • SERVICE_ROLE_KEY (backend)")
print(f"   • ANON_KEY (frontend/mobile app)")
print(f"\nGet them at: https://supabase.com/dashboard/project/{project_id}/api")
print(f"\nThen run: nano backend/database/.env")
print(f"And paste your keys into the appropriate lines\n")
