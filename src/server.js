import app from "./app.js";
import { config } from "./config/env.js";
import rewardRoutes from "./modules/rewards/rewardRoutes.js";
app.use("/rewards", rewardRoutes);

app.listen(config.PORT, () => {
  console.log(`✅ Digimint backend running on port ${config.PORT}`);
});
