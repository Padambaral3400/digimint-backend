import { db } from "../../config/firebase.js";

/**
 * 🔹 GET claim history by wallet
 * 🔒 Protected (JWT required)
 * GET /rewards/history/:wallet
 */
export const getClaimHistory = async (req, res) => {
  try {
    const { wallet } = req.params;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: "Wallet parameter is required"
      });
    }

    // 🔐 Wallet mismatch protection (JWT vs param)
    if (wallet.toLowerCase() !== req.user.wallet) {
      return res.status(403).json({
        success: false,
        error: "Wallet mismatch"
      });
    }

    const snapshot = await db
      .collection("claimHistory")
      .where("wallet", "==", wallet.toLowerCase())
      .orderBy("claimedAt", "desc")
      .limit(100) // 🛡️ abuse protection
      .get();

    const history = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      history.push({
        id: doc.id,
        wallet: data.wallet,
        tokenId: data.tokenId,
        reward: data.reward,
        txHash: data.txHash || null,
        claimedAt: data.claimedAt
          ? new Date(data.claimedAt)
          : null
      });
    });

    res.json({
      success: true,
      count: history.length,
      items: history
    });

  } catch (err) {
    console.error("Claim history error:", err);

    res.status(500).json({
      success: false,
      error: "Failed to load claim history"
    });
  }
};