export const sendOTP =async (phoneNumber)=>{
    return {
        status  : true,
        sessionId : 'zesxdtfghijkl'
    }
}


export const verifyOTPWithPhoneNumber = async (phoneNumber, OTP, sessionId)=>{
    if(otp == 1234){
        return true
    }
    else {
        return  false
    }
}