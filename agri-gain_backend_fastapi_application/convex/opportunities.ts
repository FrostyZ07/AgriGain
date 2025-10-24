import { action, mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

export const generateOpportunities = action({
  args: {
    wasteLogId: v.id("wasteLogs"),
  },
  handler: async (ctx, args): Promise<{ opportunityId: any; opportunitiesText: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Get waste log details
    const wasteLog = await ctx.runQuery(api.wasteLogs.getWasteLog, {
      wasteLogId: args.wasteLogId,
    });

    if (!wasteLog) {
      throw new Error("Waste log not found");
    }

    // Get user profile for region
    const userProfile = await ctx.runQuery(api.userProfiles.getUserProfile);
    const region = userProfile?.region || wasteLog.region || "general";

    // Search knowledge base for relevant information
    const searchQueries = [
      `how to use ${wasteLog.wasteType}`,
      `market price ${wasteLog.wasteType}`,
      `safety ${wasteLog.wasteType}`,
      `buyers ${wasteLog.wasteType}`,
    ];

    let contextChunks: string[] = [];

    for (const query of searchQueries) {
      try {
        const results = await ctx.runQuery(api.knowledgeBase.searchKnowledgeBase, {
          query,
          wasteType: wasteLog.wasteType,
          limit: 3,
        });

        contextChunks.push(...results.map((r: any) => r.content));
      } catch (error) {
        console.warn(`Search failed for query: ${query}`, error);
      }
    }

    // Remove duplicates and limit context
    const uniqueChunks = [...new Set(contextChunks)];
    const context = uniqueChunks.slice(0, 8).join("\n\n");

    // Generate opportunities using AI or fallback
    let opportunitiesText: string;

    try {
      // Try to use AI if available
      opportunitiesText = await generateWithAI(wasteLog, region, context);
    } catch (error) {
      console.warn("AI generation failed, using fallback", error);
      opportunitiesText = generateFallbackOpportunities(wasteLog, region);
    }

    // Save opportunities to database
    const opportunityId: any = await ctx.runMutation(internal.opportunities.saveOpportunities, {
      wasteLogId: args.wasteLogId,
      userId,
      opportunitiesText,
    });

    return {
      opportunityId,
      opportunitiesText,
    };
  },
});

export const saveOpportunities = internalMutation({
  args: {
    wasteLogId: v.id("wasteLogs"),
    userId: v.id("users"),
    opportunitiesText: v.string(),
    structuredOpportunities: v.optional(v.object({
      onFarmUse: v.array(v.string()),
      localSale: v.array(v.string()),
      processAndSell: v.array(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const opportunityId = await ctx.db.insert("opportunities", {
      wasteLogId: args.wasteLogId,
      userId: args.userId,
      opportunitiesText: args.opportunitiesText,
      structuredOpportunities: args.structuredOpportunities,
      generatedAt: Date.now(),
    });

    return opportunityId;
  },
});

export const getOpportunities = query({
  args: {
    wasteLogId: v.id("wasteLogs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const opportunity = await ctx.db
      .query("opportunities")
      .withIndex("by_waste_log", (q) => q.eq("wasteLogId", args.wasteLogId))
      .first();

    if (!opportunity) {
      return null;
    }

    // Verify ownership
    if (opportunity.userId !== userId) {
      throw new Error("Access denied");
    }

    return opportunity;
  },
});

export const getUserOpportunities = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const limit = args.limit || 20;
    const opportunities = await ctx.db
      .query("opportunities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return opportunities;
  },
});

// Helper functions
async function generateWithAI(wasteLog: any, region: string, context: string): Promise<string> {
  // This would integrate with Google Gemini API
  // For now, we'll use a mock implementation
  throw new Error("AI integration not implemented in this demo");
}

function generateFallbackOpportunities(wasteLog: any, region: string): string {
  const { wasteType, totalKg } = wasteLog;

  return `**Opportunities for ${totalKg} kg of ${wasteType} in ${region}**

**On-Farm Use:**
• Use as mulch around crops to retain soil moisture and suppress weeds
• Compost with kitchen waste and manure to create organic fertilizer
• Use as bedding material for livestock (if available)
• Create natural windbreaks or erosion control barriers

**Local Sale:**
• Contact local paper mills - they often purchase agricultural waste as raw material
• Sell to mushroom farmers who need substrate material for cultivation
• Check with local biomass energy plants for fuel material
• Approach organic fertilizer manufacturers

**Process & Sell:**
• Create compressed bales for easier transport and higher market value
• Process into biochar for soil amendment (requires pyrolysis setup)
• Make handicrafts or eco-friendly packaging materials
• Develop value-added products like natural fiber boards

**Estimated Value:**
Based on current market rates, your ${totalKg} kg of ${wasteType} could be worth $${(totalKg * 0.12).toFixed(2)} - $${(totalKg * 0.25).toFixed(2)} depending on processing and market conditions.

**Next Steps:**
1. Research local buyers in your area
2. Consider forming a cooperative with other farmers for better pricing
3. Explore processing options to add value
4. Ensure proper storage to maintain quality

*Note: This is a basic analysis. For AI-powered, personalized recommendations based on current market data, please ensure proper API configuration.*`;
}
