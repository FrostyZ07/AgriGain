import type { WasteType, Priority } from "@/types";

export const PRIORITIES: Priority[] = [
  { key: "profit", label: "Maximum Profit" },
  { key: "sustainability", label: "Sustainability" },
  { key: "quick", label: "Quick Disposal" },
  { key: "low-investment", label: "Low Investment" },
];

export const WASTE_TYPES: Record<string, WasteType> = {
  "rice-husk": {
    name: "Rice Husk",
    defaultQty: 5,
    usableRatio: 0.78,
    knowledge: [
      "Rice husk biochar improves soil carbon sequestration by up to 35%",
      "Rice husk contains ~18% silica, valuable for cement and ceramic industries",
      "Anaerobic digestion of rice husk yields ~280 m³ biogas per tonne",
    ],
    alternatives: [
      {
        id: "biochar",
        name: "Biochar Production",
        profitPerTon: 3708,
        sustainability: 85,
        investment: 6000,
        roi: "3.2x",
        timeWeeks: 2,
        difficulty: "Medium",
        confidence: 94,
        reasons: [
          "Highest projected ROI with strong local demand",
          "Transportation costs remain low",
          "Government subsidy available for biochar equipment",
        ],
      },
      {
        id: "direct-sale",
        name: "Direct Sale",
        profitPerTon: 2800,
        sustainability: 45,
        investment: 500,
        roi: "2.1x",
        timeWeeks: 1,
        difficulty: "Low",
        confidence: 86,
        reasons: [
          "Immediate cash flow with minimal processing",
          "No equipment investment required",
        ],
      },
      {
        id: "biogas",
        name: "Biogas",
        profitPerTon: 3100,
        sustainability: 92,
        investment: 15000,
        roi: "1.8x",
        timeWeeks: 4,
        difficulty: "High",
        confidence: 81,
        reasons: [
          "Excellent sustainability score",
          "Long-term recurring revenue from energy",
        ],
      },
      {
        id: "compost",
        name: "Composting",
        profitPerTon: 1800,
        sustainability: 78,
        investment: 2000,
        roi: "1.5x",
        timeWeeks: 8,
        difficulty: "Low",
        confidence: 72,
        reasons: [
          "Lowest barrier to entry",
          "Good for soil health improvement",
        ],
      },
    ],
    buyers: [
      { name: "Green Earth Bioproducts", distance: "12 km", price: "₹3.2/kg" },
      { name: "AgriCycle Solutions", distance: "28 km", price: "₹2.9/kg" },
      { name: "BioFuel Industries", distance: "45 km", price: "₹3.5/kg" },
    ],
    schemes: [
      { name: "PKVY", benefit: "Up to ₹15,000/ha subsidy for biochar units" },
      { name: "Goberdhan Scheme", benefit: "50% capital subsidy on biogas plants (max ₹50 lakh)" },
    ],
    discovery: "Current market prices for rice husk are 8% above seasonal average",
  },

  "sugarcane-bagasse": {
    name: "Sugarcane Bagasse",
    defaultQty: 8,
    usableRatio: 0.85,
    knowledge: [
      "Bagasse is a high-fiber byproduct ideal for paper and packaging",
      "Co-generation plants can convert bagasse into 15-20 MW electricity per 100 TPD",
      "Bagasse has calorific value of ~2,300 kcal/kg for fuel applications",
    ],
    alternatives: [
      {
        id: "biochar",
        name: "Biochar Production",
        profitPerTon: 3200,
        sustainability: 82,
        investment: 8000,
        roi: "2.8x",
        timeWeeks: 3,
        difficulty: "Medium",
        confidence: 90,
        reasons: [
          "High fibre content produces quality biochar",
          "Established market demand",
        ],
      },
      {
        id: "direct-sale",
        name: "Direct Sale to Mills",
        profitPerTon: 2400,
        sustainability: 40,
        investment: 300,
        roi: "1.8x",
        timeWeeks: 1,
        difficulty: "Low",
        confidence: 88,
        reasons: [
          "Sugar mills actively purchase bagasse for co-generation",
          "No processing needed",
        ],
      },
      {
        id: "biogas",
        name: "Biogas",
        profitPerTon: 3400,
        sustainability: 94,
        investment: 18000,
        roi: "1.9x",
        timeWeeks: 5,
        difficulty: "High",
        confidence: 84,
        reasons: [
          "High moisture content ideal for anaerobic digestion",
          "Excellent sustainability rating",
        ],
      },
    ],
    buyers: [
      { name: "Shree Renuka Sugars", distance: "15 km", price: "₹2.6/kg" },
      { name: "Bajaj Hindusthan", distance: "35 km", price: "₹2.8/kg" },
      { name: "Triveni Engineering", distance: "50 km", price: "₹3.0/kg" },
    ],
    schemes: [
      { name: "National Bioenergy Programme", benefit: "Capital subsidy up to 40% for cogeneration" },
      { name: "PKVY", benefit: "₹15,000/ha for organic conversion using bagasse compost" },
    ],
    discovery: "Sugar mills reporting higher demand this crushing season",
  },

  "coconut-shell": {
    name: "Coconut Shell",
    defaultQty: 3,
    usableRatio: 0.82,
    knowledge: [
      "Coconut shell charcoal has high carbon content (~85%) ideal for activated carbon",
      "Coconut shells can be processed into high-value handicrafts and buttons",
      "Shell powder is used in mosquito coil and incense stick manufacturing",
    ],
    alternatives: [
      {
        id: "biochar",
        name: "Activated Carbon / Biochar",
        profitPerTon: 5200,
        sustainability: 78,
        investment: 12000,
        roi: "3.5x",
        timeWeeks: 3,
        difficulty: "High",
        confidence: 91,
        reasons: [
          "Highest value product from coconut shells",
          "Activated carbon market growing at 12% CAGR",
        ],
      },
      {
        id: "direct-sale",
        name: "Direct Sale",
        profitPerTon: 3500,
        sustainability: 50,
        investment: 400,
        roi: "2.5x",
        timeWeeks: 1,
        difficulty: "Low",
        confidence: 87,
        reasons: [
          "Ready buyers in coir and handicraft industries",
          "Minimal processing required",
        ],
      },
      {
        id: "compost",
        name: "Coir Pith Composting",
        profitPerTon: 2200,
        sustainability: 72,
        investment: 3000,
        roi: "1.6x",
        timeWeeks: 10,
        difficulty: "Low",
        confidence: 68,
        reasons: [
          "Good entry point for beginners",
          "Growing demand for coir-based growing media",
        ],
      },
    ],
    buyers: [
      { name: "Kerala Coir Corporation", distance: "20 km", price: "₹4.5/kg" },
      { name: "EcoCoir India", distance: "30 km", price: "₹4.0/kg" },
      { name: "Green Carbon Technologies", distance: "55 km", price: "₹5.2/kg" },
    ],
    schemes: [
      { name: "Coir Udyami Yojana", benefit: "25% capital subsidy for coir processing units" },
    ],
    discovery: "Activated carbon prices at 6-month high in export markets",
  },

  "fruit-waste": {
    name: "Fruit Waste",
    defaultQty: 4,
    usableRatio: 0.7,
    knowledge: [
      "Fruit waste is rich in pectin and essential oils for food processing",
      "Citrus peels can be processed into disinfectants and cleaning products",
      "Fruit waste generates high methane yield in biogas plants",
    ],
    alternatives: [
      {
        id: "biogas",
        name: "Biogas",
        profitPerTon: 2900,
        sustainability: 95,
        investment: 12000,
        roi: "2.2x",
        timeWeeks: 3,
        difficulty: "Medium",
        confidence: 88,
        reasons: [
          "High moisture content excellent for digestion",
          "Best environmental score of all options",
        ],
      },
      {
        id: "compost",
        name: "Composting",
        profitPerTon: 1600,
        sustainability: 82,
        investment: 1500,
        roi: "1.4x",
        timeWeeks: 6,
        difficulty: "Low",
        confidence: 76,
        reasons: [
          "Fastest decomposition among waste types",
          "Produces high-quality organic fertilizer",
        ],
      },
      {
        id: "direct-sale",
        name: "Direct Sale",
        profitPerTon: 1200,
        sustainability: 30,
        investment: 200,
        roi: "1.1x",
        timeWeeks: 1,
        difficulty: "Low",
        confidence: 72,
        reasons: [
          "Quick disposal at minimal cost",
          "Limited buyer network compared to other options",
        ],
      },
    ],
    buyers: [
      { name: "Organic Farms Co-op", distance: "10 km", price: "₹1.2/kg" },
      { name: "BioGas Energy Park", distance: "18 km", price: "₹1.5/kg" },
    ],
    schemes: [
      { name: "Waste to Energy Programme", benefit: "Financial assistance up to ₹1 crore for biogas plants" },
      { name: "SWACHH Bharat Mission", benefit: "Support for community composting infrastructure" },
    ],
    discovery: "Fruit waste volumes peak during summer months — plan accordingly",
  },

  "corn-stalks": {
    name: "Corn Stalks",
    defaultQty: 6,
    usableRatio: 0.75,
    knowledge: [
      "Corn stalks contain ~40% cellulose, suitable for bioethanol production",
      "Stalks can be used as cattle feed when properly treated with urea",
      "Corn stover is increasingly used in mushroom cultivation as substrate",
    ],
    alternatives: [
      {
        id: "direct-sale",
        name: "Direct Sale as Fodder",
        profitPerTon: 2200,
        sustainability: 55,
        investment: 400,
        roi: "1.8x",
        timeWeeks: 1,
        difficulty: "Low",
        confidence: 84,
        reasons: [
          "Strong demand from dairy farmers during dry season",
          "Simple logistics and immediate payment",
        ],
      },
      {
        id: "biochar",
        name: "Biochar",
        profitPerTon: 3400,
        sustainability: 80,
        investment: 7000,
        roi: "2.9x",
        timeWeeks: 3,
        difficulty: "Medium",
        confidence: 86,
        reasons: [
          "Good biomass density for pyrolysis",
          "Improving soil structure when applied back to fields",
        ],
      },
      {
        id: "biogas",
        name: "Biogas",
        profitPerTon: 2600,
        sustainability: 88,
        investment: 14000,
        roi: "1.7x",
        timeWeeks: 4,
        difficulty: "Medium",
        confidence: 78,
        reasons: [
          "Reliable methane generation",
          "Digestate can be used as fertilizer",
        ],
      },
    ],
    buyers: [
      { name: "Dairy Farmers Association", distance: "8 km", price: "₹2.0/kg" },
      { name: "BioFuel Processing Unit", distance: "25 km", price: "₹2.4/kg" },
    ],
    schemes: [
      { name: "Ethanol Blending Programme", benefit: "Guaranteed offtake at MSP for bioethanol producers" },
      { name: "National Livestock Mission", benefit: "Subsidy on fodder processing equipment up to 50%" },
    ],
    discovery: "Fodder demand expected to rise 15% this quarter due to dry spell",
  },
};

