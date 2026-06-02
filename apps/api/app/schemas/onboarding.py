from pydantic import BaseModel
from typing import List


class OnboardingRequest(BaseModel):
    difficulty_level: str
    allergies: List[str]
    is_guest_user: bool = False
