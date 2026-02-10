import { ethers } from "ethers";
import jwt from "jsonwebtoken";

// ✅ Nonce store now uses Firestore instead of memory
import { db } from "../../config/firebase.js";

const NONCE_TTL = 5 * 60 * 1000; // 5 minutes

export const requestNonce = async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "No address provided" });

  const nonce = Math.floor(Math.random() * 1000000).toString();

  // Save nonce in Firestore with expiry
  await db.collection("nonces").doc(address.toLowerCase()).set({
    nonce,
    createdAt: Date.now()
  });

  res.json({ nonce });
};

export const verifyWallet = async (req, res) => {
  const { address, signature } = req.body;

  const doc = await db.collection("nonces").doc(address.toLowerCase()).get();
  if (!doc.exists) return res.status(400).json({ error: "No nonce found" });

  const { nonce, createdAt } = doc.data();

  if (Date.now() - createdAt > NONCE_TTL) {
    await db.collection("nonces").doc(address.toLowerCase()).delete();
    return res.status(400).json({ error: "Nonce expired" });
  }

  try {
    const signer = ethers.verifyMessage(`Login nonce: ${nonce}`, signature);
    if (signer.toLowerCase() !== address.toLowerCase())
      return res.status(401).json({ error: "Invalid signature" });

    // Auth success, generate token with expiry
    const token = jwt.sign(
      { wallet: address.toLowerCase() },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // ✅ JWT expiry added
    );

    await db.collection("nonces").doc(address.toLowerCase()).delete(); // one-time use
    res.json({ success: true, address, token });
  } catch (err) {
    res.status(400).json({ error: "Verification failed" });
  }
};
