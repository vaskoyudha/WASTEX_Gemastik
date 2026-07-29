from app.agent.tools.image_gen import (
    build_before_after_prompt,
    build_mockup_prompt,
    build_storyboard_prompt,
)

SKILL = {
    "id": "s1",
    "title": "Vas Botol PET",
    "material": "plastik_pet",
    "steps": [{"order": 1, "instruction": "Potong botol jadi dua", "warning": "Hati-hati gunting"}],
}


def test_storyboard_prompt_mentions_step_and_style():
    p = build_storyboard_prompt(SKILL, SKILL["steps"][0])
    assert "Potong botol jadi dua" in p
    assert "flat illustration" in p
    assert "step 1" in p.lower()
    assert "no text" in p.lower()


def test_before_after_prompt_has_split_layout():
    p = build_before_after_prompt(SKILL)
    assert "Vas Botol PET" in p
    assert "side-by-side" in p.lower()
    assert "before" in p.lower() and "after" in p.lower()


def test_mockup_prompt_is_product_photo_style():
    p = build_mockup_prompt(SKILL)
    assert "Vas Botol PET" in p
    assert "product photography" in p
    assert "photorealistic" in p.lower()
