import { useEffect, useState } from "react";
import axios from "axios";
import URL from "../../lib/url";
import { auth, userdetails } from "../../lib/types";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";

const SpecificUser = () => {
  const [isLoading, setIsLoading] = useState(false);
  const params = useParams();
  const id = params.id
  const navigate = useNavigate()
  const [data, setData] = useState<userdetails>({});


  const handleVerify = async () => {
    setIsLoading(true)
    const auth: auth | null = JSON.parse(localStorage.getItem('auth'))
    const token: string | undefined = auth?.authToken
    try {
      const res = await axios.patch(`${URL}/api/admin/verifyuser/${id}`,{} ,{
        headers: {
          "Authorization": "Bearer " + token
        }
      });

      if (res.status == 200) {
        setIsLoading(false)
        setData(res.data.user)
        return toast.success("User Verified Sucessfully")
      } else {
        setIsLoading(false)
        return toast.error(res.data.message)
      }
    } catch (error: any) {
      setIsLoading(false)
      return toast.error(error.response.data.message)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      const auth: auth | null = JSON.parse(localStorage.getItem('auth'))
      const token: string | undefined = auth?.authToken
      try {
        const res = await axios.get(`${URL}/api/admin/getspecificuser/${id}`, {
          headers: {
            "Authorization": "Bearer " + token
          }
        })

        console.log(res.data)
        setData(res.data);
        console.log(res.data.suscriptionType.subscriptionType)
      } catch (error: any) {
        console.log(error);
        return toast.error(error.response.data.error)
      }
    }
    fetchData()
  }, [])

  return (
    <div className='w-full h-auto flex flex-col lg:flex-row mt-[10vh]' >
      <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100 flex justify-center items-center p-4'>
      </div>
      <div className='w-full flex-1 bg-gray-100'>
        <div className="p-4 sm:p-6 bg-gray-100 overflow-x-auto">
          <h1 className="text-2xl font-medium mb-4 text-gray-700 capitalize"><span className="text-gray-500 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>Dashboard</span> / All User / {data.name}</h1>

          <div className="w-full h-fit bg-white rounded-xl shadow-lg  overflow-x-scroll scrolbar items-center p-6 mb-10">
            <table className="w-full text-sm text-left  text-gray-700 border border-gray-500  rounded-3xl">
              <tr className='border border-gray-500'>
                <th scope="col" colSpan={4} className="px-6 py-3 border border-gray-500 text-center text-xl text-black text-wrap">
                  User Details
                </th>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Name
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data.name}
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Aadhaar Number
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data.aadhaarNumber}
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Email
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data.email}
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  DL Number
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data.dlNumber}
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Phone Number
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  +91 {data.phoneNumber}
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  User Current Location
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data.userCurrentLocation}
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  User Type
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data.userType}
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Is Verified
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-md ${data.isVerified ? "bg-green-500 text-white" : "bg-red-400 text-white"
                      }`}
                  >
                    {data.isVerified ? "Yes" : "No"}
                  </span>
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Is Subscribed
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-md ${data.isSubscribed ? "bg-green-500 text-white" : "bg-gray-400 text-white"
                      }`}
                  >
                    {data.isSubscribed ? "Yes" : "None"}
                  </span>
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Suscription Period
                </th>
                <td scope="col" className={`px-6 py-3 border border-gray-500 font-bold `}>
                  {data.suscriptionStaredDate}-{data.suscriptionEndDate}
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Date of Birth
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data?.dob}
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Suscription Type
                </th>
                <td scope="col" className={`px-6 py-3 border border-gray-500 font-bold `}>
                  {
                    data.suscriptionStaredDate == data.suscriptionEndDate ? 'N/A' : `${data.suscriptionType?.subscriptionType}`
                  }
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Eligible For Free Trail
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-md ${data.freeTrailEliglibity ? "bg-green-500 text-white" : "bg-gray-400 text-white"
                      }`}
                  >
                    {data.freeTrailEliglibity ? "Yes" : "None"}
                  </span>
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Agency Name
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data.agencyName}
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  State
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {
                    data?.state
                  }
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  City
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {
                    data?.city
                  }
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Pincode
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data?.pincode}
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Address
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data?.address}
                </td>
              </tr>
              {
                data.isVerified ?
                  ""
                  :
                  <tr className='border border-gray-500'>
                    <td scope="col" colSpan={4} className="px-6 py-3 border border-gray-500 text-right">
                      <button className="bg-green-500 hover:bg-green-600 duration-300 px-4 py-2 rounded-2xl cursor-pointer shadow-2xl font-bold text-white" onClick={handleVerify}>Mark As Verified</button>
                    </td>
                  </tr>
              }
            </table>
          </div>
          <div className="w-full h-fit bg-white shadow-2xs rounded-xl  overflow-x-scroll scrolbar flex justify-between items-center p-6 gap-10">
            <div className="w-1/2 h-full">
              <img src={`${URL}/aadhar/${data?.aadhaarPhoto}`} alt="Aadhar Photo" className="rounded-lg mb-2" />
              <h1 className="text-xl text-center mb-4 font-bold text-gray-700 capitalize">Aadhar Photo</h1>
            </div>
            <div className="w-1/2 h-full ">
              <img src={`${URL}/dl/${data?.dlPhoto}`} alt="DL Photo" className="rounded-lg mb-2" />
              <h1 className="text-xl text-center font-bold mb-4 text-gray-700 capitalize">DL Photo</h1>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpecificUser;