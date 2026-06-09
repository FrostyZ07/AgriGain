#!/usr/bin/env python3
"""
Agricultural Waste Quantification Module

This module provides functionality to convert agricultural waste measurements
from farm units (sacks, wheelbarrows, crates, baskets) to kilograms using
predefined conversion factors.

Usage:
    from quantify import QuantificationService
    
    service = QuantificationService()
    total_kg = service.calculate_kg("rice_husks", "sacks", 10)
"""

import json
import logging
from typing import Dict, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

class QuantificationService:
    """Service for quantifying agricultural waste from units to kilograms"""
    
    def __init__(self, models_path: str = "data/quantification_models.json"):
        """
        Initialize the quantification service with conversion models.
        
        Args:
            models_path: Path to the JSON file containing quantification models
        """
        self.models_path = models_path
        self.conversion_factors: Dict[str, float] = {}
        self.load_models()
    
    def load_models(self) -> None:
        """Load quantification models from JSON file into memory"""
        try:
            with open(self.models_path, 'r', encoding='utf-8') as f:
                models_list = json.load(f)
            
            # Convert list to dictionary for O(1) lookup
            self.conversion_factors = {}
            for model in models_list:
                key = f"{model['waste_type']}_{model['unit_name']}"
                self.conversion_factors[key] = model['avg_kg_per_unit']
            
            logger.info(f"Loaded {len(self.conversion_factors)} quantification models")
            
        except FileNotFoundError:
            logger.error(f"Quantification models file not found: {self.models_path}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in quantification models file: {e}")
            raise
        except Exception as e:
            logger.error(f"Error loading quantification models: {e}")
            raise
    
    def calculate_kg(self, waste_type: str, unit_name: str, quantity: int) -> float:
        """
        Calculate total weight in kilograms from unit-based measurements.
        
        Args:
            waste_type: Type of agricultural waste (e.g., 'rice_husks', 'sugarcane_bagasse')
            unit_name: Unit of measurement (e.g., 'sacks', 'wheelbarrows', 'crates', 'baskets')
            quantity: Number of units
            
        Returns:
            Total weight in kilograms
            
        Raises:
            ValueError: If waste_type/unit_name combination not found
            TypeError: If quantity is not a valid number
        """
        # Input validation
        if not isinstance(waste_type, str) or not waste_type.strip():
            raise ValueError("waste_type must be a non-empty string")
        
        if not isinstance(unit_name, str) or not unit_name.strip():
            raise ValueError("unit_name must be a non-empty string")
        
        if not isinstance(quantity, (int, float)) or quantity < 0:
            raise TypeError("quantity must be a non-negative number")
        
        # Clean inputs
        waste_type = waste_type.strip().lower()
        unit_name = unit_name.strip().lower()
        
        # Lookup conversion factor
        key = f"{waste_type}_{unit_name}"
        if key not in self.conversion_factors:
            available_combinations = list(self.conversion_factors.keys())
            raise ValueError(
                f"No conversion factor found for {waste_type} in {unit_name}. "
                f"Available combinations: {available_combinations}"
            )
        
        conversion_factor = self.conversion_factors[key]
        total_kg = quantity * conversion_factor
        
        logger.debug(f"Converted {quantity} {unit_name} of {waste_type} to {total_kg:.2f} kg")
        
        return round(total_kg, 2)
    
    def get_available_waste_types(self) -> list[str]:
        """Get list of available waste types in the quantification models"""
        waste_types = set()
        for key in self.conversion_factors.keys():
            # Find the last underscore to properly split waste type from unit
            parts = key.rsplit('_', 1)
            if len(parts) == 2:
                waste_type = parts[0]
                waste_types.add(waste_type)
        return sorted(list(waste_types))
    
    def get_available_units_for_waste_type(self, waste_type: str) -> list[str]:
        """Get available units for a specific waste type"""
        waste_type = waste_type.strip().lower()
        units = []
        
        for key in self.conversion_factors.keys():
            parts = key.rsplit('_', 1)
            if len(parts) == 2 and parts[0] == waste_type:
                units.append(parts[1])
        
        return sorted(units)
    
    def get_conversion_factor(self, waste_type: str, unit_name: str) -> Optional[float]:
        """
        Get the conversion factor for a specific waste type and unit combination.
        
        Returns:
            Conversion factor (kg per unit) or None if not found
        """
        waste_type = waste_type.strip().lower()
        unit_name = unit_name.strip().lower()
        key = f"{waste_type}_{unit_name}"
        
        return self.conversion_factors.get(key)
    
    def validate_combination(self, waste_type: str, unit_name: str) -> Tuple[bool, str]:
        """
        Validate if a waste type and unit combination is supported.
        
        Returns:
            Tuple of (is_valid: bool, message: str)
        """
        waste_type = waste_type.strip().lower()
        unit_name = unit_name.strip().lower()
        key = f"{waste_type}_{unit_name}"
        
        if key in self.conversion_factors:
            return True, f"Valid combination: {waste_type} in {unit_name}"
        else:
            available_units = self.get_available_units_for_waste_type(waste_type)
            if available_units:
                return False, f"Invalid unit '{unit_name}' for waste type '{waste_type}'. Available units: {available_units}"
            else:
                available_types = self.get_available_waste_types()
                return False, f"Unknown waste type '{waste_type}'. Available types: {available_types}"
    
    def get_statistics(self) -> Dict[str, any]:
        """Get statistics about loaded quantification models"""
        if not self.conversion_factors:
            return {"total_models": 0, "waste_types": [], "units": []}
        
        waste_types = self.get_available_waste_types()
        all_units = set()
        
        for key in self.conversion_factors.keys():
            parts = key.rsplit('_', 1)
            if len(parts) == 2:
                all_units.add(parts[1])
        
        return {
            "total_models": len(self.conversion_factors),
            "waste_types": waste_types,
            "units": sorted(list(all_units)),
            "conversion_factors": dict(sorted(self.conversion_factors.items()))
        }


