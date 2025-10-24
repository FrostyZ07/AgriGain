import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const initializeSystem = mutation({
  args: {},
  handler: async (ctx) => {
    const results = {
      quantificationModels: { count: 0, message: "" },
      knowledgeBase: { count: 0, message: "" },
    };

    try {
      // Initialize quantification models
      const quantResult = await ctx.runMutation(internal.quantification.initializeQuantificationModels, {});
      results.quantificationModels = quantResult;

      // Initialize knowledge base
      const kbResult = await ctx.runMutation(internal.knowledgeBase.initializeKnowledgeBase, {});
      results.knowledgeBase = kbResult;

      return {
        success: true,
        message: "System initialized successfully",
        results,
      };
    } catch (error) {
      return {
        success: false,
        message: `Initialization failed: ${error}`,
        results,
      };
    }
  },
});

export const getSystemStatus = mutation({
  args: {},
  handler: async (ctx) => {
    try {
      // Check quantification models
      const quantModels = await ctx.db.query("quantificationModels").collect();
      
      // Check knowledge base
      const kbEntries = await ctx.db.query("knowledgeBase").collect();
      
      // Check user data
      const users = await ctx.db.query("users").collect();
      const wasteLogs = await ctx.db.query("wasteLogs").collect();
      const opportunities = await ctx.db.query("opportunities").collect();

      return {
        quantificationModels: quantModels.length,
        knowledgeBaseEntries: kbEntries.length,
        totalUsers: users.length,
        totalWasteLogs: wasteLogs.length,
        totalOpportunities: opportunities.length,
        systemReady: quantModels.length > 0 && kbEntries.length > 0,
      };
    } catch (error) {
      return {
        error: `Failed to get system status: ${error}`,
        systemReady: false,
      };
    }
  },
});
