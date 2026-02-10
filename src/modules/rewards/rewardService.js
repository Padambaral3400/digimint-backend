import { db } from "../../config/firebase.js";
import { sendUSDT } from "../../utils/polygonUsdtTransfer.js";

/* =====================================================
   🔒 Constants
===================================================== */
const MAX_REWARD = 1; // 1 USDT max per NFT
const MIN_REWARD = 0.00002;
const MIN_HOLD_TIME = 4 * 24 * 60 * 60 * 1000; // 4 days

/* =====================================================
   🔹 Rate Limiting (in-memory)
   - /claim → 1 per 10 min per wallet
   - /login → 5 per hour per wallet
===================================================== */
const claimRateLimit = {};
const loginRateLimit = {};

/**
 * ⏱ Claim rate limit
 */
export const isClaimAllowed = (wallet) => {
  const key = wallet.toLowerCase();
  const now = Date.now();

  if (!claimRateLimit[key] || now - claimRateLimit[key] > 10 * 60 * 1000) {
    claimRateLimit[key] = now;
    return true;
  }
  return false;
};

/**
 * 🔐 Login rate limit
 */
export const isLoginAllowed = (wallet) => {
  const key = wallet.toLowerCase();
  const now = Date.now();

  if (!loginRateLimit[key]) loginRateLimit[key] = [];

  // Remove expired attempts (> 1 hour)
  loginRateLimit[key] = loginRateLimit[key].filter(
    (ts) => now - ts < 60 * 60 * 1000
  );

  if (loginRateLimit[key].length >= 5) return false;

  loginRateLimit[key].push(now);
  return true;
};

/* =====================================================
   1️⃣ GET USER TOTAL REWARD (Dashboard)
===================================================== */
export const getUserReward = async (wallet) => {
  const walletLc = wallet.toLowerCase();

  const nftSnap = await db
    .collection("nfts")
    .where("owner", "==", walletLc)
    .get();

  let totalReward = 0;

  for (const doc of nftSnap.docs) {
    const nft = doc.data();

    /* ⏳ HOLD TIME CHECK */
    const purchasedAt = nft.purchasedAt || 0;
    if (Date.now() - purchasedAt < MIN_HOLD_TIME) continue;

    /* 🔁 ONE-TIME REWARD PER USER PER NFT */
    const alreadyClaimed = await db
      .collection("claimHistory")
      .where("wallet", "==", walletLc)
      .where("contract", "==", nft.contract)
      .where("tokenId", "==", nft.tokenId)
      .limit(1)
      .get();

    if (!alreadyClaimed.empty) continue;

    /* 📉 REWARD DECAY LOGIC */
    const purchaseCount = nft.purchaseCount || 1;
    const decayFactor = Math.pow(0.8, purchaseCount - 1);

    let reward = MAX_REWARD * decayFactor;
    if (reward < MIN_REWARD) reward = MIN_REWARD;

    totalReward += reward;
  }

  return Number(totalReward.toFixed(6));
};

/* =====================================================
   2️⃣ CLAIM REWARD (Gasless)
===================================================== */
export const claimRewards = async (wallet) => {
  const walletLc = wallet.toLowerCase();

  // 🚨 Emergency Kill Switch
  if (process.env.CLAIMS_DISABLED === "true") {
    throw new Error("Claims are temporarily paused 🚨");
  }

  // ⏱ Rate limit
  if (!isClaimAllowed(walletLc)) {
    throw new Error("⏱ Claim limit reached. Try after 10 minutes");
  }

  const reward = await getUserReward(walletLc);

  if (reward <= 0) {
    throw new Error("Nothing to claim");
  }

  /* 💸 GASLESS USDT TRANSFER */
  let txHash;
  try {
    txHash = await sendUSDT(walletLc, reward);
  } catch (err) {
    console.error("USDT transfer failed:", err.message);
    throw new Error("USDT transfer failed");
  }

  /* 🧾 SAVE CLAIM HISTORY */
  await db.collection("claimHistory").add({
    wallet: walletLc,
    amount: reward,
    txHash,
    claimedAt: Date.now(),
  });

  return {
    wallet: walletLc,
    reward,
    txHash,
  };
};
