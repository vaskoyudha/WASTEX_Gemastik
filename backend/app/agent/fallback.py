"""Hardcoded, expert-reviewed generic safe procedures per material (Gate 2 fallback)."""

from app.schemas import Material, Risk, SolutionPackage, Step, ToolItem

_MATERIAL_NOTES: dict[Material, tuple[str, str]] = {
    Material.plastik_pet: (
        "botol PET",
        "Pastikan botol bebas residu minuman manis agar tidak mengundang serangga.",
    ),
    Material.plastik_hdpe: (
        "wadah HDPE",
        "Jangan memanaskan atau melelehkan plastik - uapnya berbahaya.",
    ),
    Material.kardus: ("kardus", "Simpan di tempat kering; kardus lembap kehilangan nilai jual."),
    Material.kaleng: ("kaleng", "Hati-hati tepi tajam bekas bukaan; gunakan sarung tangan."),
    Material.kaca: ("kaca", "Jangan memotong atau memecah kaca tanpa alat dan pelindung khusus."),
    Material.sachet: (
        "sachet multilayer",
        "Jangan dibakar - lapisan aluminium-plastik menghasilkan asap beracun.",
    ),
}


def generic_safe_procedure(material: Material) -> SolutionPackage:
    label, note = _MATERIAL_NOTES[material]
    return SolutionPackage(
        recommendation=(
            f"Belum ada keterampilan terverifikasi untuk permintaan ini. "
            f"Lakukan prosedur aman umum untuk {label}: bersihkan, keringkan, pilah, "
            f"lalu setorkan ke bank sampah terdekat. Ide upcycling baru sedang diverifikasi ahli."
        ),
        steps=[
            Step(order=1, instruction=f"Bersihkan {label} dari sisa isi dengan air."),
            Step(order=2, instruction="Keringkan sepenuhnya sebelum disimpan."),
            Step(order=3, instruction="Pilah berdasarkan jenis material.", warning=note),
            Step(order=4, instruction="Setorkan ke bank sampah atau pengepul terdekat."),
        ],
        tools=[ToolItem(name="sarung tangan", optional=True), ToolItem(name="air dan sabun")],
        risks=[
            Risk(
                hazard="Kontaminasi residu",
                mitigation="Cuci bersih dan keringkan sebelum diproses.",
            )
        ],
        sources=[],
    )
