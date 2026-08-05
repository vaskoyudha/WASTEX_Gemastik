from app.agent.tools.vision import IDENTITY_PROMPT, VISION_PROMPT, build_vision_messages

ALL_MATERIALS = ["plastik_pet", "plastik_hdpe", "kardus", "kaleng", "kaca", "sachet"]


def test_prompt_describes_all_six_materials():
    for m in ALL_MATERIALS:
        assert m in VISION_PROMPT


def test_prompt_handles_ambiguity():
    assert "ragu" in VISION_PROMPT.lower() or "ambigu" in VISION_PROMPT.lower()
    assert "0.6" in VISION_PROMPT


def test_prompt_has_behavioral_contract():
    assert "Iron Law" in VISION_PROMPT
    assert "MUST" in VISION_PROMPT or "WAJIB" in VISION_PROMPT
    assert "Red Flags" in VISION_PROMPT
    assert "Self-Check" in VISION_PROMPT
    assert "confusion pairs" in VISION_PROMPT.lower()


def test_prompt_forbids_guessing():
    assert "Jangan tebak" in VISION_PROMPT or "jangan menebak" in VISION_PROMPT.lower()


def test_messages_use_detail_high():
    messages = build_vision_messages("data:image/jpeg;base64,AAAA")
    image_part = messages[0]["content"][1]
    assert image_part["image_url"]["detail"] == "high"
    assert image_part["image_url"]["url"].startswith("data:image/jpeg")


def test_identity_prompt_describes_json_fields():
    for field in ("shape", "dominant_colors", "material", "notable_features"):
        assert field in IDENTITY_PROMPT


def test_identity_prompt_forbids_guessing():
    assert "Jangan menebak" in IDENTITY_PROMPT


def test_identity_messages_reuse_high_detail():
    messages = build_vision_messages("data:image/jpeg;base64,AAAA", IDENTITY_PROMPT)
    assert messages[0]["content"][0]["text"] == IDENTITY_PROMPT
    assert messages[0]["content"][1]["image_url"]["detail"] == "high"
