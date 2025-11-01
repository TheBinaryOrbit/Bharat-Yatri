import { useEffect, useState } from "react";
import axios from "axios";
import URL from "../../lib/url";
import { auth } from "../../lib/types";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaUser, FaCar, FaMapMarkerAlt, FaCalendar, FaClock, FaRupeeSign, FaPhone, FaEnvelope, FaIdCard } from "react-icons/fa";
import { PiPaypalLogoLight } from "react-icons/pi";



interface BookingDetails {
    _id: string;
    bookingId: string;
    vehicleType: string;
    pickUpDate: string;
    pickUpTime: string;
    pickUpLocation: string;
    dropLocation: string;
    bookingType: string;
    getBestQuotePrice: boolean;
    bookingAmount?: string;
    commissionAmount?: string;
    isProfileHidden: boolean;
    extraRequirements: string[];
    status: string;
    settlementStatus?: 'unpaid' | 'partiallypaid' | 'fullpaid';
    upiId?: string;
    isPaid: boolean;
    payoutStatus?: string;
    payoutAmount?: string;
    bookedBy: {
        _id: string;
        name: string;
        phoneNumber: string;
        email?: string;
        city: string;
        userType: string;
        aadharNumber?: string;
        drivingLicenceNumber?: string;
        userImage?: string;
        isSubscribed: boolean;
        isUserVerified: boolean;
    };
    payeeUpiId?: string;
    recivedBy?: {
        _id: string;
        name: string;
        phoneNumber: string;
        email?: string;
        city: string;
        userType: string;
        aadharNumber?: string;
        drivingLicenceNumber?: string;
        userImage?: string;
    };
    paymentRequests: any[];
    recentMessages: any[];
    createdAt: string;
    updatedAt: string;
}

