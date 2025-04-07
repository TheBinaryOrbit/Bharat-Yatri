import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../lib/types";
import axios from "axios";
import URL from "../../lib/url";
import { toast } from "react-toastify";

const AddDuty = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    carModel: "",
    carrier: "",
    from: "",
    to: "",
    description: "",
    rideType: "Duty",
    PickupDateAndTime: "",
    customerFare: "",
    commissionFee: "",
    tripType: ""
  });

  const handleChange = (e : any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e : any) => {
    e.preventDefault();
    const storedData  : any = localStorage.getItem('auth')
    const auth : auth = JSON.parse(storedData)

    const obj = {...formData , createdBy : auth.authInfo.id}

    try {
        const res = await axios.post(`${URL}/api/ride/addride` , obj)

        if(res.status == 201){
            toast.success("Duty Added Sucessfully");
            navigate('/admin/dashboard')
        }else{
            toast.error("Unable to add Duty")
        }
    } catch (error) {
        toast.error("Unable to add Duty")
    }
  };

  return (
    <div className="w-full h-auto flex flex-col lg:flex-row mt-[8vh]">
      <div className="w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100 flex justify-center items-center p-4" />
      <div className="w-full flex-1 bg-gray-100">
        <div className="p-4 sm:p-6">
          <h1 className="text-2xl font-semibold text-gray-700 mb-4">
            <span className="text-gray-500 cursor-pointer hover:underline" onClick={() => navigate("/admin/dashboard")}>
              Dashboard
            </span>{" "}
            / Rides / Add Duty
          </h1>

          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Car Model */}
            <div className="flex flex-col">
              <label className="text-gray-600 mb-1 font-medium">Car Model</label>
              <select
                name="carModel"
                value={formData.carModel}
                onChange={handleChange}
                className="border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              >
                <option value="">Select Car Model</option>
                <option value="SUV">SUV</option>
                <option value="Sedan">Sedan</option>
                <option value="Mini">Mini</option>
              </select>
            </div>

            {/* Carrier */}
            <div className="flex flex-col">
              <label className="text-gray-600 mb-1 font-medium">Carrier Type</label>
              <select
                name="carrier"
                value={formData.carrier}
                onChange={handleChange}
                className="border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              >
                <option value="">Select Carrier Type</option>
                <option value="With Carrier">With Carrier</option>
                <option value="Without Carrier">Without Carrier</option>
              </select>
            </div>

            {/* From */}
            <div className="flex flex-col">
              <label className="text-gray-600 mb-1 font-medium">From</label>
              <input
                type="text"
                name="from"
                value={formData.from}
                onChange={handleChange}
                placeholder="Pickup location"
                className="border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              />
            </div>

            {/* To */}
            <div className="flex flex-col">
              <label className="text-gray-600 mb-1 font-medium">To</label>
              <input
                type="text"
                name="to"
                value={formData.to}
                onChange={handleChange}
                placeholder="Drop location"
                className="border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              />
            </div>

            {/* Pickup Date & Time */}
            <div className="flex flex-col">
              <label className="text-gray-600 mb-1 font-medium">Pickup Date & Time</label>
              <input
                type="datetime-local"
                name="PickupDateAndTime"
                value={formData.PickupDateAndTime}
                onChange={handleChange}
                className="border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              />
            </div>

            {/* Customer Fare */}
            <div className="flex flex-col">
              <label className="text-gray-600 mb-1 font-medium">Customer Fare</label>
              <input
                type="number"
                name="customerFare"
                value={formData.customerFare}
                onChange={handleChange}
                placeholder="₹"
                className="border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              />
            </div>

            {/* Commission Fee */}
            <div className="flex flex-col">
              <label className="text-gray-600 mb-1 font-medium">Commission Fee</label>
              <input
                type="number"
                name="commissionFee"
                value={formData.commissionFee}
                onChange={handleChange}
                placeholder="₹ (optional)"
                className="border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              />
            </div>

            {/* Trip Type */}
            <div className="flex flex-col">
              <label className="text-gray-600 mb-1 font-medium">Trip Type</label>
              <select
                name="tripType"
                value={formData.tripType}
                onChange={handleChange}
                className="border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              >
                <option value="">Select Trip Type</option>
                <option value="One-Way">One Way</option>
                <option value="Round-Trip">Round Trip</option>
              </select>
            </div>

            {/* Description */}
            <div className="flex flex-col md:col-span-2">
              <label className="text-gray-600 mb-1 font-medium">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter additional details"
                rows={4}
                className="border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              ></textarea>
            </div>

            {/* Submit Button */}
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="bg-[#fb651e] text-white px-6 py-2 rounded-md hover:bg-[#fb651e] transition"
              >
                Submit Duty
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddDuty;
