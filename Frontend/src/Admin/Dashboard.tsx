import { useEffect, useState } from "react";
import axios from "axios";
import URL from "../lib/url";
import { auth, statc } from "../lib/types";
import { toast } from "react-toastify";
import { Chart } from "react-google-charts";

const Dashboard = () => {
  const [data, setData] = useState<statc>({
    totalAgents: "",
    totalRiders: "",
    totalUsers: "",
    totalVerifiedUsers: "",
    subscriptionPercentage: {
      premium: "",
      standard: "",
      basic: "",
      trial: "",
      none: ""
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      const storedData: any = localStorage.getItem('auth')
      const auth: auth = JSON.parse(storedData)
      const token: string | undefined = auth?.authToken
      try {
        const res = await axios.get(`${URL}/api/admin/getstats`, {
          headers: {
            "Authorization": "Bearer " + token
          }
        })
        setData(res.data);
      } catch (error: any) {
        console.log(error);
        return toast.error(error.response.data.error)
      }
    }
    fetchData()
  }, []);

  return (
    <div className='w-full h-auto flex flex-col lg:flex-row mt-[8vh]' >
      <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100 flex justify-center items-center p-4'>
      </div>
      <div className='w-full flex-1 bg-gray-100'>
        <div className="p-4 sm:p-6 bg-gray-100 overflow-x-auto">
          {/* <h1 className="text-2xl font-medium mb-4 text-gray-700 capitalize">Hey , Anish Kumar</h1> */}

          <h1 className="text-2xl mb-4 font-bold text-gray-700  capitalize">User Overview</h1>
          <div className='w-full flex flex-wrap items-center justify-between gap-5 mb-10'>
            <div className='w-full sm:w-60 h-24 bg-[#fb651e] rounded-md flex flex-col justify-center items-start p-5 shadow-md cursor-pointer hover:scale-105 duration-300'>
              <h1 className='text-lg font-bold text-white tracking-[1px]'>Total User</h1>
              <h1 className='text-2xl font-bold text-white'>{data.totalUsers}</h1>
            </div>
            <div className='w-full sm:w-60 h-24 bg-[#fb651e] rounded-md flex flex-col justify-center items-start p-5 shadow-md cursor-pointer hover:scale-105 duration-300' >
              <h1 className='text-lg font-bold text-white tracking-[1px]'>Total Agents</h1>
              <h1 className='text-2xl font-bold text-white'>{data.totalAgents}</h1>
            </div>
            <div className='w-full sm:w-60 h-24 bg-[#fb651e] rounded-md flex flex-col justify-center items-start p-5 shadow-md cursor-pointer hover:scale-105 duration-300'>
              <h1 className='text-lg font-bold text-white tracking-[1px]'>Today Riders</h1>
              <h1 className='text-2xl font-bold text-white'>{data.totalRiders}</h1>
            </div>
            <div className='w-full sm:w-60 h-24 bg-[#fb651e] rounded-md flex flex-col justify-center items-start p-5 shadow-md cursor-pointer hover:scale-105 duration-300'>
              <h1 className='text-lg font-bold text-white tracking-[1px]'>Total Verified Users</h1>
              <h1 className='text-2xl font-bold text-white'>{data.totalVerifiedUsers}</h1>
            </div>
          </div>

          <h1 className="text-2xl mb-4 font-bold text-gray-700  capitalize">Rides Overview</h1>
          <div className='w-full flex flex-wrap items-center justify-between gap-5 mb-10'>
            <div className='w-full sm:w-60 h-24 bg-white rounded-md flex flex-col justify-center items-start p-5 shadow-md cursor-pointer hover:scale-105 duration-300 border-2 border-[#f5f5ee]'>
              <h1 className='text-lg font-bold text-[#fb651e] tracking-[1px]'>Total Rides</h1>
              <h1 className='text-2xl font-bold text-[#fb651e]'>{data.totalRides}</h1>
            </div>
            <div className='w-full sm:w-60 h-24 bg-white rounded-md flex flex-col justify-center items-start p-5 shadow-md cursor-pointer hover:scale-105 duration-300 border-2 border-[#f5f5ee]'>
              <h1 className='text-lg font-bold text-[#fb651e] tracking-[1px]'>Total Duty Rides</h1>
              <h1 className='text-2xl font-bold text-[#fb651e]'>{data.totalDutyRides}</h1>
            </div>
            <div className='w-full sm:w-60 h-24 bg-white rounded-md flex flex-col justify-center items-start p-5 shadow-md cursor-pointer hover:scale-105 duration-300 border-2 border-[#f5f5ee]'>
              <h1 className='text-lg font-bold text-[#fb651e] tracking-[1px]'>Total Exchange Ride</h1>
              <h1 className='text-2xl font-bold text-[#fb651e]'>{data.totalExchangeRides}</h1>
            </div>
            <div className='w-full sm:w-60 h-24 bg-white rounded-md flex flex-col justify-center items-start p-5 shadow-md cursor-pointer hover:scale-105 duration-300 border-2 border-[#f5f5ee]'>
              <h1 className='text-lg font-bold text-[#fb651e] tracking-[1px]'>Total Available Ride</h1>
              <h1 className='text-2xl font-bold text-[#fb651e]'>{data.totalAvailableRides}</h1>
            </div>
          </div>

          <h1 className="text-2xl mb-4 font-bold text-gray-700  capitalize">Subscription Overview</h1>
          <div className="w-full h-fit bg-white rounded-xl shadow-lg flex md:flex-row flex-col justify-between items-center p-6">
            {/* Chart View */}
            <div className="md:w-1/2 w-full md:h-full h-[50%]  flex justify-center items-center">
              <Chart
                chartType="PieChart"
                data={[
                  ["Subscription Type", "Percentage"],
                  ["Premium Plan Users", +(data.subscriptionPercentage?.premium) || 0],
                  ["Standard Plan", +(data.subscriptionPercentage?.standard) || 0],
                  ["Basic Plan Users", +(data.subscriptionPercentage?.basic) || 0],
                  ["Free Trial Users", +(data.subscriptionPercentage?.trial) || 0],
                  ["Not Subscribed Users", +(data.subscriptionPercentage?.none) || 0],
                ]}
                options={{
                  pieSliceText: "percentage",
                  is3D: true,
                  slices: {
                    0: { offset: 0.1, color: '#f1c40f' },  // Golden Yellow, complements both colors
                    1: { offset: 0.1, color: '#2980b9' },  // Soft Blue, contrasts gently with both
                    2: { offset: 0.1, color: '#16a085' },  // Teal, a nice contrast with orange
                    3: { offset: 0.1, color: '#d35400' },  // Burnt Orange, works well with the given orange
                    4: { offset: 0.1, color: '#8e44ad' },  // Soft Purple, adds balance with subtlety
                  }
                }}
                width={"100%"}
                height={"300px"}
              />

            </div>
            {/* Percentage View */}
            <div className="md:w-1/2 w-full md:h-full h-[50%]   flex-col items-center p-5">
              {[
                { name: "Premium Plan Users", percentage: `${data.subscriptionPercentage?.premium}`, color: "bg-[#f1c40f]" },
                { name: "Standard Plan", percentage: `${data.subscriptionPercentage?.standard}`, color: "bg-[#2980b9]" },
                { name: "Basic Plan Users", percentage: `${data.subscriptionPercentage?.basic}`, color: "bg-[#16a085]" },
                { name: "Free Trial Users", percentage: `${data.subscriptionPercentage?.trial}`, color: "bg-[#d35400]" },
                { name: "Not Subscribed Users", percentage: `${data.subscriptionPercentage?.none}`, color: "bg-[#8e44ad]" },
              ].map((plan, index) => (
                <div key={index} className="mb-4 w-full">
                  <h1 className="text-lg font-semibold tracking-wide text-gray-700 mb-2">
                    {plan.name} <span className="text-sm">({plan.percentage}%)</span>
                  </h1>
                  <div className="w-full h-3 rounded-lg bg-gray-300 shadow-md relative overflow-hidden">
                    <div className={`absolute h-3 top-0 left-0 ${plan.color} rounded-lg transition-all`} style={{ width: `${plan.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;