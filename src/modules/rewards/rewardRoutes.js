import express from "express";
import {
  claimRewards,
  isClaimAllowed,
  getUserReward,
} from "./rewardService.js";
import { getClaimHistory } from "./claimHistory.js";
import { auth } from "../auth/authMiddleware.js";

const router = express.Router();

/**
 * =====================================================
 * 🔹 Get pending reward (Dashboard)
 * 🔒 Protected (JWT required)
 * GET /rewards/:wallet
 * =====================================================
 */
router.get("/:wallet", auth, async (req, res) => {
  try {
    const { wallet } = req.params;

    // 🔐 Wallet mismatch protection
    if (wallet.toLowerCase() !== req.user.wallet) {
      return res.status(403).json({
        success: false,
        error: "Wallet mismatch",
      });
    }

    const reward = await getUserReward(wallet);

    res.json({
      success: true,
      wallet,
      reward,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * =====================================================
 * 🔹 Claim reward (Gasless)
 * 🔒 Protected (JWT required)
 * POST /rewards/claim
 * =====================================================
 */
router.post("/claim", auth, async (req, res) => {
  try {
    const { wallet } = req.body;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: "Wallet required",
      });
    }

    // 🔐 Wallet mismatch protection
    if (wallet.toLowerCase() !== req.user.wallet) {
      return res.status(403).json({
        success: false,
        error: "Wallet mismatch",
      });
    }

    // 🚨 Emergency Kill Switch (Mainnet safety)
    if (process.env.CLAIMS_DISABLED === "true") {
      return res.status(503).json({
        success: false,
        error: "Claims are temporarily paused 🚨",
      });
    }

    // ⏱ Rate Limiting (1 claim / 10 min / wallet)
    if (!isClaimAllowed(wallet.toLowerCase())) {
      return res.status(429).json({
        success: false,
        error: "⏱ Claim limit reached. Try after 10 minutes",
      });
    }

    const result = await claimRewards(wallet);

    res.json({
      success: true,
      result,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * =====================================================
 * 🔹 Claim history
 * 🔒 Protected (JWT required)
 * GET /rewards/history/:wallet
 * =====================================================
 */
router.get("/history/:wallet", auth, async (req, res) => {
  try {
    const { wallet } = req.params;

    // 🔐 Wallet mismatch protection
    if (wallet.toLowerCase() !== req.user.wallet) {
      return res.status(403).json({
        success: false,
        error: "Wallet mismatch",
      });
    }

    await getClaimHistory(req, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
