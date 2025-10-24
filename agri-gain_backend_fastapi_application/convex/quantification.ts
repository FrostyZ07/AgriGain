import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Default quantification models
const DEFAULT_MODELS = [
  { wasteType: "rice_straw", unitName: "bundle", avgKgPerUnit: 2.5 },
  { wasteType: "rice_straw", unitName: "bag", avgKgPerUnit: 15.0 },
  { wasteType: "rice_straw", unitName: "acre", avgKgPerUnit: 2500.0 },
  { wasteType: "corn_husks", unitName: "bundle", avgKgPerUnit: 1.8 },
  { wasteType: "corn_husks", unitName: "bag", avgKgPerUnit: 12.0 },
  { wasteType: "corn_husks", unitName: "acre", avgKgPerUnit: 1800.0 },
  { wasteType: "wheat_straw", unitName: "bundle", avgKgPerUnit: 3.0 },
  { wasteType: "wheat_straw", unitName: "bag", avgKgPerUnit: 18.0 },
  { wasteType: "wheat_straw", unitName: "acre", avgKgPerUnit: 3000.0 },
  { wasteType: "sugarcane_bagasse", unitName: "bundle", avgKgPerUnit: 4.0 },
  { wasteType: "sugarcane_bagasse", unitName: "bag", avgKgPerUnit: 25.0 },
  { wasteType: "sugarcane_bagasse", unitName: "ton", avgKgPerUnit: 1000.0 },
  { wasteType: "coconut_coir", unitName: "bundle", avgKgPerUnit: 1.5 },
  { wasteType: "coconut_coir", unitName: "bag", avgKgPerUnit: 10.0 },
  { wasteType: "coconut_coir", unitName: "cubic_meter", avgKgPerUnit: 80.0 },
];

export const initializeQuantificationModels = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if models already exist
    const existingModels = await ctx.db.query("quantificationModels").first();
    if (existingModels) {
      return { message: "Models already initialized", count: 0 };
    }

    // Insert default models
    let count = 0;
    for (const model of DEFAULT_MODELS) {
      await ctx.db.insert("quantificationModels", model);
      count++;
    }

    return { message: "Quantification models initialized", count };
  },
});

export const getQuantificationModel = query({
  args: {
    wasteType: v.string(),
    unitName: v.string(),
  },
  handler: async (ctx, args) => {
    const model = await ctx.db
      .query("quantificationModels")
      .withIndex("by_waste_and_unit", (q) =>
        q.eq("wasteType", args.wasteType).eq("unitName", args.unitName)
      )
      .first();

    return model;
  },
});

export const calculateKg = query({
  args: {
    wasteType: v.string(),
    unitName: v.string(),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const model = await ctx.db
      .query("quantificationModels")
      .withIndex("by_waste_and_unit", (q) =>
        q.eq("wasteType", args.wasteType).eq("unitName", args.unitName)
      )
      .first();

    if (!model) {
      throw new Error(
        `No quantification model found for ${args.wasteType} in ${args.unitName}`
      );
    }

    const totalKg = model.avgKgPerUnit * args.quantity;
    return {
      totalKg: Math.round(totalKg * 100) / 100, // Round to 2 decimal places
      avgKgPerUnit: model.avgKgPerUnit,
    };
  },
});

export const getAvailableWasteTypes = query({
  args: {},
  handler: async (ctx) => {
    const models = await ctx.db.query("quantificationModels").collect();
    const wasteTypes = [...new Set(models.map((m) => m.wasteType))];
    return wasteTypes.sort();
  },
});

export const getAvailableUnits = query({
  args: {
    wasteType: v.string(),
  },
  handler: async (ctx, args) => {
    const models = await ctx.db
      .query("quantificationModels")
      .withIndex("by_waste_type", (q) => q.eq("wasteType", args.wasteType))
      .collect();

    return models.map((m) => ({
      unitName: m.unitName,
      avgKgPerUnit: m.avgKgPerUnit,
    }));
  },
});
