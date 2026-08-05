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
