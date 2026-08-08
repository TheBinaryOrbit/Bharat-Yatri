import { NotificationService } from '../services/notification.service.js';
import { FcmService } from '../services/fcm.service.js';
import { env } from '../config/env.js';

export class NotificationController {
  constructor() {
    this.notificationService = new NotificationService();
    this.fcmService = new FcmService();
  }

  // PATCH /api/v3/notifications/token  (protected — either role)
  //
  // Login already stores a token (POST /auth/verify takes one), but that is not enough on its own.
  // FCM rotates a device's token on reinstall, on a restore-from-backup and occasionally at
  // Google's discretion, and an app that only registered at login would go silent until the next
  // one. The app should call this on every onTokenRefresh.
  registerToken = async (req, res) => {
    const { fcmToken } = req.body;

    if (!fcmToken || typeof fcmToken !== 'string') {
      return res.status(400).json({
        message: 'A valid FCM token is required',
        errors: [{ field: 'fcmToken', message: 'fcmToken must be a non-empty string' }],
      });
    }

    try {
      // Identity from the JWT, never the body — the caller may only bind a device to themselves.
      const account = await this.notificationService.saveToken(req.role, req.user._id, fcmToken.trim());

      return res.status(200).json({
        message: 'Notification token registered successfully.',
        pushEnabled: this.fcmService.isEnabled(),
        fcmToken: account?.fcmToken || '',
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to register token', message: 'Internal server error' });
    }
  };

  // DELETE /api/v3/notifications/token  (protected — either role)
  // Logout. Without this the handset keeps receiving a signed-out account's rides.
  clearToken = async (req, res) => {
    try {
      await this.notificationService.clearToken(req.role, req.user._id);
      return res.status(200).json({ message: 'Notification token cleared successfully.' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to clear token', message: 'Internal server error' });
    }
  };

  // POST /api/v3/notifications/test  (protected — either role, non-production only)
  //
  // Sends a real push to the caller's own registered device. The one way to answer "is my channel
  // set up, is my token stored, does the tap route correctly" without booking a ride to find out.
  sendTest = async (req, res) => {
    if (env.NODE_ENV === 'production') {
      return res.status(404).json({ message: 'Not found' });
    }

    if (!this.fcmService.isEnabled()) {
      return res.status(503).json({
        message: 'Push is not configured on this server. Set the FIREBASE_* variables and restart.',
      });
    }

    try {
      const result = await this.notificationService.send(req.role, [req.user._id], {
        title: req.body.title || 'Bharat Yaatri test',
        body: req.body.body || 'If you can read this, push notifications are working.',
        data: { type: 'test', screen: 'none' },
      });

      if (result.skipped) {
        return res.status(409).json({
          message: 'No device registered for this account. Call PATCH /notifications/token first.',
        });
      }

      return res.status(200).json({ message: 'Test notification sent.', ...result });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to send test', message: 'Internal server error' });
    }
  };
}
