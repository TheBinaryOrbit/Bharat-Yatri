import { useEffect, useState } from "react";
import axios from "axios";
import URL from "../../lib/url";
import { auth, exchnage, ride } from "../../lib/types";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import exportToExcel from "../ExcleExport/ExportToExcle";
import { FaFileExport } from "react-icons/fa";

const Exchange = () => {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState('10');
    const [status, setStatus] = useState('all')
    const [data, setData] = useState([])
    const [totalRides, settotalRides] = useState(0)
    const navigate = useNavigate()

    useEffect(() => {
        const fetchData = async () => {
            const auth: auth | null = JSON.parse(localStorage.getItem('auth'))
            const token: string | undefined = auth?.authToken
            try {
                const res = await axios.get(`${URL}/api/ride/getallrides?status=${status}&page=${page}&limit=${limit}&ridetype=Exchange`, {
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                })
                setData(res.data.rides);
                settotalRides(res.data.totalrides);
            } catch (error: any) {
                console.log(error);
                return toast.error(error.response.data.error)
            }
        }
        fetchData()
    }, [page, limit, status])

    return (
        <div className='w-full h-auto flex flex-col lg:flex-row mt-[10vh]' >
            <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100 flex justify-center items-center p-4'>
            </div>
            <div className='w-full flex-1 bg-gray-100'>
                <div className="p-4 sm:p-6 bg-gray-100 overflow-x-auto">
                    <h1 className="text-2xl font-medium mb-4 text-gray-700 capitalize"><span className="text-gray-500 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>Dashboard</span> / Rides / Exchange</h1>


                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                        <div className='flex gap-4'>
                            <select name='option' className="border rounded p-2 w-full sm:w-auto text-gray-700 cursor-pointer" onChange={(e) => setStatus(e.target.value)} >
                                <option value='all'>All Rides</option>
                                <option value='Pending'>Pending</option>
                                <option value='Completed'>Completed</option>
                            </select>
                            <select name='limit' className="border rounded p-2 w-full sm:w-auto text-gray-700 cursor-pointer" onChange={(e) => setLimit(e.target.value)} >
                                <option value='10'>Limit</option>
                                <option value='10'>10</option>
                                <option value='50'>50</option>
                                <option value='100'>100</option>
                            </select>
                        </div>
                        <div className='flex gap-4'>
                            <button className="px-4 py-2 border border-gray-800 flex justify-center items-center gap-2 rounded-lg cursor-pointer font-medium"  onClick={()=> exportToExcel(data)}><FaFileExport className="translate-y-[1px]"/>Export</button>
                        </div>
                    </div>


                    <div className="rounded-xl overflow-x-scroll scrolbar border border-gray-300 shadow-md bg-white">
                        <table className="min-w-full text-sm text-gray-700">
                            <thead className="bg-blue-600 text-white text-left text-base font-semibold">
                                <tr>
                                    <th className="py-3 px-6">To</th>
                                    <th className="py-3 px-6">From</th>
                                    <th className="py-3 px-6">Car Model</th>
                                    <th className="py-3 px-6">createdAt</th>
                                    <th className="py-3 px-6">Status</th>
                                    <th className="py-3 px-6">Created By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.length === 0 ? (
                                    <tr className="border-b hover:bg-gray-50 transition text-center">
                                        <td className="py-4 px-6 font-semibold text-gray-600" colSpan={6}>
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((ride: exchnage, i) => (
                                        <tr
                                            key={ride._id}
                                            className={`border-b text-left ${i % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                                        >
                                            <td className="py-4 px-6">{ride.to}</td>
                                            <td className="py-4 px-6 font-medium">{ride.from}</td>
                                            <td className="py-4 px-6">{ride.carModel}</td>
                                            <td className="py-4 px-6">{ride.createdAt}</td>
                                            <td className="py-4 px-6">
                                                <span
                                                    className={`px-3 py-1 text-sm font-medium rounded-md ${ride.status == "Pending" ? "bg-yellow-400 text-white" : "bg-green-500 text-white"
                                                        }`}
                                                >
                                                    {ride.status}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 cursor-pointer hover:underline duration-200 font-bold" onClick={()=> navigate(`/admin/specificuser/${ride.createdByDetails._id}`)}>{ride.createdByDetails.name}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td className="py-4 px-6 text-center" colSpan={7}>
                                        <div className="flex justify-between items-center">
                                            <button
                                                className={`px-4 py-2 rounded-md border border-blue-500 text-blue-600 transition ${page === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-100"
                                                    }`}
                                                disabled={page === 1}
                                                onClick={() => setPage(page - 1)}
                                            >
                                                Previous
                                            </button>
                                            <span className="text-gray-600 font-medium">
                                                Page {page} of {Math.ceil((+totalRides) / (+limit))}
                                            </span>
                                            <button
                                                className={`px-4 py-2 rounded-md border border-blue-500 text-blue-600 transition ${page >= Math.ceil((+totalRides) / (+limit))
                                                    ? "opacity-50 cursor-not-allowed"
                                                    : "hover:bg-blue-100"
                                                    }`}
                                                disabled={page >= Math.ceil((+totalRides) / (+limit))}
                                                onClick={() => setPage(page + 1)}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Exchange;