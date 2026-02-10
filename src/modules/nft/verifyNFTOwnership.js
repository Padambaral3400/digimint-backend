import { ethers } from "ethers";
import { config } from "../../config/env.js";

/* 🔹 Polygon provider */
const provider = new ethers.JsonRpcProvider(config.POLYGON_RPC);

/**
 * ✅ Verify NFT ownership on-chain (ERC721 / ERC1155)
 * @param {string} contract - NFT contract address
 * @param {string|number} tokenId - NFT token ID
 * @param {string} wallet - User wallet address
 * @param {string} standard - "ERC721" or "ERC1155"
 * @returns {Promise<boolean>}
 */
export const verifyNFTOwnership = async ({ contract, tokenId, wallet, standard }) => {
  try {
    if (!wallet || !ethers.isAddress(wallet)) return false;

    // ---------------- ERC721 ----------------
    if (standard === "ERC721") {
      const abi = ["function ownerOf(uint256) view returns (address)"];
      const nft = new ethers.Contract(contract, abi, provider);

      const owner = await nft.ownerOf(tokenId);
      return owner.toLowerCase() === wallet.toLowerCase();
    }

    // ---------------- ERC1155 ----------------
    if (standard === "ERC1155") {
      const abi = ["function balanceOf(address,uint256) view returns (uint256)"];
      const nft = new ethers.Contract(contract, abi, provider);

      const balance = await nft.balanceOf(wallet, tokenId);
      return Number(balance) > 0;
    }

    // ---------------- Unknown standard ----------------
    console.warn("verifyNFTOwnership: Unknown standard", standard);
    return false;

  } catch (err) {
    console.error(
      `verifyNFTOwnership error: contract=${contract}, tokenId=${tokenId}, wallet=${wallet}`,
      err.message
    );
    return false;
  }
};
