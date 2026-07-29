from app.eval.metrics import hit_at_k, mean_reciprocal_rank


def test_hit_at_k_true_within_k():
    assert hit_at_k(["s1"], ["s3", "s1", "s2"], k=2)


def test_hit_at_k_false_outside_k():
    assert not hit_at_k(["s1"], ["s3", "s2", "s1"], k=2)


def test_hit_at_k_empty_retrieved():
    assert not hit_at_k(["s1"], [], k=5)


def test_mrr():
    cases = [
        (["s1"], ["s1", "s2"]),  # rank 1 -> 1.0
        (["s2"], ["s1", "s2"]),  # rank 2 -> 0.5
        (["s9"], ["s1", "s2"]),  # miss   -> 0.0
    ]
    assert abs(mean_reciprocal_rank(cases) - 0.5) < 1e-9


def test_mrr_empty_cases():
    assert mean_reciprocal_rank([]) == 0.0
