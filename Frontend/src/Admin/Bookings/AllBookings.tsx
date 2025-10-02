import { FaEye, FaCalendar, FaCar, FaSearch, FaTimes } from "react-icons/fa";
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
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');
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

    // Debounce search input
    useEffect(() => {
        const delayedSearch = setTimeout(() => {
            setSearchQuery(searchInput);
            setPage(1); // Reset to first page when searching
        }, 500); // 500ms delay

        return () => clearTimeout(delayedSearch);
    }, [searchInput]);

    // Handle search input change
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value);
    };

    // Clear search
    const clearSearch = () => {
        setSearchInput('');
        setSearchQuery('');
        setPage(1);
    };

    const fetchData = async () => {
        const storedData: any = localStorage.getItem('auth');
        const auth: auth = JSON.parse(storedData);
        const token: string | undefined = (auth as any)?.authToken;
        setLoading(true);
        
        try {
            // Build query parameters
            const queryParams = new URLSearchParams({
                status: status,
                page: page.toString(),
                limit: limit,
                ...(searchQuery && { search: searchQuery })
            });

            const res = await axios.get<BookingResponse>(
                `${URL}/api/v2/booking/admin/all?${queryParams.toString()}`, 
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
    }, [page, limit, status, searchQuery]);

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

                    {/* Search and Controls */}
                    <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center mb-6 gap-4">
                        {/* Search Bar */}
                        <div className="relative flex-1 max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FaSearch className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchInput}
                                onChange={handleSearchChange}
                                placeholder="Search by booking ID, name, phone, vehicle type, location..."
                                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#fb651e] focus:border-transparent"
                            />
                            {searchInput && (
                                <button
                                    onClick={clearSearch}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                                >
                                    <FaTimes className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                </button>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select 
                                name='limit' 
                                value={limit}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#fb651e] focus:border-transparent" 
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
                            
                            <button 
                                className="px-4 py-2 border border-gray-800 flex justify-center items-center gap-2 rounded-lg cursor-pointer font-medium hover:bg-gray-50 transition-colors" 
                                onClick={() => exportToExcel(data)}
                            >
                                <FaFileExport className="translate-y-[1px]" />Export
                            </button>
                        </div>
                    </div>

                    {/* Search Results Info */}
                    {searchQuery && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-blue-700">
                                    Search results for: <strong>"{searchQuery}"</strong>
                                    {pagination.totalBookings > 0 && (
                                        <span className="ml-2">({pagination.totalBookings} found)</span>
                                    )}
                                </span>
                                <button
                                    onClick={clearSearch}
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                    Clear search
                                </button>
                            </div>
                        </div>
                    )}


                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#fb651e]"></div>
                            <span className="ml-2 text-gray-600">
                                {searchQuery ? 'Searching bookings...' : 'Loading bookings...'}
                            </span>
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
                                            <td className="py-8 px-6 font-semibold text-gray-600" colSpan={9}>
                                                {searchQuery ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <FaSearch className="text-gray-400 text-2xl" />
                                                        <span>No bookings found matching "{searchQuery}"</span>
                                                        <button
                                                            onClick={clearSearch}
                                                            className="text-[#fb651e] hover:underline text-sm font-medium"
                                                        >
                                                            Clear search to see all bookings
                                                        </button>
                                                    </div>
                                                ) : (
                                                    "No bookings found."
                                                )}
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
                                            Showing {((pagination?.currentPage || 1 - 1) * parseInt(limit)) + 1} to {Math.min((pagination?.currentPage || 1) * parseInt(limit), pagination?.totalBookings || 0)} of {pagination?.totalBookings || 0} {searchQuery ? 'search results' : 'bookings'}
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