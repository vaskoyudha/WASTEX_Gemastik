#!/usr/bin/env python3
"""Upload test data to WASTEX database."""

from supabase import create_client
from pathlib import Path
import os
import json

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

print("="*70)
print("🚀 UPLOADING TEST DATA TO WASTEX DATABASE")
print("="*70)

# 1. Upload Sample Products (Recycling Projects)
print("\n🔧 Uploading recycling project catalog...")

products = [
    {
        "name": "Plastic Bottle Bird Feeder",
        "material_type": "plastic",
        "description": "Convert empty PET bottles into hanging bird feeders using simple cuts and wooden perches",
        "difficulty": "beginner",
        "estimated_cost": 0,
        "estimated_time_minutes": 15,
        "tools_required": ["scissors", "string"],
        "region_price_adjustment": 1.0
    },
    {
        "name": "Glass Jar Planters",
        "material_type": "glass",
        "description": "Transform glass jars into beautiful herb planters with drainage holes and decorative elements",
        "difficulty": "beginner",
        "estimated_cost": 5000,
        "estimated_time_minutes": 30,
        "tools_required": ["drill", "gravel", "soil"],
        "region_price_adjustment": 1.0
    },
    {
        "name": "Aluminum Can Wind Chimes",
        "material_type": "metal",
        "description": "Create musical wind chimes from cleaned aluminum cans and copper wire",
        "difficulty": "intermediate",
        "estimated_cost": 10000,
        "estimated_time_minutes": 45,
        "tools_required": ["hammer", "copper_wire", "wooden_hook"],
        "region_price_adjustment": 1.0
    },
    {
        "name": "Newspaper Seedling Pots",
        "material_type": "paper",
        "description": "Roll newspaper into biodegradable pots for starting seeds indoors",
        "difficulty": "beginner",
        "estimated_cost": 0,
        "estimated_time_minutes": 20,
        "tools_required": ["newspaper", "jar", "soil"],
        "region_price_adjustment": 1.0
    },
    {
        "name": "Cardboard Storage Organizer",
        "material_type": "paper",
        "description": "Build desk organizers from old cardboard boxes and fabric scraps",
        "difficulty": "intermediate",
        "estimated_cost": 15000,
        "estimated_time_minutes": 60,
        "tools_required": ["hot_glue", "fabric", "ruler"],
        "region_price_adjustment": 1.0
    }
]

for product in products:
    result = supabase.table('products').insert(product).execute()
    print(f"   ✓ Added: {product['name']}")

print(f"\n✅ Total products uploaded: {len(products)}")

# 2. Upload Skill Knowledge Base  
print("\n📚 Upgrading expert knowledge base...")

skills = [
    {
        "title": "Beginner Plastic Crafts",
        "source_url": "https://example.com/plastic-crafts",
        "material_type": "plastic",
        "difficulty": "beginner",
        "risk_level": "low",
        "description": "Simple plastic upcycling projects safe for beginners",
        "steps": json.dumps([
            {"step": 1, "instruction": "Clean and dry all bottles thoroughly"},
            {"step": 2, "instruction": "Mark cutting lines with marker"},
            {"step": 3, "instruction": "Use scissors to cut carefully"},
            {"step": 4, "instruction": "Add decorative elements or functional parts"}
        ]),
        "before_image_url": "https://example.com/before.jpg",
        "after_image_url": "https://example.com/after.jpg"
    },
    {
        "title": "Advanced Metal Sculptures",
        "source_url": "https://example.com/metal-art",
        "material_type": "metal",
        "difficulty": "advanced",
        "risk_level": "medium",
        "description": "Complex metalworking techniques for creating artistic sculptures from recycled materials",
        "steps": json.dumps([
            {"step": 1, "instruction": "Wear safety gloves and goggles"},
            {"step": 2, "instruction": "Clean metal pieces with degreaser"},
            {"step": 3, "instruction": "Design your sculpture layout on paper"},
            {"step": 4, "instruction": "Cut and shape metal pieces"},
            {"step": 5, "instruction": "Assemble with strong adhesive or welding"},
            {"step": 6, "instruction": "Apply protective coating"}
        ]),
        "before_image_url": "https://example.com/metal-before.jpg",
        "after_image_url": "https://example.com/metal-after.jpg"
    },
    {
        "title": "Glass Recycling Safety Guide",
        "source_url": "https://example.com/glass-safety",
        "material_type": "glass",
        "difficulty": "intermediate",
        "risk_level": "high",
        "description": "Essential safety protocols and techniques for working with glass materials",
        "steps": json.dumps([
            {"step": 1, "instruction": "Wear thick leather gloves at all times"},
            {"step": 2, "instruction": "Use eye protection when drilling or cutting"},
            {"step": 3, "instruction": "Work in well-ventilated area"},
            {"step": 4, "instruction": "Keep first aid kit nearby for glass cuts"},
            {"step": 5, "instruction": "Dispose of broken glass properly"}
        ]),
        "before_image_url": None,
        "after_image_url": None
    }
]

for skill in skills:
    result = supabase.table('skills').insert(skill).execute()
    print(f"   ✓ Added: {skill['title']} ({skill['risk_level']} risk)")

print(f"\n✅ Total skills uploaded: {len(skills)}")

# 3. Create a Test User
print("\n👤 Creating sample user account...")

user_result = supabase.table('users').insert({
    "email": "test@wastex.app",
    "full_name": "Test User",
    "role": "user",
    "is_verified": True
}).execute()

test_user_id = user_result.data[0]['id']
print(f"   ✓ Created user with ID: {test_user_id[:8]}...")

# 4. Create Sample Scans
print("\n📸 Creating example scan records...")

scans = [
    {
        "scan_date": "2024-12-27T10:30:00Z",
        "image_url": "https://storage.wastex.app/scans/sample1.jpg",
        "predicted_category": "plastic",
        "confidence_score": 0.95,
        "identified_product_id": 1,
        "user_id": test_user_id
    },
    {
        "scan_date": "2024-12-27T11:15:00Z", 
        "image_url": "https://storage.wastex.app/scans/sample2.jpg",
        "predicted_category": "metal",
        "confidence_score": 0.92,
        "identified_product_id": 3,
        "user_id": test_user_id
    }
]

for scan in scans:
    result = supabase.table('scans').insert(scan).execute()
    print(f"   ✓ Added scan record")

print(f"\n✅ Total scans created: {len(scans)}")

print("\n" + "="*70)
print("🎉 ALL TEST DATA UPLOADED SUCCESSFULLY!")
print("="*70)
print(f"\n📊 Database Summary:")
print(f"   • Products: {len(products)} recycling projects")
print(f"   • Skills: {len(skills)} knowledge entries")
print(f"   • Users: 1 test account created")
print(f"   • Scans: {len(scans)} AI classification examples")
print(f"\n✨ Your WASTEX app now has real data to work with!")
