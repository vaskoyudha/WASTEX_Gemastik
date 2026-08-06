import base64 as b64
import re

import httpx

from app.config import get_settings
from app.schemas import ObjectIdentity

_MATERIAL_ID = {
    "plastik_pet": "botol plastik PET bening",
    "plastik_hdpe": "wadah plastik HDPE",
    "kardus": "kardus bergelombang",
    "kaleng": "kaleng aluminium",
    "kaca": "botol atau toples kaca",
    "sachet": "sachet plastik multilayer",
}

_STYLE_STORYBOARD = (
    "Gaya ilustrasi flat sederhana, warna pastel bersih, outline tebal, tampilan diagram "
    "instruksional, latar belakang polos terang. Tanpa teks, tanpa watermark, tanpa wajah "
    "manusia; tangan hanya ditampilkan jika diperlukan untuk menunjukkan aksi. Cahaya "
    "merata dan bayangan sederhana, palet warna hangat dan ramah."
)

_STYLE_PHOTO = (
    "Fotografi produk fotorealistik, cahaya jendela alami yang lembut, latar belakang "
    "netral, kedalaman bidang (depth of field) dangkal, detail tinggi, tanpa teks, "
    "tanpa watermark."
)


def build_identity_block(identity: ObjectIdentity | None) -> str:
    if identity is None:
        return ""
    colors = ", ".join(identity.dominant_colors) or "tidak diketahui"
    features = "; ".join(identity.notable_features) or "tidak ada"
    return (
        "\n[IDENTITAS OBJEK — KONDISI AWAL DARI FOTO SCAN]\n"
        f"- Bentuk awal: {identity.shape}\n"
        f"- Warna awal: {colors}\n"
        f"- Bahan: {identity.material}\n"
        f"- Ciri awal: {features}\n"
        "Aturan: bahan dan gaya ilustrasi selalu konsisten di semua panel. Bentuk boleh "
        "berubah mengikuti aksi (dipotong/ditekuk/disambung). Warna dan label boleh "
        "berubah bila aksi step mengubahnya (dicat/dilepas), dan perubahan itu BERLANJUT "
        "ke panel berikutnya — jangan kembalikan ke kondisi awal."
    )


_TRANSFORM_VERBS = (
    "mengecat",
    "mewarnai",
    "menghias",
    "melukis",
    "memotong",
    "menggunting",
    "menekuk",
    "menyambung",
    "menempel",
    "melapisi",
    "menggambar",
    "menulis",
    "melepas label",
    "menghilangkan label",
    "memberi pola",
    "melubangi",
    "menghaluskan",
    # varian imperatif (akar kata) yang umum di instruksi step
    "potong",
    "lubangi",
    "cat",
    "buka",
    "lepas",
    "ampelas",
    "lipat",
    "tempel",
    "hias",
    "semprot",
)

_TRANSFORM_PATTERN = re.compile(r"\b(" + "|".join(_TRANSFORM_VERBS) + r")\b", re.IGNORECASE)


def _step_is_transformative(step: dict) -> bool:
    hay = (step.get("instruction") or "") + " " + (step.get("visual_description") or "")
    return _TRANSFORM_PATTERN.search(hay) is not None


def _transform_summary(step: dict) -> str:
    """Ringkasan singkat perubahan tampilan dari sebuah step transformatif."""
    instruction = (step.get("instruction") or "").strip()
    match = _TRANSFORM_PATTERN.search(instruction)
    if match is None:
        return instruction
    tail = instruction[match.end() :].strip(" .,;:()")
    if len(tail) >= 8:
        return f"{match.group(0)} {tail}".strip()
    return instruction


def _cumulative_state_section(skill: dict, step: dict) -> str | None:
    order = step.get("order")
    prev = sorted(
        (
            s
            for s in (skill.get("steps") or [])
            if s.get("order") is not None and s.get("order") < order
        ),
        key=lambda s: s["order"],
    )
    changes = [_transform_summary(s) for s in prev if _step_is_transformative(s)]
    if not changes:
        return None
    lines = ["[KONDISI TAMPAK SAAT INI — HASIL STEP SEBELUMNYA]"]
    lines += [f"- {c}" for c in changes]
    lines.append("Pertahankan kondisi ini; gambarkan objek dalam keadaan ini.")
    return "\n".join(lines)


def _step_visual_direction(step: dict) -> str:
    vd = step.get("visual_description")
    if vd:
        return vd
    return (
        f"Aksi: {step.get('instruction', '')} "
        "Fokus pada objek utama dan hasil aksinya; tampilkan alat dan posisi tangan yang "
        "sedang bekerja, hasil antara yang terlihat, serta elemen pendukung di sekitar "
        "(meja kerja, bahan tambahan) secukupnya."
    )


