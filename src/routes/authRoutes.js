import express from "express";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import rateLimit from "express-rate-limit";

const router = express.Router();

// 🧠 In-memory nonce store (prod me DB use karo)
const nonces = {};

/**
 * 🔐 Rate limiter (IPv6 safe)
 */
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // wallet based limit + fallback IP (IPv6 safe)
    return (
      req.body?.wallet?.toLowerCase() ||
      rateLimit.ipKeyGenerator(req)
    );
  },
});

/**
 * 🔹 Generate nonce
 * POST /auth/nonce
 * body: { wallet }
 */
router.post("/nonce", (req, res) => {
  const { wallet } = req.body;

  if (!wallet) {
    return res.status(400).json({
      success: false,
      error: "Wallet required",
    });
  }

  const nonce = Math.floor(100000 + Math.random() * 900000); // 6-digit
  nonces[wallet.toLowerCase()] = nonce;

  res.json({
    success: true,
    nonce,
    message: "Sign this nonce to login",
  });
});

/**
 * 🔹 Verify signature + issue JWT
 * POST /auth/verify
 * body: { wallet, signature }
 */
router.post("/verify", loginLimiter, async (req, res) => {
  try {
    const { wallet, signature } = req.body;

    if (!wallet || !signature) {
      return res.status(400).json({
        success: false,
        error: "Wallet & signature required",
      });
    }

    const nonce = nonces[wallet.toLowerCase()];
    if (!nonce) {
      return res.status(400).json({
        success: false,
        error: "Nonce expired or not found. Request new nonce.",
      });
    }

    const message = `Login nonce: ${nonce}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== wallet.toLowerCase()) {
      return res.status(401).json({
        success: false,
        error: "Invalid signature",
      });
    }

    // ✅ JWT issue
    const token = jwt.sign(
      { wallet: wallet.toLowerCase() },
      process.env.JWT_SECRET || "digimint_secret",
      { expiresIn: "24h" }
    );

    // 🔥 Nonce single-use
    delete nonces[wallet.toLowerCase()];

    res.json({
      success: true,
      token,
      wallet: wallet.toLowerCase(),
    });
  } catch (error) {
    console.error("Auth verify error:", error);
    res.status(500).json({
      success: false,
      error: "Verification failed",
    });
  }
});

export default router;
