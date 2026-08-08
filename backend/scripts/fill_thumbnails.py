"""Isi thumbnail skill yang kosong dengan gambar dari internet.

Unduh kandidat URL, verifikasi magic bytes gambar, upload ke bucket "visuals"
dengan nama {skill_id}-before_after.png, lalu insert row ke generated_visuals
agar productThumbnailUri memuatnya.

Jalankan dari backend/: uv run python scripts/fill_thumbnails.py
"""

import asyncio
import os

import httpx
from dotenv import load_dotenv

from supabase import create_client

# skill_id -> daftar URL kandidat (dicoba berurutan)
THUMBNAIL_URLS: dict[str, list[str]] = {
    # --- plastik_pet ---
    "88f3fa43-e918-4238-8dc9-4b09a7805e44": [  # Tanaman Hidropot dari Botol PET
        "https://www.onegreenplanet.org/wp-content/uploads/2022/07/shutterstock_1452607847-scaled-e1658507067389.jpg",
        "https://i.ytimg.com/vi/-flA5mTQ05A/maxresdefault.jpg",
    ],
    "26419394-50a7-4e54-ab7e-059289d18e56": [  # Organizer Meja Multifungsi dari Botol PET
        "https://cdn.diyncrafts.com/wp-content/uploads/2022/05/Pencil-Holder-From-Plastic-Bottle-Featured-540x720.jpg",
        "https://i.ytimg.com/vi/0vVBWE3bDGk/maxresdefault.jpg",
    ],
    "b0fe87c2-acfb-4ef1-b30c-78148329a0ba": [  # Tempat Pensil dari Potongan Botol PET
        "https://i.ytimg.com/vi/0vVBWE3bDGk/maxresdefault.jpg",
        "https://cdn.diyncrafts.com/wp-content/uploads/2022/05/Pencil-Holder-From-Plastic-Bottle-Featured-540x720.jpg",
    ],
    # --- kaleng ---
    "c5b8d0d2-453e-45d9-8ed6-bf8747fb406a": [  # Kerajinan Kaleng Aluminium: Tempat Pensil Multifungsi
        "https://www.crayola.com/images/default-source/craft-direction-images/tin-can-planter_step-06.jpg",
        "https://nebg.org/wp-content/uploads/2020/05/Tin-Can-Planters-7.jpg",
    ],
    "ebe8014a-dcf7-44a6-a61b-e2c69bcf2f3a": [  # Membuat Pot Tanaman Hias dari Kaleng Bekas
        "https://nebg.org/wp-content/uploads/2020/05/Tin-Can-Planters-7.jpg",
        "https://i0.wp.com/mimiblog.org/wp-content/uploads/2024/03/Rainbow-DIY-craft-decopauged-tin-can-planters.jpg",
    ],
    "ca0db9b5-f2fe-4788-b387-52d4f691ccfc": [  # Mengubah Kaleng Bekas menjadi Wadah Serbaguna
        "https://thegraphicsfairy.com/wp-content/uploads/2025/03/Tin-can-planters-226.jpg",
        "https://nebg.org/wp-content/uploads/2020/05/Tin-Can-Planters-7.jpg",
    ],
    "444f4773-1ba3-41a0-920d-ce8ecfae6499": [  # Papan Display Mini dari Kaleng
        "https://i0.wp.com/mimiblog.org/wp-content/uploads/2024/03/Rainbow-DIY-craft-decopauged-tin-can-planters.jpg",
        "https://thegraphicsfairy.com/wp-content/uploads/2025/03/Tin-can-planters-226.jpg",
    ],
    "254617c2-8b26-4ad8-8b3c-addc67d029dc": [  # Pot Bunga Mini dari Kaleng
        "https://nebg.org/wp-content/uploads/2020/05/Tin-Can-Planters-7.jpg",
        "https://i0.wp.com/mimiblog.org/wp-content/uploads/2024/03/Rainbow-DIY-craft-decopauged-tin-can-planters.jpg",
    ],
    "d4a15f5f-4ca4-4db4-99df-ba14c4efdac6": [  # Tempat Pensil Minimalis
        "https://www.crayola.com/images/default-source/craft-direction-images/tin-can-planter_step-06.jpg",
        "https://nebg.org/wp-content/uploads/2020/05/Tin-Can-Planters-7.jpg",
    ],
    "665a2d1e-5621-4c5c-98ea-c5fde34941c6": [  # Vasi Tanaman Mini dari Kaleng Bekas
        "https://nebg.org/wp-content/uploads/2020/05/Tin-Can-Planters-7.jpg",
        "https://thegraphicsfairy.com/wp-content/uploads/2025/03/Tin-can-planters-226.jpg",
    ],
    # --- kardus ---
    "16a4f7f2-9f1f-4112-86ea-02feef5bf94b": [  # Membuat Kotak Penyimpanan dari Kardus Bekas
        "https://www.howjoyful.com/wp-content/uploads/2013/04/DIY-cardboard-organizer-square.jpeg",
        "https://i.ytimg.com/vi/9iwnEqL25kI/hq720.jpg",
    ],
    "490b7d78-f5d1-42bc-9592-65252d7e3238": [  # Membuat Rak Buku Kardus Multilayer Tahan Lama
        "https://i.ytimg.com/vi/T0F24ohJXI0/maxresdefault.jpg",
        "https://www.howjoyful.com/wp-content/uploads/2013/04/DIY-cardboard-organizer-square.jpeg",
    ],
    "7e9d3ca3-0b9d-4322-a24f-80fa568cba11": [  # Membuat Rak Penyimpanan Multifungsi dari Kardus Bekas
        "https://www.howjoyful.com/wp-content/uploads/2013/04/DIY-cardboard-organizer-6.jpg.webp",
        "https://i.ytimg.com/vi/T0F24ohJXI0/maxresdefault.jpg",
    ],
    # --- kaca ---
    "0583f4fb-cdf2-4ab5-b850-210d8ff159d9": [  # Membuat Mozaik dari Pecahan Botol Kaca Bekas
        "https://images.saymedia-content.com/.image/t_share/MTc1MDE1MDAzNjAwOTg3OTQ3/beaded-stained-glass-mosaic-bottle-craft.jpg",
        "https://static.platform.michaels.com/2c-prd/519555976797200.jpg",
    ],
    "d390b2eb-a39b-48db-bd46-4d3a4084fb6b": [  # Membuat Vas Bunga Sederhana dari Botol Kaca Bekas
        "https://static.platform.michaels.com/2c-prd/359943495871504.jpg",
        "https://images.saymedia-content.com/.image/t_share/MTc1MDE1MDAzNjAwOTg3OTQ3/beaded-stained-glass-mosaic-bottle-craft.jpg",
    ],
    "37cca7f0-8200-47ff-bf95-b9f65175659d": [  # Mempersiapkan dan Memilah Botol Kaca untuk Daur Ulang
        "https://static.platform.michaels.com/2c-prd/519556674624528.jpg",
        "https://static.platform.michaels.com/2c-prd/359943495871504.jpg",
    ],
    # --- sachet ---
    "d9eac1d9-4a8b-432f-b6a1-58f25ecad817": [  # Membuat Tas Daur Ulang dari Kemasan Sachet Bekas
        "https://zerowasteearthstore.com/wp-content/uploads/2022/07/sachet-bag.jpeg",
        "https://i.etsystatic.com/38155389/r/il/2fdcc1/5571071079/il_fullxfull.5571071079_8rrm.jpg",
    ],
    "d7434f7b-0697-4d4f-898c-49cf55fcc376": [  # Membuat Tas Kombinasi Sachet dan Plastik Kresek
        "https://i.etsystatic.com/38155389/r/il/2fdcc1/5571071079/il_fullxfull.5571071079_8rrm.jpg",
        "https://zerowasteearthstore.com/wp-content/uploads/2022/07/sachet-bag.jpeg",
    ],
    "537e99bb-75c4-467b-afd3-e6cbc227d801": [  # Membuat Tas Sederhana dari Kemasan Sachet Bekas
        "https://zerowasteearthstore.com/wp-content/uploads/2022/07/sachet-bag.jpeg",
        "https://i.etsystatic.com/38155389/r/il/2fdcc1/5571071079/il_fullxfull.5571071079_8rrm.jpg",
    ],
}