# Global instance for convenient access
_quantification_service = None

def get_quantification_service(models_path: str = "data/quantification_models.json") -> QuantificationService:
    """Get global quantification service instance (singleton pattern)"""
    global _quantification_service
    if _quantification_service is None:
        _quantification_service = QuantificationService(models_path)
    return _quantification_service

def calculate_kg(waste_type: str, unit_name: str, quantity: int) -> float:
    """
    Convenience function to calculate kilograms using the global service instance.
    
    Args:
        waste_type: Type of agricultural waste
        unit_name: Unit of measurement  
        quantity: Number of units
        
    Returns:
        Total weight in kilograms
    """
    service = get_quantification_service()
    return service.calculate_kg(waste_type, unit_name, quantity)


if __name__ == "__main__":
    # Example usage and testing
    print("Agricultural Waste Quantification Module")
    print("=" * 50)
    
    try:
        # Initialize service
        service = QuantificationService()
        
        # Show statistics
        stats = service.get_statistics()
        print(f"Loaded {stats['total_models']} quantification models")
        print(f"Waste types: {stats['waste_types']}")
        print(f"Units: {stats['units']}")
        print()
        
        # Test calculations
        test_cases = [
            ("rice_husks", "sacks", 10),
            ("sugarcane_bagasse", "wheelbarrows", 5),
            ("vegetable_trimmings", "crates", 3),
            ("fruit_seeds", "baskets", 8),
            ("mixed_waste", "sacks", 15)
        ]
        
        print("Test calculations:")
        for waste_type, unit_name, quantity in test_cases:
            try:
                total_kg = service.calculate_kg(waste_type, unit_name, quantity)
                print(f"  {quantity} {unit_name} of {waste_type} = {total_kg} kg")
            except Exception as e:
                print(f"  Error: {e}")
        
        print()
        print("Validation tests:")
        
        # Test invalid combinations
        invalid_cases = [
            ("rice_husks", "tons"),
            ("unknown_waste", "sacks"),
            ("vegetable_trimmings", "invalid_unit")
        ]
        
        for waste_type, unit_name in invalid_cases:
            is_valid, message = service.validate_combination(waste_type, unit_name)
            print(f"  {waste_type} + {unit_name}: {message}")
            
    except Exception as e:
        print(f"Error: {e}")