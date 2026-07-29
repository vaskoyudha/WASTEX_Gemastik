"""Pydantic schemas for vision-based waste detection."""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class MaterialType(str, Enum):
    """Indonesian non-organic waste material types."""
    plastik_pet = "plastik_pet"
    plastik_hdpe = "plastik_hdpe"
    kardus = "kardus"
    kaleng = "kaleng"
    kaca = "kaca"
    sachet = "sachet"


class RiskLevel(str, Enum):
    """Risk level classification for processing safety."""
    aman = "aman"
    hati_hati = "hati_hati"
    berisiko = "berisiko"


class Difficulty(str, Enum):
    """Difficulty level for upcycling projects."""
    mudah = "mudah"
    sedang = "sedang"
    sulit = "sulit"


class Condition(str, Enum):
    """Physical condition of the waste item."""
    baik = "baik"
    rusak_ringan = "rusak_ringan"
    rusak_sedang = "rusak_sedang"
    rusak_berat = "rusak_berat"
    kotor = "kotor"


class WasteDetectionResult(BaseModel):
    """Structured output from AI vision model for waste detection.
    
    This schema is used as the system prompt contract for the vision model,
    ensuring consistent structured JSON output for all waste analysis.
    """
    
    material_type: MaterialType = Field(
        description="The primary material type detected in the image",
        examples=["plastik_pet", "plastik_hdpe", "kardus", "kaleng", "kaca", "sachet"]
    )
    material_label: str = Field(
        description="Human-readable label for the material in Indonesian",
        examples=["Botol Plastik PET", "Kaleng Aluminium", "Kardus Bekas"]
    )
    condition: Condition = Field(
        description="Current physical condition of the waste item",
        examples=["baik", "rusak_ringan", "kotor"]
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="AI confidence score (0-1). < 0.70 triggers manual verification",
        examples=[0.96, 0.85, 0.62]
    )
    risk_level: RiskLevel = Field(
        description="Safety risk level when processing this material",
        examples=["aman", "hati_hati", "berisiko"]
    )
    difficulty: Difficulty = Field(
        default=None,
        description="Estimated difficulty level for upcycling this material",
        examples=["mudah", "sedang", "sulit"]
    )
    potential_value: Optional[str] = Field(
        default=None,
        description="Potential economic value level",
        examples=["rendah", "sedang", "tinggi"]
    )
    safety_notes: list[str] = Field(
        default=[],
        description="List of safety warnings and precautions for handling this material",
        examples=["Gunakan sarung tangan saat memotong", "Hindari kontak langsung dengan kulit"]
    )
    potential_uses: list[str] = Field(
        default=[],
        description="Suggested upcycling applications for this material",
        examples=["Pot tanaman gantung", "Tempat pensil", "Wadah penyimpanan"]
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "material_type": "plastik_pet",
                "material_label": "Botol Plastik PET",
                "condition": "baik",
                "confidence": 0.96,
                "risk_level": "aman",
                "difficulty": "mudah",
                "potential_value": "sedang",
                "safety_notes": [
                    "Cuci bersih sebelum dipotong",
                    "Gunakan gunting atau cutter dengan hati-hati"
                ],
                "potential_uses": [
                    "Pot tanaman gantung",
                    "Tempat sabun cair",
                    "Lampu hias"
                ]
            }
        }


# Fallback manual correction schema for low-confidence detections
class ManualMaterialSelection(BaseModel):
    """Manual selection result when AI confidence is below threshold."""
    
    selected_material: MaterialType = Field(
        description="Manually selected material type by user"
    )
    user_confirmed: bool = Field(
        default=True,
        description="User confirmed their selection after seeing AI suggestion"
    )
