import React, { useState, useEffect, useRef } from 'react'
import { Search, X, UserPlus } from 'lucide-react'
import axios from 'axios'

interface User {
    _id: string
    name: string
    phoneNumber: string
}

interface FormData {
    vehicleType: string
    pickUpDate: string
    pickUpTime: string
    pickUpLocation: string
    dropLocation: string
    bookingType: string
    getBestQuotePrice: boolean
    bookingAmount: string
    commissionAmount: string
    isProfileHidden: boolean
    extraRequirements: string
}

interface NewUser {
    name: string
    phoneNumber: string
    city: string
}

interface LocationSuggestion {
    place_id: string
    description: string
    main_text: string
    secondary_text: string
    types: string[]
}

const AddBookings: React.FC = () => {
    const BASE_URL = 'https://api.bharatyaatri.com'

    const [phoneNumber, setPhoneNumber] = useState<string>('')
    const [userSuggestions, setUserSuggestions] = useState<User[]>([])
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [showCreateUserModal, setShowCreateUserModal] = useState<boolean>(false)
    const [loading, setLoading] = useState<boolean>(false)
    const [searchLoading, setSearchLoading] = useState<boolean>(false)

    const [formData, setFormData] = useState<FormData>({
        vehicleType: 'SEDAN',
        pickUpDate: '',
        pickUpTime: '',
        pickUpLocation: '',
        dropLocation: '',
        bookingType: 'ONE-WAY',
        getBestQuotePrice: true,
        bookingAmount: '',
        commissionAmount: '',
        isProfileHidden: false,
        extraRequirements: ''
    })

    const [newUser, setNewUser] = useState<NewUser>({
        name: '',
        phoneNumber: '',
        city: ''
    })

    // Location suggestion states
    const [pickupSuggestions, setPickupSuggestions] = useState<LocationSuggestion[]>([])
    const [dropSuggestions, setDropSuggestions] = useState<LocationSuggestion[]>([])
    const [showPickupSuggestions, setShowPickupSuggestions] = useState<boolean>(false)
    const [showDropSuggestions, setShowDropSuggestions] = useState<boolean>(false)
    const [locationLoading, setLocationLoading] = useState<{ pickup: boolean; drop: boolean }>({
        pickup: false,
        drop: false
    })

    // Refs for click outside functionality
    const pickupRef = useRef<HTMLDivElement>(null)
    const dropRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (phoneNumber.length >= 3) {
            const timeoutId = setTimeout(() => {
                searchUsers(phoneNumber)
            }, 500)
            return () => clearTimeout(timeoutId)
        } else {
            setUserSuggestions([])
        }
    }, [phoneNumber])

    const searchUsers = async (phone: string): Promise<void> => {
        setSearchLoading(true)
        try {
            const response = await fetch(`${BASE_URL}/api/v2/user/admin/search/${phone}`)
            if (response.ok) {
                const data: User[] = await response.json()
                setUserSuggestions(data)
            }
        } catch (error) {
            console.error('Error searching users:', error)
        } finally {
            setSearchLoading(false)
        }
    }

    const handleSelectUser = (user: User): void => {
        setSelectedUser(user)
        setPhoneNumber(user.phoneNumber)
        setUserSuggestions([])
    }

    const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault()
        setLoading(true)
        try {
            const response = await axios.post(`${BASE_URL}/api/v2/user/createaccount`, {
                ...newUser
            })

            if (response.status === 201) {
                const createdUser: User = response.data
                setSelectedUser(createdUser)
                setShowCreateUserModal(false)
                setNewUser({ name: '', phoneNumber: '', city: '' })
                alert('User created successfully!')
            } else {
                alert('Failed to create user')
            }
        } catch (error) {
            console.error('Error creating user:', error)
            alert('Error creating user')
        } finally {
            setLoading(false)
        }
    }

    const openCreateUserModal = (): void => {
        setShowCreateUserModal(true)
        setNewUser({ name: '', phoneNumber: '', city: '' })
    }

    // Location suggestion functions
    const searchLocationSuggestions = async (keyword: string, type: 'pickup' | 'drop'): Promise<void> => {
        if (keyword.length < 2) {
            if (type === 'pickup') {
                setPickupSuggestions([])
                setShowPickupSuggestions(false)
            } else {
                setDropSuggestions([])
                setShowDropSuggestions(false)
            }
            return
        }

        setLocationLoading(prev => ({ ...prev, [type]: true }))
        
        try {
            const response = await axios.get(`${BASE_URL}/api/v2/booking/location-suggestions?keyword=${encodeURIComponent(keyword)}`)
            
            if (response.status === 200) {
                const suggestions: LocationSuggestion[] = response.data.suggestions || []
                
                if (type === 'pickup') {
                    setPickupSuggestions(suggestions)
                    setShowPickupSuggestions(true)
                } else {
                    setDropSuggestions(suggestions)
                    setShowDropSuggestions(true)
                }
            }
        } catch (error) {
            console.error(`Error fetching ${type} location suggestions:`, error)
        } finally {
            setLocationLoading(prev => ({ ...prev, [type]: false }))
        }
    }

    const handleLocationSelect = (suggestion: LocationSuggestion, type: 'pickup' | 'drop'): void => {
        if (type === 'pickup') {
            setFormData(prev => ({ ...prev, pickUpLocation: suggestion.description }))
            setShowPickupSuggestions(false)
            setPickupSuggestions([])
        } else {
            setFormData(prev => ({ ...prev, dropLocation: suggestion.description }))
            setShowDropSuggestions(false)
            setDropSuggestions([])
        }
    }

    // Debounced location search useEffects
    useEffect(() => {
        if (formData.pickUpLocation.length >= 2) {
            const timeoutId = setTimeout(() => {
                searchLocationSuggestions(formData.pickUpLocation, 'pickup')
            }, 300)
            return () => clearTimeout(timeoutId)
        } else {
            setPickupSuggestions([])
            setShowPickupSuggestions(false)
        }
    }, [formData.pickUpLocation])

    useEffect(() => {
        if (formData.dropLocation.length >= 2) {
            const timeoutId = setTimeout(() => {
                searchLocationSuggestions(formData.dropLocation, 'drop')
            }, 300)
            return () => clearTimeout(timeoutId)
        } else {
            setDropSuggestions([])
            setShowDropSuggestions(false)
        }
    }, [formData.dropLocation])

    // Click outside handler to close suggestions
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickupRef.current && !pickupRef.current.contains(event.target as Node)) {
                setShowPickupSuggestions(false)
            }
            if (dropRef.current && !dropRef.current.contains(event.target as Node)) {
                setShowDropSuggestions(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
        const target = e.target as HTMLInputElement
        const { name, value, type } = target
        const checked = target.checked

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault()

        if (!selectedUser) {
            alert('Please select or create a user first')
            return
        }

        setLoading(true)
        try {
            const bookingData: any = {
                bookedBy: selectedUser._id,
                vehicleType: formData.vehicleType,
                pickUpDate: formData.pickUpDate,
                pickUpTime: formData.pickUpTime,
                pickUpLocation: formData.pickUpLocation,
                dropLocation: formData.dropLocation,
                bookingType: formData.bookingType,
                getBestQuotePrice: formData.getBestQuotePrice,
                isProfileHidden: formData.isProfileHidden,
                extraRequirements: formData.extraRequirements ? formData.extraRequirements.split(',').map(s => s.trim()) : []
            }

            if (!formData.getBestQuotePrice) {
                bookingData.bookingAmount = parseFloat(formData.bookingAmount)
                bookingData.commissionAmount = parseFloat(formData.commissionAmount)
            }

            const response = await fetch(`${BASE_URL}/api/v2/booking/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingData)
            })

            if (response.ok) {
                alert('Booking created successfully!')
                setFormData({
                    vehicleType: 'SEDAN',
                    pickUpDate: '',
                    pickUpTime: '',
                    pickUpLocation: '',
                    dropLocation: '',
                    bookingType: 'ONE-WAY',
                    getBestQuotePrice: true,
                    bookingAmount: '',
                    commissionAmount: '',
                    isProfileHidden: false,
                    extraRequirements: ''
                })
                setSelectedUser(null)
                setPhoneNumber('')
            } else {
                const error = await response.json()
                alert(`Failed to create booking: ${error.message || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Error creating booking:', error)
            alert('Error creating booking')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full h-auto flex flex-col lg:flex-row mt-[8vh]">
            <div className='w-full lg:w-64 h-auto lg:h-[100vh] bg-gray-100 flex justify-center items-center p-4'>
            </div>
            <div className="flex-1">
                <div className="p-4 sm:p-6 bg-gray-100 overflow-x-auto">
                    <h1 className="text-2xl font-medium mb-4 text-gray-700 capitalize">
                        <span className="text-gray-500 cursor-pointer">
                            Dashboard
                        </span> / Add New Booking
                    </h1>

                    <div className="mb-8 p-6 bg-white rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-4">Search User</h2>
                        <div className="relative">
                            <div className="flex items-center gap-2">
                                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search by phone number..."
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="flex-1 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                    type="button"
                                    onClick={openCreateUserModal}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                                >
                                    <UserPlus size={20} />
                                    Create User
                                </button>
                                {searchLoading && <div className="text-sm text-gray-500">Searching...</div>}
                            </div>

                            {userSuggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {userSuggestions.map((user) => (
                                        <div
                                            key={user._id}
                                            onClick={() => handleSelectUser(user)}
                                            className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                                        >
                                            <div className="font-medium">{user.name}</div>
                                            <div className="text-sm text-gray-600">{user.phoneNumber}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedUser && (
                            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-green-800">Selected User: {selectedUser.name}</div>
                                    <div className="text-sm text-green-600">{selectedUser.phoneNumber}</div>
                                </div>
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg shadow space-y-6">
                        <h2 className="text-xl font-semibold mb-4">Booking Details</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Vehicle Type</label>
                                <select
                                    name="vehicleType"
                                    value={formData.vehicleType}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="HATCHBACK">HATCHBACK</option>
                                    <option value="SEDAN">SEDAN</option>
                                    <option value="ERTIGA">ERTIGA</option>
                                    <option value="SUV">SUV</option>
                                    <option value="INNOVA">INNOVA</option>
                                    <option value="INNOVA CRYSTA">INNOVA CRYSTA</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Booking Type</label>
                                <select
                                    name="bookingType"
                                    value={formData.bookingType}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="ONE-WAY">ONE-WAY</option>
                                    <option value="ROUND">ROUND</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Pick Up Date</label>
                                <input
                                    type="date"
                                    name="pickUpDate"
                                    value={formData.pickUpDate}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Pick Up Time</label>
                                <input
                                    type="time"
                                    name="pickUpTime"
                                    value={formData.pickUpTime}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="relative" ref={pickupRef}>
                            <label className="block text-sm font-medium mb-1">Pick Up Location</label>
                            <input
                                type="text"
                                name="pickUpLocation"
                                value={formData.pickUpLocation}
                                onChange={handleInputChange}
                                onFocus={() => formData.pickUpLocation.length >= 2 && setShowPickupSuggestions(true)}
                                required
                                placeholder="Enter pickup location..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            {locationLoading.pickup && (
                                <div className="absolute right-3 top-9 text-sm text-gray-500">
                                    Loading...
                                </div>
                            )}
                            
                            {showPickupSuggestions && pickupSuggestions.length > 0 && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {pickupSuggestions.map((suggestion) => (
                                        <div
                                            key={suggestion.place_id}
                                            onClick={() => handleLocationSelect(suggestion, 'pickup')}
                                            className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                                        >
                                            <div className="font-medium text-sm">{suggestion.main_text}</div>
                                            <div className="text-xs text-gray-600">{suggestion.secondary_text}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative" ref={dropRef}>
                            <label className="block text-sm font-medium mb-1">Drop Location</label>
                            <input
                                type="text"
                                name="dropLocation"
                                value={formData.dropLocation}
                                onChange={handleInputChange}
                                onFocus={() => formData.dropLocation.length >= 2 && setShowDropSuggestions(true)}
                                required
                                placeholder="Enter drop location..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            {locationLoading.drop && (
                                <div className="absolute right-3 top-9 text-sm text-gray-500">
                                    Loading...
                                </div>
                            )}
                            
                            {showDropSuggestions && dropSuggestions.length > 0 && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {dropSuggestions.map((suggestion) => (
                                        <div
                                            key={suggestion.place_id}
                                            onClick={() => handleLocationSelect(suggestion, 'drop')}
                                            className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                                        >
                                            <div className="font-medium text-sm">{suggestion.main_text}</div>
                                            <div className="text-xs text-gray-600">{suggestion.secondary_text}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                name="getBestQuotePrice"
                                checked={formData.getBestQuotePrice}
                                onChange={handleInputChange}
                                className="w-4 h-4"
                            />
                            <label className="text-sm font-medium">Get Best Quote Price</label>
                        </div>

                        {!formData.getBestQuotePrice && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Booking Amount</label>
                                    <input
                                        type="number"
                                        name="bookingAmount"
                                        value={formData.bookingAmount}
                                        onChange={handleInputChange}
                                        required={!formData.getBestQuotePrice}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Commission Amount</label>
                                    <input
                                        type="number"
                                        name="commissionAmount"
                                        value={formData.commissionAmount}
                                        onChange={handleInputChange}
                                        required={!formData.getBestQuotePrice}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                name="isProfileHidden"
                                checked={formData.isProfileHidden}
                                onChange={handleInputChange}
                                className="w-4 h-4"
                            />
                            <label className="text-sm font-medium">Hide Profile</label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Extra Requirements (comma separated)</label>
                            <textarea
                                name="extraRequirements"
                                value={formData.extraRequirements}
                                onChange={handleInputChange}
                                placeholder="e.g., Child seat, Extra luggage space, AC"
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !selectedUser}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                        >
                            {loading ? 'Creating Booking...' : 'Create Booking'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Create User Modal */}
            {showCreateUserModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <UserPlus size={20} />
                                Create New User
                            </h2>
                            <button
                                onClick={() => setShowCreateUserModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter full name"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={newUser.phoneNumber}
                                    onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter phone number"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">City</label>
                                <input
                                    type="text"
                                    value={newUser.city}
                                    onChange={(e) => setNewUser({ ...newUser, city: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter city"
                                />
                            </div>
                            
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateUserModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                                >
                                    {loading ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AddBookings