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
    carrierType: "",
    from: "",
    to: "",
    description: "",
    leadType: "",
  });

  const handleChange = (e : any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e : any) => {
    e.preventDefault();

    // Simple validation
    if (!formData.carModel || !formData.from || !formData.to) {
      alert("Please fill all required fields.");
      return;
    }
    const storedData  : any = localStorage.getItem('auth')
    const auth : auth = JSON.parse(storedData)

    const obj = {
        carModel : formData.carModel ,
        from : formData.from,
        to : formData.to,
        createdBy : auth.authInfo.id ,
        rideType : formData.leadType ,
        carrier : formData.carrierType,
    }

    try {
        const res = await axios.post(`${URL}/api/ride/addride` , obj)

        if(res.status == 201){
            toast.success("Ride Added Sucessfully");
            navigate('/admin/dashboard')
        }else{
            toast.error("Unable to add Ride")
        }
    } catch (error) {
        toast.error("Unable to add Ride")
    }

  };

  return (
    <div className="w-full h-auto flex flex-col lg:flex-row mt-[8vh]">
      <div className="w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100 flex justify-center items-center p-4" />

      <div className="w-full flex-1 bg-gray-100">
        <div className="p-4 sm:p-6 bg-gray-100">
          <h1 className="text-2xl font-semibold text-gray-700 mb-4">
            <span
              className="text-gray-500 cursor-pointer hover:underline"
              onClick={() => navigate("/admin/dashboard")}
            >
              Dashboard
            </span>{" "}
            / Rides / Add Duty
          </h1>

          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 rounded-xl shadow-md grid gap-6 md:grid-cols-2"
          >
            <div className="flex flex-col">
              <label className="mb-1 font-medium text-gray-600">Car Model</label>
              <select
                name="carModel"
                value={formData.carModel}
                onChange={handleChange}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              >
                <option value="">Select Car Model</option>
                <option value="SUV">SUV</option>
                <option value="Sedan">Sedan</option>
                <option value="Mini">Mini</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 font-medium text-gray-600">Carrier Type</label>
              <select
                name="carrierType"
                value={formData.carrierType}
                onChange={handleChange}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              >
                <option value="">Select Carrier Type</option>
                <option value="With Carrier">With Carrier</option>
                <option value="Without Carrier">Without Carrier</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 font-medium text-gray-600">From</label>
              <input
                type="text"
                name="from"
                value={formData.from}
                onChange={handleChange}
                placeholder="Pickup location"
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              />
            </div>

            <div className="flex flex-col">
              <label className="mb-1 font-medium text-gray-600">To</label>
              <input
                type="text"
                name="to"
                value={formData.to}
                onChange={handleChange}
                placeholder="Drop location"
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              />
            </div>

            <div className="flex flex-col md:col-span-2">
              <label className="mb-1 font-medium text-gray-600">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add any notes or instructions"
                rows={3}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              />
            </div>

            <div className="flex flex-col">
              <label className="mb-1 font-medium text-gray-600">Lead Type</label>
              <select
                name="leadType"
                value={formData.leadType}
                onChange={handleChange}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fb651e]"
              >
                <option value="">Select Lead Type</option>
                <option value="Exchange">Exchange</option>
                <option value="Available">Available</option>
              </select>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="bg-[#fb651e] text-white px-6 py-2 rounded-lg hover:bg-[#fb651e] transition-all duration-200"
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
