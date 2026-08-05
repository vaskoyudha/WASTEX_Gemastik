from io import BytesIO

import httpx
import pytest
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, StreamObject

from app.rag.document_ingest import extract_pdf, extract_url


def _make_pdf(pages: list[str]) -> bytes:
    """Build a minimal PDF whose text pypdf can extract. Uses pypdf's own
    writer internals (`_add_object`) to attach a content stream."""
    writer = PdfWriter()
    for text in pages:
        page = writer.add_blank_page(width=612, height=792)
        content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("latin-1")
        stream = StreamObject()
        stream.set_data(content)
        page[NameObject("/Contents")] = writer._add_object(stream)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
        )
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def test_extract_pdf_returns_page_and_text():
    parts = extract_pdf(_make_pdf(["Pot tanaman dari botol PET"]))
    assert parts == [{"page": 1, "text": "Pot tanaman dari botol PET"}]


def test_extract_pdf_multiple_pages():
    parts = extract_pdf(_make_pdf(["Halaman satu", "Halaman dua"]))
    assert [p["page"] for p in parts] == [1, 2]
    assert parts[1]["text"] == "Halaman dua"


def test_extract_pdf_raises_on_empty(monkeypatch):
    import app.rag.document_ingest as di

    monkeypatch.setattr(di, "MAX_PDF_PAGES", 0)
    with pytest.raises(ValueError):
        extract_pdf(_make_pdf(["teks"]))


class _Resp:
    def __init__(self, body: bytes, status: int = 200):
        self.body = body
        self.status = status

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def aiter_bytes(self):
        yield self.body

    def raise_for_status(self):
        if self.status >= 400:
            raise httpx.HTTPStatusError("bad", request=None, response=None)


class _Client:
    def __init__(self, resp: _Resp):
        self._resp = resp

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    def stream(self, method, url):
        return self._resp


HTML = (
    "<html><body><article>"
    "<h1>Panduan Daur Ulang</h1>"
    "<h2>Botol PET</h2>"
    "<p>Cuci botol sebelum dipotong.</p>"
    "<p>Gunakan gunting tajam.</p>"
    "<h2>Kardus</h2>"
    "<p>Lipat kardus menjadi rak.</p>"
    "</article></body></html>"
)


def test_extract_url_splits_sections():
    async def run():
        return await extract_url(
            "https://example.com/x", client_factory=lambda *a, **k: _Client(_Resp(HTML.encode()))
        )

    sections = asyncio_run(run())
    assert sections[0] == {
        "section": "Botol PET",
        "text": "Cuci botol sebelum dipotong. Gunakan gunting tajam.",
    }
    assert sections[1] == {"section": "Kardus", "text": "Lipat kardus menjadi rak."}


def test_extract_url_sends_browser_user_agent():
    captured = {}

    def factory(**kwargs):
        captured.update(kwargs)
        return _Client(_Resp(HTML.encode()))

    async def run():
        return await extract_url("https://example.com/x", client_factory=factory)

    asyncio_run(run())
    ua = captured["headers"]["User-Agent"]
    assert ua.startswith("Mozilla/5.0")
    assert "Chrome/" in ua

def test_extract_url_raises_on_http_error():
    async def run():
        return await extract_url(
            "https://example.com/404",
            client_factory=lambda *a, **k: _Client(_Resp(b"", status=404)),
        )

    with pytest.raises(httpx.HTTPStatusError):
        asyncio_run(run())


def test_extract_url_raises_over_size_limit(monkeypatch):
    import app.rag.document_ingest as di

    monkeypatch.setattr(di, "MAX_URL_BYTES", 10)

    async def run():
        return await extract_url(
            "https://example.com/x", client_factory=lambda *a, **k: _Client(_Resp(HTML.encode()))
        )

    with pytest.raises(ValueError, match="5MB"):
        asyncio_run(run())


def asyncio_run(coro):
    import asyncio

    return asyncio.new_event_loop().run_until_complete(coro)
