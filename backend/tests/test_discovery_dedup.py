from app.agent.tools.discovery import is_duplicate_title


def test_exact_match_is_duplicate():
    assert is_duplicate_title("Vas Bunga dari Botol PET", ["Vas Bunga dari Botol PET"])


def test_near_match_is_duplicate():
    assert is_duplicate_title("Vas bunga dari botol pet", ["Vas Bunga dari Botol PET bekas"])


def test_different_title_not_duplicate():
    assert not is_duplicate_title("Celengan Kaleng Susu", ["Vas Bunga dari Botol PET"])


def test_empty_existing_not_duplicate():
    assert not is_duplicate_title("Apapun", [])
