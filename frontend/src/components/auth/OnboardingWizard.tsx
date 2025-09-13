'use client';

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingButton } from '../Loading';
import { ClientLogger } from '../../lib/logger';

interface OnboardingWizardProps {
  onComplete?: () => void;
}

const DIETARY_PREFERENCES = [
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥬' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱' },
  { id: 'gluten-free', label: 'Gluten-Free', emoji: '🚫🌾' },
  { id: 'dairy-free', label: 'Dairy-Free', emoji: '🥛❌' },
  { id: 'keto', label: 'Keto', emoji: '🥑' },
  { id: 'paleo', label: 'Paleo', emoji: '🦴' },
  { id: 'low-sodium', label: 'Low Sodium', emoji: '🧂❌' },
  { id: 'pescatarian', label: 'Pescatarian', emoji: '🐟' }
];

const COMMON_ALLERGENS = [
  { id: 'nuts', label: 'Tree Nuts', emoji: '🥜' },
  { id: 'peanuts', label: 'Peanuts', emoji: '🥜' },
  { id: 'shellfish', label: 'Shellfish', emoji: '🦐' },
  { id: 'fish', label: 'Fish', emoji: '🐟' },
  { id: 'eggs', label: 'Eggs', emoji: '🥚' },
  { id: 'dairy', label: 'Dairy', emoji: '🥛' },
  { id: 'soy', label: 'Soy', emoji: '🫘' },
  { id: 'gluten', label: 'Gluten/Wheat', emoji: '🌾' }
];

