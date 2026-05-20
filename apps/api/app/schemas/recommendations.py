from pydantic import BaseModel
from typing import List, Optional

class PlantFood(BaseModel):
    id: str
    name: str
    category: str
    nutritional_info: Optional[dict] = None

class RecommendationRequest(BaseModel):
    """Request body for getting recommendations"""
    limit: Optional[int] = 5

class RecommendationResponse(BaseModel):
    """Response body with recommendations"""
    user_id: str
    recommendations: List[PlantFood]
