#!/usr/bin/env python3
"""Quick interactive setup to configure and deploy WASTEX database."""

import os
from pathlib import Path

def main():
    print("\n" + "="*70)
    print("WASTEX Database Setup")
    print("="*70)
    
    print("""
📋 What you need from your browser (supabase.com/dashboard):

1. Go to: https://supabase.com/dashboard/project/ibxnycomuwbloqaninji/api
    
2. COPY these three values (click the copy button next to each):

   ┌─────────────────────────────────────────────┐
   │ URL:                                        │
   │ https://xxxxxx.supabase.co                  │
   └─────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────┐
   │ service_role key:                           │
   │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  ← USE THIS ONE!
   └─────────────────────────────────────────────┘

3. Get your PostgreSQL password from:
   Settings → Database → Passwords section
   
""")
    
    url = input("Enter SUPABASE_URL (paste it here): ").strip()
    service_key = input("Enter service_role API key (paste it here): ").strip()
    anon_key = input("Enter anon key (for mobile app): ").strip()
    db_password = input("Enter DATABASE_PASSWORD: ").strip()
    
    # Create/update .env file
    env_path = Path("backend/database/.env")
    
    content = f'''# WASTEX Supabase Configuration
SUPABASE_URL={url}
SUPABASE_SERVICE_ROLE_KEY={service_key}
SUPABASE_ANON_KEY={anon_key}
DATABASE_PASSWORD={db_password}
OPENAI_API_KEY=# Add later if needed

=== Next Step ===
Run: python scripts/deploy_to_supabase.py
'''
    
    env_path.write_text(content)
    print(f"\n✅ Created backend/database/.env")
    
    print("\nNow deploying migrations...")
    print("\n⚠️  This will:")
    print("  - Connect to your Supabase project")
    print("  - Run schema migrations")
    print("  - Set up Row Level Security")
    print("  - Create all required tables\n")
    
    confirm = input("Continue with deployment? [y/N]: ").strip().lower()
    
    if confirm == 'y':
        return True
    else:
        print("Deployment cancelled")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
