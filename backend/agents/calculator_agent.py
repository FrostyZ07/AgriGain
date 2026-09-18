import json
import os
import logging
from typing import Any, Dict, Optional, Tuple
from backend.agents.base_agent import BaseAgent
from backend.models.tool_models import ToolRequest, ToolResponse, ToolError
from quantify import get_quantification_service

logger = logging.getLogger(__name__)

# C3 fix: the transport/storage/yield/CO2 constants and crop yield multipliers
# used to be bare literals here, presented in every response rounded to 2dp as
# if measured. They're unsourced placeholders (see data/cost_models.json's
# _note) - moving them to JSON makes that visible and makes them calibratable
# per-region without a code change.
_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
_DEFAULT_COST_MODELS_PATH = os.path.join(_DATA_DIR, "cost_models.json")
_DEFAULT_MARKET_DATA_PATH = os.path.join(_DATA_DIR, "market_data.json")


def _load_cost_models(path: str) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load cost models from {path}: {e} - using hardcoded fallback constants.")
        return {
            "transportation_cost_per_kg": {"value": 0.8},
            "storage_cost_per_kg": {"value": 0.45},
            "biochar_yield_fraction": {"value": 0.33},
            "biogas_yield_fraction": {"value": 0.25},
            "co2_saved_per_kg": {"value": 0.45},
            "crop_yield_multipliers_kg_per_acre": {
                "rice": {"value": 2000.0}, "sugarcane": {"value": 3000.0},
                "vegetable": {"value": 1200.0}, "fruit": {"value": 800.0},
                "default": {"value": 1000.0},
            },
        }


