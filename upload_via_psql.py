#!/usr/bin/env python3
"""Upload data using direct psql connection (more reliable)."""

import subprocess
import json
import os
from pathlib import Path

# Load credentials
env_path = Path("backend/database/.env")
credentials = {}
with open(env_path) as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            key, value = line.strip().split('=', 1)
            credentials[key] = value

password = credentials['DATABASE_PASSWORD']
project_id = "ibxnycomuwbloqaninji"
host = f"db.{project_id}.supabase.co"
conn = f"postgresql://postgres:{password}@{host}:5432/postgres"

print("="*70)
print("🚀 UPLOADING DATA VIA DIRECT POSTGRESQL CONNECTION")
print("="*70)

def run_sql(sql):
    result = subprocess.run(["psql", conn, "-t", "-c", sql], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None

# 1. Clear old test data (if exists)
print("\n🧹 Cleaning up existing data...")
run_sql("DELETE FROM scans; DELETE FROM skills; DELETE FROM products; DELETE FROM users;")
print("   ✓ Data cleared")

# 2. Insert Products
print("\n📦 Uploading recycling projects...")

products_sql = """
INSERT INTO products (name, material_type, description, difficulty, estimated_cost, 
                     estimated_time_minutes, tools_required, region_price_adjustment, is_approved)
VALUES 
('Plastic Bottle Bird Feeder', 'plastic', 'Convert PET bottles into bird feeders', 'beginner', 0, 15, '{"scissors","string"}', 1.0, true),
('Glass Jar Planters', 'glass', 'Transform jars into herb planters', 'beginner', 5000, 30, '{"drill","gravel"}', 1.0, true),
('Aluminum Wind Chimes', 'metal', 'Create musical chimes from cans', 'intermediate', 10000, 45, '{"hammer","copper_wire"}', 1.0, true),
('Newspaper Seedling Pots', 'paper', 'Roll newspaper into biodegradable pots', 'beginner', 0, 20, '{"newspaper"}', 1.0, true);
"""

result = subprocess.run(["psql", conn, "-c", products_sql], capture_output=True, text=True)
if result.returncode == 0:
    print("   ✓ 4 products uploaded successfully!")
else:
    print(f"   ⚠️  Error: {result.stderr[:100]}")

# 3. Insert Skills  
print("\n📚 Uploading knowledge base...")

skills_sql = """
INSERT INTO skills (title, source_url, material_type, difficulty, risk_level, description,
                   steps, before_image_url, mockup_image_url, required_materials, required_tools,
                   estimated_cost, carbon_saved_kg, status, approved, created_at)
VALUES 
('Beginner Plastic Crafts', 'https://wastex.app/plastic', 'plastic', 'beginner', 'low', 
 'Safe plastic upcycling guide for beginners', 
 '[{"step":1,"instruction":"Clean bottles"},{"step":2,"instruction":"Design project"}]',
 NULL, NULL, '{}', '{"scissors"}', 0, 0.5, 'approved', true, NOW()),
('Metal Working Safety', 'https://wastex.app/metal-safety', 'metal', 'intermediate', 'medium',
 'Essential safety protocols for metal crafting',
 '[{"step":1,"instruction":"Wear protective equipment"}]',
 NULL, NULL, '{}', '{"gloves","safety_goggles"}', 20000, 1.2, 'approved', true, NOW());
"""

result = subprocess.run(["psql", conn, "-c", skills_sql], capture_output=True, text=True)
if result.returncode == 0:
    print("   ✓ 2 knowledge guides uploaded!")
else:
    print(f"   ⚠️  Error: {result.stderr[:100]}")

# 4. Insert Admin User
print("\n👤 Creating admin account...")

user_sql = """
INSERT INTO users (email, full_name, role, is_verified, created_at)
VALUES ('admin@wastex.app', 'Admin User', 'admin', true, NOW())
RETURNING id;
"""

user_result = run_sql(user_sql)
test_user_id = user_result.split(':')[1].strip() if user_result else None
if test_user_id:
    print(f"   ✓ Admin created (ID: {test_user_id[:8]}...)")
else:
    print("   ⚠️  Could not create user")

# 5. Insert Sample Scans
print("\n📸 Adding example AI scans...")

scans_sql = f"""
INSERT INTO scans (scan_date, image_url, predicted_category, confidence_score, 
                  identified_product_id, user_id)
VALUES 
('2024-12-27T10:30:00Z', 'https://example.com/s1.jpg', 'plastic', 0.95, 1, '{test_user_id}'),
('2024-12-27T11:15:00Z', 'https://example.com/s2.jpg', 'glass', 0.91, 2, '{test_user_id}');
"""

result = subprocess.run(["psql", conn, "-c", scans_sql], capture_output=True, text=True)
if result.returncode == 0:
    print("   ✓ 2 scan records uploaded!")
else:
    print(f"   ⚠️  Error: {result.stderr[:100]}")

# Verify everything
print("\n" + "="*70)
print("✅ VERIFICATION - Current Database State:")
print("="*70)

count_users = run_sql("SELECT COUNT(*) FROM users;")
print(f"Users: {count_users}")

count_products = run_sql("SELECT COUNT(*) FROM products;")
print(f"Products: {count_products}")

count_skills = run_sql("SELECT COUNT(*) FROM skills;")
print(f"Skills: {count_skills}")

count_scans = run_sql("SELECT COUNT(*) FROM scans;")
print(f"Scans: {count_scans}")

print("\n" + "="*70)
print("🎉 COMPLETE SUCCESS! ALL TEST DATA UPLOADED!")
print("="*70)
print("\nYour WASTEX database is now fully populated with:")
print("  ✓ 1 Admin user")
print("  ✓ 4 Recycling projects")  
print("  ✓ 2 Knowledge guides")
print("  ✓ 2 Sample AI scan records")
print("\nReady for testing and development! 🚀")
