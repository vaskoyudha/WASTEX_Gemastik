#!/usr/bin/env python3
"""Test Supabase connection and verify database is accessible."""

from supabase import create_client, Client
import os
from pathlib import Path

# Load environment variables
env_path = Path("backend/database/.env")
if not env_path.exists():
    print("❌ .env file not found!")
    exit(1)

# Parse .env file
credentials = {}
with open(env_path) as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            key, value = line.strip().split('=', 1)
            credentials[key] = value

url = credentials.get('SUPABASE_URL')
key = credentials.get('SUPABASE_ANON_KEY')

print("="*70)
print("🔍 TESTING SUPABASE CONNECTION")
print("="*70)

try:
    # Create client
    supabase: Client = create_client(url, key)
    print("\n✅ Successfully connected to Supabase!")
    print(f"   URL: {url}")
    
    # Test reading tables
    print("\n📊 Testing table access...")
    
    # Try users table
    result = supabase.table('users').select("*").limit(5).execute()
    print(f"   ✓ Users table: {len(result.data)} rows")
    
    # Try products table
    result = supabase.table('products').select("*").limit(5).execute()
    print(f"   ✓ Products table: {len(result.data)} rows")
    
    # Try scans table
    result = supabase.table('scans').select("*").limit(5).execute()
    print(f"   ✓ Scans table: {len(result.data)} rows")
    
    # Try skills table
    result = supabase.table('skills').select("*").limit(5).execute()
    print(f"   ✓ Skills table: {len(result.data)} rows")
    
    print("\n" + "="*70)
    print("🎉 ALL CONNECTIONS WORKING PERFECTLY!")
    print("="*70)
    
except Exception as e:
    print(f"\n❌ Connection failed: {e}")
    print("\nTroubleshooting:")
    print("  1. Check API keys are correct")
    print("  2. Verify RLS policies aren't blocking access")
    print("  3. Ensure tables exist (they should have been created)")
    exit(1)
