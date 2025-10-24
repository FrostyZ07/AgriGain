import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Waste logs for tracking farmer's waste data
  wasteLogs: defineTable({
    userId: v.id("users"),
    wasteType: v.string(),
    unitName: v.string(),
    quantity: v.number(),
    totalKg: v.number(),
    region: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_timestamp", ["userId", "timestamp"]),

  // User profiles with region information
  userProfiles: defineTable({
    userId: v.id("users"),
    region: v.string(),
    farmSize: v.optional(v.number()),
    primaryCrops: v.optional(v.array(v.string())),
    contactInfo: v.optional(v.string()),
  })
    .index("by_user", ["userId"]),

  // Knowledge base entries for RAG system
  knowledgeBase: defineTable({
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
    embedding: v.optional(v.array(v.number())),
  })
    .index("by_waste_type", ["wasteType"])
    .index("by_source_type", ["sourceType"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["wasteType", "sourceType"],
    }),

  // Quantification models for converting units to kg
  quantificationModels: defineTable({
    wasteType: v.string(),
    unitName: v.string(),
    avgKgPerUnit: v.number(),
  })
    .index("by_waste_type", ["wasteType"])
    .index("by_waste_and_unit", ["wasteType", "unitName"]),

  // Generated opportunities cache
  opportunities: defineTable({
    wasteLogId: v.id("wasteLogs"),
    userId: v.id("users"),
    opportunitiesText: v.string(),
    structuredOpportunities: v.optional(v.object({
      onFarmUse: v.array(v.string()),
      localSale: v.array(v.string()),
      processAndSell: v.array(v.string()),
    })),
    generatedAt: v.number(),
  })
    .index("by_waste_log", ["wasteLogId"])
    .index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
