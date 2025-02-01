import { auth } from "../../lib/types"
const Navbar = () => {
  const auth: auth | null = JSON.parse(localStorage.getItem('auth'))
  const user = auth?.authInfo
  return (
    <div className='w-full h-[10vh] py-2 bg-white fixed top-0 left-0 px-10 shadow flex items-center justify-between z-40'>
      <div>
        <h1>Bharat yatri logo</h1>
      </div>
      <div className='justify-end gap-2 items-center md:flex hidden'>
        <div className=' w-12 h-12 rounded-full'>
          <img src="https://uxwing.com/wp-content/themes/uxwing/download/peoples-avatars/man-user-circle-icon.png" alt="" />
        </div>
        <div className=' flex flex-col items-start justify-center '>
          <h1 className='font-bold text-sm'>{user?.name}</h1>
          <p className='text-xs'>{user?.email}</p>
        </div>
      </div>
    </div>
  )
}

export default Navbar
