import { Outlet, useNavigate } from "react-router-dom"
import Sidebar from "./Component/Sidebar"
import { auth } from "../lib/types"
import Navbar from "./Component/Navbar"
import { useEffect } from "react"

const AdminOutlet = () => {
  const navigate = useNavigate()
  const auth: auth | null = JSON.parse(localStorage.getItem('auth')) 
  useEffect(()=>{
    if(!auth?.authToken ||  !auth.authInfo ){
      navigate('/')
    }
  },[])
  return (
    <>
    <Sidebar />
    <Navbar />
    <Outlet />
    </>
  )
}

export default AdminOutlet
