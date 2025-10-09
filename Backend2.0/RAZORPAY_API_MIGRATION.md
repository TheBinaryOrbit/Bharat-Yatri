# 🔄 Updated Razorpay Payout Implementation - API Calls Only

## 📋 Overview

The Razorpay payout system has been updated to use direct API calls instead of the Razorpay SDK. This provides better control, error handling, and reduces dependencies.

## ✅ **What Changed**

### **Before (SDK)**
```javascript
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.key_id,
  key_secret: process.env.key_secret,
});

const contact = await razorpay.contacts.create(contactData);
```

### **After (Direct API)**
```javascript
const makeRazorpayRequest = async (endpoint, method, data, headers) => {
  const credentials = Buffer.from(`${process.env.key_id}:${process.env.key_secret}`).toString('base64');
  
  const response = await fetch(`https://api.razorpay.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: data ? JSON.stringify(data) : undefined
  });
  
  return await response.json();
};
```

## 🛠️ **Updated Functions**

### **1. Enhanced Error Handling**
```javascript
// New utility functions for better error detection
export const isInsufficientBalanceError = (errorMessage) => {
  const keywords = ['insufficient balance', 'balance not sufficient'];
  return keywords.some(keyword => errorMessage.toLowerCase().includes(keyword));
};

export const isInvalidUpiError = (errorMessage) => {
  const keywords = ['invalid vpa', 'invalid upi', 'vpa not found'];
  return keywords.some(keyword => errorMessage.toLowerCase().includes(keyword));
};
```

### **2. Additional Utility Functions**
```javascript
// UPI validation
export const validateUpiId = (upiId) => {
  const upiRegex = /^[\w.-]+@[\w.-]+$/;
  return upiRegex.test(upiId);
};

// Amount formatting
export const formatAmountForRazorpay = (amount) => {
  return Math.round(parseFloat(amount) * 100); // Convert to paise
};

export const formatAmountFromRazorpay = (amount) => {
  return (amount / 100).toFixed(2); // Convert from paise to rupees
};

// Reference ID generation
export const generatePayoutReferenceId = (bookingId, type = 'payout') => {
  const timestamp = Date.now();
  return `${type}_${bookingId}_${timestamp}`;
};
```

### **3. New API Functions**
```javascript
// Get all payouts with filters
export const getAllPayouts = async (filters = {}) => {
  const queryParams = new URLSearchParams();
  if (filters.count) queryParams.append('count', filters.count);
  if (filters.status) queryParams.append('status', filters.status);
  
  const endpoint = `/payouts?${queryParams.toString()}`;
  return await makeRazorpayRequest(endpoint, 'GET');
};

// Cancel payout
export const cancelRazorpayPayout = async (payoutId) => {
  return await makeRazorpayRequest(`/payouts/${payoutId}/cancel`, 'POST');
};
```

## 🔧 **Implementation Benefits**

### **1. Better Error Handling**
```javascript
// Before: Generic error handling
catch (error) {
  return { success: false, error: error.message };
}

// After: Specific error detection
catch (error) {
  let errorType = 'general';
  if (isInsufficientBalanceError(error.message)) {
    errorType = 'insufficient_balance';
  } else if (isInvalidUpiError(error.message)) {
    errorType = 'invalid_upi';
  }
  
  return { 
    success: false, 
    error: error.message,
    errorType: errorType
  };
}
```

### **2. Enhanced Admin Controller**
```javascript
// Updated imports
import { 
  createRazorpayContact, 
  createRazorpayFundAccount, 
  createRazorpayPayout,
  getRazorpayPayoutStatus,
  mapPayoutStatus,
  validateUpiId,
  formatAmountForRazorpay,
  generatePayoutReferenceId,
  isInsufficientBalanceError,
  isInvalidUpiError
} from "../utils/RazorpayPayout.js";

