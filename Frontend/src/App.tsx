import './App.css'
import { BrowserRouter as Router , Routes , Route } from 'react-router-dom'
import Login from './Pages/Login'
import { ToastContainer } from 'react-toastify'
import AdminOutlet from './Admin/AdminOutlet'
import Dashboard from './Admin/Dashboard'
import AllUser from './Admin/User/Alluser'
import Rider from './Admin/User/Rider'
import Agents from './Admin/User/Agents'
import Unverified from './Admin/User/Unverified'
import SpecificUser from './Admin/User/SpecificUser'
import Duty from './Admin/Rides/Duty'
import Available from './Admin/Rides/Available'
import Exchange from './Admin/Rides/Exchange'
import Subscription from './Admin/Subscription/Subscription'
function App() {
  return (
    <Router>
      <ToastContainer />
      <Routes >
        <Route path='/' element={<Login />} />
        <Route path='/admin' element={<AdminOutlet />}>
          <Route path='/admin/dashboard' element={<Dashboard />} />
          <Route path='/admin/user/allusers' element={<AllUser />} />
          <Route path='/admin/user/riders' element={<Rider />} />
          <Route path='/admin/user/agents' element={<Agents />} />
          <Route path='/admin/user/unverified' element={<Unverified />} />
          <Route path='/admin/specificuser/:id' element={<SpecificUser />} />
          <Route path='/admin/ride/duty' element={<Duty />} />
          <Route path='/admin/ride/available' element={<Available />} />
          <Route path='/admin/ride/exchange' element={<Exchange />} />
          <Route path='/admin/subscription' element={<Subscription />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
