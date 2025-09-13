'use client';

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { QuickSignup } from './QuickSignup';
import { SMSVerification } from './SMSVerification';
import { OnboardingWizard } from './OnboardingWizard';
import { ClientLogger } from '../../lib/logger';

interface OnboardingFlowProps {
  restaurantId?: string;
  referralSource?: string;
  onComplete?: () => void;
  initialStep?: 'signup' | 'verification' | 'onboarding';
}

type FlowStep = 'signup' | 'verification' | 'onboarding' | 'complete';

export function OnboardingFlow({ 
  restaurantId, 
  referralSource = 'direct',
  onComplete,
  initialStep = 'signup'
}: OnboardingFlowProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<FlowStep>(initialStep);
  const [userPhone, setUserPhone] = useState('');

  // Log the start of onboarding flow
  React.useEffect(() => {
    ClientLogger.businessEvent('ONBOARDING_FLOW_STARTED', {
      referralSource,
      restaurantId,
      initialStep
    });
  }, [referralSource, restaurantId, initialStep]);

  const handleSignupSuccess = (userId: string) => {
    ClientLogger.businessEvent('SIGNUP_SUCCESS', { userId, referralSource, restaurantId });
    
    // If user is already authenticated (no verification needed), go to onboarding
    if (user) {
      setCurrentStep('onboarding');
    }
  };

  const handleVerificationNeeded = (phone: string) => {
    setUserPhone(phone);
    setCurrentStep('verification');
    ClientLogger.userAction('VERIFICATION_STEP_STARTED', { phone });
  };

  const handleVerificationSuccess = () => {
    ClientLogger.businessEvent('VERIFICATION_SUCCESS', { phone: userPhone });
    setCurrentStep('onboarding');
  };

  const handleOnboardingComplete = () => {
    ClientLogger.businessEvent('ONBOARDING_COMPLETE', { userId: user?.id });
    setCurrentStep('complete');
    
    // Give user a moment to see success, then proceed
    setTimeout(() => {
      onComplete?.();
    }, 1500);
  };

  const handleBackToSignup = () => {
    setCurrentStep('signup');
    setUserPhone('');
  };

  // If user is already authenticated and has completed onboarding, skip to complete
  React.useEffect(() => {
    if (user && currentStep === 'signup') {
      // Check if user has completed basic profile
      if (user.dinerProfile) {
        setCurrentStep('complete');
        setTimeout(() => onComplete?.(), 500);
      } else {
        setCurrentStep('onboarding');
      }
    }
  }, [user, currentStep, onComplete]);

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'signup':
        return (
          <QuickSignup
            restaurantId={restaurantId}
            referralSource={referralSource}
            onSuccess={handleSignupSuccess}
            onVerificationNeeded={handleVerificationNeeded}
          />
        );
      
      case 'verification':
        return (
          <SMSVerification
            phone={userPhone}
            onSuccess={handleVerificationSuccess}
            onBack={handleBackToSignup}
          />
        );
      
      case 'onboarding':
        return (
          <OnboardingWizard
            onComplete={handleOnboardingComplete}
          />
        );
      
      case 'complete':
        return (
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mb-6 animate-bounce">
              <span className="text-3xl">🚀</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready to dine!
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              You&apos;re now part of the La Carta VIP experience
            </p>
            
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center justify-center space-x-2">
                <span className="text-green-500">✓</span>
                <span>Skip the line at partner restaurants</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <span className="text-green-500">✓</span>
                <span>Pre-order your favorite dishes</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <span className="text-green-500">✓</span>
                <span>Get personalized recommendations</span>
              </div>
            </div>

            <div className="mt-6 animate-pulse text-gray-500">
              Taking you to restaurants...
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            La Carta
          </h1>
          <p className="text-gray-600">
            Skip lines, savor time, smile bigger
          </p>
        </div>

        {/* Flow Step Indicator (only show during flow) */}
        {currentStep !== 'complete' && (
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-4">
              {/* Step 1: Signup */}
              <div className={`flex items-center ${currentStep === 'signup' ? 'text-blue-600' : currentStep === 'verification' || currentStep === 'onboarding' ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  currentStep === 'signup' 
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' 
                    : currentStep === 'verification' || currentStep === 'onboarding'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {currentStep === 'verification' || currentStep === 'onboarding' ? '✓' : '1'}
                </div>
                <span className="ml-2 text-sm font-medium hidden sm:block">Sign up</span>
              </div>

              {/* Connector */}
              <div className={`w-8 h-px ${currentStep === 'onboarding' ? 'bg-green-300' : currentStep === 'verification' ? 'bg-blue-300' : 'bg-gray-300'}`} />

              {/* Step 2: Verification */}
              <div className={`flex items-center ${currentStep === 'verification' ? 'text-blue-600' : currentStep === 'onboarding' ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  currentStep === 'verification' 
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' 
                    : currentStep === 'onboarding'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {currentStep === 'onboarding' ? '✓' : '2'}
                </div>
                <span className="ml-2 text-sm font-medium hidden sm:block">Verify</span>
              </div>

              {/* Connector */}
              <div className={`w-8 h-px ${currentStep === 'onboarding' ? 'bg-blue-300' : 'bg-gray-300'}`} />

              {/* Step 3: Preferences */}
              <div className={`flex items-center ${currentStep === 'onboarding' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  currentStep === 'onboarding' 
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  3
                </div>
                <span className="ml-2 text-sm font-medium hidden sm:block">Preferences</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex justify-center">
          {renderCurrentStep()}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>
            Join thousands of diners who skip the wait.{' '}
            <span className="font-medium">Average time saved: 22 minutes</span>
          </p>
        </div>
      </div>
    </div>
  );
}