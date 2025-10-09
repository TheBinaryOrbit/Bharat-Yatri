// Razorpay API base URL
const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

// Helper function to create authorization header
const getAuthHeader = () => {
  const credentials = Buffer.from(`${process.env.key_id}:${process.env.key_secret}`).toString('base64');
  return `Basic ${credentials}`;
};

// Helper function to make API calls
const makeRazorpayRequest = async (endpoint, method = 'GET', data = null, headers = {}) => {
  try {
    const config = {
      method,
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${RAZORPAY_API_BASE}${endpoint}`, config);
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error?.description || responseData.message || 'API request failed');
    }

    return {
      success: true,
      data: responseData
    };
  } catch (error) {
    console.error(`Razorpay API Error [${endpoint}]:`, error);
    return {
      success: false,
      error: error.message || 'API request failed'
    };
  }
};

/**
 * Create a Razorpay contact for payout
 * @param {Object} contactData - Contact information
 * @returns {Promise<Object>} Contact creation response
 */
export const createRazorpayContact = async (contactData) => {
  try {
    const contactPayload = {
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
    };

    const result = await makeRazorpayRequest('/contacts', 'POST', contactPayload);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create contact'
      };
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Create Contact Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create contact'
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
    const fundAccountPayload = {
      contact_id: contactId,
      account_type: 'vpa',
      vpa: {
        address: upiId
      }
    };

    const result = await makeRazorpayRequest('/fund_accounts', 'POST', fundAccountPayload);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create fund account'
      };
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Create Fund Account Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create fund account'
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
    const payoutPayload = {
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
    };

    const headers = {
      'X-Payout-Idempotency': payoutData.idempotency_key
    };

    const result = await makeRazorpayRequest('/payouts', 'POST', payoutPayload, headers);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create payout'
      };
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Create Payout Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create payout'
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
    const result = await makeRazorpayRequest(`/payouts/${payoutId}`, 'GET');
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch payout status'
      };
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Get Payout Status Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch payout status'
    };
  }
};

/**
 * Get all payouts with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Payouts list response
 */
export const getAllPayouts = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Add filters to query params
    if (filters.count) queryParams.append('count', filters.count);
    if (filters.skip) queryParams.append('skip', filters.skip);
    if (filters.from) queryParams.append('from', filters.from);
    if (filters.to) queryParams.append('to', filters.to);
    if (filters.status) queryParams.append('status', filters.status);

    const endpoint = `/payouts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const result = await makeRazorpayRequest(endpoint, 'GET');
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch payouts'
      };
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Get All Payouts Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch payouts'
    };
  }
};

/**
 * Cancel a payout
 * @param {string} payoutId - Razorpay payout ID
 * @returns {Promise<Object>} Cancel payout response
 */
export const cancelRazorpayPayout = async (payoutId) => {
  try {
    const result = await makeRazorpayRequest(`/payouts/${payoutId}/cancel`, 'POST');
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to cancel payout'
      };
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Cancel Payout Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to cancel payout'
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

/**
 * Validate UPI ID format
 * @param {string} upiId - UPI ID to validate
 * @returns {boolean} Whether UPI ID is valid
 */
export const validateUpiId = (upiId) => {
  const upiRegex = /^[\w.-]+@[\w.-]+$/;
  return upiRegex.test(upiId);
};

/**
 * Format amount for Razorpay (convert to paise)
 * @param {string|number} amount - Amount in rupees
 * @returns {number} Amount in paise
 */
export const formatAmountForRazorpay = (amount) => {
  return Math.round(parseFloat(amount) * 100);
};

/**
 * Format amount from Razorpay (convert from paise to rupees)
 * @param {number} amount - Amount in paise
 * @returns {string} Amount in rupees with 2 decimal places
 */
export const formatAmountFromRazorpay = (amount) => {
  return (amount / 100).toFixed(2);
};

/**
 * Generate reference ID for payout
 * @param {string} bookingId - Booking ID
 * @param {string} type - Payout type (refund/commission)
 * @returns {string} Reference ID
 */
export const generatePayoutReferenceId = (bookingId, type = 'payout') => {
  const timestamp = Date.now();
  return `${type}_${bookingId}_${timestamp}`;
};

/**
 * Check if error is due to insufficient balance
 * @param {string} errorMessage - Error message from Razorpay
 * @returns {boolean} Whether error is due to insufficient balance
 */
export const isInsufficientBalanceError = (errorMessage) => {
  const insufficientBalanceKeywords = [
    'insufficient balance',
    'balance not sufficient',
    'insufficient funds',
    'BAD_REQUEST_ERROR'
  ];
  
  return insufficientBalanceKeywords.some(keyword => 
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  );
};

/**
 * Check if error is due to invalid UPI ID
 * @param {string} errorMessage - Error message from Razorpay
 * @returns {boolean} Whether error is due to invalid UPI ID
 */
export const isInvalidUpiError = (errorMessage) => {
  const invalidUpiKeywords = [
    'invalid vpa',
    'invalid upi',
    'vpa not found',
    'invalid account'
  ];
  
  return invalidUpiKeywords.some(keyword => 
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  );
};