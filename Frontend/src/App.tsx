import './App.css'
import { BrowserRouter as Router , Routes , Route } from 'react-router-dom'
import Login from './Pages/Login'
import { ToastContainer } from 'react-toastify'
import AdminOutlet from './Admin/AdminOutlet'
import Dashboard from './Admin/Dashboard'
import AllUser from './Admin/User/Alluser'
import SpecificUser from './Admin/User/SpecificUser'


import AllBookings from './Admin/Bookings/AllBookings'
import BookingDetails from './Admin/Bookings/BookingDetails'
import AddBookings from './Admin/Bookings/AddBookings'

function App() {
  return (
    <Router>
      <ToastContainer />
      <Routes >
        <Route path='/' element={<Login />} />
        <Route path='/admin' element={<AdminOutlet />}>
          <Route path='/admin/dashboard' element={<Dashboard />} />
          
          {/* User Management Routes */}
          <Route path='/admin/users' element={<AllUser />} />
          <Route path='/admin/user/allusers' element={<AllUser />} />
          
          <Route path='/admin/specificuser/:id' element={<SpecificUser />} />
          <Route path='/admin/user/details/:userId' element={<SpecificUser />} />
          
          {/* Booking Management Routes */}
          <Route path='/admin/bookings' element={<AllBookings />} />
          <Route path='/admin/addride' element={<AddBookings />} />
          <Route path='/admin/booking/details/:bookingId' element={<BookingDetails />} />
          
          
          
        </Route>
      </Routes>
    </Router>
  )
}

export default App