def build_storyboard_prompt(
    skill: dict,
    step: dict,
    identity: ObjectIdentity | None = None,
    step_count: int | None = None,
) -> str:
    material = _MATERIAL_ID.get(skill.get("material", ""), "bahan daur ulang rumah tangga")
    panel = (
        f"step {step.get('order')} dari {step_count}" if step_count else f"step {step.get('order')}"
    )
    sections = [
        (
            "[PANEL]\n"
            f"Panel instruksional tutorial kerajinan daur ulang, {panel}.\n"
            f"Proyek: {skill.get('title')}, dibuat dari {material}."
        ),
    ]
    if identity is not None:
        sections.append(build_identity_block(identity).lstrip("\n"))
    cumulative = _cumulative_state_section(skill, step)
    if cumulative is not None:
        sections.append(cumulative)
    sections.append(_tools_materials_section(skill, step))
    if _step_is_transformative(step):
        sections.append(
            "[PENTING — AKSI INI MENGUBAH TAMPILAN]\n"
            "Tampilkan hasil perubahannya (warna baru, label hilang, bentuk baru); "
            "jangan pertahankan tampilan lama."
        )
    sections.append(
        "[AKSI STEP — GAMBARKAN SECARA DETAIL]\n"
        f"Instruksi: {step.get('instruction')}.\n"
        f"Detail visual yang wajib tampak: {_step_visual_direction(step)}"
    )
    warning = step.get("warning")
    if warning:
        sections.append(f"[PERINGATAN KESELAMATAN — TAMPILKAN SECARA SUBTIL]\n{warning}")
    sections.append(f"[GAYA VISUAL]\n{_STYLE_STORYBOARD}")
    return "\n\n".join(sections)


def _relevant_items(step: dict, items: list[str]) -> list[str]:
    hay = (
        (step.get("instruction") or "")
        + " "
        + (step.get("visual_description") or "")
        + " "
        + (step.get("warning") or "")
    ).lower()
    hits = [item for item in items if item.lower() in hay]
    return hits if hits else items


def _tools_materials_section(skill: dict, step: dict) -> str:
    tools = [t.get("name") for t in (skill.get("tools") or []) if t.get("name")]
    materials = [m.get("name") for m in (skill.get("additional_materials") or []) if m.get("name")]
    if not tools and not materials:
        return "[ALAT & BAHAN YANG DIGUNAKAN]\n(Tidak ada daftar alat/bahan tambahan.)"
    lines = ["[ALAT & BAHAN YANG DIGUNAKAN]"]
    if tools:
        lines.append("- Alat: " + ", ".join(_relevant_items(step, tools)) + ".")
    if materials:
        lines.append("- Bahan pelengkap: " + ", ".join(_relevant_items(step, materials)) + ".")
    lines.append(
        "Gambar benda dari daftar ini sesuai aksi step; bentuk dan posisinya "
        "konsisten dengan panel lain."
    )
    return "\n".join(lines)


def build_materials_panel_prompt(skill: dict, identity: ObjectIdentity | None = None) -> str:
    material = _MATERIAL_ID.get(skill.get("material", ""), "bahan daur ulang rumah tangga")
    tools = [t.get("name") for t in (skill.get("tools") or []) if t.get("name")]
    materials = [m.get("name") for m in (skill.get("additional_materials") or []) if m.get("name")]
    sections = [
        (
            "[PANEL ALAT & BAHAN]\n"
            f"Panel pembuka tutorial (SEBELUM step 1) yang menampilkan SEMUA alat dan "
            f"bahan yang dipakai proyek '{skill.get('title')}' dari {material}."
        ),
    ]
    if identity is not None:
        sections.append(build_identity_block(identity).lstrip("\n"))
    items = ["Susunan visual (flat-lay) di atas meja kerja:"]
    if tools:
        items.append("- Alat-alat: " + ", ".join(tools) + ".")
    if materials:
        items.append("- Bahan pelengkap: " + ", ".join(materials) + ".")
    items.append(
        "- Semua benda tersusun rapi dan terlihat jelas, jarak antar benda cukup, "
        "proporsi wajar, pencahayaan merata."
    )
    sections.append("[ISI PANEL]\n" + "\n".join(items))
    sections.append(f"[GAYA VISUAL]\n{_STYLE_STORYBOARD}")
    return "\n\n".join(sections)


def build_before_after_prompt(skill: dict) -> str:
    material = _MATERIAL_ID.get(skill.get("material", ""), "bahan daur ulang rumah tangga")
    return (
        "[GAMBAR PERBANDINGAN SEBELUM & SESUDAH]\n"
        "Panel sisi-ke-sisi (side-by-side) yang dibagi garis vertikal tipis.\n"
        f"- KIRI (SEBELUM): {material} bekas kotor sebagai sampah rumah tangga.\n"
        f"- KANAN (SESUDAH): produk daur ulang jadi '{skill.get('title')}', bersih dan menarik.\n"
        "- Pencahayaan sama di kedua sisi.\n"
        f"[GAYA FOTO]\n{_STYLE_PHOTO}"
    )