type Step = 'welcome' | 'dietary' | 'allergens' | 'notifications' | 'complete';

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user, updateProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  
  const [preferences, setPreferences] = useState({
    dietary: [] as string[],
    allergens: [] as string[],
    notifications: {
      reservation: true,
      promotions: false,
      newsletter: false
    }
  });

  const toggleDietary = (id: string) => {
    setPreferences(prev => ({
      ...prev,
      dietary: prev.dietary.includes(id)
        ? prev.dietary.filter(item => item !== id)
        : [...prev.dietary, id]
    }));
  };

  const toggleAllergen = (id: string) => {
    setPreferences(prev => ({
      ...prev,
      allergens: prev.allergens.includes(id)
        ? prev.allergens.filter(item => item !== id)
        : [...prev.allergens, id]
    }));
  };

  const handleNext = (nextStep: Step) => {
    ClientLogger.userAction(`ONBOARDING_${currentStep.toUpperCase()}_COMPLETED`, {
      userId: user?.id,
      step: currentStep
    });
    setCurrentStep(nextStep);
  };

  const handleComplete = async () => {
    setIsLoading(true);
    
    try {
      // Update user profile with collected preferences
      await updateProfile({
        dinerProfile: {
          dietaryTags: preferences.dietary,
          allergensJson: preferences.allergens
        },
        marketingOptIn: preferences.notifications.promotions || preferences.notifications.newsletter
      });

      ClientLogger.businessEvent('ONBOARDING_COMPLETED', {
        userId: user?.id,
        dietaryPreferences: preferences.dietary,
        allergenCount: preferences.allergens.length,
        marketingOptIn: preferences.notifications.promotions
      });

      setCurrentStep('complete');
      
      // Auto-proceed to main app after showing success
      setTimeout(() => {
        onComplete?.();
      }, 2000);

    } catch (error) {
      ClientLogger.error('Onboarding completion failed', { 
        error: { 
          name: (error as Error).name, 
          message: (error as Error).message 
        } 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mb-6">
              <span className="text-3xl">👋</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to La Carta, {user?.name?.split(' ')[0]}!
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Let&apos;s personalize your dining experience in just 3 quick steps
            </p>
            
            <div className="flex justify-center space-x-8 mb-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-xl">🍽️</span>
                </div>
                <p className="text-sm text-gray-600">Preferences</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-xl">⚠️</span>
                </div>
                <p className="text-sm text-gray-600">Allergies</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-xl">🔔</span>
                </div>
                <p className="text-sm text-gray-600">Updates</p>
              </div>
            </div>

            <button
              onClick={() => handleNext('dietary')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 text-lg font-semibold shadow-lg"
            >
              Let&apos;s get started! →
            </button>
          </div>
        );

      case 'dietary':
        return (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Any dietary preferences?
              </h2>
              <p className="text-gray-600">
                Help us recommend the perfect dishes for you
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {DIETARY_PREFERENCES.map((pref) => (
                <button
                  key={pref.id}
                  onClick={() => toggleDietary(pref.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    preferences.dietary.includes(pref.id)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="text-2xl mb-1">{pref.emoji}</div>
                  <div className="text-sm font-medium">{pref.label}</div>
                </button>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => handleNext('allergens')}
                className="text-gray-600 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Skip for now
              </button>
              <button
                onClick={() => handleNext('allergens')}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Continue →
              </button>
            </div>
          </div>
        );

      case 'allergens':
        return (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Any food allergies?
              </h2>
              <p className="text-gray-600">
                We&apos;ll make sure restaurants know to keep you safe
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {COMMON_ALLERGENS.map((allergen) => (
                <button
                  key={allergen.id}
                  onClick={() => toggleAllergen(allergen.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    preferences.allergens.includes(allergen.id)
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="text-2xl mb-1">{allergen.emoji}</div>
                  <div className="text-sm font-medium">{allergen.label}</div>
                </button>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => handleNext('notifications')}
                className="text-gray-600 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                None for me
              </button>
              <button
                onClick={() => handleNext('notifications')}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Continue →
              </button>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Stay in the loop?
              </h2>
              <p className="text-gray-600">
                Choose what updates you&apos;d like to receive
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
                <input
                  type="checkbox"
                  id="reservation-notifications"
                  checked={preferences.notifications.reservation}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, reservation: e.target.checked }
                  }))}
                  className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <label htmlFor="reservation-notifications" className="text-sm font-medium text-gray-900">
                    Reservation updates
                  </label>
                  <p className="text-xs text-gray-500">
                    Table confirmations, check-in reminders, order status
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
                <input
                  type="checkbox"
                  id="promotion-notifications"
                  checked={preferences.notifications.promotions}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, promotions: e.target.checked }
                  }))}
                  className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <label htmlFor="promotion-notifications" className="text-sm font-medium text-gray-900">
                    Special offers
                  </label>
                  <p className="text-xs text-gray-500">
                    Exclusive deals, happy hour alerts, loyalty rewards
                  </p>
                </div>
              </div>
            </div>

            <LoadingButton
              isLoading={isLoading}
              onClick={handleComplete}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-4 px-6 rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 text-lg font-semibold shadow-lg"
            >
              {isLoading ? 'Setting up your profile...' : 'Complete setup! 🎉'}
            </LoadingButton>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mb-6">
              <span className="text-3xl">🎉</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              You&apos;re all set!
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Welcome to the VIP dining experience
            </p>
            
            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-700">
                <strong>✨ Profile complete!</strong><br />
                Restaurants can now provide personalized recommendations and keep you safe from allergens.
              </p>
            </div>

            <div className="animate-pulse text-gray-500">
              Taking you to your dashboard...
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      {/* Progress indicator */}
      {currentStep !== 'welcome' && currentStep !== 'complete' && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Step {currentStep === 'dietary' ? '1' : currentStep === 'allergens' ? '2' : '3'} of 3</span>
            <span>{Math.round(((currentStep === 'dietary' ? 1 : currentStep === 'allergens' ? 2 : 3) / 3) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${((currentStep === 'dietary' ? 1 : currentStep === 'allergens' ? 2 : 3) / 3) * 100}%` 
              }}
            />
          </div>
        </div>
      )}

      {renderStep()}
    </div>
  );
}