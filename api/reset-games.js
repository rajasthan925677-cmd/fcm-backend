// api/reset-games.js  ← बिल्कुल यही फाइल में पेस्ट कर दे

const { resetGames } = require("../server.js");

module.exports = async (req, res) => {
  let secret = "";

  // 4 तरीकों से secret लेगा – कोई भी चलेगा
  if (req.query.secret) secret = req.query.secret;
  else if (req.body.secret) secret = req.body.secret;
  else if (req.headers.authorization) {
    const auth = req.headers.authorization;
    if (auth.startsWith("Bearer ")) {
      secret = auth.split("Bearer ")[1];
    }
  }

  // सही सीक्रेट चेक
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ 
      success: false,
      error: "Bhai secret galat hai ya missing hai!" 
    });
  }

  try {
    const result = await resetGames();
    res.status(200).json({
      success: true,
      message: "सारे गेम रिजल्ट रिसेट हो गए भाई!",
      resetCount: result.count || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Reset failed:", error);
    res.status(500).json({ 
      success: false,
      error: "Server side gadbad", 
      details: error.message 
    });
  }
};