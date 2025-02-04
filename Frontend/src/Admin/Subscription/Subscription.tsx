import { useEffect, useState } from "react";
import axios from "axios";
import { FaEye } from "react-icons/fa";
import { CiEdit } from "react-icons/ci";
import URL from "../../lib/url";
import { auth, subscription } from "../../lib/types";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const Subscription = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<subscription[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [currentSubscription, setCurrentSubscription] = useState<subscription | null>(null);
    const [updatedPrice, setUpdatedPrice] = useState<number | string>('');
    const [updatedDescription, setUpdatedDescription] = useState<string>('');
    const [updatedBenefits, setUpdatedBenefits] = useState<string>(''); // Assuming it's a comma-separated string
    const [updatedTimePeriod, setUpdatedTimePeriod] = useState<number | string>(''); // Time Period for subscription
    const [activeId, setActiveId] = useState<string>('')

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`${URL}/api/subscription/getsubscription`);
                setData(res.data);
            } catch (error: any) {
                console.log(error);
                return toast.error(error.response.data.error);
            }
        };
        fetchData();
    }, []);

    const openModal = (sub: subscription) => {
        setCurrentSubscription(sub);
        setUpdatedPrice(sub.price);
        setUpdatedDescription(sub.description);
        setUpdatedBenefits(sub.benefits);
        setUpdatedTimePeriod(sub.timePeriod);
        setActiveId(sub._id)
        setShowModal(true);
    };

    const handleUpdateSubscription = async () => {
        if (currentSubscription) {
            try {
                const auth: auth | null = JSON.parse(localStorage.getItem('auth'))
                const token: string | undefined = auth?.authToken
                const updatedSub = {
                    ...currentSubscription,
                    price: updatedPrice,
                    description: updatedDescription,
                    benefits: updatedBenefits,
                    timePeriod: updatedTimePeriod, // Include updated time period
                };
                await axios.patch(`${URL}/api/subscription/updatesubscription/${activeId}`, updatedSub, {
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                });
                toast.success("Subscription updated successfully!");
                setShowModal(false);
                setData((prevData) =>
                    prevData.map((sub) =>
                        sub._id === currentSubscription._id ? updatedSub : sub
                    )
                );
            } catch (error: any) {
                console.log(error);
                toast.error(error.response.data.error);
            }
        }
    };

    return (
        <div className='w-full h-auto flex flex-col lg:flex-row mt-[8vh]'>
            <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100 flex justify-center items-center p-4'></div>
            <div className='w-full flex-1 bg-gray-100'>
                <div className="p-4 sm:p-6 bg-gray-100 overflow-x-auto">
                    <h1 className="text-2xl font-medium mb-4 text-gray-700 capitalize">
                        <span className="text-gray-500 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
                            Dashboard
                        </span> / Subscription
                    </h1>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {
                            data.map((sub: subscription) => (
                                <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200 flex flex-col" key={sub._id}>
                                    <div className="p-6 flex flex-col grow space-y-6">
                                        <div className="flex flex-col items-center">
                                            <h3 className="text-2xl/relaxed font-semibold text-gray-800">{sub.subscriptionType}</h3>
                                            <p className="text-lg font-medium text-gray-600">₹ {sub.price}</p>
                                        </div>

                                        <div className="space-y-6 text-gray-700">
                                            <div className="space-y-2">
                                                <div className="font-medium text-sm text-gray-600">Description:</div>
                                                <p className="text-sm text-gray-600">{sub.description}</p>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="font-medium text-sm text-gray-600">Benefits:</div>
                                                <ul className="text-sm space-y-1 text-gray-600">
                                                    {JSON.parse(sub.benefits).map((item: string, i: number) => (
                                                        <li key={i} className="flex items-center space-x-2">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4 text-teal-500">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="font-medium text-sm text-gray-600">Time Period:</div>
                                                <p className="text-sm text-gray-600">{sub.timePeriod} Days</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 pt-0 mt-auto">
                                        <button
                                            onClick={() => openModal(sub)}
                                            className="bg-gray-800 text-white hover:bg-gray-700 font-semibold py-2 px-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 w-full cursor-pointer"
                                        >
                                            Update
                                        </button>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0  bg-[rgba(0,0,0,.3)] flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                        <h2 className="text-xl font-semibold mb-4">Update Subscription</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Price</label>
                                <input
                                    type="number"
                                    value={updatedPrice}
                                    onChange={(e) => setUpdatedPrice(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea
                                    value={updatedDescription}
                                    onChange={(e) => setUpdatedDescription(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Benefits (comma separated)</label>
                                <input
                                    type="text"
                                    value={updatedBenefits}
                                    onChange={(e) => setUpdatedBenefits(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded"
                                />
                            </div>
                            {/* Time Period Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Time Period (Days)</label>
                                <input
                                    type="number"
                                    value={updatedTimePeriod}
                                    onChange={(e) => setUpdatedTimePeriod(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={handleUpdateSubscription}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                            >
                                Save Changes
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="bg-gray-400 text-white px-4 py-2 ml-2 rounded-lg"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Subscription;
