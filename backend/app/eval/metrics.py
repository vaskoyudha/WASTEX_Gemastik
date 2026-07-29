def hit_at_k(expected: list[str], retrieved: list[str], k: int) -> bool:
    top = set(retrieved[:k])
    return any(e in top for e in expected)


def mean_reciprocal_rank(cases: list[tuple[list[str], list[str]]]) -> float:
    if not cases:
        return 0.0
    total = 0.0
    for expected, retrieved in cases:
        for rank, item in enumerate(retrieved, start=1):
            if item in expected:
                total += 1.0 / rank
                break
    return total / len(cases)
