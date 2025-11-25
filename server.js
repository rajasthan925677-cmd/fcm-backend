
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config(); // Load .env file

// Load Firebase service account from environment variables
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
};

// Check if all required environment variables are set
const requiredEnvVars = [
  'FIREBASE_TYPE',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_AUTH_URI',
  'FIREBASE_TOKEN_URI',
  'FIREBASE_AUTH_PROVIDER_X509_CERT_URL',
  'FIREBASE_CLIENT_X509_CERT_URL',
  'FIREBASE_UNIVERSE_DOMAIN'
];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`Missing environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const messaging = admin.messaging();
const app = express();

app.use(cors());
app.use(express.json());

// -------------------------
// Endpoint: Send Notification (FCM)
// -------------------------
app.post('/api/send-notification', async (req, res) => {
  const { title, body, topic } = req.body;

  if (!title || !body || !topic) {
    return res.status(400).json({ error: 'Title, body, and topic are required' });
  }

  let notificationRef;

  try {
    // Save notification to Firestore with 'pending' status
    notificationRef = await db.collection('notifications').add({
      title,
      body,
      topic,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Send notification via FCM
    const message = {
      notification: { title, body },
      data: { click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      topic,
    };

    await messaging.send(message);

    // Update notification status to 'sent'
    await notificationRef.update({ status: 'sent', sentAt: new Date().toISOString() });

    res.status(200).json({ message: 'Notification sent successfully', id: notificationRef.id });
  } catch (error) {
    console.error('Error sending notification:', error);
    if (notificationRef) {
      await notificationRef.update({ status: 'failed', error: error.message });
    }
    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});

// -------------------------
// Endpoint: Reset User Password (Admin)
// -------------------------
app.post('/api/reset-user-password', async (req, res) => {
  const { mobile, newPassword } = req.body;

  if (!mobile || !newPassword) {
    return res.status(400).json({ error: 'Mobile and newPassword are required' });
  }

  try {
    // Convert mobile to email for Firebase Auth
    const email = `${mobile}@myapp.com`;

    // Get user from Firebase Auth
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (authError) {
      console.error('Firebase Auth error:', authError);
      return res.status(404).json({ error: `No user found with mobile number: ${mobile}` });
    }

    // Update password in Firebase Auth
    await admin.auth().updateUser(userRecord.uid, { password: newPassword });

    // Revoke all refresh tokens to log out user from all devices
    await admin.auth().revokeRefreshTokens(userRecord.uid);

    res.status(200).json({ message: 'Password reset successfully, user logged out from all devices' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
});

// -------------------------
// Endpoint: Set Custom Claims (Admin)
// -------------------------
app.post('/api/set-custom-claims', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    // Check if user exists in Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Set role to 'admin' in Firestore
    await db.collection('users').doc(userId).update({ role: 'admin' });

    // Set custom claims to 'admin'
    await admin.auth().setCustomUserClaims(userId, { role: 'admin' });
    res.status(200).json({ message: 'User successfully set as admin' });
  } catch (error) {
    console.error('Error setting custom claims:', error);
    res.status(500).json({ error: 'Failed to set custom claims', details: error.message });
  }
});

// -------------------------
// Health check
// -------------------------
app.get('/', (req, res) => {
  res.send('Notification & Password backend is running...');
});

// -------------------------
// Localhost configuration
// -------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});






//auto reset wala 



// -------------------------
// Endpoint: Auto Reset Games (Cron Job)
// -------------------------
app.post('/api/reset-games', async (req, res) => {
  // सिक्योरिटी: सिर्फ Vercel Cron ही कॉल कर सके
  // Allow Vercel Cron OR allow authorized manual trigger
const authHeader = req.headers['authorization'];
const isCron = req.headers['x-vercel-cron'];

if (!isCron && (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
  return res.status(401).json({ error: 'Unauthorized access' });
}


  try {
    const gamesRef = db.collection('games');
    const snapshot = await gamesRef.get();

    if (snapshot.empty) {
      return res.status(200).json({ message: 'No games found to reset' });
    }

    const promises = snapshot.docs.map(doc => 
      doc.ref.update({
        openResult: "",
        closeResult: ""
      })
    );

    await Promise.all(promises);

    console.log(`Auto reset: ${snapshot.size} games reset at ${new Date().toISOString()}`);

    res.status(200).json({ 
      message: `Successfully reset ${snapshot.size} games`,
      count: snapshot.size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Auto reset failed:', error);
    res.status(500).json({ error: 'Failed to reset games', details: error.message });
  }
});













// Export app for Vercel
module.exports = app;


// Only run locally
//if (require.main === module) {
  //const PORT = process.env.PORT || 3001;
  //app.listen(PORT, () => {
    //console.log(`Local server running on http://localhost:${PORT}`);
  //});
//}