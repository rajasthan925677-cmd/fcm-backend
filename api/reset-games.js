// api/reset-games.js   (CommonJS style – 100% काम करेगा)

const { resetGames } = require("../server.js");

module.exports = async (req, res) => {
  const secret = req.query.secret;

  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized bhai!" });
  }

  try {
    const result = await resetGames();
    res.status(200).json({
      success: true,
      message: "सारे गेम रिसेट हो गए!",
      count: result.count || 0,
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error("Reset failed:", error);
    res.status(500).json({ error: "Kuch toh gadbad hai", details: error.message });
  }
};