import express from "express";
import { fetchDigimintNFTs } from "../modules/nft/nftTracker.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { cursor } = req.query;
    const data = await fetchDigimintNFTs(cursor);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
