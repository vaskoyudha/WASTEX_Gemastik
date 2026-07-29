from app.agent.tools.vision import VISION_PROMPT, build_vision_messages

ALL_MATERIALS = ["plastik_pet", "plastik_hdpe", "kardus", "kaleng", "kaca", "sachet"]


def test_prompt_describes_all_six_materials():
    for m in ALL_MATERIALS:
        assert m in VISION_PROMPT


def test_prompt_handles_ambiguity():
    assert "ragu" in VISION_PROMPT.lower() or "ambigu" in VISION_PROMPT.lower()
    assert "0.6" in VISION_PROMPT


def test_messages_use_detail_high():
    messages = build_vision_messages("data:image/jpeg;base64,AAAA")
    image_part = messages[0]["content"][1]
    assert image_part["image_url"]["detail"] == "high"
    assert image_part["image_url"]["url"].startswith("data:image/jpeg")
