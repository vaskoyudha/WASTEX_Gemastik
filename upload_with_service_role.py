#!/usr/bin/env python3
"""Upload test data using service role key to bypass RLS."""

from supabase import create_client
from pathlib import Path

# Load credentials - USE SERVICE ROLE KEY for bulk operations
env_path = Path("backend/database/.env")
credentials = {}
with open(env_path) as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            key, value = line.strip().split('=', 1)
            credentials[key] = value

url = credentials['SUPABASE_URL']
service_key = credentials['SUPABASE_SERVICE_ROLE_KEY']

print("="*70)
print("🚀 UPLOADING TEST DATA (Service Role Mode)")
print("="*70)

# Create client with service role
supabase = create_client(url, service_key)

# Check connection
result = supabase.table('products').select("*", count="exact").execute()
print(f"✅ Connected successfully!")

# 1. Upload Products
print("\n🔧 Uploading recycling projects...")

products = [
    {
        "name": "Plastic Bottle Bird Feeder",
        "material_type": "plastic", 
        "description": "Convert empty PET bottles into hanging bird feeders",
        "difficulty": "beginner",
        "estimated_cost": 0,
        "estimated_time_minutes": 15,
        "tools_required": ["scissors", "string"],
        "region_price_adjustment": 1.0,
        "is_approved": True
    },
    {
        "name": "Glass Jar Planters",
        "material_type": "glass",
        "description": "Transform glass jars into herb planters with drainage",
        "difficulty": "beginner", 
        "estimated_cost": 5000,
        "estimated_time_minutes": 30,
        "tools_required": ["drill", "gravel", "soil"],
        "region_price_adjustment": 1.0,
        "is_approved": True
    },
    {
        "name": "Aluminum Can Wind Chimes",
        "material_type": "metal",
        "description": "Create musical wind chimes from cleaned aluminum cans",
        "difficulty": "intermediate",
        "estimated_cost": 10000,
        "estimated_time_minutes": 45,
        "tools_required": ["hammer", "copper_wire"],
        "region_price_adjustment": 1.0,
        "is_approved": True
    },
    {
        "name": "Newspaper Seedling Pots",
        "material_type": "paper",
        "description": "Roll newspaper into biodegradable seedling pots",
        "difficulty": "beginner",
        "estimated_cost": 0,
        "estimated_time_minutes": 20,
        "tools_required": ["newspaper", "jar"],
        "region_price_adjustment": 1.0,
        "is_approved": True
    }
]

for product in products:
    result = supabase.table('products').insert(product).execute()
    print(f"   ✓ Added: {product['name']}")

# 2. Upload Skills
print("\n📚 Uploading knowledge base...")

skills = [
    {
        "title": "Beginner Plastic Crafts Guide",
        "source_url": "https://wastex.app/tutorials/plastic-basics",
        "material_type": "plastic",
        "difficulty": "beginner",
        "risk_level": "low",
        "description": "Safe plastic upcycling projects for beginners",
        "steps": [{"step": 1, "instruction": "Clean bottles thoroughly"}, {"step": 2, "instruction": "Plan your design"}],
        "before_image_url": None,
        "after_image_url": None
    },
    {
        "title": "Metal Safety & Working Techniques",
        "source_url": "https://wastex.app/safety/metalworking",
        "material_type": "metal",
        "difficulty": "intermediate",
        "risk_level": "medium",
        "description": "Essential safety for metal crafting",
        "steps": [{"step": 1, "instruction": "Wear protective gear"}],
        "before_image_url": None,
        "after_image_url": None
    }
]

for skill in skills:
    result = supabase.table('skills').insert(skill).execute()
    print(f"   ✓ Added: {skill['title']}")

# 3. Create Test User  
print("\n👤 Creating test user...")

user_result = supabase.table('users').insert({
    "email": "admin@wastex.app",
    "full_name": "Admin User",
    "role": "admin",
    "is_verified": True
}).execute()

test_user_id = user_result.data[0]['id']
print(f"   ✓ User created: {test_user_id[:8]}...")

# 4. Create Sample Scans
print("\n📸 Creating sample AI scans...")

scans = [
    {
        "scan_date": "2024-12-27T10:30:00Z",
        "image_url": "https://example.com/scan1.jpg",
        "predicted_category": "plastic",
        "confidence_score": 0.95,
        "identified_product_id": 1,
        "user_id": test_user_id
    },
    {
        "scan_date": "2024-12-27T11:15:00Z",
        "image_url": "https://example.com/scan2.jpg",
        "predicted_category": "glass",
        "confidence_score": 0.91,
        "identified_product_id": 2,
        "user_id": test_user_id
    }
]

for scan in scans:
    result = supabase.table('scans').insert(scan).execute()
    print(f"   ✓ Added scan")

print("\n" + "="*70)
print("🎉 SUCCESS! ALL TEST DATA UPLOADED!")
print("="*70)
print(f"\nSummary:")
print(f"  • 4 Recycling projects uploaded")
print(f"  • 2 Knowledge guides added")  
print(f"  • 1 Admin account created")
print(f"  • 2 Sample AI scans created")
print(f"\nYour WASTEX database is now fully populated!")
