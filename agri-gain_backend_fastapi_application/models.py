from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class WasteLogRequest(BaseModel):
    userId: str = Field(..., description="User ID")
    waste_type: str = Field(..., description="Type of waste (e.g., 'rice_straw', 'corn_husks')")
    unit_name: str = Field(..., description="Unit of measurement (e.g., 'bundle', 'bag', 'acre')")
    quantity: int = Field(..., gt=0, description="Quantity of waste in the specified unit")

class WasteLogResponse(BaseModel):
    success: bool
    waste_log_id: str
    estimated_kg: float

class OpportunitiesRequest(BaseModel):
    userId: str = Field(..., description="User ID")
    waste_log_id: str = Field(..., description="ID of the waste log to generate opportunities for")

class OpportunitiesResponse(BaseModel):
    opportunities_text: str

class StructuredOpportunities(BaseModel):
    on_farm_use: List[str] = Field(default_factory=list, description="On-farm use opportunities")
    local_sale: List[str] = Field(default_factory=list, description="Local sale opportunities")
    process_and_sell: List[str] = Field(default_factory=list, description="Processing and selling opportunities")

class StructuredOpportunitiesResponse(BaseModel):
    structured_opportunities: StructuredOpportunities

# Data models for knowledge base
class HowToGuide(BaseModel):
    guide_id: str
    waste_type: str
    title: str
    description: str
    steps: List[str]
    materials_needed: List[str]
    difficulty: str
    region: str

class MarketData(BaseModel):
    data_id: str
    waste_type: str
    product_type: str
    region: str
    avg_price_per_kg: float
    source: str
    last_updated: str

class BuyerDirectory(BaseModel):
    buyer_id: str
    buyer_name: str
    region: str
    waste_types_accepted: List[str]
    contact_info: str

class QuantificationModel(BaseModel):
    model_id: str
    waste_type: str
    unit_name: str
    avg_kg_per_unit: float

class SafetySheet(BaseModel):
    sheet_id: str
    waste_type: str
    content: str
    source: str
