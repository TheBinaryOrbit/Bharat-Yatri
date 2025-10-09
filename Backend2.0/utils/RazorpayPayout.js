import Razorpay from "razorpay";

// Initialize Razorpay with credentials from environment
const razorpay = new Razorpay({
  key_id: process.env.key_id,
  key_secret: process.env.key_secret,
});

/**
 * Create a Razorpay contact for payout
 * @param {Object} contactData - Contact information
 * @returns {Promise<Object>} Contact creation response
 */
export const createRazorpayContact = async (contactData) => {
  try {
    const contact = await razorpay.contacts.create({
      name: contactData.name,
      email: contactData.email || '',
      contact: contactData.phoneNumber,
      type: 'customer',
      reference_id: contactData.reference_id,
      notes: {
        purpose: 'Booking payout',
        user_id: contactData.user_id,
        booking_id: contactData.booking_id
      }
    });
    
    return {
      success: true,
      data: contact
    };
  } catch (error) {
    console.error('Create Contact Error:', error);
    return {
      success: false,
      error: error.error || error.message || 'Failed to create contact'
    };
  }
};

/**
 * Create a fund account for UPI payout
 * @param {string} contactId - Razorpay contact ID
 * @param {string} upiId - UPI ID for payout
 * @returns {Promise<Object>} Fund account creation response
 */
export const createRazorpayFundAccount = async (contactId, upiId) => {
  try {
    const fundAccount = await razorpay.fundAccount.create({
      contact_id: contactId,
      account_type: 'vpa',
      vpa: {
        address: upiId
      }
    });
    
    return {
      success: true,
      data: fundAccount
    };
  } catch (error) {
    console.error('Create Fund Account Error:', error);
    return {
      success: false,
      error: error.error || error.message || 'Failed to create fund account'
    };
  }
};

/**
 * Create a payout using Razorpay
 * @param {Object} payoutData - Payout information
 * @returns {Promise<Object>} Payout creation response
 */
export const createRazorpayPayout = async (payoutData) => {
  try {
    const payout = await razorpay.payouts.create({
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // Add this to your .env
      fund_account_id: payoutData.fund_account_id,
      amount: Math.round(parseFloat(payoutData.amount) * 100), // Convert to paise
      currency: 'INR',
      mode: 'UPI',
      purpose: 'refund',
      queue_if_low_balance: true,
      reference_id: payoutData.reference_id,
      narration: `Payout for Booking #${payoutData.booking_id}`,
      notes: {
        booking_id: payoutData.booking_id,
        user_id: payoutData.user_id,
        payout_type: payoutData.payout_type
      }
    }, {
      'X-Payout-Idempotency': payoutData.idempotency_key
    });
    
    return {
      success: true,
      data: payout
    };
  } catch (error) {
    console.error('Create Payout Error:', error);
    return {
      success: false,
      error: error.error || error.message || 'Failed to create payout'
    };
  }
};

/**
 * Get payout status from Razorpay
 * @param {string} payoutId - Razorpay payout ID
 * @returns {Promise<Object>} Payout status response
 */
export const getRazorpayPayoutStatus = async (payoutId) => {
  try {
    const payout = await razorpay.payouts.fetch(payoutId);
    
    return {
      success: true,
      data: payout
    };
  } catch (error) {
    console.error('Get Payout Status Error:', error);
    return {
      success: false,
      error: error.error || error.message || 'Failed to fetch payout status'
    };
  }
};

/**
 * Map Razorpay payout status to our internal status
 * @param {string} razorpayStatus - Razorpay payout status
 * @returns {string} Internal payout status
 */
export const mapPayoutStatus = (razorpayStatus) => {
  const statusMapping = {
    'queued': 'queued',
    'pending': 'pending',
    'processing': 'processing',
    'processed': 'processed',
    'cancelled': 'cancelled',
    'failed': 'failed'
  };
  
  return statusMapping[razorpayStatus] || 'pending';
};