IMAGE_MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"GIF87a": "image/gif",
    b"GIF89a": "image/gif",
    b"RIFF": "image/webp",
}


def sniff(content_type: str, data: bytes) -> str:
    for magic, mime in IMAGE_MAGIC.items():
        if data.startswith(magic):
            return mime
    if "image" in (content_type or ""):
        return content_type.split(";")[0]
    return ""


async def main() -> None:
    load_dotenv()
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    existing = {
        row["skill_id"]
        for row in sb.table("generated_visuals")
        .select("skill_id")
        .eq("kind", "before_after")
        .execute()
        .data
    }

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for skill_id, urls in THUMBNAIL_URLS.items():
            if skill_id in existing:
                print(f"skip  {skill_id} (sudah ada before_after)")
                continue
            ok = False
            for url in urls:
                try:
                    r = await client.get(url)
                    r.raise_for_status()
                    mime = sniff(r.headers.get("content-type", ""), r.content)
                    if not mime or len(r.content) < 10_000:
                        print(
                            f"  x   {skill_id}: reject {url} (mime={mime or '-'}, {len(r.content)}B)"
                        )
                        continue
                    path = f"{skill_id}-before_after.png"
                    sb.storage.from_("visuals").upload(path, r.content, {"content-type": mime})
                    sb.table("generated_visuals").insert(
                        {
                            "skill_id": skill_id,
                            "kind": "before_after",
                            "step_order": None,
                            "image_path": path,
                            "prompt": "[THUMBNAIL internet-sourced placeholder]",
                            "reference_image_path": None,
                        }
                    ).execute()
                    print(f"OK    {skill_id}: {url} -> {path} ({len(r.content)}B)")
                    ok = True
                    break
                except Exception as e:
                    print(f"  x   {skill_id}: {url} FAILED ({e})")
            if not ok:
                print(f"FAIL  {skill_id}: semua URL gagal")


if __name__ == "__main__":
    asyncio.run(main())
