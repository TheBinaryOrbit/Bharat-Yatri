import axios from "axios";
import { useState, useEffect } from "react";
import { FaPhoneAlt, FaUnlock } from "react-icons/fa";
import { auth } from "../lib/types";
import URL from "../lib/url";
import { toast } from "react-toastify";
import img from '../assets/auth1.png'
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [otp, setOtp] = useState('');

  const auth: auth | null = JSON.parse(localStorage.getItem('auth'));
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
        phoneNumber: `+91 ${phoneNumber}`
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
        phoneNumber: `+91 ${phoneNumber}`,
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
    <div className='w-[100vw] h-[100vh]  flex justify-between items-center gap-10'>
      <div className='w-[60%] h-full object-cover'>
        <img src={img} alt="auth image" className="w-full h-full object-cover " />
      </div>
      <div className='w-[40%] h-full bg-white flex justify-center items-center'>
        <div className='w-[500px] h-[500px]  p-5'>
          <h1 className="text-3xl font-bold mb-1">Sign in</h1>
          <p className="text-xl font-medium mb-12">Welcome back</p>
          <h1 className="mb-2 mx-1 font-medium">Phone Number</h1>
          <div className='flex  justify-between gap-5 items-center border border-gray-500 rounded-2xl px-2 mb-4'>
            <div className="flex items-center gap-5">
              <FaPhoneAlt size={20} />
              <input type="text" name='Name' className='h-12 outline-none rounded-2xl' placeholder='Phone Number' onChange={(e) => setPhoneNumber(e.target.value)} />
            </div>
            {
              sessionId
                ?
                ""
                :
                <button className="bg-blue-500 hover:bg-blue-600 duration-300 text-white font-bold cursor-pointer px-4 py-2 rounded-3xl shadow-2xl" onClick={otpLoading ? undefined : handlGetOtp}>Get OTP</button>
            }
          </div>
          <h1 className="mb-2 mx-1 font-medium">OTP</h1>
          <div className='flex  justify-start gap-5 items-center border border-gray-500 rounded-2xl px-2 mb-12'>
            <FaUnlock size={20} />
            <input type="text" name='Name' className='h-12 outline-none rounded-2xl' placeholder='OTP' onChange={(e) => setOtp(e.target.value)} />
          </div>
          <div className='flex  justify-center gap-5 items-center  rounded-2xl px-2 mb-6 cursor-pointer text-white bg-blue-500 hover:bg-blue-600' onClick={isLoading ? undefined : handleLogin}>
            <button className="h-12 cursor-pointer font-bold  duration-300 outline-none rounded-2xl" >Sing in</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login


