import { ethers } from "ethers";
import { config } from "../config/env.js";

const abi = [
  "function transfer(address to, uint amount) returns (bool)"
];

const provider = new ethers.JsonRpcProvider(config.POLYGON_RPC);
const wallet = new ethers.Wallet(config.POLYGON_PRIVATE_KEY, provider);
const usdt = new ethers.Contract(config.USDT_ADDRESS, abi, wallet);

/**
 * ✅ Sends USDT to the given wallet
 * @param {string} to - recipient wallet address
 * @param {number} amount - amount in USDT
 * @returns {string} txHash
 */
export const sendUSDT = async (to, amount) => {
  try {
    const decimals = 6; // USDT decimals
    const value = ethers.parseUnits(amount.toString(), decimals);

    const tx = await usdt.transfer(to, value);
    await tx.wait();

    console.log(`✅ USDT sent: ${amount} to ${to} | txHash: ${tx.hash}`);
    return tx.hash;
  } catch (err) {
    console.error(`❌ USDT transfer failed to ${to}:`, err.message);
    throw new Error(`USDT transfer failed: ${err.message}`);
  }
};
