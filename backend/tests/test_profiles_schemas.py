from app.schemas import UserProfileCreate, UserProfileResponse, UserProfileUpdate


def test_user_profile_create_model_validates_fields():
    data = {
        "auth_user_id": "123e4567-e89b-12d3-a456-426614174000",
        "display_name": "John Doe",
        "first_name": "John",
        "last_name": "Doe",
        "bio": "Waste upcycler enthusiast",
        "phone": "+62812345678",
        "avatar_url": "https://example.com/avatar.jpg",
    }
    profile = UserProfileCreate(**data)
    assert profile.display_name == "John Doe"
    assert profile.first_name == "John"


def test_user_profile_update_can_be_partial():
    data = {"display_name": "Updated Name"}
    update = UserProfileUpdate(**data)
    assert "first_name" not in update.model_dump(exclude_unset=True)


def test_user_profile_response_includes_uuid():
    from uuid import UUID

    data = {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "auth_user_id": "123e4567-e89b-12d3-a456-426614174000",
        "display_name": "Jane Smith",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    profile = UserProfileResponse(**data)
    assert str(profile.id) == "123e4567-e89b-12d3-a456-426614174000"
    assert isinstance(profile.id, UUID)
