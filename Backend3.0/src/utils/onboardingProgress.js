import { ONBOARDING_STEPS } from '../constants/driver.constants.js';

// Where a driver stands in onboarding, in the shape every onboarding response carries.
//
// isProfileComplete wins over the stored step: drivers who registered through the single-call
// /drivers/onboard have a finished profile whether or not they were ever given a step number.
export const onboardingProgress = (driver) => {
  const completedStep = driver.isProfileComplete ? ONBOARDING_STEPS.length : driver.onboardingStep || 0;

  return {
    completedStep,
    nextStep: ONBOARDING_STEPS[completedStep] ?? null,
    totalSteps: ONBOARDING_STEPS.length,
    isComplete: completedStep >= ONBOARDING_STEPS.length,
  };
};
