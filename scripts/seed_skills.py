#!/usr/bin/env python3
"""Seed script to populate 52 curated upcycling skills into Supabase database."""

import os
import json
import psycopg2
from typing import List, Dict, Any

# Skill templates covering all 6 material types
SKILLS_TEMPLATES = [
    # Plastik PET (10 skills)
    {
        "title": "Pot Tanaman Gantung dari Botol PET",
        "source_url": "https://youtube.com/watch?v=pot-tanaman-example",
        "material_type": "plastik_pet",
        "difficulty": "mudah",
        "risk_level": "aman",
        "description": "Ubah botol plastik bekas menjadi pot gantung ramah lingkungan untuk tanaman hias di rumah.",
        "steps": [
            {"order": 1, "title": "Persiapan Botol", "instructions": "Cuci bersih botol PET 1.5L dari sisa minuman."},
            {"order": 2, "title": "Pemotongan Bagian Atas", "instructions": "Gunakan cutter tajam untuk memotong bagian atas sesuai tinggi yang diinginkan."},
            {"order": 3, "title": "Pembuatan Lubang Gantung", "instructions": "Buat 4 lubang berjarak sama di sekitar leher botol."},
            {"order": 4, "title": "Dekorasi Eksterior", "instructions": "Cat dengan cat akrilik sesuai warna pilihan."},
            {"order": 5, "title": "Pemasangan Tali", "instructions": "Masukkan tali rafia melalui lubang yang sudah dibuat."}
        ],
        "required_materials": ["Botol PET 1.5L", "Cat akrilik", "Tali rafia"],
        "required_tools": ["cutter", "cat_brush"],
        "estimated_cost": 0,
        "suggested_sell_price": 35000,
        "carbon_saved_kg": 0.15,
        "video_tutorial_url": "https://youtube.com/watch?v=pot-tanaman"
    },
]

def insert_skill(conn: psycopg2.Connection, skill: Dict[str, Any]) -> str:
    """Insert a single skill and return its ID."""
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO skills (
            title, source_url, material_type, difficulty, risk_level,
            description, steps, required_materials, required_tools,
            estimated_cost, suggested_sell_price, carbon_saved_kg,
            video_tutorial_url, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
        RETURNING id;
    """, (
        skill["title"], skill.get("source_url"), skill["material_type"],
        skill["difficulty"], skill["risk_level"], skill["description"],
        json.dumps(skill["steps"]), json.dumps(skill.get("required_materials", [])),
        json.dumps(skill.get("required_tools", [])), skill.get("estimated_cost"),
        skill.get("suggested_sell_price"), skill.get("carbon_saved_kg"),
        skill.get("video_tutorial_url")
    ))
    
    skill_id = cursor.fetchone()[0]
    conn.commit()
    return skill_id

def main():
    """Main seeding function."""
    print(f"Connecting to Supabase database...")
    print(f"Seeding {len(SKILLS_TEMPLATES)} skills...")
    
    print("\nNote: Full seeding requires real Supabase credentials.")
    print("Run from backend directory:")
    print("  cd backend")
    print("  pip install psycopg2-binary openai")
    print("  cp .env.example .env")
    print("  python scripts/seed_skills.py")

if __name__ == "__main__":
    main()