const BookingDetails = () => {
    const [booking, setBooking] = useState<BookingDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const { bookingId } = useParams();
    const navigate = useNavigate();

    // Payout state
    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [payoutLoading, setPayoutLoading] = useState(false);
    const [payoutForm, setPayoutForm] = useState({
        userType: 'customer' as 'customer' | 'driver',
        amount: '',
        userId: ''
    });

    useEffect(() => {
        const fetchBookingDetails = async () => {
            const storedData: any = localStorage.getItem('auth');
            const auth: auth = JSON.parse(storedData);
            const token: string | undefined = (auth as any)?.authToken;
            
            try {
                const res = await axios.get(`${URL}/api/v2/booking/admin/details/${bookingId}`, {
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                });
                
                setBooking(res.data.booking);
                setLoading(false);
            } catch (error: any) {
                console.log(error);
                setLoading(false);
                toast.error(error.response?.data?.error || 'Failed to fetch booking details');
            }
        };

        if (bookingId) {
            fetchBookingDetails();
        }
    }, [bookingId]);

    // Payout functions
    const getAuthToken = () => {
        const storedData: any = localStorage.getItem('auth');
        const auth: auth = JSON.parse(storedData);
        return (auth as any)?.authToken;
    };

    const processPayout = async () => {
        if (!booking || !payoutForm.amount || !payoutForm.userId) {
            toast.error('Please fill all required fields');
            return;
        }

        // Validate payout amount against commission amount
        const payoutAmount = parseFloat(payoutForm.amount);
        const commissionAmount = parseFloat(booking.commissionAmount || '0');
        
        if (payoutAmount > commissionAmount) {
            toast.error(`Payout amount (₹${payoutAmount}) cannot exceed commission amount (₹${commissionAmount})`);
            return;
        }

        if (payoutAmount <= 0) {
            toast.error('Payout amount must be greater than 0');
            return;
        }

        // Check if booking status is PENDING
        if (booking.status === 'PENDING') {
            toast.error('Cannot process payout for pending bookings');
            return;
        }

        setPayoutLoading(true);
        try {
            const token = getAuthToken();
            const response = await axios.post(`${URL}/api/v2/admin/payout/process`, {
                bookingId: booking.bookingId,
                userId: payoutForm.userId,
                amount: payoutForm.amount
            }, {
                headers: {
                    "Authorization": "Bearer " + token
                }
            });

            if (response.status === 200) {
                toast.success('Payout initiated successfully');
                setShowPayoutModal(false);
                setPayoutForm({ userType: 'customer', amount: '', userId: '' });
                
                // Refresh booking details to get updated settlement status
                const bookingResponse = await axios.get(`${URL}/api/v2/booking/admin/details/${bookingId}`, {
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                });
                setBooking(bookingResponse.data.booking);
            }
        } catch (error: any) {
            console.log(error);
            toast.error(error.response?.data?.error || 'Failed to process payout');
        } finally {
            setPayoutLoading(false);
        }
    };

    const checkPayoutStatus = async () => {
        if (!booking) return;

        try {
            const token = getAuthToken();
            const response = await axios.get(`${URL}/api/v2/admin/payout/status/${booking.bookingId}`, {
                headers: {
                    "Authorization": "Bearer " + token
                }
            });
            
            if (response.status === 200) {
                const payoutData = response.data;
                
                // Show detailed status information
                const statusMessage = `
Payout Details:
• Payout ID: ${payoutData.payout.payoutId}
• Amount: ₹${payoutData.payout.amount}
• Status: ${payoutData.payout.status.toUpperCase()}
• Settlement: ${payoutData.booking.settlementStatus.toUpperCase()}
• Initiated: ${new Date(payoutData.payout.initiatedAt).toLocaleString()}
${payoutData.payout.razorpayData ? `• UTR: ${payoutData.payout.razorpayData.utr}` : ''}
                `;
                
                alert(statusMessage);
                
                // Update booking data with latest settlement status
                setBooking(prev => prev ? { ...prev, settlementStatus: payoutData.booking.settlementStatus } : null);
            }
        } catch (error: any) {
            console.log(error);
            toast.error(error.response?.data?.error || 'Failed to check payout status');
        }
    };

    const openPayoutModal = () => {
        if (!booking) return;
        
        setPayoutForm({
            userType: 'customer',
            amount: '',
            userId: booking.bookedBy._id
        });
        setShowPayoutModal(true);
    };

    const getSettlementBadge = (status?: string) => {
        if (!status) return null;
        
        const statusClasses = {
            unpaid: 'bg-red-100 text-red-800 border-red-200',
            partiallypaid: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            fullpaid: 'bg-green-100 text-green-800 border-green-200'
        };
        
        const displayText = {
            unpaid: 'Unpaid',
            partiallypaid: 'Partially Paid',
            fullpaid: 'Fully Paid'
        };
        
        return (
            <span className={`px-4 py-2 text-sm font-medium rounded-full border ${statusClasses[status as keyof typeof statusClasses]}`}>
                {displayText[status as keyof typeof displayText]}
            </span>
        );
    };

    const getStatusBadge = (status: string) => {
        const statusClasses = {
            PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            ASSIGNED: 'bg-blue-100 text-blue-800 border-blue-200',
            PICKEDUP: 'bg-purple-100 text-purple-800 border-purple-200',
            COMPLETED: 'bg-green-100 text-green-800 border-green-200',
            CANCELLED: 'bg-red-100 text-red-800 border-red-200'
        };
        
        return (
            <span className={`px-4 py-2 text-sm font-medium rounded-full border ${statusClasses[status as keyof typeof statusClasses]}`}>
                {status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className='w-full h-auto flex flex-col lg:flex-row mt-[8vh]'>
                <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100'></div>
                <div className='w-full flex-1 bg-gray-100 flex justify-center items-center'>
                    <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#fb651e]"></div>
                        <span className="text-gray-600">Loading booking details...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!booking) {
        return (
            <div className='w-full h-auto flex flex-col lg:flex-row mt-[8vh]'>
                <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100'></div>
                <div className='w-full flex-1 bg-gray-100 flex justify-center items-center'>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-700 mb-2">Booking Not Found</h2>
                        <p className="text-gray-500 mb-4">The booking you're looking for doesn't exist.</p>
                        <button 
                            onClick={() => navigate('/admin/bookings')}
                            className="bg-[#fb651e] text-white px-4 py-2 rounded-md hover:bg-[#fb641ec8] transition"
                        >
                            Back to Bookings
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='w-full h-auto flex flex-col lg:flex-row mt-[8vh]'>
            <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100'></div>
            <div className='w-full flex-1 bg-gray-100'>
                <div className="p-4 sm:p-6 bg-gray-100">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-6">
                        <button 
                            onClick={() => navigate('/admin/bookings')}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition"
                        >
                            <FaArrowLeft />
                            <span>Back to Bookings</span>
                        </button>
                        <h1 className="text-2xl font-medium text-gray-700">
                            Booking Details - {booking.bookingId}
                        </h1>
                        <div className="flex gap-2">
                            {getStatusBadge(booking.status)}
                            {getSettlementBadge(booking.settlementStatus || 'unpaid')}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Booking Information */}
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FaCar className="text-[#fb651e]" />
                                    Booking Information
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Booking ID</label>
                                        <p className="font-mono text-sm text-blue-600 font-medium">{booking.bookingId}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Vehicle Type</label>
                                        <p className="font-medium">{booking.vehicleType}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Pickup Date</label>
                                        <p className="flex items-center gap-2">
                                            <FaCalendar className="text-gray-400" />
                                            {new Date(booking.pickUpDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Pickup Time</label>
                                        <p className="flex items-center gap-2">
                                            <FaClock className="text-gray-400" />
                                            {booking.pickUpTime}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Booking Type</label>
                                        <p className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                            {booking.bookingType}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Created</label>
                                        <p className="text-sm text-gray-500">
                                            {new Date(booking.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="text-sm font-medium text-gray-600">Route</label>
                                    <div className="flex items-start gap-3 mt-2">
                                        <FaMapMarkerAlt className="text-green-500 mt-1" />
                                        <div className="flex-1">
                                            <p className="font-medium text-green-700">{booking.pickUpLocation}</p>
                                            <div className="border-l-2 border-gray-300 ml-2 my-2 h-4"></div>
                                            <FaMapMarkerAlt className="text-red-500" />
                                            <p className="font-medium text-red-700">{booking.dropLocation}</p>
                                        </div>
                                    </div>
                                </div>

                                {booking.extraRequirements && booking.extraRequirements.length > 0 && (
                                    <div className="mt-4">
                                        <label className="text-sm font-medium text-gray-600">Extra Requirements</label>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {booking.extraRequirements.map((req, index) => (
                                                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                                    {req}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Payment Information */}
                            <div className="bg-white rounded-lg shadow-sm border p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FaRupeeSign className="text-[#fb651e]" />
                                    Payment Information
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Booking Amount</label>
                                        <p className="text-lg font-bold text-green-600">
                                            {booking.bookingAmount ? `₹${booking.bookingAmount}` : 'Not set'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Commission Amount</label>
                                        <p className="text-lg font-bold text-blue-600">
                                            {booking.commissionAmount ? `₹${booking.commissionAmount}` : 'Not set'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Payment Status</label>
                                        <p className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                                            booking.isPaid 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {booking.isPaid ? 'Paid' : 'Pending'}
                                        </p>
                                    </div>
                                    {booking.upiId && (
                                        <div>
                                            <label className="text-sm font-medium text-gray-600">UPI ID</label>
                                            <p className="font-mono text-sm">{booking.upiId}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Settlement & Payout Management */}
                            <div className="bg-white rounded-lg shadow-sm border p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <PiPaypalLogoLight className="text-[#fb651e]" />
                                    Settlement & Payout Management
                                </h3>
                                
                                <div className="space-y-4">
                                    {/* Settlement Status */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-sm font-medium text-gray-600">Settlement Status</label>
                                            <div className="mt-1">
                                                {getSettlementBadge(booking.settlementStatus || 'unpaid')}
                                            </div>
                                        </div>
                                        {booking.payoutAmount && (
                                            <div className="text-right">
                                                <label className="text-sm font-medium text-gray-600">Payout Amount</label>
                                                <p className="text-lg font-bold text-green-600">₹{booking.payoutAmount}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                                        <button 
                                            onClick={openPayoutModal}
                                            disabled={booking.status === 'PENDING' || booking.settlementStatus === 'fullpaid' || !booking.commissionAmount || parseFloat(booking.commissionAmount) <= 0}
                                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                        >
                                            <FaRupeeSign size={14} />
                                            Process Payout
                                        </button>
                                        <button 
                                            onClick={checkPayoutStatus}
                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <FaIdCard size={14} />
                                            Check Status
                                        </button>
                                    </div>

                                    {/* Payout Status Info */}
                                    {booking.payoutStatus && (
                                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                            <label className="text-sm font-medium text-gray-600">Payout Status</label>
                                            <p className="text-sm font-medium capitalize">{booking.payoutStatus}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Customer & Driver Information */}
                        <div className="space-y-6">
                            {/* Customer Information */}
                            <div className="bg-white rounded-lg shadow-sm border p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FaUser className="text-[#fb651e]" />
                                    Customer Details
                                </h3>
                                
                                <div className="flex items-center gap-3 mb-4">
                                    
                                    <div>
                                        <h4 className="font-medium text-gray-800">{booking.bookedBy.name}</h4>
                                        <p className="text-sm text-gray-500">{booking.bookedBy.userType}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <FaPhone className="text-gray-400" />
                                        <span className="text-sm">+91 {booking.bookedBy.phoneNumber}</span>
                                    </div>
                                    {booking.bookedBy.email && (
                                        <div className="flex items-center gap-2">
                                            <FaEnvelope className="text-gray-400" />
                                            <span className="text-sm">{booking.bookedBy.email}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <FaMapMarkerAlt className="text-gray-400" />
                                        <span className="text-sm">{booking.bookedBy.city}</span>
                                    </div>
                                    {booking.bookedBy.aadharNumber && (
                                        <div className="flex items-center gap-2">
                                            <FaIdCard className="text-gray-400" />
                                            <span className="text-sm">Aadhar: {booking.bookedBy.aadharNumber}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        booking.bookedBy.isUserVerified 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {booking.bookedBy.isUserVerified ? 'Verified' : 'Unverified'}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        booking.bookedBy.isSubscribed 
                                            ? 'bg-blue-100 text-blue-800' 
                                            : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {booking.bookedBy.isSubscribed ? 'Subscribed' : 'Free User'}
                                    </span>
                                </div>
                            </div>

                            {/* Driver Information */}
                            {booking.recivedBy ? (
                                <div className="bg-white rounded-lg shadow-sm border p-6">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                        <FaUser className="text-[#fb651e]" />
                                        Driver Details
                                    </h3>
                                    
                                    <div className="flex items-center gap-3 mb-4">
                                        {/* <img 
                                            src={booking.recivedBy.userImage || '/userimages/default.png'} 
                                            alt={booking.recivedBy.name}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/userimages/default.png';
                                            }}
                                        /> */}
                                        <div>
                                            <h4 className="font-medium text-gray-800">{booking.recivedBy.name}</h4>
                                            <p className="text-sm text-gray-500">{booking.recivedBy.userType}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <FaPhone className="text-gray-400" />
                                            <span className="text-sm">+91 {booking.recivedBy.phoneNumber}</span>
                                        </div>
                                        {booking.recivedBy.email && (
                                            <div className="flex items-center gap-2">
                                                <FaEnvelope className="text-gray-400" />
                                                <span className="text-sm">{booking.recivedBy.email}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <FaMapMarkerAlt className="text-gray-400" />
                                            <span className="text-sm">{booking.recivedBy.city}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <PiPaypalLogoLight className="text-gray-400" />
                                            <span className="text-sm">{booking?.payeeUpiId || 'N/A'}</span>
                                        </div>
                                        {booking.recivedBy.drivingLicenceNumber && (
                                            <div className="flex items-center gap-2">
                                                <FaIdCard className="text-gray-400" />
                                                <span className="text-sm">DL: {booking.recivedBy.drivingLicenceNumber}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg shadow-sm border p-6">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                        <FaUser className="text-[#fb651e]" />
                                        Driver Details
                                    </h3>
                                    <div className="text-center text-gray-500 py-4">
                                        <p>No driver assigned yet</p>
                                    </div>
                                </div>
                            )}

                            {/* Additional Options */}
                            <div className="bg-white rounded-lg shadow-sm border p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Booking Options</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Best Quote Price</span>
                                        <span className={`text-sm font-medium ${booking.getBestQuotePrice ? 'text-green-600' : 'text-gray-500'}`}>
                                            {booking.getBestQuotePrice ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Profile Hidden</span>
                                        <span className={`text-sm font-medium ${booking.isProfileHidden ? 'text-red-600' : 'text-green-600'}`}>
                                            {booking.isProfileHidden ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payout Modal */}
            {showPayoutModal && booking && (
                <div className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <PiPaypalLogoLight className="text-[#fb651e]" />
                            Process Payout
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-sm text-gray-600 mb-1">Booking ID</p>
                                <p className="font-mono text-sm font-medium">#{booking.bookingId}</p>
                                <p className="text-sm text-gray-600 mb-1 mt-2">Total Amount</p>
                                <p className="text-lg font-bold text-green-600">₹{booking.bookingAmount}</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Pay To</label>
                                <select 
                                    value={payoutForm.userType}
                                    onChange={(e) => {
                                        const userType = e.target.value as 'customer' | 'driver';
                                        setPayoutForm(prev => ({
                                            ...prev,
                                            userType,
                                            userId: userType === 'customer' ? booking.bookedBy._id : booking.recivedBy?._id || ''
                                        }));
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="customer">
                                        Customer - {booking.bookedBy.name} ({booking.bookedBy.phoneNumber})
                                    </option>
                                    {booking.recivedBy && (
                                        <option value="driver">
                                            Driver - {booking.recivedBy.name} ({booking.recivedBy.phoneNumber})
                                        </option>
                                    )}
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Payout Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-500">₹</span>
                                    <input
                                        type="number"
                                        placeholder="Enter amount"
                                        value={payoutForm.amount}
                                        max={booking.commissionAmount || 0}
                                        onChange={(e) => setPayoutForm(prev => ({ ...prev, amount: e.target.value }))}
                                        className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                                            payoutForm.amount && parseFloat(payoutForm.amount) > parseFloat(booking.commissionAmount || '0')
                                                ? 'border-red-300 focus:ring-red-500' 
                                                : 'border-gray-300'
                                        }`}
                                    />
                                </div>
                                <div className="flex justify-between text-xs mt-1">
                                    <p className="text-gray-500">
                                        Commission: ₹{booking.commissionAmount || '0'}
                                    </p>
                                    <p className="text-blue-600">
                                        Max: ₹{parseFloat(booking.commissionAmount || '0') - parseFloat(booking.payoutAmount || '0') || '0'}
                                    </p>
                                </div>
                                {payoutForm.amount && parseFloat(payoutForm.amount) > ((parseFloat(booking.commissionAmount || '0') - parseFloat(booking.payoutAmount || '0'))) && (
                                    <p className="text-red-500 text-xs mt-1">
                                        Payout amount cannot exceed commission amount
                                    </p>
                                )}
                            </div>

                            {/* UPI Info */}
                            <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-sm text-blue-800 font-medium">
                                    Payout will be processed to the registered UPI ID
                                </p>
                                {booking.upiId && (
                                    <p className="text-xs text-blue-600 mt-1">UPI: {booking.upiId}</p>
                                )}
                            </div>

                            {/* Payout Rules */}
                            <div className="bg-yellow-50 p-3 rounded-lg">
                                <p className="text-sm text-yellow-800 font-medium">Payout Rules:</p>
                                <ul className="text-xs text-yellow-700 mt-1 list-disc list-inside">
                                    <li>Payout amount must not exceed commission amount</li>
                                    <li>Available for all booking statuses except PENDING</li>
                                    <li>Cannot process if settlement is already full paid</li>
                                </ul>
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <button 
                                    onClick={() => setShowPayoutModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={processPayout}
                                    disabled={
                                        payoutLoading || 
                                        !payoutForm.amount || 
                                        parseFloat(payoutForm.amount) <= 0 ||
                                        parseFloat(payoutForm.amount) > parseFloat(booking.commissionAmount || '0')
                                    }
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                                >
                                    {payoutLoading ? (
                                        <span>Processing...</span>
                                    ) : (
                                        <>
                                            <FaRupeeSign size={14} />
                                            Process Payout
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingDetails;