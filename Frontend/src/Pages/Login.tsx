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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const storedData  : any = localStorage.getItem('auth')
  const auth : auth = JSON.parse(storedData)
  useEffect(() => {
    if (auth) {
      navigate('/admin/dashboard');
    }
  }, [])

  // Validation function for email and password
  const validateInputs = () => {
    if (!email || !email.includes('@')) {
      return { valid: false, message: "Enter Valid Email Address" };
    }
    if (!password || password.length < 6) {
      return { valid: false, message: "Password must be at least 6 characters" };
    }
    return { valid: true, message: "" };
  }


  const handleLogin = async () => {
    setIsLoading(true);
    
    const validation = validateInputs();
    if (!validation.valid) {
      setIsLoading(false);
      return toast.error(validation.message);
    }

    try {
      const response: any = await axios.post(`${URL}/api/v2/admin/login`, {
        email: email,
        password: password
      })

      const auth: auth = {
        authStatus: true,
        authInfo: response.data.admin,
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
      return toast.error(error.response?.data?.error || 'Login failed')
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

        <label className="mb-2 mx-1 font-medium block">Email Address</label>
        <div className='flex justify-between gap-3 items-center border border-gray-500 rounded-2xl px-3 mb-4'>
          <div className="flex items-center gap-3 w-full">
            <FaPhoneAlt size={20} />
            <input 
              type="email" 
              name='email' 
              className='h-12 outline-none rounded-2xl w-full' 
              placeholder='Email Address' 
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
        </div>

        <label className="mb-2 mx-1 font-medium block">Password</label>
        <div className='flex items-center gap-3 border border-gray-500 rounded-2xl px-3 mb-6'>
          <FaUnlock size={20} />
          <input 
            type="password" 
            name='password' 
            className='h-12 outline-none rounded-2xl w-full' 
            placeholder='Password' 
            value={password}
            onChange={(e) => setPassword(e.target.value)} 
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


