import Admin from "../Model/admin.js";
import { matchedPassword } from "../utils/password.js";
import { booking } from "../Model/BookingModel.js";
import {
    createRazorpayContact,
    createRazorpayFundAccount,
    createRazorpayPayout,
    getRazorpayPayoutStatus,
    mapPayoutStatus,
} from "../utils/RazorpayPayout.js";
import { BankDetails } from "../Model/BankDetailsModel.js";

export const loginAdmin = async (req, res) => {
    const { email, password } = req.body;
    try {

        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        if (!matchedPassword(password, admin.password)) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        res.status(200).json({ message: "Login successful", admin });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

/**
 * Process booking payout to user
 * @param {Object} req - Request object containing booking ID, user ID, and amount
 * @param {Object} res - Response object
 */
export const processBookingPayout = async (req, res) => {
    try {
        const { bookingId, userId, amount } = req.body;

        // Validate required fields
        if (!bookingId || !userId || !amount) {
            return res.status(400).json({
                error: "Booking ID, User ID, and amount are required."
            });
        }

        // Validate amount format
        if (!/^\d+(\.\d{1,2})?$/.test(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({
                error: "Invalid amount format. Amount must be a positive number."
            });
        }

        // Fetch booking details
        const bookingDetails = await booking.findOne({ bookingId })
            .populate('bookedBy', 'name email phoneNumber')
            .populate('recivedBy', 'name email phoneNumber');

        if (!bookingDetails) {
            return res.status(404).json({ error: "Booking not found." });
        }

        // Determine which user to pay and get their UPI ID
        let targetUser;
        let upiId;

        if (userId === bookingDetails.bookedBy._id.toString()) {
            targetUser = bookingDetails.bookedBy;
        } else if (bookingDetails.recivedBy && userId === bookingDetails.recivedBy._id.toString()) {
            targetUser = bookingDetails.recivedBy;
        } else {
            return res.status(400).json({
                error: "User ID does not match booking participants."
            });
        }

        // Check if payout already exists for this booking and user
        if (bookingDetails.payoutAmount === bookingDetails.commissionAmount) {
            return res.status(409).json({
                error: "Max Payout has been already initiated for this booking."
            });
        }

        // Step 1: Create or fetch Razorpay contact
        const contactData = {
            name: targetUser.name,
            email: targetUser.email,
            phoneNumber: targetUser.phoneNumber,
            reference_id: `booking_${bookingId}_${userId}`,
            user_id: userId,
            booking_id: bookingId
        };

        const contactResponse = await createRazorpayContact(contactData);

        if (!contactResponse.success) {
            return res.status(500).json({
                error: "Failed to create Razorpay contact.",
                details: contactResponse.error
            });
        }

        const contactId = contactResponse.data.id;

        // Update booking with contact ID
        await booking.findByIdAndUpdate(bookingDetails._id, {
            razorpayContactId: contactId
        });

        // fetch the bank account details from booking
        const bankAccountDetails = await BankDetails.findOne({ userId: targetUser._id });

        if (!bankAccountDetails) {
            return res.status(404).json({
                error: "Bank account details not found for the user."
            });
        }

        const fundAccountResponse = await createRazorpayFundAccount(contactId, bankAccountDetails.accountHolderName, bankAccountDetails.ifscCode, bankAccountDetails.accountNumber);

        if (!fundAccountResponse.success) {
            return res.status(500).json({
                error: "Failed to create fund account.",
                details: fundAccountResponse.error
            });
        }

        const fundAccountId = fundAccountResponse.data.id;

        // Update booking with fund account ID
        await booking.findByIdAndUpdate(bookingDetails._id, {
            razorpayFundAccountId: fundAccountId
        });


        // Step 3: Create payout with MongoDB _id as idempotency key
        const payoutData = {
            fund_account_id: fundAccountId,
            amount: amount,
            reference_id: `booking_${bookingId}`,
            booking_id: bookingId,
            user_id: userId,
            payout_type: userId === bookingDetails.bookedBy._id.toString() ? 'refund' : 'commission',
            idempotency_key: `${userId === bookingDetails.bookedBy._id.toString() ? 'ref' : 'comm'}_${bookingDetails._id.toString()}`
        };

        const payoutResponse = await createRazorpayPayout(payoutData);

        if (!payoutResponse.success) {
            return res.status(500).json({
                error: "Failed to create payout.",
                details: payoutResponse.error
            });
        }

        const payoutId = payoutResponse.data.id;
        const payoutStatus = mapPayoutStatus(payoutResponse.data.status);

        const totalPayoutAmount = bookingDetails.payoutAmount ? parseFloat(bookingDetails.payoutAmount) + parseFloat(amount) : parseFloat(amount);

        // Update booking with payout details
        const updatedBooking = await booking.findByIdAndUpdate(
            bookingDetails._id,
            {
                razorpayPayoutId: payoutId,
                payoutAmount: totalPayoutAmount,
                payoutStatus: payoutStatus,
                payoutInitiatedBy: req.user?._id, // Assuming admin user is attached to request
                payoutInitiatedAt: new Date(),
                settlementStatus: bookingDetails.commissionAmount === totalPayoutAmount ? 'fullpaid' : 'partiallypaid'
            },
            { new: true }
        );

        return res.status(200).json({
            message: "Payout initiated successfully.",
            payout: {
                payoutId: payoutId,
                amount: amount,
                status: payoutStatus,
                upiId: upiId,
                recipient: {
                    name: targetUser.name,
                    phoneNumber: targetUser.phoneNumber
                }
            },
            booking: {
                bookingId: bookingDetails.bookingId,
                settlementStatus: updatedBooking.settlementStatus
            }
        });

    } catch (error) {
        console.error("Process Booking Payout Error:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            details: error.message
        });
    }
};

/**
 * Check payout status for a booking
 * @param {Object} req - Request object containing booking ID
 * @param {Object} res - Response object
 */
export const checkPayoutStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;

        if (!bookingId) {
            return res.status(400).json({ error: "Booking ID is required." });
        }

        const bookingDetails = await booking.findOne({ bookingId });

        if (!bookingDetails) {
            return res.status(404).json({ error: "Booking not found." });
        }

        if (!bookingDetails.razorpayPayoutId) {
            return res.status(404).json({
                error: "No payout found for this booking.",
                settlementStatus: bookingDetails.settlementStatus
            });
        }

        // Fetch latest payout status from Razorpay
        const payoutStatusResponse = await getRazorpayPayoutStatus(bookingDetails.razorpayPayoutId);

        if (!payoutStatusResponse.success) {
            return res.status(500).json({
                error: "Failed to fetch payout status.",
                details: payoutStatusResponse.error
            });
        }

        const latestStatus = mapPayoutStatus(payoutStatusResponse.data.status);

        // Update booking if status changed
        if (latestStatus !== bookingDetails.payoutStatus) {
            await booking.findByIdAndUpdate(bookingDetails._id, {
                payoutStatus: latestStatus,
                settlementStatus: latestStatus === 'processed' ? 'fullpaid' :
                    latestStatus === 'failed' ? 'unpaid' : 'partiallypaid'
            });
        }

        return res.status(200).json({
            message: "Payout status retrieved successfully.",
            payout: {
                payoutId: bookingDetails.razorpayPayoutId,
                amount: bookingDetails.payoutAmount,
                status: latestStatus,
                initiatedAt: bookingDetails.payoutInitiatedAt,
                razorpayData: payoutStatusResponse.data
            },
            booking: {
                bookingId: bookingDetails.bookingId,
                settlementStatus: latestStatus === 'processed' ? 'fullpaid' :
                    latestStatus === 'failed' ? 'unpaid' : 'partiallypaid'
            }
        });

    } catch (error) {
        console.error("Check Payout Status Error:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            details: error.message
        });
    }
};