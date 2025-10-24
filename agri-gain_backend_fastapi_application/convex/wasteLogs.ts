import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const logWaste = mutation({
  args: {
    wasteType: v.string(),
    unitName: v.string(),
    quantity: v.number(),
    region: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Calculate total kg using quantification model
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

    // Get user's region if not provided
    let region = args.region;
    if (!region) {
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      region = userProfile?.region || "general";
    }

    // Create waste log
    const wasteLogId = await ctx.db.insert("wasteLogs", {
      userId,
      wasteType: args.wasteType,
      unitName: args.unitName,
      quantity: args.quantity,
      totalKg: Math.round(totalKg * 100) / 100,
      region,
      timestamp: Date.now(),
    });

    return {
      success: true,
      wasteLogId,
      estimatedKg: Math.round(totalKg * 100) / 100,
    };
  },
});

export const getUserWasteLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const limit = args.limit || 50;
    const logs = await ctx.db
      .query("wasteLogs")
      .withIndex("by_user_and_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return logs;
  },
});

export const getWasteLog = query({
  args: {
    wasteLogId: v.id("wasteLogs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const wasteLog = await ctx.db.get(args.wasteLogId);
    if (!wasteLog) {
      throw new Error("Waste log not found");
    }

    // Verify ownership
    if (wasteLog.userId !== userId) {
      throw new Error("Access denied");
    }

    return wasteLog;
  },
});

export const getWasteStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const logs = await ctx.db
      .query("wasteLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const stats = {
      totalLogs: logs.length,
      totalKg: logs.reduce((sum, log) => sum + log.totalKg, 0),
      wasteTypeBreakdown: {} as Record<string, { count: number; totalKg: number }>,
      recentActivity: logs
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5),
    };

    // Calculate waste type breakdown
    logs.forEach((log) => {
      if (!stats.wasteTypeBreakdown[log.wasteType]) {
        stats.wasteTypeBreakdown[log.wasteType] = { count: 0, totalKg: 0 };
      }
      stats.wasteTypeBreakdown[log.wasteType].count++;
      stats.wasteTypeBreakdown[log.wasteType].totalKg += log.totalKg;
    });

    return stats;
  },
});
