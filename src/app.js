import express from "express";
import cors from "cors";
import nftRoutes from "./routes/nftRoutes.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/nfts", nftRoutes);

// Root route (optional)
app.get("/", (req, res) => {
  res.send("Digimint Backend is running 🚀");
});


import authRoutes from "./routes/authRoutes.js";

app.use("/auth", authRoutes);

export default app;
