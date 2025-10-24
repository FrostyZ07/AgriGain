import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const createOrUpdateProfile = mutation({
  args: {
    region: v.string(),
    farmSize: v.optional(v.number()),
    primaryCrops: v.optional(v.array(v.string())),
    contactInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Check if profile exists
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        region: args.region,
        farmSize: args.farmSize,
        primaryCrops: args.primaryCrops,
        contactInfo: args.contactInfo,
      });
      return { profileId: existingProfile._id, updated: true };
    } else {
      // Create new profile
      const profileId = await ctx.db.insert("userProfiles", {
        userId,
        region: args.region,
        farmSize: args.farmSize,
        primaryCrops: args.primaryCrops,
        contactInfo: args.contactInfo,
      });
      return { profileId, updated: false };
    }
  },
});

export const getUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return profile;
  },
});

export const getAvailableRegions = query({
  args: {},
  handler: async (ctx) => {
    // Return common Indian agricultural regions
    return [
      "punjab",
      "haryana",
      "uttar_pradesh",
      "bihar",
      "west_bengal",
      "maharashtra",
      "gujarat",
      "rajasthan",
      "madhya_pradesh",
      "karnataka",
      "andhra_pradesh",
      "telangana",
      "tamil_nadu",
      "kerala",
      "odisha",
      "jharkhand",
      "chhattisgarh",
      "assam",
      "general",
    ].sort();
  },
});
