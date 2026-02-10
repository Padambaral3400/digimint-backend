  import { db } from "../../config/firebase.js";
import { sendUSDT } from "../../utils/polygonUsdtTransfer.js";
import { verifyNFTOwnership } from "../nft/verifyNFTOwnership.js";

// Constants
const LOCK_TTL = 60 * 1000; // 1 minute
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000; // 24h
const MIN_REWARD = 0.00002;
const MAX_REWARD = 1; // max 1 USDT per NFT
const MIN_HOLD_TIME = 4 * 24 * 60 * 60 * 1000; // 4 days
const DAILY_PAYOUT_CAP = 1000; // Max USDT per day

export const claimReward = async (wallet) => {
  const lockRef = db.collection("claimLocks").doc(wallet);

  // ---------------- 1️⃣ CLAIM LOCK ----------------
  await db.runTransaction(async (tx) => {
    const lock = await tx.get(lockRef);
    if (lock.exists) {
      const age = Date.now() - lock.data().lockedAt;
      if (age < LOCK_TTL) throw new Error("Claim already in progress");
    }
    tx.set(lockRef, { lockedAt: Date.now() });
  });

  let totalReward = 0;
  const claimItems = [];

  try {
    // ---------------- 2️⃣ LOAD USER NFTs FROM FIREBASE ----------------
    const nftSnap = await db
      .collection("nfts")
      .where("owner", "==", wallet)
      .get();

    if (nftSnap.empty) {
      throw new Error("No NFTs found");
    }

    // ---------------- 3️⃣ REWARD CALC ----------------
    for (const doc of nftSnap.docs) {
      const nft = doc.data();

      // 3a️⃣ ✅ Check on-chain ownership
      const isOwner = await verifyNFTOwnership({
        contract: nft.contract,
        tokenId: nft.tokenId,
        wallet,
        standard: nft.standard,
      });
      if (!isOwner) continue; // NFT sold → skip reward

      // 3b️⃣ Check minimum hold time
      const purchasedAt = nft.purchasedAt || Date.now();
      if (Date.now() - purchasedAt < MIN_HOLD_TIME) continue;

      // 3c️⃣ Already claimed by this user?
      const userRewardDoc = await db
        .collection("claimHistory")
        .where("wallet", "==", wallet)
        .where("tokenId", "==", nft.tokenId)
        .get();
      if (!userRewardDoc.empty) continue;

      // 3d️⃣ Cooldown per NFT
      const lastClaimed = nft.lastClaimedAt || 0;
      if (Date.now() - lastClaimed < DAILY_COOLDOWN) continue;

      // 3e️⃣ Calculate reward with decrease factor
      let baseReward = MAX_REWARD;
      const purchaseCount = nft.purchaseCount || 1;
      let decreaseFactor = Math.pow(0.8, purchaseCount - 1);
      let reward = baseReward * decreaseFactor;
      if (reward < MIN_REWARD) reward = MIN_REWARD;

      totalReward += reward;

      claimItems.push({
        nftRef: doc.ref,
        tokenId: nft.tokenId,
        reward,
        purchaseCount,
      });
    }

    if (totalReward <= 0) throw new Error("Nothing to claim");

    totalReward = Number(totalReward.toFixed(6));

    // ---------------- 4️⃣ DAILY PAYOUT CAP ----------------
    const statsRef = db.collection("systemStats").doc("dailyPayout");
    await db.runTransaction(async (tx) => {
      const stats = await tx.get(statsRef);
      const today = new Date().toISOString().slice(0, 10);
      const data = stats.exists ? stats.data() : { date: today, total: 0 };

      if (data.date !== today) {
        data.date = today;
        data.total = 0;
      }

      if (data.total + totalReward > DAILY_PAYOUT_CAP) {
        throw new Error("Daily payout limit reached");
      }

      data.total += totalReward;
      tx.set(statsRef, data);
    });

    // ---------------- 5️⃣ CREATE CLAIM ----------------
    const claimRef = await db.collection("claims").add({
      wallet,
      amount: totalReward,
      status: "PENDING",
      createdAt: Date.now(),
    });

    // ---------------- 6️⃣ SEND USDT (Gasless) ----------------
    let txHash;
    try {
      txHash = await sendUSDT(wallet, totalReward);
    } catch (e) {
      await claimRef.update({ status: "FAILED", error: e.message });
      throw new Error("USDT transfer failed");
    }

    // ---------------- 7️⃣ FINALIZE SUCCESS ----------------
    const batch = db.batch();
    for (const item of claimItems) {
      batch.update(item.nftRef, {
        lastClaimedAt: Date.now(),
        purchaseCount: item.purchaseCount + 1,
      });

      batch.set(db.collection("claimHistory").doc(), {
        wallet,
        tokenId: item.tokenId,
        reward: item.reward,
        claimedAt: Date.now(),
        txHash,
      });
    }

    batch.update(claimRef, { status: "COMPLETED", txHash });
    await batch.commit();

    return { wallet, totalReward, txHash, claimedNFTs: claimItems.length };
  } finally {
    // ---------------- 8️⃣ RELEASE LOCK ----------------
    await lockRef.delete();
  }
};
