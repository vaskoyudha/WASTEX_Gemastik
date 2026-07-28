from dataclasses import dataclass, field

# Spec §2: 500-1000 tokens per chunk, 15% overlap. Words used as a cheap token proxy.
MAX_WORDS = 750
OVERLAP_RATIO = 0.15


@dataclass
class Chunk:
    content: str
    metadata: dict = field(default_factory=dict)


def chunk_text(text: str, metadata: dict | None = None, max_words: int = MAX_WORDS) -> list[Chunk]:
    words = text.split()
    if not words:
        return []
    step = max(1, int(max_words * (1 - OVERLAP_RATIO)))
    chunks = []
    for start in range(0, len(words), step):
        window = words[start : start + max_words]
        chunks.append(Chunk(content=" ".join(window), metadata=dict(metadata or {})))
        if start + max_words >= len(words):
            break
    return chunks
