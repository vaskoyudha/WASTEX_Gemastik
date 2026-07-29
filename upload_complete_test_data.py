#!/usr/bin/env python3
"""Complete test data upload for WASTEX."""

from supabase import create_client
from pathlib import Path
import json

# Load service role key
env_path = Path("backend/database/.env")
credentials = {}
with open(env_path) as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            key, value = line.strip().split('=', 1)
            credentials[key] = value

url = credentials['SUPABASE_URL']
service_key = credentials['SUPABASE_SERVICE_ROLE_KEY']
supabase = create_client(url, service_key)

print("="*70)
print("🚀 COMPLETE TEST DATA UPLOAD")
print("="*70)

# Upload Products (4 projects)
print("\n📦 Adding recycling projects...")

products = [
    {"name": "Plastic Bottle Bird Feeder", "material_type": "plastic", "description": "Convert empty PET bottles into bird feeders", "difficulty": "beginner", "estimated_cost": 0, "estimated_time_minutes": 15, "tools_required": ["scissors", "string"], "region_price_adjustment": 1.0, "is_approved": True},
    {"name": "Glass Jar Planters", "material_type": "glass", "description": "Transform glass jars into herb planters", "difficulty": "beginner", "estimated_cost": 5000, "estimated_time_minutes": 30, "tools_required": ["drill", "gravel"], "region_price_adjustment": 1.0, "is_approved": True},
    {"name": "Aluminum Wind Chimes", "material_type": "metal", "description": "Create musical chimes from cans", "difficulty": "intermediate", "estimated_cost": 10000, "estimated_time_minutes": 45, "tools_required": ["hammer", "copper_wire"], "region_price_adjustment": 1.0, "is_approved": True},
    {"name": "Newspaper Seedling Pots", "material_type": "paper", "description": "Roll newspaper into biodegradable pots", "difficulty": "beginner", "estimated_cost": 0, "estimated_time_minutes": 20, "tools_required": ["newspaper"], "region_price_adjustment": 1.0, "is_approved": True}
]

for product in products:
    supabase.table('products').insert(product).execute()
    print(f"   ✓ {product['name']}")

# Upload Skills (3 knowledge guides)
print("\n📚 Upgrading knowledge base...")

skills = [
    {"title": "Beginner Plastic Crafts", "source_url": "https://wastex.app/plastic", "material_type": "plastic", "difficulty": "beginner", "risk_level": "low", "description": "Safe plastic upcycling guide", "steps": [{"step": 1, "instruction": "Clean bottles"}, {"step": 2, "instruction": "Design project"}], "before_image_url": None, "after_image_url": None, "mockup_image_url": None, "required_materials": [], "required_tools": ["scissors"], "estimated_cost": 0, "suggested_sell_price": None, "carbon_saved_kg": 0.5, "video_tutorial_url": None, "status": "approved", "approved": True, "approved_by": None},
    {"title": "Metal Working Safety", "source_url": "https://wastex.app/metal-safety", "material_type": "metal", "difficulty": "intermediate", "risk_level": "medium", "description": "Essential safety protocols", "steps": [{"step": 1, "instruction": "Wear PPE"}, {"step": 2, "instruction": "Prepare workspace"}], "before_image_url": None, "after_image_url": None, "mockup_image_url": None, "required_materials": [], "required_tools": ["gloves"], "estimated_cost": 20000, "suggested_sell_price": None, "carbon_saved_kg": 1.2, "video_tutorial_url": None, "status": "approved", "approved": True, "approved_by": None},
    {"title": "Advanced Sculpture Techniques", "source_url": "https://wastex.app/sculpture", "material_type": "mixed", "difficulty": "advanced", "risk_level": "high", "description": "Professional metal sculpture methods", "steps": [{"step": 1, "instruction": "Plan design"}, {"step": 2, "instruction": "Cut materials"}, {"step": 3, "instruction": "Assemble"}], "before_image_url": None, "after_image_url": None, "mockup_image_url": None, "required_materials": ["metal_scrap"], "required_tools": ["welder", "cutting_tool"], "estimated_cost": 50000, "suggested_sell_price": 200000, "carbon_saved_kg": 3.5, "video_tutorial_url": None, "status": "approved", "approved": True, "approved_by": None}
]

for skill in skills:
    supabase.table('skills').insert(skill).execute()
    print(f"   ✓ {skill['title']}")

# Create Admin User
print("\n👤 Creating admin account...")
user_result = supabase.table('users').insert({"email": "admin@wastex.app", "full_name": "Admin", "role": "admin", "is_verified": True}).execute()
test_user_id = user_result.data[0]['id']
print(f"   ✓ User created")

# Upload Sample AI Scans
print("\n📸 Adding example scans...")

scans = [
    {"scan_date": "2024-12-27T10:30:00Z", "image_url": "https://example.com/s1.jpg", "predicted_category": "plastic", "confidence_score": 0.95, "identified_product_id": 1, "user_id": test_user_id},
    {"scan_date": "2024-12-27T11:15:00Z", "image_url": "https://example.com/s2.jpg", "predicted_category": "glass", "confidence_score": 0.91, "identified_product_id": 2, "user_id": test_user_id},
    {"scan_date": "2024-12-27T12:00:00Z", "image_url": "https://example.com/s3.jpg", "predicted_category": "metal", "confidence_score": 0.88, "identified_product_id": 3, "user_id": test_user_id}
]

for scan in scans:
    supabase.table('scans').insert(scan).execute()
    print(f"   ✓ Scan added")

print("\n" + "="*70)
print("🎉 ALL TEST DATA SUCCESSFULLY UPLOADED!")
print("="*70)
print(f"\n✅ 4 Recycling Projects")
print(f"✅ 3 Knowledge Guides")  
print(f"✅ 1 Admin Account")
print(f"✅ 3 AI Classification Examples")
print(f"\n✨ Your database is now fully populated and ready!")