class CalculatorAgent(BaseAgent):
    def __init__(self, market_data_path: str = _DEFAULT_MARKET_DATA_PATH, cost_models_path: str = _DEFAULT_COST_MODELS_PATH) -> None:
        super().__init__()
        self.market_data_path = market_data_path
        self.quantification_service = get_quantification_service()
        self.market_prices: Dict[str, float] = {}
        self.cost_models = _load_cost_models(cost_models_path)

    def _cost(self, key: str) -> float:
        return self.cost_models[key]["value"]

    def _crop_yield_multiplier(self, crop: str) -> float:
        multipliers = self.cost_models["crop_yield_multipliers_kg_per_acre"]
        entry = multipliers.get(crop, multipliers["default"])
        return entry["value"]

    def initialize(self) -> None:
        """Load market prices from json file to calculate revenue."""
        try:
            if os.path.exists(self.market_data_path):
                with open(self.market_data_path, "r", encoding="utf-8") as f:
                    market_data = json.load(f)

                # Compute average price per waste type
                temp_prices: Dict[str, list] = {}
                for entry in market_data:
                    wtype = entry.get("waste_type", "").strip().lower()
                    price = entry.get("avg_price_per_kg", 0.0)
                    if wtype:
                        if wtype not in temp_prices:
                            temp_prices[wtype] = []
                        temp_prices[wtype].append(price)

                self.market_prices = {
                    wtype: sum(prices) / len(prices)
                    for wtype, prices in temp_prices.items()
                }
                logger.info(f"Loaded market prices for {len(self.market_prices)} waste types.")
            else:
                logger.warning(f"Market data file not found at {self.market_data_path}. Fallbacks will be used.")
        except Exception as e:
            logger.error(f"Error loading market prices: {e}")

    def validate(self, request: ToolRequest) -> bool:
        """
        Validate input for CalculatorAgent.
        Supports either (quantity, unit, waste_type) or (crop, area, area_unit, waste_type).
        """
        inp = request.input
        if not inp:
            raise ValueError("Input data is missing.")

        waste_type = inp.get("waste_type")
        if not waste_type:
            raise ValueError("Parameter 'waste_type' is required.")

        # Option A: Unit-based quantity
        has_quantity = "quantity" in inp and inp.get("quantity") is not None
        # Option B: Crop acreage
        has_area = "area" in inp and inp.get("area") is not None
        has_crop = "crop" in inp and inp.get("crop") is not None

        if not has_quantity and not (has_area and has_crop):
            raise ValueError("Must provide either 'quantity' or both 'area' and 'crop'.")

        if has_quantity:
            qty = inp.get("quantity")
            if not isinstance(qty, (int, float)) or qty < 0:
                raise ValueError("Parameter 'quantity' must be a non-negative number.")
            unit = inp.get("unit") or inp.get("unit_name")
            if not unit:
                raise ValueError("Parameter 'unit' is required when quantity is provided.")
        
        if has_area:
            area = inp.get("area")
            if not isinstance(area, (int, float)) or area < 0:
                raise ValueError("Parameter 'area' must be a non-negative number.")

        return True

    def execute(self, request: ToolRequest) -> ToolResponse:
        import time
        start_time = time.time()
        try:
            self.validate(request)
            inp = request.input
            waste_type = inp.get("waste_type")
            
            # 1. Estimate waste weight in kg
            estimated_waste_kg = 0.0
            
            if "quantity" in inp and inp.get("quantity") is not None:
                qty = float(inp.get("quantity"))
                unit = inp.get("unit") or inp.get("unit_name") or ""
                unit_clean = unit.strip().lower()
                
                if unit_clean in ["kg", "kilo", "kilos", "kilogram", "kilograms"]:
                    estimated_waste_kg = qty
                elif unit_clean in ["tonne", "tonnes", "ton", "tons", "t"]:
                    estimated_waste_kg = qty * 1000.0
                elif unit_clean in ["quintal", "quintals", "q"]:
                    estimated_waste_kg = qty * 100.0
                else:
                    # C2 fix: an unknown waste_type/unit combination used to
                    # silently fall back to a fabricated 50kg-per-unit conversion
                    # ("3 truckloads" -> 150 kg, asserted as if measured). Let the
                    # error propagate - execute()'s except block turns it into an
                    # honest "failed" ToolResponse instead of a wrong number.
                    estimated_waste_kg = self.quantification_service.calculate_kg(
                        waste_type=waste_type,
                        unit_name=unit,
                        quantity=int(qty)
                    )
            else:
                # Estimate from acreage
                area = float(inp.get("area", 0))
                crop = inp.get("crop", "").strip().lower()
                multiplier = self._crop_yield_multiplier(crop)
                estimated_waste_kg = area * multiplier

            # 2. Lookup avg price per kg
            clean_wtype = waste_type.strip().lower().replace(" ", "_")
            avg_price = self.market_prices.get(clean_wtype, 5.0)  # default fallback is ₹5.0/kg

            # 3. Calculations - see data/cost_models.json for these constants
            # and their (unsourced-placeholder) provenance (C3 fix).
            estimated_revenue = estimated_waste_kg * avg_price
            transportation_cost = estimated_waste_kg * self._cost("transportation_cost_per_kg")
            storage_cost = estimated_waste_kg * self._cost("storage_cost_per_kg")
            total_cost = transportation_cost + storage_cost

            roi = 0.0
            if total_cost > 0:
                roi = (estimated_revenue - total_cost) / total_cost

            biochar_yield = estimated_waste_kg * self._cost("biochar_yield_fraction")
            biogas_estimate = estimated_waste_kg * self._cost("biogas_yield_fraction")
            co2_saved = estimated_waste_kg * self._cost("co2_saved_per_kg")

            result = {
                "estimated_waste": round(estimated_waste_kg, 2),
                "unit": "kg",
                "estimated_revenue": round(estimated_revenue, 2),
                "transportation_cost": round(transportation_cost, 2),
                "storage_cost": round(storage_cost, 2),
                "roi": round(roi, 2),
                "biochar_yield": round(biochar_yield, 2),
                "biogas_estimate": round(biogas_estimate, 2),
                "co2_saved": round(co2_saved, 2)
            }

            execution_time = int((time.time() - start_time) * 1000)
            return self.format_response(result, "success", request, execution_time)

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"CalculatorAgent execution failed: {e}")
            return self.format_response(None, "failed", request, execution_time, error=e)

    def format_response(
        self, 
        result: Any, 
        status: str, 
        request: ToolRequest, 
        execution_time_ms: int,
        error: Any = None
    ) -> ToolResponse:
        err_obj = None
        if error:
            err_obj = ToolError(code="CALCULATOR_ERROR", message=str(error))
        
        return ToolResponse(
            request_id=request.request_id,
            tool_name=request.tool_name,
            status=status,
            execution_time_ms=execution_time_ms,
            result=result,
            error=err_obj
        )
