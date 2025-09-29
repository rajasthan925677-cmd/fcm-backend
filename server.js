const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// Load Firebase service account key
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');

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
    notificationRef = await db.collection('users').add({
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

// Export app for Vercel (use this for deployment)
// Replace 'http://localhost:3001' with 'https://your-vercel-app.vercel.app' in TokenSyncWorker
module.exports = app;