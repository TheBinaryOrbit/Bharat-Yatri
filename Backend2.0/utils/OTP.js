export const sendOTP =async (phoneNumber)=>{
    return {
        status  : true,
        sessionId : 'zesxdtfghijkl'
    }
}


export const verifyOTPWithPhoneNumber = async (phoneNumber, OTP, sessionId)=>{
    console.log(OTP)
    if(OTP == '1234'){
        return true
    }
    else {
        return  false
    }
}