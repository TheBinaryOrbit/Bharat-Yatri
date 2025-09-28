import { useNavigate } from "react-router-dom";
import { FaUsers, FaCar, FaUserCheck, FaUserTimes, FaCalendarAlt, FaCheckCircle, FaClock, FaTimes } from "react-icons/fa";
import Sidebar from "./Component/Sidebar";

const Dashboard = () => {
  const navigate = useNavigate();


  return (
    <div className='w-full h-auto flex flex-col lg:flex-row mt-[8vh]' >
      <Sidebar />
      <div className='w-full flex-1  md:ml-60'>
        <div className="p-4 sm:p-6  overflow-x-auto">
          <h1 className="text-3xl mb-6 font-bold text-gray-800 capitalize">Admin Dashboard</h1>
          
          {/* Quick Navigation Links */}
          <div className="mb-10">
            <h2 className="text-2xl mb-4 font-bold text-gray-700 capitalize">Quick Navigation</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
              {/* User Management Cards */}
              <div 
                onClick={() => navigate('/admin/users')}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 border-l-4 border-blue-500"
              >
                <div className="flex items-center">
                  <FaUsers className="text-3xl text-blue-500 mr-4" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">All Users</h3>
                    <p className="text-sm text-gray-600">Manage all users</p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => navigate('/admin/users?subscribed=true')}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 border-l-4 border-green-500"
              >
                <div className="flex items-center">
                  <FaUserCheck className="text-3xl text-green-500 mr-4" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Subscribed Users</h3>
                    <p className="text-sm text-gray-600">Active subscribers</p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => navigate('/admin/users?subscribed=false')}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 border-l-4 border-red-500"
              >
                <div className="flex items-center">
                  <FaUserTimes className="text-3xl text-red-500 mr-4" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Unsubscribed Users</h3>
                    <p className="text-sm text-gray-600">Non-subscribers</p>
                  </div>
                </div>
              </div>

              {/* Booking Management Cards */}
              <div 
                onClick={() => navigate('/admin/bookings?status=all')}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 border-l-4 border-purple-500"
              >
                <div className="flex items-center">
                  <FaCar className="text-3xl text-purple-500 mr-4" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">All Bookings</h3>
                    <p className="text-sm text-gray-600">View all bookings</p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => navigate('/admin/bookings?status=pending')}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 border-l-4 border-yellow-500"
              >
                <div className="flex items-center">
                  <FaClock className="text-3xl text-yellow-500 mr-4" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Pending Bookings</h3>
                    <p className="text-sm text-gray-600">Awaiting assignment</p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => navigate('/admin/bookings?status=completed')}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 border-l-4 border-green-600"
              >
                <div className="flex items-center">
                  <FaCheckCircle className="text-3xl text-green-600 mr-4" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Completed Bookings</h3>
                    <p className="text-sm text-gray-600">Successfully completed</p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => navigate('/admin/bookings?status=cancelled')}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 border-l-4 border-red-600"
              >
                <div className="flex items-center">
                  <FaTimes className="text-3xl text-red-600 mr-4" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Cancelled Bookings</h3>
                    <p className="text-sm text-gray-600">Cancelled rides</p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => navigate('/admin/bookings?status=assigned')}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 border-l-4 border-indigo-500"
              >
                <div className="flex items-center">
                  <FaCalendarAlt className="text-3xl text-indigo-500 mr-4" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Assigned Bookings</h3>
                    <p className="text-sm text-gray-600">Currently assigned</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;