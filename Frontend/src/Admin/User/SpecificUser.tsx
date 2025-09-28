import { useEffect, useState } from "react";
import axios from "axios";
import URL from "../../lib/url";
import { userdetails } from "../../lib/types";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";



const SpecificUser = () => {
  const params = useParams();
  const userId = params.userId
  const navigate = useNavigate()
  const [data, setData] = useState<userdetails>({});

  useEffect(() => {
    const fetchData = async () => {
      console.log(params)
      
      try {
        const res = await axios.get(`${URL}/api/v2/user/admin/details/${userId}`, {
          
        })
        console.log(res.data)
        setData(res.data);

      } catch (error: any) {
        console.log(error);
        return toast.error(error.response.data.error)
      }
    }
    fetchData()
  }, [])

  return (
    <div className='w-full h-auto flex flex-col lg:flex-row mt-[8vh]' >
      <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100 flex justify-center items-center p-4'>
      </div>
      <div className='w-full flex-1 bg-gray-100'>
        <div className="p-4 sm:p-6 bg-gray-100 overflow-x-auto">
          <h1 className="text-2xl font-medium mb-4 text-gray-700 capitalize"><span className="text-gray-500 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>Dashboard</span> / All User / {data?.user?.name || 'User Details'}</h1>

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
                  {data?.user?.name || 'N/A'}
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Phone Number
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  +91 {data?.user?.phoneNumber || 'N/A'}
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  City
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data?.user?.city || 'N/A'}
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  User Type
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  {data?.user?.userType || 'N/A'}
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Is User Verified
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-md ${data?.user?.isUserVerified ? "bg-green-500 text-white" : "bg-red-400 text-white"
                      }`}
                  >
                    {data?.user?.isUserVerified ? "Yes" : "No"}
                  </span>
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Is Subscribed
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-md ${data?.user?.isSubscribed ? "bg-green-500 text-white" : "bg-gray-400 text-white"
                      }`}
                  >
                    {data?.user?.isSubscribed ? "Yes" : "No"}
                  </span>
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Free Trial Eligible
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-md ${data?.user?.isFreeTrialEligible ? "bg-green-500 text-white" : "bg-gray-400 text-white"
                      }`}
                  >
                    {data?.user?.isFreeTrialEligible ? "Yes" : "No"}
                  </span>
                </td>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Send Notification
                </th>
                <td scope="col" className="px-6 py-3 border border-gray-500">
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-md ${data?.user?.isSendNotification ? "bg-green-500 text-white" : "bg-gray-400 text-white"
                      }`}
                  >
                    {data?.user?.isSendNotification ? "Yes" : "No"}
                  </span>
                </td>
              </tr>
              <tr className='border border-gray-500'>
                <th scope="col" className="px-6 py-3 border border-gray-500">
                  Car Alert For
                </th>
                <td scope="col" colSpan={3} className="px-6 py-3 border border-gray-500">
                  {/* {data?.user?.carAleartFor?.length > 0 ? data.user.carAleartFor.join(', ') : 'N/A'} */}
                </td>
              </tr>
            </table>
          </div>
          {data?.user?.userImage && (
            <div className="w-full h-fit bg-white shadow-2xs rounded-xl overflow-x-scroll scrolbar flex justify-center items-center p-6 mb-10">
              <div className="w-1/2 h-full text-center">
                <a href={`https://api.bharatyaatri.com/${data.user.userImage}`} target="_blank" rel="noopener noreferrer">
                  <img src={`https://api.bharatyaatri.com/${data.user.userImage}`} alt="User Photo" className="rounded-lg mb-2 mx-auto max-w-full h-auto cursor-pointer" />
                </a>
                <h1 className="text-xl text-center mb-4 font-bold text-gray-700 capitalize">User Photo</h1>
              </div>
            </div>
          )}

          {/* Subscription History */}
          <div className="w-full h-fit bg-white rounded-xl shadow-lg overflow-x-scroll scrolbar items-center p-6 mb-10">
            <h2 className="text-xl font-medium mb-4 text-gray-700">Subscription History</h2>
            {data?.user?.subscriptionHistory && data.user.subscriptionHistory.length > 0 ? (
              <table className="w-full text-sm text-left text-gray-700 border border-gray-500 rounded-3xl">
                <thead className="border border-gray-500">
                  <tr>
                    <th className="px-6 py-3 border border-gray-500">Plan Name</th>
                    <th className="px-6 py-3 border border-gray-500">Price</th>
                    <th className="px-6 py-3 border border-gray-500">Duration</th>
                    <th className="px-6 py-3 border border-gray-500">Start Date</th>
                    <th className="px-6 py-3 border border-gray-500">End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.user.subscriptionHistory.map((subscription: any, index: number) => (
                    <tr key={index} className="border border-gray-500">
                      <td className="px-6 py-3 border border-gray-500">{subscription?.subscriptionType?.title || 'N/A'}</td>
                      <td className="px-6 py-3 border border-gray-500">₹{subscription?.subscriptionType?.price || 'N/A'}</td>
                      <td className="px-6 py-3 border border-gray-500">{subscription?.subscriptionType?.timePeriod || 'N/A'} days</td>
                      <td className="px-6 py-3 border border-gray-500">{new Date(subscription?.startDate).toLocaleDateString() || 'N/A'}</td>
                      <td className="px-6 py-3 border border-gray-500">{new Date(subscription?.endDate).toLocaleDateString() || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500">No subscription history found.</p>
            )}
          </div>

          {/* Driver Details */}
          <div className="w-full h-fit bg-white rounded-xl shadow-lg overflow-x-scroll scrolbar items-center p-6 mb-10">
            <h2 className="text-xl font-medium mb-4 text-gray-700">Driver Details</h2>
            {data?.user?.drivers && data.user.drivers.length > 0 ? (
              <div className="space-y-6">
                {data.user.drivers.map((driver: any, index: number) => (
                  <div key={index} className="border border-gray-300 rounded-lg p-4">
                    <table className="w-full text-sm text-left text-gray-700 border border-gray-500 rounded-3xl mb-4">
                      <tbody>
                        <tr className="border border-gray-500">
                          <th className="px-6 py-3 border border-gray-500">Name</th>
                          <td className="px-6 py-3 border border-gray-500">{driver?.name || 'N/A'}</td>
                          <th className="px-6 py-3 border border-gray-500">Phone</th>
                          <td className="px-6 py-3 border border-gray-500">+91 {driver?.phone || 'N/A'}</td>
                        </tr>
                        <tr className="border border-gray-500">
                          <th className="px-6 py-3 border border-gray-500">DL Number</th>
                          <td className="px-6 py-3 border border-gray-500">{driver?.dlNumber || 'N/A'}</td>
                          <th className="px-6 py-3 border border-gray-500">Address</th>
                          <td className="px-6 py-3 border border-gray-500">{driver?.address || 'N/A'}</td>
                        </tr>
                        <tr className="border border-gray-500">
                          <th className="px-6 py-3 border border-gray-500">City</th>
                          <td className="px-6 py-3 border border-gray-500" colSpan={3}>{driver?.city || 'N/A'}</td>
                        </tr>
                      </tbody>
                    </table>
                    
                    {/* Driver Images */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {driver?.driverImage && (
                        <div className="text-center">
                          <a href={`https://api.bharatyaatri.com/${driver.driverImage}`} target="_blank" rel="noopener noreferrer">
                            <img src={`https://api.bharatyaatri.com/${driver.driverImage}`} alt="Driver Photo" className="rounded-lg mb-2 w-full h-48 object-cover cursor-pointer" />
                          </a>
                          <h3 className="text-lg font-medium text-gray-700">Driver Photo</h3>
                        </div>
                      )}
                      {driver?.dlFront && (
                        <div className="text-center">
                          <a href={`https://api.bharatyaatri.com/drivinglicence/front/${driver.dlFront.split('/').pop()}`} target="_blank" rel="noopener noreferrer">
                            <img src={`https://api.bharatyaatri.com/drivinglicence/front/${driver.dlFront.split('/').pop()}`} alt="DL Front" className="rounded-lg mb-2 w-full h-48 object-cover cursor-pointer" />
                          </a>
                          <h3 className="text-lg font-medium text-gray-700">DL Front</h3>
                        </div>
                      )}
                      {driver?.dlBack && (
                        <div className="text-center">
                          <a href={`https://api.bharatyaatri.com/drivinglicence/back/${driver.dlBack.split('/').pop()}`} target="_blank" rel="noopener noreferrer">
                            <img src={`https://api.bharatyaatri.com/drivinglicence/back/${driver.dlBack.split('/').pop()}`} alt="DL Back" className="rounded-lg mb-2 w-full h-48 object-cover cursor-pointer" />
                          </a>
                          <h3 className="text-lg font-medium text-gray-700">DL Back</h3>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No driver details found.</p>
            )}
          </div>

          {/* Vehicle Details */}
          <div className="w-full h-fit bg-white rounded-xl shadow-lg overflow-x-scroll scrolbar items-center p-6 mb-10">
            <h2 className="text-xl font-medium mb-4 text-gray-700">Vehicle Details</h2>
            {data?.user?.vehicles && data.user.vehicles.length > 0 ? (
              <div className="space-y-6">
                {data.user.vehicles.map((vehicle: any, index: number) => (
                  <div key={index} className="border border-gray-300 rounded-lg p-4">
                    <table className="w-full text-sm text-left text-gray-700 border border-gray-500 rounded-3xl mb-4">
                      <tbody>
                        <tr className="border border-gray-500">
                          <th className="px-6 py-3 border border-gray-500">Vehicle Type</th>
                          <td className="px-6 py-3 border border-gray-500">{vehicle?.vehicleType || 'N/A'}</td>
                          <th className="px-6 py-3 border border-gray-500">Registration Number</th>
                          <td className="px-6 py-3 border border-gray-500">{vehicle?.registrationNumber || 'N/A'}</td>
                        </tr>
                        <tr className="border border-gray-500">
                          <th className="px-6 py-3 border border-gray-500">Year of Manufacture</th>
                          <td className="px-6 py-3 border border-gray-500">{vehicle?.yearOfManufacture || 'N/A'}</td>
                          <th className="px-6 py-3 border border-gray-500">Insurance Expiry</th>
                          <td className="px-6 py-3 border border-gray-500">{vehicle?.insuranceExpDate ? new Date(vehicle.insuranceExpDate).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      </tbody>
                    </table>
                    
                    {/* Vehicle Documents */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {vehicle?.insuranceImage && (
                        <div className="text-center">
                          <a href={`https://api.bharatyaatri.com/${vehicle.insuranceImage}`} target="_blank" rel="noopener noreferrer">
                            <img src={`https://api.bharatyaatri.com/${vehicle.insuranceImage}`} alt="Insurance" className="rounded-lg mb-2 w-full h-48 object-cover cursor-pointer" />
                          </a>
                          <h3 className="text-lg font-medium text-gray-700">Insurance Document</h3>
                        </div>
                      )}
                      {vehicle?.rcImage && (
                        <div className="text-center">
                          <a href={`https://api.bharatyaatri.com/${vehicle.rcImage}`} target="_blank" rel="noopener noreferrer">
                            <img src={`https://api.bharatyaatri.com/${vehicle.rcImage}`} alt="RC" className="rounded-lg mb-2 w-full h-48 object-cover cursor-pointer" />
                          </a>
                          <h3 className="text-lg font-medium text-gray-700">RC Document</h3>
                        </div>
                      )}
                    </div>
                    
                    {/* Vehicle Images */}
                    {vehicle?.vehicleImages && vehicle.vehicleImages.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-700 mb-3">Vehicle Images</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {vehicle.vehicleImages.map((image: string, imgIndex: number) => (
                            <div key={imgIndex} className="text-center">
                              <a href={`https://api.bharatyaatri.com/${image}`} target="_blank" rel="noopener noreferrer">
                                <img src={`https://api.bharatyaatri.com/${image}`} alt={`Vehicle ${imgIndex + 1}`} className="rounded-lg mb-2 w-full h-48 object-cover cursor-pointer" />
                              </a>
                              <p className="text-sm text-gray-600">Vehicle Image {imgIndex + 1}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No vehicle details found.</p>
            )}
          </div>

          {/* Bank Details */}
          <div className="w-full h-fit bg-white rounded-xl shadow-lg overflow-x-scroll scrolbar items-center p-6 mb-10">
            <h2 className="text-xl font-medium mb-4 text-gray-700">Bank Details</h2>
            {data?.user?.bankDetails && data.user.bankDetails.length > 0 ? (
              <table className="w-full text-sm text-left text-gray-700 border border-gray-500 rounded-3xl">
                <thead className="border border-gray-500">
                  <tr>
                    <th className="px-6 py-3 border border-gray-500">Account Holder</th>
                    <th className="px-6 py-3 border border-gray-500">Account Number</th>
                    <th className="px-6 py-3 border border-gray-500">Bank Name</th>
                    <th className="px-6 py-3 border border-gray-500">IFSC Code</th>
                    <th className="px-6 py-3 border border-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.user.bankDetails.map((bank: any, index: number) => (
                    <tr key={index} className="border border-gray-500">
                      <td className="px-6 py-3 border border-gray-500">{bank?.accountHolderName || 'N/A'}</td>
                      <td className="px-6 py-3 border border-gray-500">{bank?.accountNumber || 'N/A'}</td>
                      <td className="px-6 py-3 border border-gray-500">{bank?.bankName || 'N/A'}</td>
                      <td className="px-6 py-3 border border-gray-500">{bank?.ifscCode || 'N/A'}</td>
                      <td className="px-6 py-3 border border-gray-500">
                        <span className={`px-3 py-1 text-sm font-medium rounded-md ${bank?.isVerified ? "bg-green-500 text-white" : "bg-red-400 text-white"}`}>
                          {bank?.isVerified ? "Verified" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500">No bank details found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpecificUser;