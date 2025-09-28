import { Outlet, useNavigate } from "react-router-dom"
import Sidebar from "./Component/Sidebar"
import { auth } from "../lib/types"
import Navbar from "./Component/Navbar"
import { useEffect } from "react"

const AdminOutlet = () => {
  const navigate = useNavigate()
  const storedData  : any = localStorage.getItem('auth')
  const auth : auth = JSON.parse(storedData) 
  useEffect(()=>{
    if(!auth.authInfo ){
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
