import { PaymentDetailsService } from '../services/paymentDetails.service.js';

export class PaymentDetailsController {
  constructor() {
    this.paymentDetailsService = new PaymentDetailsService();
  }

  // GET /api/v3/payment-details/my  (protected — driver only)
  getMyPaymentDetails = async (req, res) => {
    try {
      const details = await this.paymentDetailsService.getByDriver(req.user._id);
      if (!details) {
        return res.status(404).json({ message: 'Payment details not found' });
      }
      return res.status(200).json(details);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch payment details', message: 'Internal server error' });
    }
  };

  // POST /api/v3/payment-details  (protected — driver only)
  // Driver comes from the auth token; body carries only the UPI id.
  addPaymentDetails = async (req, res) => {
    const { upiId } = req.body;

    if (!upiId) {
      return res.status(400).json({
        message: 'UPI id is required',
        errors: [{ field: 'upiId', message: 'UPI id is required' }],
      });
    }

    try {
      const details = await this.paymentDetailsService.upsertForDriver(req.user._id, upiId);
      return res.status(201).json(details);
    } catch (error) {
      console.log(error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Invalid UPI id', error: error.message });
      }
      return res.status(500).json({ error: 'Failed to save payment details', message: 'Internal server error' });
    }
  };
}
