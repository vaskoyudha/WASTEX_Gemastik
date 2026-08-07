from app.agent.tools.image_gen import (
    build_before_after_prompt,
    build_identity_block,
    build_materials_panel_prompt,
    build_mockup_master_prompt,
    build_mockup_prompt,
    build_storyboard_prompt,
)

SKILL = {
    "id": "s1",
    "title": "Vas Botol PET",
    "material": "plastik_pet",
    "tools": [
        {
            "name": "Gunting",
            "optional": False,
            "description": "Memotong botol sesuai pola",
        },
        {"name": "Lem tembak", "optional": True},
    ],
    "additional_materials": [
        {
            "name": "Cat akrilik",
            "category": "cat",
            "est_cost_idr": 5000,
            "purpose": "Menghias permukaan",
        }
    ],
    "est_price_idr": 25000,
    "steps": [{"order": 1, "instruction": "Potong botol jadi dua", "warning": "Hati-hati gunting"}],
}


def test_storyboard_prompt_mentions_step_and_style():
    p = build_storyboard_prompt(SKILL, SKILL["steps"][0])
    assert "Potong botol jadi dua" in p
    assert "ilustrasi flat" in p
    assert "step 1" in p.lower()
    assert "tanpa teks" in p.lower()
    assert "[AKSI STEP" in p
    assert "[GAYA VISUAL]" in p


def test_storyboard_prompt_uses_visual_description_when_present():
    step = {
        "order": 1,
        "instruction": "Potong botol",
        "warning": None,
        "visual_description": "Tangan memegang gunting, memotong botol PET menjadi dua bagian di atas meja kayu, serpihan plastik di sekitar.",
    }
    p = build_storyboard_prompt(SKILL, step)
    assert "Tangan memegang gunting" in p
    assert "serpihan plastik" in p


def test_storyboard_prompt_falls_back_to_instruction_detail():
    p = build_storyboard_prompt(SKILL, SKILL["steps"][0])
    assert "Fokus pada objek utama dan hasil aksinya" in p


def test_before_after_prompt_has_split_layout():
    p = build_before_after_prompt(SKILL)
    assert "Vas Botol PET" in p
    assert "sisi-ke-sisi" in p.lower()
    assert "sebelum" in p.lower() and "sesudah" in p.lower()


def test_mockup_prompt_is_ready_to_publish_sales_asset():
    p = build_mockup_prompt(SKILL)
    assert "Vas Botol PET" in p
    assert "fotografi produk" in p.lower()
    assert "fotorealistik" in p.lower()
    assert "Rp25.000" in p
    assert "HANDMADE • UPCYCLE" in p
    assert "PESAN SEKARANG" in p
    assert "[VERSI PROMPT: sales-v2]" in p
    assert "siap unggah" in p.lower()
    assert "diskon" in p.lower()
    assert "rating" in p.lower()


def test_mockup_prompt_does_not_invent_missing_price():
    p = build_mockup_prompt({**SKILL, "est_price_idr": None})
    assert "HARGA SESUAI PESANAN" in p
    assert "Rp0" not in p


def test_mockup_master_allows_only_the_requested_sales_text():
    p = build_mockup_master_prompt(build_mockup_prompt(SKILL), has_references=True)
    assert "desainer iklan" in p.lower()
    assert "TEKS PROMOSI" in p
    assert "produk jadi" in p.lower()
    assert "foto scan" in p.lower()
    assert "JANGAN render teks" not in p
    assert "JANGAN pernah fotorealistik" not in p


def test_storyboard_prompt_injects_relevant_tools_and_materials():
    p = build_storyboard_prompt(SKILL, SKILL["steps"][0])
    assert "[ALAT & BAHAN YANG DIGUNAKAN]" in p
    assert "Gunting" in p
    assert "Cat akrilik" in p
    assert "Lem tembak" not in p


def test_storyboard_prompt_lists_all_items_when_none_relevant():
    step = {"order": 2, "instruction": "Rendam botol", "warning": None}
    p = build_storyboard_prompt(SKILL, step)
    assert "Gunting" in p and "Lem tembak" in p
    assert "Cat akrilik" in p


def test_identity_block_is_initial_state_not_immutable_law():
    from app.schemas import ObjectIdentity

    identity = ObjectIdentity(
        shape="tall clear bottle",
        dominant_colors=["red", "white"],
        material="kaleng",
        notable_features=["Coca-Cola logo"],
    )
    p = build_identity_block(identity)
    assert "KONDISI AWAL" in p
    assert "BERLANJUT" in p
    assert "boleh berubah" in p
    assert "WAJIB TETAP IDENTIK" not in p


def test_storyboard_prompt_marks_transformative_step():
    step = {
        "order": 3,
        "instruction": "Mengecat permukaan kaleng dengan warna hijau",
        "warning": None,
    }
    p = build_storyboard_prompt(SKILL, step)
    assert "[PENTING — AKSI INI MENGUBAH TAMPILAN]" in p
    assert "jangan pertahankan tampilan lama" in p


