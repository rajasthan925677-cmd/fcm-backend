import { resetGames } from "../server.js";

export default async function handler(req, res) {
  try {
    await resetGames(); 
    return res.status(200).json({ message: "Games reset successful (CRON)" });
  } catch (error) {
    console.error("CRON reset error:", error);
    return res.status(500).json({ error: "Cron failed" });
  }
}
