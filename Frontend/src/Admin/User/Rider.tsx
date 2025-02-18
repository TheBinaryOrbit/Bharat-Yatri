import { FaEye } from "react-icons/fa";
import { useEffect, useState } from "react";
import axios from "axios";
import URL from "../../lib/url";
import { auth, user } from "../../lib/types";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { FaFileExport, FaSearch } from "react-icons/fa";
import exportToExcel from "../ExcleExport/ExportToExcle";

const Rider = () => {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState('10');
    const [option, setOption] = useState('all')
    const [data, setData] = useState([])
    const [totaluser, setTotalUser] = useState(0)
    const navigate = useNavigate()
    const [name , setName] = useState<string>('')

    const fetchData = async () => {
        const storedData  : any = localStorage.getItem('auth')
  const auth : auth = JSON.parse(storedData)
        const token: string | undefined = auth?.authToken
        try {
            const res = await axios.get(`${URL}/api/admin/getallusers?options=${option}&page=${page}&limit=${limit}&usertype=RIDER&name=${name}`, {
                headers: {
                    "Authorization": "Bearer " + token
                }
            })
            setData(res.data.users);
            setTotalUser(res.data.totalUsers);
        } catch (error: any) {
            console.log(error);
            return toast.error(error.response.data.error)
        }
    }


    useEffect(() => {
        fetchData()
    }, [page, limit, option])

    const handlesearchByEnter = (e : any)=>{
        if(e.key == "Enter"){
            fetchData()
        }
    }

    const handleSearch = ()=>{
        fetchData()
    }

    return (
        <div className='w-full h-auto flex flex-col lg:flex-row mt-[8vh]' >
            <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100 flex justify-center items-center p-4'>
            </div>
            <div className='w-full flex-1 bg-gray-100'>
                <div className="p-4 sm:p-6 bg-gray-100 overflow-x-auto">
                    <h1 className="text-2xl font-medium mb-4 text-gray-700 capitalize"><span className="text-gray-500 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>Dashboard</span> / All Riders</h1>


                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                        <div className='flex gap-4'>
                            <select name='option' className="border rounded p-2 w-full sm:w-auto text-gray-700 cursor-pointer" onChange={(e) => setOption(e.target.value)} >
                                <option value='all'>All User</option>
                                <option value='Verified'>Verified</option>
                                <option value='UnVerified'>Un-Verified</option>
                            </select>
                            <select name='limit' className="border rounded p-2 w-full sm:w-auto text-gray-700 cursor-pointer" onChange={(e) => setLimit(e.target.value)} >
                                <option value='10'>Limit</option>
                                <option value='10'>10</option>
                                <option value='50'>50</option>
                                <option value='100'>100</option>
                            </select>
                        </div>
                        <div className='flex gap-4'>
                            <div className="flex items-center gap-5 border border-gray-800 px-4 rounded-xl">
                                <input type="text" name='name' className='outline-none' placeholder='Search By Name' onChange={(e) => setName(e.target.value)} onKeyDown={(e) => handlesearchByEnter(e)} />
                                <FaSearch className="cursor-pointer" size={20} onClick={handleSearch} />
                            </div>
                            <button className="px-4 py-2 border border-gray-800 flex justify-center items-center gap-2 rounded-lg cursor-pointer font-medium" onClick={() => exportToExcel(data)}><FaFileExport className="translate-y-[1px]" />Export</button>
                        </div>
                    </div>


                    <div className="rounded-xl overflow-x-scroll scrolbar border border-gray-300 shadow-md bg-white">
                        <table className="min-w-full text-sm text-gray-700">
                            <thead className="bg-[#fb651e] text-white text-left text-base font-semibold">
                                <tr>
                                    <th className="py-3 px-6">Name</th>
                                    <th className="py-3 px-6">Phone Number</th>
                                    <th className="py-3 px-6">User Type</th>
                                    <th className="py-3 px-6">Verified</th>
                                    <th className="py-3 px-6">Subscription</th>
                                    <th className="py-3 px-6">Action</th>
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
                                    data.map((user: user, i) => (
                                        <tr
                                            key={user._id}
                                            className={`border-b text-left ${i % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                                        >
                                            <td className="py-4 px-6">{user.name}</td>
                                            <td className="py-4 px-6 font-medium">+91 {user.phoneNumber}</td>
                                            <td className="py-4 px-6">{user.userType}</td>
                                            <td className="py-4 px-6">
                                                <span
                                                    className={`px-3 py-1 text-sm font-medium rounded-md ${user.isVerified ? "bg-green-500 text-white" : "bg-red-500 text-white"
                                                        }`}
                                                >
                                                    {user.isVerified ? "Yes" : "No"}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span
                                                    className={`px-3 py-1 text-sm font-medium rounded-md ${user.isSubscribed ? "bg-green-500 text-white" : "bg-gray-400 text-white"
                                                        }`}
                                                >
                                                    {user.isSubscribed ? "Yes" : "None"}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <button
                                                    className="bg-[#fb651e] hover:bg-[#fb641ec8] cursor-pointer p-2 rounded-md transition duration-200 shadow-md"
                                                    onClick={() => navigate(`/admin/specificuser/${user._id}`)}
                                                >
                                                    <FaEye className="text-white" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td className="py-4 px-6 text-center" colSpan={6}>
                                        <div className="flex justify-between items-center">
                                            <button
                                                className={`px-4 py-2 rounded-md border border-blue-500 text-[#fb651e] transition ${page === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-100"
                                                    }`}
                                                disabled={page === 1}
                                                onClick={() => setPage(page - 1)}
                                            >
                                                Previous
                                            </button>
                                            <span className="text-gray-600 font-medium">
                                                Page {page} of {Math.ceil((+totaluser) / (+limit))}
                                            </span>
                                            <button
                                                className={`px-4 py-2 rounded-md border border-blue-500 text-[#fb651e] transition ${page >= Math.ceil((+totaluser) / (+limit))
                                                    ? "opacity-50 cursor-not-allowed"
                                                    : "hover:bg-blue-100"
                                                    }`}
                                                disabled={page >= Math.ceil((+totaluser) / (+limit))}
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

export default Rider;