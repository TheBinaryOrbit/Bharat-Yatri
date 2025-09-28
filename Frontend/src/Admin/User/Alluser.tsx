import { FaEye } from "react-icons/fa";
import { useEffect, useState } from "react";
import axios from "axios";
import URL from "../../lib/url";
import { user } from "../../lib/types";
import { toast } from "react-toastify";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaFileExport  } from "react-icons/fa";
import exportToExcel from "../ExcleExport/ExportToExcle";


const AllUser = () => {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState('10');
    const [searchParams] = useSearchParams();
    const [option, setOption] = useState('all')
    const [data, setData] = useState([])
    const [totaluser, setTotalUser] = useState(0)
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()


    // Get subscription status from URL params
    useEffect(() => {
        const subscribed = searchParams.get('subscribed');
        if (subscribed === 'true') {
            setOption('subscribed');
        } else if (subscribed === 'false') {
            setOption('not-subscribed');
        } else {
            setOption('all');
        }
    }, [searchParams]);

    const fetchData = async () => {
        
        setLoading(true);
        
        try {
            // Map option to the correct API parameter
            let subscriptionStatus = 'all';
            if (option === 'subscribed') subscriptionStatus = 'subscribed';
            if (option === 'not-subscribed') subscriptionStatus = 'not-subscribed';
            
            const res = await axios.get(`${URL}/api/v2/user/admin/all?subscriptionStatus=${subscriptionStatus}&page=${page}&limit=${limit}`, {
               
            })
            setData(res.data.users);
            setTotalUser(res.data.pagination.totalUsers);
            setLoading(false);
        } catch (error: any) {
            console.log(error);
            setLoading(false);
            return toast.error(error.response?.data?.error || 'Failed to fetch users')
        }
    }


    useEffect(() => {
        fetchData()
    }, [page, limit, option])

    const getPageTitle = () => {
        switch(option) {
            case 'subscribed': return 'Subscribed Users';
            case 'not-subscribed': return 'Unsubscribed Users';
            default: return 'All Users';
        }
    }

    return (
        <div className='w-full h-auto flex flex-col lg:flex-row mt-[8vh]' >
            <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100 flex justify-center items-center p-4'>
            </div>
            <div className='w-full flex-1 bg-gray-100'>
                <div className="p-4 sm:p-6 bg-gray-100 overflow-x-auto">
                    <h1 className="text-2xl font-medium mb-4 text-gray-700 capitalize">
                        <span className="text-gray-500 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>Dashboard</span> / {getPageTitle()}
                    </h1>

                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                        <div className='flex gap-4'>
                            <select 
                                name='option' 
                                value={option}
                                className="border rounded p-2 w-full sm:w-auto text-gray-700 cursor-pointer" 
                                onChange={(e) => {
                                    setOption(e.target.value);
                                    setPage(1); // Reset to first page
                                }} 
                            >
                                <option value='all'>All Users</option>
                                <option value='subscribed'>Subscribed Users</option>
                                <option value='not-subscribed'>Unsubscribed Users</option>
                            </select>
                            <select 
                                name='limit' 
                                value={limit}
                                className="border rounded p-2 w-full sm:w-auto text-gray-700 cursor-pointer" 
                                onChange={(e) => {
                                    setLimit(e.target.value);
                                    setPage(1); // Reset to first page
                                }} 
                            >
                                <option value='10'>10 per page</option>
                                <option value='25'>25 per page</option>
                                <option value='50'>50 per page</option>
                                <option value='100'>100 per page</option>
                            </select>
                        </div>
                        <div className='flex gap-4 flex-col sm:flex-row '>
                            <button className="px-4 py-2 border border-gray-800 flex justify-center items-center gap-2 rounded-lg cursor-pointer font-medium" onClick={() => exportToExcel(data)}>
                                <FaFileExport className="translate-y-[1px]" />Export
                            </button>
                        </div>
                    </div>


                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#fb651e]"></div>
                            <span className="ml-2 text-gray-600">Loading users...</span>
                        </div>
                    ) : (
                        <div className="rounded-xl overflow-x-scroll scrolbar border border-gray-300 shadow-md bg-white">
                            <table className="min-w-full text-sm text-gray-700">
                                <thead className="bg-[#fb651e] text-white text-left text-base font-semibold">
                                    <tr>
                                        <th className="py-3 px-6">Name</th>
                                        <th className="py-3 px-6">Phone</th>
                                        {/* <th className="py-3 px-6">Email</th> */}
                                        <th className="py-3 px-6">City</th>
                                        <th className="py-3 px-6">Type</th>
                                        <th className="py-3 px-6">Verified</th>
                                        <th className="py-3 px-6">Subscription</th>
                                        <th className="py-3 px-6">Joined</th>
                                        <th className="py-3 px-6">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.length === 0 ? (
                                        <tr className="border-b hover:bg-gray-50 transition text-center">
                                            <td className="py-4 px-6 font-semibold text-gray-600" colSpan={9}>
                                                No users found.
                                            </td>
                                        </tr>
                                    ) : (
                                        data.map((user: user, i) => (
                                            <tr
                                                key={user._id}
                                                className={`border-b text-left hover:bg-gray-50 transition ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                                            >
                                                <td className="py-4 px-6 flex items-center gap-3">
                                                    
                                                    <span className="font-medium">{user.name}</span>
                                                </td>
                                                <td className="py-4 px-6 font-medium">+91 {user.phoneNumber}</td>
                                                {/* <td className="py-4 px-6 text-sm">{(user as any).email || 'N/A'}</td> */}
                                                <td className="py-4 px-6">{(user as any).city}</td>
                                                <td className="py-4 px-6">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                                        {user.userType}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span
                                                        className={`px-3 py-1 text-sm font-medium rounded-full ${user.isVerified ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                                            }`}
                                                    >
                                                        {user.isVerified ? "Verified" : "Pending"}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span
                                                        className={`px-3 py-1 text-sm font-medium rounded-full ${user.isSubscribed ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                                                            }`}
                                                    >
                                                        {user.isSubscribed ? "Active" : "None"}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-sm text-gray-500">
                                                    {new Date((user as any).createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <button
                                                        className="bg-[#fb651e] hover:bg-[#fb641ec8] cursor-pointer p-2 rounded-md transition duration-200 shadow-md"
                                                        onClick={() => navigate(`/admin/user/details/${user._id}`)}
                                                        title="View Details"
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
                                            Showing {((page - 1) * parseInt(limit)) + 1} to {Math.min(page * parseInt(limit), totaluser)} of {totaluser} users
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                className={`px-3 py-1 rounded-md border text-sm transition ${
                                                    page === 1 
                                                        ? "opacity-50 cursor-not-allowed border-gray-300 text-gray-400" 
                                                        : "border-[#fb651e] text-[#fb651e] hover:bg-[#fb651e] hover:text-white"
                                                }`}
                                                disabled={page === 1}
                                                onClick={() => setPage(page - 1)}
                                            >
                                                Previous
                                            </button>
                                            
                                            <span className="px-3 py-1 text-sm font-medium text-gray-700">
                                                Page {page} of {Math.ceil(totaluser / parseInt(limit))}
                                            </span>
                                            
                                            <button
                                                className={`px-3 py-1 rounded-md border text-sm transition ${
                                                    page >= Math.ceil(totaluser / parseInt(limit))
                                                        ? "opacity-50 cursor-not-allowed border-gray-300 text-gray-400"
                                                        : "border-[#fb651e] text-[#fb651e] hover:bg-[#fb651e] hover:text-white"
                                                }`}
                                                disabled={page >= Math.ceil(totaluser / parseInt(limit))}
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
}

export default AllUser;