#!/usr/bin/env python3
"""Get API Keys Guide"""

print("="*70)
print("🔑 SUPABASE API KEYS - WHERE TO FIND THEM")
print("="*70)

print("""
Supabase has changed their UI recently! Here's how to find your keys:

┌─────────────────────────────────────────────────────┐
│ STEP 1: Go to your project                         │
└─────────────────────────────────────────────────────┘
   https://supabase.com/dashboard/project/ibxnycomuwbloqaninji

┌─────────────────────────────────────────────────────┐
│ STEP 2: Look for "Settings" (gear icon in sidebar)  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ STEP 3: Under Settings, scroll to API section      │
│    OR click "API" directly in left sidebar         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ STEP 4: You'll see this:                           │
│                                                      │
│  PROJECT URL                                          │
│  https://ibxnycomuwbloqaninji.supabase.co           │
│                                                      │
│  ANON KEY                                           │
│  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...                 │
│  [Copy]  ← CLICK THIS BUTTON                        │
│                                                      │
│  SERVICE_ROLE KEY                                   │
│  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...                 │
│  [Edit]  ← Might need to generate if first time     │
│                                                      │
└─────────────────────────────────────────────────────┘

If you don't see "API" or "Settings":
- Click "Settings" (gear icon ⚙️) at top of sidebar
- Scroll down to find "API" section
"""
)

# Check existing .env
import re
from pathlib import Path

env_file = Path("backend/database/.env")
if env_file.exists():
    print("\n📋 Your current .env file:")
    print("-" * 70)
    
    url_match = re.search(r'SUPABASE_URL=(\S+)', env_file.read_text())
    anon_match = re.search(r'SUPABASE_ANON_KEY=(\S+)', env_file.read_text())
    service_match = re.search(r'SUPABASE_SERVICE_ROLE_KEY=(\S+)', env_file.read_text())
    
    print(f"\n✅ SUPABASE_URL        = {url_match.group(1) if url_match else 'MISSING'}")
    print(f"⚠️  ANON_KEY            = {'PLACEHOLDER' if not anon_match or '.KEY_HERE' in anon_match.group(1) else '✓ SET'}")
    print(f"⚠️  SERVICE_ROLE_KEY    = {'PLACEHOLDER' if not service_match or 'YOUR_...' in service_match.group(1) else '✓ SET'}")

print("\n" + "="*70)
print("💡 Once you have the real keys:")
print("="*70)
print("""
Option A: Paste them here and I'll update .env automatically
Option B: Manually edit: nano backend/database/.env
          Replace the placeholder lines with your real keys
""")
