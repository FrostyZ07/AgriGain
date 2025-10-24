import json
import logging
from typing import Dict, Any
from models import QuantificationModel

logger = logging.getLogger(__name__)

class QuantificationService:
    """Service for calculating waste quantities in kg"""
    
    def __init__(self):
        self.models: Dict[str, Dict[str, float]] = {}
        self.loaded = False
    
    async def load_models(self):
        """Load quantification models from JSON file"""
        try:
            with open("data/quantification_models.json", "r") as f:
                models_data = json.load(f)
            
            # Convert to nested dictionary for fast lookup
            # Structure: {waste_type: {unit_name: avg_kg_per_unit}}
            for model in models_data:
                waste_type = model["waste_type"]
                unit_name = model["unit_name"]
                avg_kg_per_unit = model["avg_kg_per_unit"]
                
                if waste_type not in self.models:
                    self.models[waste_type] = {}
                
                self.models[waste_type][unit_name] = avg_kg_per_unit
            
            self.loaded = True
            logger.info(f"Loaded {len(models_data)} quantification models")
            
        except FileNotFoundError:
            logger.error("Quantification models file not found")
            # Create default models for development
            self._create_default_models()
        except Exception as e:
            logger.error(f"Error loading quantification models: {e}")
            raise
    
    def _create_default_models(self):
        """Create default quantification models for development"""
        default_models = {
            "rice_straw": {
                "bundle": 2.5,
                "bag": 15.0,
                "acre": 2500.0
            },
            "corn_husks": {
                "bundle": 1.8,
                "bag": 12.0,
                "acre": 1800.0
            },
            "wheat_straw": {
                "bundle": 3.0,
                "bag": 18.0,
                "acre": 3000.0
            },
            "sugarcane_bagasse": {
                "bundle": 4.0,
                "bag": 25.0,
                "ton": 1000.0
            },
            "coconut_coir": {
                "bundle": 1.5,
                "bag": 10.0,
                "cubic_meter": 80.0
            }
        }
        
        self.models = default_models
        self.loaded = True
        logger.info("Created default quantification models")
    
    def calculate_kg(self, waste_type: str, unit_name: str, quantity: int) -> float:
        """
        Calculate total kg of waste based on type, unit, and quantity
        
        Args:
            waste_type: Type of waste (e.g., 'rice_straw')
            unit_name: Unit of measurement (e.g., 'bundle')
            quantity: Number of units
            
        Returns:
            Total weight in kg
            
        Raises:
            ValueError: If waste_type or unit_name not found
        """
        if not self.loaded:
            raise ValueError("Quantification models not loaded")
        
        if waste_type not in self.models:
            available_types = list(self.models.keys())
            raise ValueError(f"Unknown waste type '{waste_type}'. Available types: {available_types}")
        
        if unit_name not in self.models[waste_type]:
            available_units = list(self.models[waste_type].keys())
            raise ValueError(f"Unknown unit '{unit_name}' for waste type '{waste_type}'. Available units: {available_units}")
        
        avg_kg_per_unit = self.models[waste_type][unit_name]
        total_kg = avg_kg_per_unit * quantity
        
        logger.info(f"Calculated {total_kg} kg for {quantity} {unit_name} of {waste_type}")
        
        return round(total_kg, 2)
    
    def get_available_waste_types(self) -> list:
        """Get list of available waste types"""
        return list(self.models.keys())
    
    def get_available_units(self, waste_type: str) -> list:
        """Get list of available units for a waste type"""
        if waste_type not in self.models:
            return []
        return list(self.models[waste_type].keys())
