"""Pydantic schemas for AI-generated tutorial images and visual content."""

from pydantic import BaseModel, Field
from typing import Optional, List


class TutorialStep(BaseModel):
    """Single step in a tutorial with visual guidance."""
    
    order: int = Field(
        gt=0,
        description="Step sequence number (1-indexed)"
    )
    title: str = Field(
        min_length=1,
        max_length=100,
        description="Brief title for this step"
    )
    description: str = Field(
        min_length=10,
        max_length=500,
        description="Detailed instructions for completing this step"
    )
    safety_warning: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Optional safety warning specific to this step"
    )
    estimated_time_minutes: int = Field(
        default=5,
        ge=1,
        le=120,
        description="Estimated time to complete this step in minutes"
    )


class ProductTutorial(BaseModel):
    """Complete tutorial package for an upcycling product."""
    
    product_id: str = Field(
        min_length=1,
        description="Unique identifier for the product"
    )
    product_name: str = Field(
        min_length=3,
        max_length=150,
        description="Name of the upcycled product"
    )
    steps: List[TutorialStep] = Field(
        min_length=3,
        max_length=12,
        description="Ordered list of tutorial steps"
    )
    estimated_total_time_minutes: int = Field(
        description="Total estimated time for entire project"
    )
    tools_and_materials: List[str] = Field(
        description="List of tools and materials needed"
    )
    difficulty: str = Field(
        description="Overall difficulty level"
    )


class GeneratedImagePrompt(BaseModel):
    """Prompt structure for AI image generation."""
    
    subject: str = Field(
        min_length=10,
        max_length=300,
        description="Main subject of the image to generate"
    )
    style: str = Field(
        default="clean instructional illustration",
        max_length=150,
        description="Art style for the image"
    )
    context: Optional[str] = Field(
        default=None,
        max_length=400,
        description="Additional context or environment details"
    )
    composition: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Composition specifications (e.g., 'close-up', 'overhead view')"
    )
    
    def to_full_prompt(self) -> str:
        """Combine all fields into a single generation prompt."""
        parts = [self.subject, self.style]
        if self.context:
            parts.append(f"Context: {self.context}")
        if self.composition:
            parts.append(f"Composition: {self.composition}")
        return " | ".join(parts)


class ImageGenerationResult(BaseModel):
    """Structured result from image generation API."""
    
    status: str = Field(
        description="Status of generation ('success' or 'failed')"
    )
    image_url: Optional[str] = Field(
        default=None,
        description="URL to the generated image"
    )
    thumbnail_url: Optional[str] = Field(
        default=None,
        description="URL to a thumbnail version"
    )
    alt_text: Optional[str] = Field(
        default=None,
        description="Accessible alt text description"
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error message if generation failed"
    )


class BeforeAfterTransformation(BaseModel):
    """Before/After transformation description for tutorials."""
    
    before_description: str = Field(
        description="Description of the waste item before upcycling"
    )
    after_description: str = Field(
        description="Description of the final upcycled product"
    )
    transformation_highlights: List[str] = Field(
        description="Key changes achieved during transformation"
    )

