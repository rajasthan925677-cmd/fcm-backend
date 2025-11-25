import { resetGames } from "../server.js";

export default async function handler(req, res) {
  const secret = req.query.secret;

  // SECURITY CHECK
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await resetGames();
    return res.status(200).json({
      message: "Games reset successful",
      result,
    });
  } catch (error) {
    console.error("CRON reset error:", error);
    return res.status(500).json({ error: "Cron failed" });
  }
}
