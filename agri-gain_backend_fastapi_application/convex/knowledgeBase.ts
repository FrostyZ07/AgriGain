import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Sample knowledge base data
const SAMPLE_KNOWLEDGE_BASE = [
  {
    sourceType: "how_to_guide" as const,
    wasteType: "rice_straw",
    title: "Growing Oyster Mushrooms on Rice Straw",
    content: "Learn how to cultivate oyster mushrooms using rice straw as substrate. Collect fresh rice straw and chop into 2-3 inch pieces. Soak straw in water for 24 hours to soften. Steam sterilize the straw for 1 hour to kill harmful microorganisms. Cool the straw to room temperature. Inoculate with oyster mushroom spawn at 2-3% rate. Pack in plastic bags with air holes. Maintain 80-85% humidity and 25-28°C temperature. Harvest mushrooms after 10-15 days.",
    metadata: {
      region: "general",
      difficulty: "medium",
    },
  },
  {
    sourceType: "how_to_guide" as const,
    wasteType: "rice_straw",
    title: "Making Compost from Rice Straw",
    content: "Convert rice straw into nutrient-rich compost for your crops. Chop rice straw into small pieces (1-2 inches). Create layers: straw, green materials (kitchen waste), soil. Maintain 3:1 ratio of brown (straw) to green materials. Add water to maintain 50-60% moisture. Turn the pile every 2 weeks. Monitor temperature (should reach 140-160°F). Compost is ready in 3-4 months when dark and crumbly.",
    metadata: {
      region: "general",
      difficulty: "easy",
    },
  },
  {
    sourceType: "market_data" as const,
    wasteType: "rice_straw",
    title: "Rice Straw Market Price - Punjab",
    content: "Market price for rice_straw as paper_pulp in punjab region: $0.15 per kilogram. Source: Punjab Paper Mills Association. Last updated: 2024-01-15.",
    metadata: {
      region: "punjab",
      pricePerKg: 0.15,
      source: "Punjab Paper Mills Association",
    },
  },
  {
    sourceType: "market_data" as const,
    wasteType: "wheat_straw",
    title: "Wheat Straw Market Price - UP",
    content: "Market price for wheat_straw as paper_pulp in uttar_pradesh region: $0.18 per kilogram. Source: UP Pulp and Paper Mills. Last updated: 2024-01-12.",
    metadata: {
      region: "uttar_pradesh",
      pricePerKg: 0.18,
      source: "UP Pulp and Paper Mills",
    },
  },
  {
    sourceType: "safety_sheet" as const,
    wasteType: "rice_straw",
    title: "Rice Straw Safety Guidelines",
    content: "SAFETY GUIDELINES FOR RICE STRAW HANDLING: Always wear protective gloves when handling rice straw to prevent cuts from sharp edges. Use dust masks to avoid inhaling particles. Store in dry areas to prevent mold growth. When burning (where permitted), ensure proper ventilation and fire safety measures. Avoid handling wet straw as it can harbor harmful bacteria. Keep straw away from electrical equipment to prevent fire hazards.",
    metadata: {
      source: "Agricultural Safety Board",
    },
  },
  {
    sourceType: "buyer_directory" as const,
    wasteType: "rice_straw",
    title: "Punjab Paper Mills Ltd",
    content: "Buyer: Punjab Paper Mills Ltd in punjab region. Accepts waste types: rice_straw, wheat_straw. Contact information: contact@punjabpaper.com, +91-161-2345678.",
    metadata: {
      region: "punjab",
      contactInfo: "contact@punjabpaper.com, +91-161-2345678",
    },
  },
];

export const initializeKnowledgeBase = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if knowledge base already exists
    const existing = await ctx.db.query("knowledgeBase").first();
    if (existing) {
      return { message: "Knowledge base already initialized", count: 0 };
    }

    // Insert sample data
    let count = 0;
    for (const entry of SAMPLE_KNOWLEDGE_BASE) {
      await ctx.db.insert("knowledgeBase", entry);
      count++;
    }

    return { message: "Knowledge base initialized", count };
  },
});

export const searchKnowledgeBase = query({
  args: {
    query: v.string(),
    wasteType: v.optional(v.string()),
    sourceType: v.optional(
      v.union(
        v.literal("how_to_guide"),
        v.literal("market_data"),
        v.literal("safety_sheet"),
        v.literal("buyer_directory")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    // Build search query
    let searchQuery = ctx.db.query("knowledgeBase").withSearchIndex("search_content", (q) => {
      let query = q.search("content", args.query);
      
      if (args.wasteType) {
        query = query.eq("wasteType", args.wasteType);
      }
      
      if (args.sourceType) {
        query = query.eq("sourceType", args.sourceType);
      }
      
      return query;
    });

    const results = await searchQuery.take(limit);
    return results;
  },
});

export const getKnowledgeByWasteType = query({
  args: {
    wasteType: v.string(),
    sourceType: v.optional(
      v.union(
        v.literal("how_to_guide"),
        v.literal("market_data"),
        v.literal("safety_sheet"),
        v.literal("buyer_directory")
      )
    ),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("knowledgeBase")
      .withIndex("by_waste_type", (q) => q.eq("wasteType", args.wasteType));

    if (args.sourceType) {
      const results = await query.collect();
      return results.filter((r) => r.sourceType === args.sourceType);
    }

    return await query.collect();
  },
});

export const addKnowledgeEntry = mutation({
  args: {
    sourceType: v.union(
      v.literal("how_to_guide"),
      v.literal("market_data"),
      v.literal("safety_sheet"),
      v.literal("buyer_directory")
    ),
    wasteType: v.string(),
    title: v.string(),
    content: v.string(),
    metadata: v.object({
      region: v.optional(v.string()),
      difficulty: v.optional(v.string()),
      pricePerKg: v.optional(v.number()),
      contactInfo: v.optional(v.string()),
      source: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const entryId = await ctx.db.insert("knowledgeBase", args);
    return { entryId, success: true };
  },
});