// Enhanced payout processing with better validation
export const processBookingPayout = async (req, res) => {
  try {
    const { bookingId, userId, amount } = req.body;

    // Validate UPI ID before processing
    if (!validateUpiId(upiId)) {
      return res.status(400).json({ 
        error: "Invalid UPI ID format",
        errorType: "invalid_upi"
      });
    }

    // Enhanced error handling for payout creation
    const payoutResponse = await createRazorpayPayout(payoutData);
    
    if (!payoutResponse.success) {
      let errorType = 'general';
      if (isInsufficientBalanceError(payoutResponse.error)) {
        errorType = 'insufficient_balance';
      } else if (isInvalidUpiError(payoutResponse.error)) {
        errorType = 'invalid_upi';
      }
      
      return res.status(500).json({ 
        error: "Failed to create payout.",
        details: payoutResponse.error,
        errorType: errorType
      });
    }

    // Rest of the implementation...
  } catch (error) {
    // Enhanced error logging and response
  }
};
```

## 📊 **API Endpoints Overview**

| Endpoint | Method | Purpose | SDK Replacement |
|----------|--------|---------|-----------------|
| `/contacts` | POST | Create contact | `razorpay.contacts.create()` |
| `/fund_accounts` | POST | Create fund account | `razorpay.fundAccount.create()` |
| `/payouts` | POST | Create payout | `razorpay.payouts.create()` |
| `/payouts/{id}` | GET | Get payout status | `razorpay.payouts.fetch()` |
| `/payouts` | GET | List all payouts | `razorpay.payouts.all()` |
| `/payouts/{id}/cancel` | POST | Cancel payout | `razorpay.payouts.cancel()` |

## 🔒 **Security Enhancements**

### **1. Better Authentication**
```javascript
// Secure credential handling
const getAuthHeader = () => {
  const credentials = Buffer.from(`${process.env.key_id}:${process.env.key_secret}`).toString('base64');
  return `Basic ${credentials}`;
};
```

### **2. Request Validation**
```javascript
// Enhanced input validation
const validatePayoutRequest = (data) => {
  const errors = [];
  
  if (!data.amount || parseFloat(data.amount) <= 0) {
    errors.push({ field: 'amount', message: 'Invalid amount' });
  }
  
  if (!validateUpiId(data.upiId)) {
    errors.push({ field: 'upiId', message: 'Invalid UPI ID format' });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
```

## 🚀 **Testing the Updated Implementation**

### **1. Test Contact Creation**
```bash
curl -X POST http://localhost:3000/api/v2/admin/payout/process \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "TEST123",
    "userId": "64f1234567890abcdef12345",
    "amount": "100.00"
  }'
```

### **2. Test Error Handling**
```bash
# Test with invalid UPI ID
curl -X POST http://localhost:3000/api/v2/admin/payout/process \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "TEST123",
    "userId": "64f1234567890abcdef12345",
    "amount": "100.00"
  }'
```

### **3. Test Status Check**
```bash
curl -X GET http://localhost:3000/api/v2/admin/payout/status/TEST123
```

## 📝 **Environment Variables**

Ensure these are set in your `.env` file:
```env
# Existing Razorpay credentials (used for both payments and payouts)
key_id=rzp_test_XXXXXXXXXX
key_secret=XXXXXXXXXXXXXXXX

# New: Razorpay account number for payouts
RAZORPAY_ACCOUNT_NUMBER=XXXXXXXXXXXXXXXXX
```

## 🎯 **Frontend Integration Updates**

### **Enhanced Error Handling in Frontend**
```javascript
const handlePayoutError = (error) => {
  switch (error.errorType) {
    case 'insufficient_balance':
      showToast('Insufficient balance in Razorpay account', 'error');
      break;
    case 'invalid_upi':
      showToast('Invalid UPI ID provided', 'error');
      break;
    default:
      showToast(error.message || 'Payout failed', 'error');
  }
};

// Enhanced payout processing
const processPayout = async (bookingId, userId, amount) => {
  try {
    const response = await fetch('/api/v2/admin/payout/process', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ bookingId, userId, amount })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      handlePayoutError(result);
      return;
    }
    
    showToast('Payout initiated successfully', 'success');
    refreshBookingList();
  } catch (error) {
    handlePayoutError({ message: 'Network error occurred' });
  }
};
```

## 🔄 **Migration Checklist**

- [x] Remove Razorpay SDK dependency from payout utilities
- [x] Implement direct API calls with proper authentication
- [x] Add enhanced error handling and validation
- [x] Update AdminController imports
- [x] Add new utility functions for better UX
- [x] Create comprehensive documentation
- [ ] Update frontend error handling (if applicable)
- [ ] Test all payout scenarios
- [ ] Update environment variables
- [ ] Deploy and monitor

## 📞 **Support & Troubleshooting**

### **Common Issues**

1. **Authentication Errors**
   - Verify `key_id` and `key_secret` in environment
   - Check base64 encoding of credentials

2. **API Rate Limits**
   - Implement retry logic with exponential backoff
   - Monitor API usage

3. **Network Timeouts**
   - Add proper timeout handling
   - Implement request retries

### **Debugging**
```javascript
// Enhanced logging for debugging
console.log('Payout Request:', {
  endpoint: `/payouts`,
  payload: payoutPayload,
  headers: { 'X-Payout-Idempotency': idempotencyKey }
});
```

The updated implementation provides better control, enhanced error handling, and improved debugging capabilities while maintaining the same functionality as the SDK-based approach.