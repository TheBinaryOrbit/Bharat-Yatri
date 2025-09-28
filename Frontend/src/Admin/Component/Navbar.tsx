
import img from '../../assets/logo.png'


const Navbar = () => {
  return (
    <div className='w-full h-[10vh] py-4 bg-white fixed top-0 left-0 md:px-10 shadow flex items-center justify-between z-40'>
      <div>
        <img src={img} alt="" className="w-36 scale-90" />
      </div>
      <div className='justify-end gap-2 items-center md:flex hidden'>
        <div className=' w-12 h-12 rounded-full'>
          <img src="https://uxwing.com/wp-content/themes/uxwing/download/peoples-avatars/man-user-circle-icon.png" alt="" />
        </div>
        <div className=' flex flex-col items-start justify-center '>
          <h1 className='font-bold text-sm'>admin</h1>
          <p className='text-xs'>admin@bharatyaatri.com</p>
        </div>
      </div>
    </div>
  )
}

export default Navbar
