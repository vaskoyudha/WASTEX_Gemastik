import logging
from io import BytesIO

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader

logger = logging.getLogger(__name__)

MAX_PDF_PAGES = 500
MAX_URL_BYTES = 5 * 1024 * 1024


def extract_pdf(data: bytes) -> list[dict]:
    """Return [{"page": int, "text": str}] per page with extractable text."""
    reader = PdfReader(BytesIO(data))
    if len(reader.pages) > MAX_PDF_PAGES:
        raise ValueError("PDF exceeds 500 pages")
    out = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            out.append({"page": i, "text": text})
    if not out:
        raise ValueError("no extractable text in PDF")
    return out


async def extract_url(url: str, client_factory=httpx.AsyncClient) -> list[dict]:
    """Fetch an article URL and split its main content on h1/h2/h3 headings."""
    async with (
        client_factory(timeout=30, follow_redirects=True, max_redirects=5) as client,
        client.stream("GET", url) as resp,
    ):
        resp.raise_for_status()
        total = 0
        parts = []
        async for chunk in resp.aiter_bytes():
            total += len(chunk)
            if total > MAX_URL_BYTES:
                raise ValueError("URL content exceeds 5MB")
            parts.append(chunk)
    soup = BeautifulSoup(b"".join(parts), "html.parser")
    main = soup.find("article") or soup.body or soup
    sections: list[dict] = []
    current_heading = None
    current_parts: list[str] = []

    def flush() -> None:
        text = " ".join(current_parts).strip()
        if text:
            sections.append({"section": current_heading, "text": text})
        current_parts.clear()

    for el in main.find_all(["h1", "h2", "h3", "p", "li"]):
        if el.name in ("h1", "h2", "h3"):
            flush()
            current_heading = el.get_text(strip=True)
        else:
            t = el.get_text(strip=True)
            if t:
                current_parts.append(t)
    flush()
    if not sections:
        raise ValueError("no extractable text in URL")
    return sections


from datetime import UTC, datetime
from uuid import UUID

from app.rag.chunking import chunk_text
from app.rag.embeddings import embed_texts


async def ingest_document(sb, document_id: UUID | str) -> int:
    res = sb.table("documents").select("*").eq("id", str(document_id)).single().execute()
    doc = res.data
    if not doc or doc["status"] != "approved":
        raise ValueError(
            f"document {document_id} is not approved (status={doc.get('status') if doc else 'missing'})"
        )

    sb.table("document_chunks").delete().eq("document_id", str(document_id)).execute()

    if doc["source_type"] == "pdf":
        blob = sb.storage.from_("documents").download(doc["file_path"])
        entries = [
            {"page": p["page"], "section": None, "text": p["text"]} for p in extract_pdf(blob)
        ]
    else:
        entries = [
            {"page": None, "section": p["section"], "text": p["text"]}
            for p in await extract_url(doc["url"])
        ]

    chunks = []
    for e in entries:
        meta = {"materials": doc["materials"], "section": e["section"], "page": e["page"]}
        chunks.extend(chunk_text(e["text"], metadata=meta))
    if not chunks:
        return 0

    embeddings = await embed_texts([c.content for c in chunks])
    rows = [
        {
            "document_id": str(document_id),
            "content": c.content,
            "embedding": e,
            "metadata": c.metadata,
        }
        for c, e in zip(chunks, embeddings)
    ]
    sb.table("document_chunks").insert(rows).execute()
    sb.table("documents").update({"indexed_at": datetime.now(UTC).isoformat()}).eq(
        "id", str(document_id)
    ).execute()
    return len(rows)
