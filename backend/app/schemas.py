from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class Material(str, Enum):
    plastik_pet = "plastik_pet"
    plastik_hdpe = "plastik_hdpe"
    kardus = "kardus"
    kaleng = "kaleng"
    kaca = "kaca"
    sachet = "sachet"


class Difficulty(str, Enum):
    pemula = "pemula"
    menengah = "menengah"
    mahir = "mahir"


class SkillStatus(str, Enum):
    draft = "draft"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    needs_revision = "needs_revision"


class MaterialIdentification(BaseModel):
    material: Material
    condition: str
    confidence: float = Field(ge=0, le=1)


class ObjectIdentity(BaseModel):
    shape: str
    dominant_colors: list[str]
    material: str
    notable_features: list[str] = []


class ToolItem(BaseModel):
    name: str
    optional: bool = False


class AdditionalMaterial(BaseModel):
    name: str
    category: Literal["tali", "cat", "lem", "tanah_tanaman", "pengait", "alat", "lainnya"]
    est_cost_idr: int = Field(default=0, ge=0)
    purpose: str = ""


class Step(BaseModel):
    order: int
    instruction: str
    warning: str | None = None
    visual_description: str | None = None


class Risk(BaseModel):
    hazard: str
    mitigation: str


class SourceRef(BaseModel):
    url: str | None = None
    citation: str | None = None
    accessed_at: str | None = None


class SkillDraft(BaseModel):
    title: str
    material: Material
    difficulty: Difficulty
    tools: list[ToolItem] = []
    steps: list[Step] = []
    risks: list[Risk] = []
    est_cost_idr: int | None = None
    est_price_idr: int | None = None
    sources: list[SourceRef] = []


class SafetyVerdict(BaseModel):
    safe: bool
    violations: list[str] = []


class SolutionPackage(BaseModel):
    recommendation: str
    steps: list[Step] = []
    tools: list[ToolItem] = []
    risks: list[Risk] = []
    est_cost_idr: int | None = None
    est_price_idr: int | None = None
    marketing_copy: str | None = None
    est_time_minutes: int | None = None
    sources: list[str] = []


class ScanResponse(BaseModel):
    scan_id: UUID
    status: Literal["identified", "needs_manual_verification"]
    identification: MaterialIdentification | None = None
    material_options: list[Material] | None = None


class RecommendRequest(BaseModel):
    scan_id: UUID | None = None
    material: Material | None = None
    condition: str = ""
    user_intent: str


class RecommendResponse(BaseModel):
    status: Literal["grounded", "generic_safe_procedure"]
    package: SolutionPackage
    gate_path: list[str]


class SkillStatusUpdate(BaseModel):
    status: SkillStatus
    reviewed_by: str | None = None


class IngestRequest(BaseModel):
    skill_ids: list[UUID] | None = None


class SellingKit(BaseModel):
    skill_id: str = ""
    product_name: str
    description: str
    captions: list[str] = []
    photo_tips: list[str] = []
    packaging_ideas: list[str] = []
    hashtags: list[str] = []


class UserProfileCreate(BaseModel):
    auth_user_id: UUID = Field(..., description="UUID from auth.users")
    display_name: str = Field(..., min_length=1, max_length=64)
    first_name: str | None = Field(None, max_length=64)
    last_name: str | None = Field(None, max_length=64)
    bio: str | None = Field(None, max_length=500)
    phone: str | None = Field(None, max_length=24)
    avatar_url: str | None = Field(None, max_length=512)


class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=64)
    first_name: str | None = Field(None, max_length=64)
    last_name: str | None = Field(None, max_length=64)
    bio: str | None = Field(None, max_length=500)
    phone: str | None = Field(None, max_length=24)
    avatar_url: str | None = Field(None, max_length=512)


class UserProfileResponse(BaseModel):
    id: UUID
    auth_user_id: UUID
    display_name: str
    first_name: str | None = None
    last_name: str | None = None
    bio: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


# Auth DTOs
class RegisterRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=1, max_length=64)
    first_name: str | None = Field(None, max_length=64)
    last_name: str | None = Field(None, max_length=64)
    bio: str | None = Field(None, max_length=500)
    phone: str | None = Field(None, max_length=24)


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthRegisterResponse(BaseModel):
    access_token: str
    user_id: str
    profile: UserProfileResponse


class AuthLoginResponse(BaseModel):
    access_token: str
    user_id: str
    profile: UserProfileResponse


class ImpactEventIn(BaseModel):
    skill_id: UUID | None = None
    material: Material
    waste_kg: float = Field(ge=0)
    est_value_idr: int = Field(ge=0)


class ImpactSummary(BaseModel):
    total_projects: int
    total_waste_kg: float
    total_value_idr: int


class SkillFlagIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class FeedbackIn(BaseModel):
    agent_run_id: UUID | None = None
    rating: int = Field(ge=1, le=5)
    flag_inaccurate: bool = False
    comment: str | None = Field(default=None, max_length=1000)


class SkillProposal(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=2000)
    material: Material
    difficulty: Difficulty
    steps: list[Step] = []
    tools: list[ToolItem] = []
    additional_materials: list[AdditionalMaterial] = []
    est_cost_idr: int | None = Field(default=None, ge=0)
    est_price_idr: int | None = None


class SkillIdea(BaseModel):
    """Ide ringkas fase 1 (two-phase): tanpa langkah detail. Di-expand menjadi
    SkillProposal lengkap pada fase 2 setelah user memilih."""

    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=2000)
    material: Material
    difficulty: Difficulty
    est_cost_idr: int | None = Field(default=None, ge=0)
    est_price_idr: int | None = None


class SkillProposalRequest(BaseModel):
    material: Material
    condition: str = ""


class SkillExpandRequest(BaseModel):
    material: Material
    condition: str = ""
    idea: SkillIdea


class SkillVerifyRequest(BaseModel):
    draft: SkillProposal
    chat_history: list[dict] = []


class SkillVerifyResponse(BaseModel):
    verdict: Literal["layak", "perbaiki"]
    feedback: list[str] = []
    suggestions: list[str] = []
    draft: SkillProposal | None = None
    auto_repaired: bool = False


class ContinuityStepIssue(BaseModel):
    order: int
    missing_prerequisite: str
    note: str = ""


class ContinuityCritique(BaseModel):
    index: int = 0
    verdict: Literal["kontinu", "perbaiki"]
    steps: list[ContinuityStepIssue] = []
    suggestions: list[str] = []


class ContinuityCritiqueBatch(BaseModel):
    critiques: list[ContinuityCritique] = []


class SkillCreateRequest(SkillProposal):
    reference_scan_id: UUID | None = None
    ai_verdict: Literal["layak", "perbaiki"] | None = None


class SkillCompletionCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class SkillCompletion(BaseModel):
    id: str
    user_id: str
    skill_id: str
    photo_path: str
    rating: int
    comment: str | None = None
    created_at: str


class CompletionGalleryItem(BaseModel):
    photo_url: str
    rating: int
    comment: str | None = None
    created_at: str
    user_display_name: str = ""


class SkillCompletionsSummary(BaseModel):
    skill_id: str
    avg_rating: float
    count: int
    gallery: list[CompletionGalleryItem] = []


class DocumentSourceType(str, Enum):
    pdf = "pdf"
    url = "url"


class DocumentCreateRequest(BaseModel):
    title: str
    source_type: DocumentSourceType
    url: str | None = None
    materials: list[Material]


class DocumentStatusUpdate(BaseModel):
    status: Literal["approved", "rejected"]
    reviewed_by: str
