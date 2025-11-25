// api/reset-games-daily.js  (CommonJS for Vercel compatibility)

const admin = require('firebase-admin');

// Initialize Firebase if not already
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
    })
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    console.log("Daily reset triggered at:", new Date().toISOString());

    const snapshot = await db.collection("games").get();

    if (snapshot.empty) {
      return res.status(200).json({ message: "No games to reset" });
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        openResult: "",
        closeResult: "",
        lastResetAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    console.log(`Reset ${snapshot.size} games`);

    res.status(200).json({
      success: true,
      resetCount: snapshot.size,
      time: new Date().toISOString()
    });

  } catch (error) {
    console.error("Reset failed:", error);
    res.status(500).json({ error: error.message });
  }
};