def build_mockup_prompt(skill: dict) -> str:
    material = _MATERIAL_ID.get(skill.get("material", ""), "bahan daur ulang rumah tangga")
    return (
        "[FOTO PRODUK MOCKUP]\n"
        f"Mockup fotografi produk dari '{skill.get('title')}', produk kerajinan daur ulang "
        f"buatan tangan dari {material}, ditata di atas meja kayu dengan tanaman kecil, "
        "siap untuk katalog online. Fotorealistik.\n"
        f"[GAYA FOTO]\n{_STYLE_PHOTO}"
    )


class ImageGenUnavailable(Exception):
    pass


_REFERENCE_FIELD_NAMES = {
    "codex": "image",  # codex accepts images[]; single primary ref via "image" for now
}

_MASTER_PROMPT = (
    "[PERAN]\n"
    "Kamu adalah perajin ulung yang mengubah sampah anorganik menjadi produk "
    "bernilai jual tinggi dan kreatif, sekaligus ilustrator instruksional yang "
    "objektif dan teliti. Tugasmu: membuat SATU panel ilustrasi instruksional "
    "tutorial kerajinan daur ulang (upcycling) yang JELAS, KONSISTEN, dan "
    "MENARIK untuk katalog produk.\n\n"
    "[STANDAR KUALITAS PERAJIN]\n"
    "- Gambar setiap aksi dengan presisi sehingga pemula bisa langsung memahaminya "
    "tanpa teks.\n"
    "- Proporsi, posisi tangan, alat, dan hasil aksi harus masuk akal secara fisik.\n"
    "- Detail kecil yang memperjelas aksi WAJIB tampak: arah gerakan, hasil "
    "potongan, benda yang sedang dipegang.\n"
    "- Estetika produk jadi harus layak jual: rapi, bersih, proporsional, dan menarik.\n\n"
    "[ATURAN UTAMA — WAJIB DIPATUHI]\n"
    "1. Gambar HANYA aksi yang dijelaskan pada step ini; jangan tambahkan aksi lain.\n"
    "2. JANGAN PERNAH render teks, huruf, angka, atau watermark di dalam gambar.\n"
    "3. Satu objek utama di tengah bingkai, sudut pandang depan-kiri 3/4.\n"
    "4. Komposisi, ukuran, dan proporsi objek harus konsisten di semua panel yang "
    "berbagi gambar referensi.\n"
    "5. Hindari wajah manusia; tangan hanya ditampilkan jika diperlukan."
)

_REFERENCE_POLICY = (
    "\n\n[REFERENSI — PRIORITAS: IKUTI STEP, BUKAN PANEL SEBELUMNYA]\n"
    "1. Instruksi step adalah SUMBER UTAMA: gambar persis aksi dan perubahan yang "
    "dijelaskan step (bentuk dipotong/ditekuk/disambung, warna dicat, label dilepas, "
    "hiasan ditempel). Jika bertentangan dengan panel sebelumnya, IKUTI STEP — "
    "jangan pertahankan tampilan lama.\n"
    "2. Panel sebelumnya hanya PANDUAN untuk hal yang TIDAK diubah step: salin PERSIS "
    "bahan, gaya ilustrasi, proporsi, dan sudut pandang; HANYA aksi yang berubah.\n"
    "3. Foto scan: hanya sumber bentuk/warna/bahan asli objek. Selalu render dalam gaya "
    "ilustrasi flat, JANGAN pernah fotorealistik, JANGAN mencampur tekstur foto ke dalam panel."
)


def build_master_prompt(step_prompt: str, has_references: bool) -> str:
    policy = _REFERENCE_POLICY if has_references else ""
    return f"{_MASTER_PROMPT}{policy}\n\n{step_prompt}"


async def generate_image(prompt: str, reference_images: list[bytes] | None = None) -> bytes:
    s = get_settings()

    payload: dict = {
        "model": s.image_model,
        "prompt": prompt,
        "size": "1024x1024",
    }
    primary = reference_images[0] if reference_images else None
    if primary is not None:
        field = _REFERENCE_FIELD_NAMES.get(s.image_model.split("/")[0], "image")
        payload[field] = b64.b64encode(primary).decode()
        if field == "image" and s.image_model.split("/")[0] == "codex":
            payload["image_detail"] = "high"

    async with httpx.AsyncClient(timeout=120) as client:
        try:
            r = await client.post(
                f"{s.openrouter_base_url}/images/generations?response_format=binary",
                headers={"Authorization": f"Bearer {s.openrouter_api_key}"},
                json=payload,
            )
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise ImageGenUnavailable("image provider error") from e
        return r.content
