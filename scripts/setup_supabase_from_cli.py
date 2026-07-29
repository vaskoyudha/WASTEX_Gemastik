#!/usr/bin/env python3
"""Extract Supabase config from CLI and deploy migrations."""

import os
import sys
import json
from pathlib import Path
from typing import Dict, Optional

def get_project_config(project_ref: str) -> Dict[str, str]:
    """Try to read Supabase project config from local machine."""
    
    # Try multiple possible locations for Supabase config
    possible_paths = [
        Path.home() / ".config" / "supabase" / "contexts.json",
        Path.home() / ".supabase" / "config.json",
        Path.home() / ".supabase" / "contexts" / f"{project_ref}.json",
    ]
    
    for config_path in possible_paths:
        if config_path.exists():
            print(f"🔍 Found config at: {config_path}")
            try:
                with open(config_path) as f:
                    config = json.load(f)
                
                # Handle different config formats
                if isinstance(config, dict):
                    return extract_credentials(config, project_ref)
                    
                # If it's a list of contexts, find matching one
                elif isinstance(config, list):
                    for context in config:
                        if context.get("project_id") == project_ref:
                            return extract_credentials(context, project_ref)
                            
            except Exception as e:
                print(f"⚠️  Error reading config: {e}")
    
    print("❌ Could not find Supabase CLI configuration")
    return None

def extract_credentials(config: Dict, project_ref: str) -> Dict[str, str]:
    """Extract needed credentials from config."""
    
    url = None
    service_key = None
    anon_key = None
    
    # Try common field names
    fields_to_try = [
        ("db_url", lambda x: x.replace(".postgres.supabase.co", ""), lambda x: x.split(":")[0].split("@")[-1].split(":")[0]),
        ("supabaseUrl", lambda x: x, lambda x: ""),
        ("url", lambda x: x, lambda x: ""),
    ]
    
    for field, url_extractor, password_extractor in fields_to_try:
        if field in config:
            value = config[field]
            if isinstance(value, str) and "https://" in value:
                if "supabase.co" in value:
                    url = value
                    # Extract password from connection string
                    break
    
    # Get API keys
    api_keys = config.get("api", {})
    service_key = api_keys.get("serviceRoleKey") or api_keys.get("service_role_key")
    anon_key = api_keys.get("anonKey") or api_keys.get("public_key")
    
    # Get database password
    db_password = config.get("dbPassword") or config.get("password")
    
    return {
        "SUPABASE_URL": url or "",
        "SUPABASE_SERVICE_ROLE_KEY": service_key or "",
        "SUPABASE_ANON_KEY": anon_key or "",
        "DATABASE_PASSWORD": db_password or ""
    }

def populate_env_file(credentials: Dict[str, str]):
    """Update backend/database/.env with credentials."""
    
    env_path = Path("backend/database/.env")
    
    if not env_path.exists():
        print("❌ backend/database/.env not found")
        return False
    
    content = env_path.read_text()
    
    # Update each credential
    replacements = {
        r"SUPABASE_URL=https://.*?\.supabase\.co": f"SUPABASE_URL={credentials['SUPABASE_URL']}",
        r"SUPABASE_SERVICE_ROLE_KEY=.*": f"SUPABASE_SERVICE_ROLE_KEY={credentials['SUPABASE_SERVICE_ROLE_KEY']}",
        r"SUPABASE_ANON_KEY=.*": f"SUPABASE_ANON_KEY={credentials['SUPABASE_ANON_KEY']}",
    }
    
    import re
    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content, count=1)
    
    # Add DATABASE_PASSWORD if found
    if credentials["DATABASE_PASSWORD"]:
        content = re.sub(
            r"DATABASE_PASSWORD=.*",
            f"DATABASE_PASSWORD={credentials['DATABASE_PASSWORD']}",
            content,
            count=1
        )
    else:
        # Append if not found
        content += "\nDATABASE_PASSWORD=" + credentials.get("DATABASE_PASSWORD", "# NEEDS_MANUAL_UPDATE")
    
    env_path.write_text(content)
    print(f"✅ Updated {env_path}")
    return True

def main():
    print("=" * 70)
    print("WASTEX Supabase Configuration Extractor")
    print("=" * 70)
    
    project_ref = "ibxnycomuwbloqaninji"
    print(f"\n📍 Target project: {project_ref}")
    
    print("\n🔍 Looking for Supabase CLI config...")
    credentials = get_project_config(project_ref)
    
    if not credentials or not credentials.get("SUPABASE_URL"):
        print("\n❌ Cannot automatically extract credentials.")
        print("\n💡 Alternative approach:")
        print("   1. Manually copy values from supabase.com/dashboard")
        print("   2. Run: nano backend/database/.env")
        print("   3. Paste these values into appropriate lines:")
        print(f"      - SUPABASE_URL from project URL")
        print(f"      - SUPABASE_SERVICE_ROLE_KEY (service role token)")
        print(f"      - DATABASE_PASSWORD (PostgreSQL password)")
        return False
    
    print(f"\n✅ Found credentials!")
    print(f"   ✓ SUPABASE_URL: {credentials['SUPABASE_URL']}")
    print(f"   ✓ SERVICE_ROLE_KEY: {credentials['SUPABASE_SERVICE_ROLE_KEY'][:50]}...")
    print(f"   ✓ ANON_KEY: {credentials['SUPABASE_ANON_KEY'][:50]}...")
    
    print("\n📝 Populating .env file...")
    if populate_env_file(credentials):
        print("\n✅ Configuration complete!")
        print("\nNext step:")
        print("  python scripts/deploy_to_supabase.py")
        return True
    else:
        print("\n❌ Failed to update .env file")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
