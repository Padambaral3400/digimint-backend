import dotenv from "dotenv";
dotenv.config();

export const config = {
  PORT: process.env.PORT || 5000,
  POLYGON_RPC: process.env.POLYGON_RPC,
  POLYGON_PRIVATE_KEY: process.env.POLYGON_PRIVATE_KEY,
  USDT_ADDRESS: process.env.USDT_POLYGON_ADDRESS
};
