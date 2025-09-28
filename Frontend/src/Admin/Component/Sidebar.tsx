import { useState } from 'react';
import { BiMenuAltRight } from 'react-icons/bi';
import { IoLogOutOutline } from "react-icons/io5";
import { NavLink, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify';
import { FaUsers, FaCar , FaDashcube } from 'react-icons/fa';


const Sidebar = () => {
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false);

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    const handleLogout = () => {
        localStorage.removeItem('auth');
        toast.success("Logout SucessFully");
        navigate('/')

    }
    return (
        <>
            {/* Toggle Button for Mobile */}
            <div className="fixed top-4 right-5 z-50 md:hidden">
                <BiMenuAltRight
                    size={36}
                    className={`cursor-pointer  rounded-r-xl  text-gray-700 flex`}
                    onClick={toggleSidebar}
                />
            </div>
            <div
                className={`fixed top-0 left-0 h-[92vh] w-60 bg-white mt-[8vh]  p-4 flex-col z-40 transition-transform duration-300  overflow-y-scroll scrolbar pt-10
                ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
            >
                <div className="w-full overflow-y-scroll scrolbar">
                    <div className="w-full h-8 px-3 flex items-center pl-0">
                        <h6 className="text-gray-500 text-sm font-semibold">Dashboard</h6>
                    </div>
                    <NavLink to={'/admin/dashboard'}>
                        <ul className="flex flex-col gap-2">
                            <li>
                                <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`} >
                                    <div className="h-5 flex gap-3">
                                        <div className="relative">
                                            <p className='text-sm translate-y-1'><FaDashcube /></p>
                                        </div>
                                        <h2 className="text-gray-500 text-sm font-medium">Dashboard</h2>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </NavLink>


                    <div className="w-full h-8 px-3 flex items-center pl-0">
                        <h6 className="text-gray-500 text-sm font-semibold">User</h6>
                    </div>
                    <NavLink to={'/admin/users'}>
                        <ul className="flex flex-col gap-2">
                            <li>
                                <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`} >
                                    <div className="h-5 flex gap-3">
                                        <div className="relative">
                                            <p className='text-sm translate-y-1'><FaUsers /></p>
                                        </div>
                                        <h2 className="text-gray-500 text-sm font-medium">All users</h2>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </NavLink>


                    <NavLink to={'/admin/users?subscribed=true'}>
                        <ul className="flex flex-col gap-2">
                            <li>
                                <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`} >
                                    <div className="h-5 flex gap-3">
                                        <div className="relative">
                                            <p className='text-sm translate-y-1'><FaUsers /></p>
                                        </div>
                                        <h2 className="text-gray-500 text-sm font-medium">Subscribed users</h2>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </NavLink>

                    <NavLink to={'/admin/users?subscribed=false'}>
                        <ul className="flex flex-col gap-2">
                            <li>
                                <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`} >
                                    <div className="h-5 flex gap-3">
                                        <div className="relative">
                                            <p className='text-sm translate-y-1'><FaUsers /></p>
                                        </div>
                                        <h2 className="text-gray-500 text-sm font-medium">Unsubscribed users</h2>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </NavLink>


                    <div className="w-full h-8 px-3 flex items-center pl-0 mb-2 mt-2">
                        <h6 className="text-gray-500 text-sm font-semibold">Bookings</h6>
                    </div>
                    <NavLink to={'/admin/bookings?staus=all'}>
                        <ul className="flex flex-col gap-2">
                            <li>
                                <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`}>
                                    <div className="h-5 flex gap-3">
                                        <div className="relative">
                                            <p className='text-sm translate-y-1'><FaCar /></p>
                                        </div>
                                        <h2 className="text-gray-500 text-sm font-medium">All Bookings</h2>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </NavLink>

                    <NavLink to={'/admin/bookings?status=pending'}>
                        <ul className="flex flex-col gap-2">
                            <li>
                                <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`}>
                                    <div className="h-5 flex gap-3">
                                        <div className="relative">
                                            <p className='text-sm translate-y-1'><FaCar /></p>
                                        </div>
                                        <h2 className="text-gray-500 text-sm font-medium">Pending Bookings</h2>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </NavLink>


                    <NavLink to={'/admin/bookings?status=assigned'}>
                        <ul className="flex flex-col gap-2">
                            <li>
                                <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`}>
                                    <div className="h-5 flex gap-3">
                                        <div className="relative">
                                            <p className='text-sm translate-y-1'><FaCar /></p>
                                        </div>
                                        <h2 className="text-gray-500 text-sm font-medium">Assingned Bookings</h2>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </NavLink>


                    <NavLink to={'/admin/bookings?status=pickedup'}>
                        <ul className="flex flex-col gap-2">
                            <li>
                                <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`}>
                                    <div className="h-5 flex gap-3">
                                        <div className="relative">
                                            <p className='text-sm translate-y-1'><FaCar /></p>
                                        </div>
                                        <h2 className="text-gray-500 text-sm font-medium">Pickedup Bookings</h2>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </NavLink>


                    <NavLink to={'/admin/bookings?status=completed'}>
                        <ul className="flex flex-col gap-2">
                            <li>
                                <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`}>
                                    <div className="h-5 flex gap-3">
                                        <div className="relative">
                                            <p className='text-sm translate-y-1'><FaCar /></p>
                                        </div>
                                        <h2 className="text-gray-500 text-sm font-medium">Completed Bookings</h2>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </NavLink>


                    <NavLink to={'/admin/bookings?status=cancelled'}>
                        <ul className="flex flex-col gap-2">
                            <li>
                                <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`}>
                                    <div className="h-5 flex gap-3">
                                        <div className="relative">
                                            <p className='text-sm translate-y-1'><FaCar /></p>
                                        </div>
                                        <h2 className="text-gray-500 text-sm font-medium">Cancelled Bookings</h2>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </NavLink>


                    <div className="w-full h-8 px-3 flex items-center pl-0 mb-2 mt-2">
                        <h6 className="text-gray-500 text-sm font-semibold">Seeting</h6>
                    </div>
                    <ul className="flex flex-col gap-2">
                        <li>
                            <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`} onClick={handleLogout}>
                                <div className="h-5 flex gap-3">
                                    <div className="relative">
                                        <p className='text-sm translate-y-1'><IoLogOutOutline /></p>
                                    </div>
                                    <h2 className="text-gray-500 text-sm font-medium">Logout</h2>
                                </div>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
