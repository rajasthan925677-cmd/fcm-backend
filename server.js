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
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Endpoint to send notification
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
      notification: {
        title,
        body,
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      topic,
    };

    await messaging.send(message);

    // Update notification status to 'sent'
    await notificationRef.update({
      status: 'sent',
      sentAt: new Date().toISOString(),
    });

    res.status(200).json({ message: 'Notification sent successfully', id: notificationRef.id });
  } catch (error) {
    console.error('Error sending notification:', error);

    // Update status to 'failed' if an error occurs
    if (notificationRef) {
      await notificationRef.update({
        status: 'failed',
        error: error.message,
      });
    }

    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Notification backend is running...');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});