def test_storyboard_prompt_marks_imperative_transform_verbs():
    for instruction in (
        "Potong bagian atas botol (mulut dan kerucut) sekitar 1/3",
        "Lubangi dasar kaleng untuk drainase",
        "Cat seluruh permukaan luar kaleng dengan cat akrilik",
        "Buka bagian atas kaleng dengan pembuka kaleng",
        "Lepas label botol dengan hati-hati",
        "Ampelas tepi potongan hingga halus",
        "Lipat kardus mengikuti garis pola",
    ):
        step = {"order": 2, "instruction": instruction, "warning": None}
        p = build_storyboard_prompt(SKILL, step)
        assert "[PENTING — AKSI INI MENGUBAH TAMPILAN]" in p, instruction
        assert "jangan pertahankan tampilan lama" in p, instruction


def test_storyboard_prompt_imperative_does_not_flag_common_words():
    for instruction in (
        "Gunting ada di dalam kotak peralatan",
        "Hitung jumlah botol yang tersedia",
        "Perhatikan gambar contoh sebelum mulai",
    ):
        step = {"order": 2, "instruction": instruction, "warning": None}
        p = build_storyboard_prompt(SKILL, step)
        assert "[PENTING — AKSI INI MENGUBAH TAMPILAN]" not in p, instruction


def test_storyboard_prompt_non_transformative_no_clause():
    step = {"order": 1, "instruction": "Bersihkan kaleng dari sisa minuman", "warning": None}
    p = build_storyboard_prompt(SKILL, step)
    assert "[PENTING — AKSI INI MENGUBAH TAMPILAN]" not in p


def test_storyboard_prompt_no_false_positive_for_menutupi():
    step = {
        "order": 3,
        "instruction": "Isi kaleng dengan tanah hingga menutupi akar dengan mantap",
        "warning": None,
    }
    skill = {
        **SKILL,
        "steps": [
            {"order": 1, "instruction": "Cuci botol hingga bersih", "warning": None},
            {"order": 2, "instruction": "Keringkan dengan lap", "warning": None},
        ],
    }
    p = build_storyboard_prompt(skill, step)
    assert "[PENTING — AKSI INI MENGUBAH TAMPILAN]" not in p
    assert "[KONDISI TAMPAK SAAT INI" not in p
    assert "Instruksi: Isi kaleng dengan tanah hingga menutupi akar" in p


def test_storyboard_prompt_no_false_positive_for_menggambarkan():
    step = {
        "order": 2,
        "instruction": "Perhatikan bentuk potongan yang menggambarkan hasil akhir",
        "warning": None,
    }
    p = build_storyboard_prompt(SKILL, step)
    assert "[PENTING — AKSI INI MENGUBAH TAMPILAN]" not in p


def test_storyboard_prompt_includes_cumulative_state():
    skill = {
        "id": "s1",
        "title": "Vas Botol PET",
        "material": "plastik_pet",
        "steps": [
            {"order": 1, "instruction": "Melepas label dan tutup botol", "warning": None},
            {
                "order": 2,
                "instruction": "Mengecat permukaan botol dengan warna hijau",
                "warning": None,
            },
            {"order": 3, "instruction": "Tanam sukulen di dalam botol", "warning": None},
        ],
    }
    p = build_storyboard_prompt(skill, skill["steps"][2])
    assert "[KONDISI TAMPAK SAAT INI — HASIL STEP SEBELUMNYA]" in p
    assert "melepas label" in p.lower()
    assert "mengecat permukaan botol" in p.lower()
    assert "Pertahankan kondisi ini" in p


def test_storyboard_prompt_no_cumulative_state_before_any_transformation():
    skill = {
        "id": "s1",
        "title": "Vas Botol PET",
        "material": "plastik_pet",
        "steps": [
            {"order": 1, "instruction": "Bersihkan botol", "warning": None},
            {"order": 2, "instruction": "Potong botol jadi dua", "warning": None},
        ],
    }
    p = build_storyboard_prompt(skill, skill["steps"][0])
    assert "[KONDISI TAMPAK SAAT INI" not in p


def test_reference_policy_prioritizes_step_over_previous_panel():
    from app.agent.tools.image_gen import build_master_prompt

    p = build_master_prompt("step text", has_references=True)
    assert "PRIORITAS: IKUTI STEP" in p
    assert "IKUTI STEP" in p
    assert "jangan pertahankan tampilan lama" in p
    assert "salin PERSIS" in p


def test_materials_panel_prompt_lists_everything():
    p = build_materials_panel_prompt(SKILL)
    assert "[PANEL ALAT & BAHAN]" in p
    assert "Vas Botol PET" in p
    assert "Gunting" in p
    assert "Lem tembak" in p
    assert "Cat akrilik" in p
    assert "flat-lay" in p
    assert "ilustrasi flat" in p
    assert "Memotong botol sesuai pola" in p
    assert "Menghias permukaan" in p
    assert "jangan render nama, deskripsi, label, caption, atau teks" in p


def test_materials_panel_prompt_includes_identity():
    from app.schemas import ObjectIdentity

    identity = ObjectIdentity(
        shape="tall clear bottle",
        dominant_colors=["transparent"],
        material="plastik_pet",
        notable_features=["white cap"],
    )
    p = build_materials_panel_prompt(SKILL, identity=identity)
    assert "IDENTITAS OBJEK" in p
    assert "tall clear bottle" in p


def test_materials_panel_without_tools_still_has_panel():
    p = build_materials_panel_prompt({"title": "X", "material": "plastik_pet"})
    assert "[PANEL ALAT & BAHAN]" in p
