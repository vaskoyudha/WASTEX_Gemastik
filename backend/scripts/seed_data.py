import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.deps import get_supabase

SEED_SKILLS = [
    {
        "title": "Pot Bunga dari Botol Plastik",
        "description": "Mengubah botol plastik bekas menjadi pot bunga yang menarik",
        "difficulty": "pemula",
        "material": "plastik_pet",
        "materials": ["plastic bottle", "paint", "string"],
        "tools": ["scissors", "paint brush"],
        "steps": [
            {"order": 1, "instruction": "Potong botol plastik menjadi dua bagian"},
            {"order": 2, "instruction": "Lubangi bagian bawah untuk drainase"},
            {"order": 3, "instruction": "Cat botol sesuai selera"},
            {"order": 4, "instruction": "Tambahkan tali sebagai pegangan"},
            {"order": 5, "instruction": "Isi dengan tanah dan tanam bunga"},
        ],
        "status": "approved",
    },
    {
        "title": "Tas Daur Ulang dari Kardus",
        "description": "Membuat tas belanja ramah lingkungan dari kardus bekas",
        "difficulty": "menengah",
        "material": "kardus",
        "materials": ["cardboard", "fabric", "glue"],
        "tools": ["scissors", "ruler"],
        "steps": [
            {"order": 1, "instruction": "Potong kardus sesuai ukuran yang diinginkan"},
            {"order": 2, "instruction": "Balut dengan kain sebagai lapisan luar"},
            {"order": 3, "instruction": "Rekatkan dengan lem"},
            {"order": 4, "instruction": "Buat pegangan dari tali atau kain"},
            {"order": 5, "instruction": "Keringkan selama 24 jam"},
        ],
        "status": "approved",
    },
    {
        "title": "Lampu Hias dari Botol Kaca",
        "description": "Mengubah botol kaca menjadi lampu hias dekoratif",
        "difficulty": "mahir",
        "material": "kaca",
        "materials": ["glass", "paint", "rope"],
        "tools": ["drill", "light bulb kit"],
        "steps": [
            {"order": 1, "instruction": "Bersihkan botol kaca secara menyeluruh"},
            {"order": 2, "instruction": "Lubangi bagian bawah untuk kabel"},
            {"order": 3, "instruction": "Cat bagian luar botol"},
            {"order": 4, "instruction": "Masukkan lampu LED ke dalam botol"},
            {"order": 5, "instruction": "Gantung dengan tali dekoratif"},
        ],
        "status": "approved",
    },
]


def seed():
    supabase = get_supabase()

    for skill in SEED_SKILLS:
        # Check if already exists
        existing = (
            supabase.table("skills").select("id").eq("title", skill["title"]).execute()
        )

        if existing.data:
            print(f"Skip (exists): {skill['title']}")
            continue

        resp = supabase.table("skills").insert(skill).execute()
        print(f"Created: {skill['title']} (ID: {resp.data[0]['id']})")


if __name__ == "__main__":
    seed()
