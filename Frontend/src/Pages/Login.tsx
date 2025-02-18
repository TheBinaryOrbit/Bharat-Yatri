import axios from "axios";
import { useState, useEffect } from "react";
import { FaPhoneAlt, FaUnlock } from "react-icons/fa";
import { auth } from "../lib/types";
import URL from "../lib/url";
import { toast } from "react-toastify";
import img from '../assets/loginlogo.png'
import car from '../assets/suv.png'
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [otp, setOtp] = useState('');

  const storedData  : any = localStorage.getItem('auth')
  const auth : auth = JSON.parse(storedData)
  useEffect(() => {
    if (auth) {
      navigate('/admin/dashboard');
    }
  }, [])

  const handlGetOtp = async () => {
    setOtpLoading(true);
    if (!phoneNumber || phoneNumber.length != 10) {
      setOtpLoading(false);
      return toast.error("Enter Valid Phone Number")
    }
    try {
      const response = await axios.post(`${URL}/api/user/getotp`, {
        phoneNumber: `${phoneNumber}`
      });

      if (response.status == 200) {
        setOtpLoading(false);
        setSessionId(response.data.SessionId);
        return toast.success("OTP Sent Successfully")
      } else {
        setOtpLoading(false);
        return toast.error(response.data.message)
      }
    } catch (error: any) {
      setOtpLoading(false);
      return toast.error(error.response.data.error)
    }
  }


  const handleLogin = async () => {
    setIsLoading(true);
    if (!otp || otp.length != 4 || !phoneNumber) {
      setIsLoading(false);
      return toast.error("Enter Valid 4 digit Number");
    }
    try {
      const response: any = await axios.post(`${URL}/api/admin/adminlogin`, {
        phoneNumber: `${phoneNumber}`,
        OTP: otp,
        SessionId: sessionId
      })

      const auth: auth = {
        authStatus: true,
        authToken: response.data.token,
        authInfo: {
          id: response.data.id,
          name: response.data.name,
          phoneNumber: response.data.phoneNumber,
          userType: response.data.userType,
          email: response.data.email
        },
        authpermission : response.data.permission
      }

      localStorage.setItem('auth', JSON.stringify(auth));
      if (response.status == 200) {
        setIsLoading(false);
        navigate('/admin/dashboard');
        return toast.success("Login Successfully")
      }
      else {
        setIsLoading(false);
        return toast.error(response.data.message)
      }
    } catch (error: any) {
      setIsLoading(false);
      return toast.error(error.response.data.error)
    }
  }
  return (
    <div className='w-[100vw] h-[100vh] flex justify-between items-center gap-10 lg:overflow-hidden lg:flex-row-reverse flex-col'>
    {/* Image Section - Hidden on screens smaller than md */}
    <div className='hidden md:flex lg:w-[60%] lg:h-full object-cover justify-between lg:items-center lg:flex-row-reverse'>
      <div className="lg:w-[50%] lg:h-full bg-[#eb6e00] relative">
        <img src={car} alt="auth" className="object-cover absolute lg:top-[50%] lg:left-[-50%] translate-y-[-50%] scale-75 lg:scale-150" />
      </div>
    </div>

    {/* Form Section */}
    <div className='lg:w-[40%] w-full h-full bg-white flex justify-center lg:items-start items-center p-5'>
      <div className='w-full max-w-[500px] p-5'>
        <img src={img} alt="logo" className="w-36 object-cover my-3 lg:my-10" />
        <h1 className="text-3xl font-bold mb-1">Sign in</h1>
        <p className="text-xl font-medium mb-6 lg:mb-12">Welcome Admin</p>

        <label className="mb-2 mx-1 font-medium block">Phone Number</label>
        <div className='flex justify-between gap-3 items-center border border-gray-500 rounded-2xl px-3 mb-4'>
          <div className="flex items-center gap-3">
            <FaPhoneAlt size={20} />
            <input 
              type="text" 
              name='phone' 
              className='h-12 outline-none rounded-2xl w-full' 
              placeholder='Phone Number' 
              onChange={(e) => setPhoneNumber(e.target.value)} 
            />
          </div>
          {
            !sessionId && (
              <button 
                className="bg-[#eb6e00] hover:bg-[#eb6e00df]  duration-300 text-white font-bold px-4 py-2 rounded-3xl shadow-2xl text-nowrap" 
                onClick={otpLoading ? undefined : handlGetOtp}
              >
                Get OTP
              </button>
            )
          }
        </div>

        <label className="mb-2 mx-1 font-medium block">OTP</label>
        <div className='flex items-center gap-3 border border-gray-500 rounded-2xl px-3 mb-6'>
          <FaUnlock size={20} />
          <input 
            type="text" 
            name='otp' 
            className='h-12 outline-none rounded-2xl w-full' 
            placeholder='OTP' 
            onChange={(e) => setOtp(e.target.value)} 
          />
        </div>

        <button 
          className='w-full flex justify-center items-center text-white bg-[#eb6e00] hover:bg-[#eb6e00df] rounded-2xl py-3 font-bold duration-300' 
          onClick={isLoading ? undefined : handleLogin}
        >
          Sign In
        </button>
      </div>
    </div>
  </div>
  )
}

export default Login


