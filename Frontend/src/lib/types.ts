export interface auth {
    authStatus : Boolean,
    authToken : string,
    authInfo : {
      id : string,
      name : string,
      phoneNumber : string,
      userType : string,
      email : string
    }
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


export interface userdetails {
  aadhaarNumber : string,
  dlNumber : string,
  email : string,
  freeTrailEliglibity : boolean,
  isSubscribed : boolean,
  isVerified : boolean,
  name : string,
  phoneNumber : string,
  suscriptionEndDate  : string,
  suscriptionStaredDate : string,
  suscriptionType : {
    _id : string,
    subscriptionType : string,
    price : string,
    description : string
  },
  userCurrentLocation : string,
  userType : string,
  agencyName : string ,
  pincode : string,
  address : string,
  state : string,
  city : string,
  dob : string,
  aadhaarPhoto : string,
  dlPhoto : string
}

export interface statc {
  totalUsers : string,
  totalRiders: string,
  totalAgents: string,
  totalVerifiedUsers: string,
  subscriptionPercentage: {
      premium : string,
      standard: string,
      basic: string,
      trial: string,
      none: string,
  },
  totalRides: string,
  totalDutyRides: string,
  totalAvailableRides: string,
  totalExchangeRides: string
}

export interface subscription{
  _id : string,
  subscriptionType : string,
  price : string,
  description : string,
  benefits : string;
  timePeriod : number
}