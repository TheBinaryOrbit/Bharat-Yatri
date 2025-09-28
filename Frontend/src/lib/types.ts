export interface auth {
    authStatus : Boolean,
    authInfo : {
      id : string,
      name : string,
      phoneNumber : string,
      email : string
    },
  }

export interface user  {
    _id : string,
    name : string,
    phoneNumber : string,
    isVerified : boolean,
    isSubscribed : boolean,
    userType : string
}


export interface ride  {
  _id : string,
  PickupDateAndTime: string,
  commissionFee: string,
  customerFare: string,
  description: string,
  from: string,
  status: string,
  to: string,
  carModel : string,
  tripType : string,
  createdAt : string,
  createdByDetails : {
    email : string,
    name : string,
    phoneNumber : string,
    userType : string
    _id : string
  }
}

export interface exchnage  {
    _id: string,
    carModel: string,
    from: string
    to: string,
    description: string,
    status: string,
    createdAt : string,
    createdByDetails : {
      email : string,
      name : string,
      phoneNumber : string,
      userType : string
      _id : string
    }
}


export interface subscriptionHistory {
  _id?: string,
  subscriptionType?: {
    _id?: string,
    title?: string,
    price?: number,
    benefits?: string,
    timePeriod?: number
  },
  subscribedBy?: string,
  startDate?: string,
  endDate?: string,
  createdAt?: string,
  updatedAt?: string
}

export interface driver {
  _id?: string,
  name?: string,
  phone?: string,
  address?: string,
  city?: string,
  driverImage?: string,
  dlNumber?: string,
  dlFront?: string,
  dlBack?: string,
  userId?: string,
  createdAt?: string,
  updatedAt?: string
}

export interface vehicle {
  _id?: string,
  vehicleType?: string,
  registrationNumber?: string,
  yearOfManufacture?: string,
  insuranceImage?: string,
  insuranceExpDate?: string,
  vehicleImages?: string[],
  rcImage?: string,
  userId?: string,
  createdAt?: string,
  updatedAt?: string
}

export interface bankDetail {
  _id?: string,
  accountHolderName?: string,
  accountNumber?: string,
  bankName?: string,
  ifscCode?: string,
  isVerified?: boolean,
  userId?: string,
  createdAt?: string,
  updatedAt?: string
}

export interface userdetails {
  message?: string,
  user?: {
    _id?: string,
    name?: string,
    phoneNumber?: string,
    city?: string,
    userType?: string,
    userImage?: string,
    isSubscribed?: boolean,
    isUserVerified?: boolean,
    isSendNotification?: boolean,
    carAleartFor?: string[],
    isFreeTrialEligible?: boolean,
    createdAt?: string,
    updatedAt?: string,
    subscriptionHistory?: subscriptionHistory[],
    drivers?: driver[],
    vehicles?: vehicle[],
    bankDetails?: bankDetail[]
  }
}

export interface statc {
  totalUsers : string,
  totalRiders : string,
  totalAgents : string,
  totalVerifiedUsers : string,
  subscriptionPercentage: {
      premium : string,
      standard: string,
      basic: string,
      trial: string,
      none: string,
  },
  totalRides?: string,
  totalDutyRides?: string,
  totalAvailableRides?: string,
  totalExchangeRides?: string
}

export interface subscription{
  _id : string,
  subscriptionType : string,
  price : string,
  description : string,
  benefits : string;
  timePeriod : number
}