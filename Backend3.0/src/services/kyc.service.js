import axios from 'axios';
import { env } from '../config/env.js';

export class KycService {
  // Creates a Signzy DigiLocker session and returns the redirect URL.
  // `callbackUrl` is where Signzy posts the result (must include the account id).
  createDigilockerUrl = async (callbackUrl) => {
    const { data } = await axios.post(
      `${env.SIGNZY_BASE_URL}/api/v3/digilocker/createUrl`,
      {
        signup: true,
        callbackUrl,
        successRedirectUrl: env.SIGNZY_SUCCESS_URL,
        successRedirectTime: '5',
        failureRedirectUrl: env.SIGNZY_FAILURE_URL,
        failureRedirectTime: '5',
        logoVisible: 'true',
        logo: 'https://static.wixstatic.com/media/fac051_da14316a893448478965bfbd3187ec2f~mv2.png/v1/fill/w_80,h_80,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Black%20logo.png',
        docType: ['ADHAR'],
        purpose: 'kyc',
        getScope: true,
        getBase64Files: false,
        getEAadhaarPdf: true,
        getEAadhaarJpeg: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: env.SIGNZY_API_KEY,
        },
      }
    );

    return data?.result?.url;
  };

  // Normalizes a Signzy KYC callback payload into the fields we persist.
  parseCallback = (data) => {
    return {
      requestId: data?.requestId,
      status: data?.status,
      adharFileId: data?.details?.files?.[0]?.id,
      aadhaarJpeg: data?.aadharDetail?.aadhaarJpeg,
    };
  };
}