export function detectWaste(text: string): WasteType {
  const lower = text.toLowerCase();
  if (lower.includes("rice") || lower.includes("husk")) return WASTE_TYPES["rice-husk"];
  if (lower.includes("sugarcane") || lower.includes("bagasse")) return WASTE_TYPES["sugarcane-bagasse"];
  if (lower.includes("coconut") || lower.includes("coconut shell")) return WASTE_TYPES["coconut-shell"];
  if (lower.includes("fruit") || lower.includes("citrus") || lower.includes("banana") || lower.includes("mango")) return WASTE_TYPES["fruit-waste"];
  if (lower.includes("corn") || lower.includes("maize") || lower.includes("stalk") || lower.includes("stover")) return WASTE_TYPES["corn-stalks"];
  return WASTE_TYPES["rice-husk"];
}

export function parseQuantity(text: string): number | null {
  const patterns = [
    /(\d+[.,]?\d*)\s*(?:tonnes?|tons?|t\b)/i,
    /(\d+[.,]?\d*)\s*(?:kg|kilos?)/i,
    /(\d+[.,]?\d*)\s*(?:quintals?)/i,
    /(\d+[.,]?\d*)\s*(?:mt|metric)/i,
    /around\s+(\d+[.,]?\d*)/i,
    /approximately\s+(\d+[.,]?\d*)/i,
    /~(\d+[.,]?\d*)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let val = parseFloat(match[1].replace(",", "."));
      if (pattern.source.includes("kg")) val /= 1000;
      if (pattern.source.includes("quintal")) val /= 10;
      return Math.round(val * 10) / 10;
    }
  }
  return null;
}

export function pickHero(waste: WasteType, priority: string): { alt: (typeof waste.alternatives)[0]; rationale: string } {
  const sorted = [...waste.alternatives];
  switch (priority) {
    case "sustainability":
      sorted.sort((a, b) => b.sustainability - a.sustainability);
      break;
    case "low-investment":
      sorted.sort((a, b) => a.investment - b.investment);
      break;
    case "quick":
      sorted.sort((a, b) => a.timeWeeks - b.timeWeeks);
      break;
    default:
      sorted.sort((a, b) => b.profitPerTon - a.profitPerTon);
  }
  const alt = sorted[0];
  const rationale =
    priority === "sustainability"
      ? "Re-ranked by highest sustainability score"
      : priority === "low-investment"
        ? "Re-ranked by lowest upfront investment"
        : priority === "quick"
          ? "Re-ranked by fastest processing time"
          : "Ranked highest by projected profitability";
  return { alt, rationale };
}
