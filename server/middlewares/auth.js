import { clerkClient } from "@clerk/express";

// Middleware to check userID and plan
export const auth = async (req, res, next) => {
  try {
    const { userId, has } = await req.auth(); // ✅ call function
    const hasPremiumPlan = await has({ plan: 'premium' });

    const user = await clerkClient.users.getUser(userId);

    if (!hasPremiumPlan) {
      req.free_usage = user.privateMetadata?.free_usage || 0;
    } else {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          ...user.privateMetadata,
          free_usage: 0
        }
      });
      req.free_usage = 0;
    }

    req.plan = hasPremiumPlan ? 'premium' : 'free';
    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
