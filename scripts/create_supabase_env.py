#!/usr/bin/env python3
"""Interactive script to create Supabase environment configuration."""

import os

def main():
    print("=" * 70)
    print("WASTEX Supabase Configuration Creator")
    print("=" * 70)
    
    print("\n📋 Required Values:")
    print("   To deploy migrations, we need these from your Supabase dashboard:")
    print()
    print("   1️⃣ SUPABASE_URL")
    print("      Location: https://supabase.com/dashboard → Settings → API")
    print("      Format: https://xxxxx.supabase.co")
    print()
    print("   2️⃣ SUPABASE_SERVICE_ROLE_KEY")
    print("      Location: Same page under 'Project API keys'")
    print("      Format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (long token)")
    print()
    print("   3️⃣ SUPABASE_ANON_KEY")
    print("      Location: Same page")
    print("      Format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    print()
    print("   4️⃣ DATABASE_PASSWORD")
    print("      Location: Settings → Database → Passwords")
    print("      This is the password for postgres user access")
    print()
    print("   5️⃣ OPENAI_API_KEY (optional)")
    print("      For generating embeddings: https://platform.openai.com/api-keys")
    print()
    
    response = input("\nDo you have all values ready? [y/N]: ").strip().lower()
    
    if response not in ['y', 'yes']:
        print("\n💡 Tip: You can view these values in Supabase dashboard anytime")
        return False
    
    # Get actual values
    env_vars = {}
    
    try:
        import secrets
        
        url = input("\nEnter SUPABASE_URL (e.g., https://sb_f11d37a1624da65c81d94aa91342613ccf608a3b.supabase.co): ").strip()
        service_role = input("Enter SUPABASE_SERVICE_ROLE_KEY: ").strip()
        anon_key = input("Enter SUPABASE_ANON_KEY: ").strip()
        db_password = input("Enter DATABASE_PASSWORD: ").strip()
        
        while len(db_password) < 8:
            print(f"⚠️  Password too short ({len(db_password)} chars). Minimum 8 characters required.")
            db_password = input("Re-enter DATABASE_PASSWORD: ").strip()
            
        openai_key = input("Enter OPENAI_API_KEY (or press Enter to skip): ").strip()
        
        # Create .env file
        env_path = Path("backend/database/.env")
        
        env_content = f'''# WASTEX Supabase Configuration
# Generated: {secrets.token_hex(8)[:16]}

SUPABASE_URL={url}
SUPABASE_SERVICE_ROLE_KEY={service_role}
SUPABASE_ANON_KEY={anon_key}
DATABASE_PASSWORD={db_password}
OPENAI_API_KEY={openai_key if openai_key else "# Add when available"}

=== SECURITY NOTES ===
- Never commit this .env file to git!
- Keep backup of passwords in secure location
- Service Role Key gives full database access - protect it!
'''
        
        env_path.write_text(env_content)
        env_path.chmod(0o600)  # Read/write for owner only
        
        print("\n✅ Environment file created: backend/database/.env")
        print(f"   Size: {env_path.stat().st_size} bytes")
        print(f"   Permissions: {oct(env_path.stat().st_mode)[-3:]}")
        
        return True
        
    except KeyboardInterrupt:
        print("\n\n❌ Configuration cancelled by user")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

if __name__ == "__main__":
    from pathlib import Path
    success = main()
    exit(0 if success else 1)
