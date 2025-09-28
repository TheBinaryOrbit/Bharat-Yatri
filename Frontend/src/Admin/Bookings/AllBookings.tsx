import { FaEye, FaCalendar, FaCar } from "react-icons/fa";
import { useEffect, useState } from "react";
import axios from "axios";
import URL from "../../lib/url";
import { auth } from "../../lib/types";
import { toast } from "react-toastify";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaFileExport } from "react-icons/fa";

interface Booking {
    _id: string;
    bookingId: string;
    vehicleType: string;
    pickUpDate: string;
    pickUpTime: string;
    pickUpLocation: string;
    dropLocation: string;
    bookingType: string;
    status: string;
    bookingAmount?: string;
    bookedBy: {
        _id: string;
        name: string;
        phoneNumber: string;
        city: string;
        userType: string;
    };
    recivedBy?: {
        _id: string;
        name: string;
        phoneNumber: string;
        city: string;
        userType: string;
    };
    createdAt: string;
}

interface BookingResponse {
    message: string;
    bookings: Booking[];
    statusSummary: {
        PENDING: number;
        ASSIGNED: number;
        PICKEDUP: number;
        COMPLETED: number;
        CANCELLED: number;
    };
    pagination: {
        currentPage: number;
        totalPages: number;
        totalBookings: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

const AllBookings = () => {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState('10');
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('All');
    const [data, setData] = useState<Booking[]>([]);
    const [statusSummary, setStatusSummary] = useState({
        PENDING: 0,
        ASSIGNED: 0,
        PICKEDUP: 0,
        COMPLETED: 0,
        CANCELLED: 0
    });
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 0,
        totalBookings: 0,
        hasNextPage: false,
        hasPrevPage: false
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Get status from URL params
    useEffect(() => {
        const statusParam = searchParams.get('status');
        if (statusParam) {
            setStatus(statusParam.toUpperCase());
        } else {
            setStatus('All');
        }
    }, [searchParams]);

    const fetchData = async () => {
        const storedData: any = localStorage.getItem('auth');
        const auth: auth = JSON.parse(storedData);
        const token: string | undefined = (auth as any)?.authToken;
        setLoading(true);
        
        try {
            const res = await axios.get<BookingResponse>(
                `${URL}/api/v2/booking/admin/all?status=${status}&page=${page}&limit=${limit}`, 
                {
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                }
            );
            
            setData(res.data?.bookings || []);
            setStatusSummary(res.data?.statusSummary || {
                PENDING: 0,
                ASSIGNED: 0,
                PICKEDUP: 0,
                COMPLETED: 0,
                CANCELLED: 0
            });
            setPagination(res.data?.pagination || {
                currentPage: 1,
                totalPages: 0,
                totalBookings: 0,
                hasNextPage: false,
                hasPrevPage: false
            });
            setLoading(false);
        } catch (error: any) {
            console.log(error);
            setLoading(false);
            return toast.error(error.response?.data?.error || 'Failed to fetch bookings');
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, limit, status]);

    const getPageTitle = () => {
        switch(status) {
            case 'PENDING': return 'Pending Bookings';
            case 'ASSIGNED': return 'Assigned Bookings';
            case 'PICKEDUP': return 'Picked Up Bookings';
            case 'COMPLETED': return 'Completed Bookings';
            case 'CANCELLED': return 'Cancelled Bookings';
            default: return 'All Bookings';
        }
    };

    const getStatusBadge = (bookingStatus: string) => {
        const statusClasses = {
            PENDING: 'bg-yellow-100 text-yellow-800',
            ASSIGNED: 'bg-blue-100 text-blue-800',
            PICKEDUP: 'bg-purple-100 text-purple-800',
            COMPLETED: 'bg-green-100 text-green-800',
            CANCELLED: 'bg-red-100 text-red-800'
        };
        
        return (
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusClasses[bookingStatus as keyof typeof statusClasses]}`}>
                {bookingStatus}
            </span>
        );
    };

    const exportToExcel = (bookingData: Booking[]) => {
        // Implementation for Excel export
        console.log('Exporting bookings:', bookingData);
        toast.info('Export functionality to be implemented');
    };

    return (
        <div className='w-full h-auto flex flex-col lg:flex-row mt-[8vh]'>
            <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100 flex justify-center items-center p-4'>
            </div>
            <div className='w-full flex-1 bg-gray-100'>
                <div className="p-4 sm:p-6 bg-gray-100 overflow-x-auto">
                    <h1 className="text-2xl font-medium mb-4 text-gray-700 capitalize">
                        <span className="text-gray-500 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
                            Dashboard
                        </span> / {getPageTitle()}
                    </h1>

                    {/* Status Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="text-yellow-600 text-2xl font-bold">{statusSummary?.PENDING || 0}</div>
                            <div className="text-gray-600 text-sm">Pending</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="text-blue-600 text-2xl font-bold">{statusSummary?.ASSIGNED || 0}</div>
                            <div className="text-gray-600 text-sm">Assigned</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="text-purple-600 text-2xl font-bold">{statusSummary?.PICKEDUP || 0}</div>
                            <div className="text-gray-600 text-sm">Picked Up</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="text-green-600 text-2xl font-bold">{statusSummary?.COMPLETED || 0}</div>
                            <div className="text-gray-600 text-sm">Completed</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <div className="text-red-600 text-2xl font-bold">{statusSummary?.CANCELLED || 0}</div>
                            <div className="text-gray-600 text-sm">Cancelled</div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                        <div className='flex gap-4'>
                            {/* <select 
                                name='status' 
                                value={status}
                                className="border rounded p-2 w-full sm:w-auto text-gray-700 cursor-pointer" 
                                onChange={(e) => {
                                    setStatus(e.target.value);
                                    setPage(1);
                                }} 
                            >
                                <option value='All'>All Bookings</option>
                                <option value='PENDING'>Pending</option>
                                <option value='ASSIGNED'>Assigned</option>
                                <option value='PICKEDUP'>Picked Up</option>
                                <option value='COMPLETED'>Completed</option>
                                <option value='CANCELLED'>Cancelled</option>
                            </select> */}
                            <select 
                                name='limit' 
                                value={limit}
                                className="border rounded p-2 w-full sm:w-auto text-gray-700 cursor-pointer" 
                                onChange={(e) => {
                                    setLimit(e.target.value);
                                    setPage(1);
                                }} 
                            >
                                <option value='10'>10 per page</option>
                                <option value='25'>25 per page</option>
                                <option value='50'>50 per page</option>
                                <option value='100'>100 per page</option>
                            </select>
                        </div>
                        <div className='flex gap-4 flex-col sm:flex-row'>
                            <button 
                                className="px-4 py-2 border border-gray-800 flex justify-center items-center gap-2 rounded-lg cursor-pointer font-medium" 
                                onClick={() => exportToExcel(data)}
                            >
                                <FaFileExport className="translate-y-[1px]" />Export
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#fb651e]"></div>
                            <span className="ml-2 text-gray-600">Loading bookings...</span>
                        </div>
                    ) : (
                        <div className="rounded-xl overflow-x-scroll scrolbar border border-gray-300 shadow-md bg-white">
                            <table className="min-w-full text-sm text-gray-700">
                                <thead className="bg-[#fb651e] text-white text-left text-base font-semibold">
                                    <tr>
                                        <th className="py-3 px-6">Booking ID</th>
                                        <th className="py-3 px-6">Vehicle</th>
                                        <th className="py-3 px-6">Date & Time</th>
                                        {/* <th className="py-3 px-6">Route</th> */}
                                        <th className="py-3 px-6">Type</th>
                                        <th className="py-3 px-6">Customer</th>
                                        <th className="py-3 px-6">Driver</th>
                                        <th className="py-3 px-6">Amount</th>
                                        <th className="py-3 px-6">Status</th>
                                        <th className="py-3 px-6">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.length === 0 ? (
                                        <tr className="border-b hover:bg-gray-50 transition text-center">
                                            <td className="py-4 px-6 font-semibold text-gray-600" colSpan={10}>
                                                No bookings found.
                                            </td>
                                        </tr>
                                    ) : (
                                        data.map((booking: Booking, i) => (
                                            <tr
                                                key={booking?._id || i}
                                                className={`border-b text-left hover:bg-gray-50 transition ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                                            >
                                                <td className="py-4 px-6 font-mono text-sm font-medium text-blue-600">
                                                    {booking?.bookingId || 'N/A'}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-2">
                                                        <FaCar className="text-gray-400" />
                                                        <span className="font-medium">{booking?.vehicleType || 'N/A'}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-2">
                                                        <FaCalendar className="text-gray-400" />
                                                        <div>
                                                            <div className="font-medium">
                                                                {booking?.pickUpDate ? new Date(booking.pickUpDate).toLocaleDateString() : 'N/A'}
                                                            </div>
                                                            <div className="text-sm text-gray-500">{booking?.pickUpTime || 'N/A'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* <td className="py-4 px-6 max-w-xs">
                                                    <div className="flex items-start gap-2">
                                                        <FaMapMarkerAlt className="text-gray-400 mt-1 flex-shrink-0" />
                                                        <div className="text-sm">
                                                            <div className="font-medium truncate">{booking.pickUpLocation}</div>
                                                            <div className="text-gray-500 truncate">→ {booking.dropLocation}</div>
                                                        </div>
                                                    </div>
                                                </td> */}
                                                <td className="py-4 px-6">
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                                        {booking?.bookingType || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="text-sm">
                                                        <div className="font-medium">{booking?.bookedBy?.name || 'N/A'}</div>
                                                        <div className="text-gray-500">+91 {booking?.bookedBy?.phoneNumber || 'N/A'}</div>
                                                        <div className="text-xs text-gray-400">{booking?.bookedBy?.city || 'N/A'}</div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    {booking?.recivedBy ? (
                                                        <div className="text-sm">
                                                            <div className="font-medium">{booking?.recivedBy?.name || 'N/A'}</div>
                                                            <div className="text-gray-500">+91 {booking?.recivedBy?.phoneNumber || 'N/A'}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">Not assigned</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6">
                                                    {booking?.bookingAmount ? (
                                                        <span className="font-medium text-green-600">₹{booking.bookingAmount}</span>
                                                    ) : (
                                                        <span className="text-gray-400">N/A</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6">
                                                    {getStatusBadge(booking?.status || 'PENDING')}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <button
                                                        className="bg-[#fb651e] hover:bg-[#fb641ec8] cursor-pointer p-2 rounded-md transition duration-200 shadow-md"
                                                        onClick={() => booking?.bookingId && navigate(`/admin/booking/details/${booking.bookingId}`)}
                                                        title="View Details"
                                                        disabled={!booking?.bookingId}
                                                    >
                                                        <FaEye className="text-white" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            
                            {/* Pagination */}
                            {data.length > 0 && (
                                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                        <div className="text-sm text-gray-600">
                                            Showing {((pagination?.currentPage || 1 - 1) * parseInt(limit)) + 1} to {Math.min((pagination?.currentPage || 1) * parseInt(limit), pagination?.totalBookings || 0)} of {pagination?.totalBookings || 0} bookings
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                className={`px-3 py-1 rounded-md border text-sm transition ${
                                                    !pagination?.hasPrevPage 
                                                        ? "opacity-50 cursor-not-allowed border-gray-300 text-gray-400" 
                                                        : "border-[#fb651e] text-[#fb651e] hover:bg-[#fb651e] hover:text-white"
                                                }`}
                                                disabled={!pagination?.hasPrevPage}
                                                onClick={() => setPage(page - 1)}
                                            >
                                                Previous
                                            </button>
                                            
                                            <span className="px-3 py-1 text-sm font-medium text-gray-700">
                                                Page {pagination?.currentPage || 1} of {pagination?.totalPages || 1}
                                            </span>
                                            
                                            <button
                                                className={`px-3 py-1 rounded-md border text-sm transition ${
                                                    !pagination?.hasNextPage
                                                        ? "opacity-50 cursor-not-allowed border-gray-300 text-gray-400"
                                                        : "border-[#fb651e] text-[#fb651e] hover:bg-[#fb651e] hover:text-white"
                                                }`}
                                                disabled={!pagination?.hasNextPage}
                                                onClick={() => setPage(page + 1)}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AllBookings;