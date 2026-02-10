import axios from "axios";

export const fetchDigimintNFTs = async (cursor) => {
  const creator = "ETHEREUM:0xba61ffdb90d8fb2257aa5fbe3d2fa75baa4e071d";

  try {
    const res = await axios.get(
      "https://api.rarible.org/v0.1/items/byCreator",
      {
        params: { creator, cursor },
        headers: {
          "X-API-KEY": process.env.RARIBLE_API_KEY,
        },
      }
    );
    return res.data || { items: [], cursor: null };
  } catch (err) {
    console.error("fetchDigimintNFTs error:", err);
    return { items: [], cursor: null };
  }
};
