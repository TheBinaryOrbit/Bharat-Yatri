import { useState } from 'react';
import { BiMenuAltRight } from 'react-icons/bi';
import { FiHome, FiUsers, FiUserCheck, FiUserX, FiBriefcase, FiClock, FiRepeat, FiTag } from "react-icons/fi";
import { IoLogOutOutline } from "react-icons/io5";
import { NavLink, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify';

const menu = [
    {
        name: "Dashboard",
        child: [
            {
                name: "Dashboard",
                route: "dashboard",
                icon: <FiHome />
            },
        ]
    },
    {
        name: "User",
        child: [
            {
                name: "All user",
                route: "user/allusers",
                icon: <FiUsers />
            },
            {
                name: "Rider",
                route: "user/riders",
                icon: <FiUserCheck />
            },
            {
                name: "Agents",
                route: "user/agents",
                icon: <FiBriefcase />
            },
            {
                name: "Un-Verified User",
                route: "user/unverified",
                icon: <FiUserX />
            },
        ]
    },
    {
        name: "Rides",
        child: [
            {
                name: "Duty",
                route: "ride/duty",
                icon: <FiClock />
            },
            {
                name: "Available",
                route: "ride/available",
                icon: <FiUsers />
            },
            {
                name: "Exchange",
                route: "ride/exchange",
                icon: <FiRepeat />
            }
        ]
    },
    {
        name: "Subscription",
        child: [
            {
                name: "Subscription",
                route: "subscription",
                icon: <FiTag />
            }
        ]
    },
];

const Sidebar = () => {
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false);

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    const handleLogout = ()=>{
        localStorage.removeItem('auth');
        toast.success("Logout SucessFully");
        navigate('/')

    }
    return (
        <>
            {/* Toggle Button for Mobile */}
            <div className="fixed top-6 right-5 z-50 md:hidden">
                <BiMenuAltRight
                    size={36}
                    className={`cursor-pointer  rounded-r-xl  text-gray-700 flex`}
                    onClick={toggleSidebar}
                />
            </div>
            <div
                className={`fixed top-0 left-0 h-[100vh] w-60 bg-white mt-[10vh]  p-4 flex-col z-40 transition-transform duration-300  overflow-y-scroll scrolbar
                ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
            >
                <div className="w-full">
                    {
                        menu.map((item, index) => (
                            <>
                                <div key={index} className="w-full h-8 px-3 flex items-center pl-0">
                                    <h6 className="text-gray-500 text-md font-semibold">{item.name}</h6>
                                </div>
                                <ul className="flex flex-col gap-2">
                                    {
                                        item.child.map((child, i) => (
                                            <li key={i}>
                                                <NavLink to={`/admin/${child.route}`}>
                                                    <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2`} onClick={toggleSidebar}>
                                                        <div className="h-5 flex gap-3">
                                                            <div className="relative">
                                                                <p className='text-sm translate-y-1'>{child.icon}</p>
                                                            </div>
                                                            <h2 className="text-gray-500 text-sm font-medium">{child.name}</h2>
                                                        </div>
                                                    </div>
                                                </NavLink>
                                            </li>
                                        ))
                                    }
                                </ul>
                            </>

                        ))
                    }
                    <div className="w-full h-8 px-3 flex items-center pl-0">
                        <h6 className="text-gray-500 text-md font-semibold">Seeting</h6>
                    </div>
                    <ul className="flex flex-col gap-2">
                        <li>
                                <div className={`flex-col p-3 hover:bg-blue-100 duration-300 rounded-lg ml-2 cursor-pointer`}>
                                    <div className="h-5 flex gap-3">
                                        <div className="relative">
                                            <p className='text-sm translate-y-1'><IoLogOutOutline /></p>
                                        </div>
                                        <h2 className="text-gray-500 text-sm font-medium" onClick={handleLogout}>Logout</h2>
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
