from app.rag.chunking import MAX_WORDS, chunk_text


def test_short_text_single_chunk() -> None:
    chunks = chunk_text("daur ulang botol plastik", metadata={"material": "plastik_pet"})
    assert len(chunks) == 1
    assert chunks[0].metadata == {"material": "plastik_pet"}


def test_long_text_overlaps() -> None:
    words = [f"kata{i}" for i in range(2000)]
    chunks = chunk_text(" ".join(words))
    assert len(chunks) > 1
    for c in chunks:
        assert len(c.content.split()) <= MAX_WORDS
    first = chunks[0].content.split()
    second = chunks[1].content.split()
    assert first[-1] in second  # 15% overlap window


def test_empty_text() -> None:
    assert chunk_text("   ") == []
