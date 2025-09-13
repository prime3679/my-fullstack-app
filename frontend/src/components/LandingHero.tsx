'use client';

import React from 'react';
import Link from 'next/link';
import { ClientLogger } from '../lib/logger';

interface LandingHeroProps {
  restaurantId?: string;
  restaurantName?: string;
}

export function LandingHero({ restaurantId, restaurantName }: LandingHeroProps) {
  const handleGetStartedClick = () => {
    ClientLogger.userAction('HERO_CTA_CLICKED', { 
      restaurantId,
      restaurantName,
      action: 'GET_STARTED'
    });
  };

  const handleLearnMoreClick = () => {
    ClientLogger.userAction('HERO_LEARN_MORE_CLICKED', { 
      restaurantId,
      restaurantName 
    });
  };

  const joinUrl = restaurantId 
    ? `/join?restaurant=${restaurantId}&ref=hero`
    : `/join?ref=hero`;

  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center">
          {/* Logo/Brand */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-8">
            <span className="text-4xl">🍽️</span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
            <span className="block">Skip the line,</span>
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              savor the moment
            </span>
          </h1>

          {/* Subheadline */}
          <p className="max-w-3xl mx-auto text-xl sm:text-2xl text-gray-600 mb-8">
            {restaurantName ? (
              <>
                Reserve your table at <span className="font-semibold text-gray-900">{restaurantName}</span> and pre-order your meal in under 90 seconds
              </>
            ) : (
              'Reserve tables and pre-order meals at your favorite restaurants. Arrive to find your food ready and your table waiting.'
            )}
          </p>

          {/* Value propositions */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mb-12">
            <div className="flex items-center text-gray-700">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-xl">⚡</span>
              </div>
              <div className="text-left">
                <div className="font-semibold">90 seconds</div>
                <div className="text-sm text-gray-500">to reserve & order</div>
              </div>
            </div>
            
            <div className="flex items-center text-gray-700">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-xl">🎯</span>
              </div>
              <div className="text-left">
                <div className="font-semibold">22 minutes</div>
                <div className="text-sm text-gray-500">average time saved</div>
              </div>
            </div>

            <div className="flex items-center text-gray-700">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-xl">⭐</span>
              </div>
              <div className="text-left">
                <div className="font-semibold">VIP treatment</div>
                <div className="text-sm text-gray-500">every time</div>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
            <Link
              href={joinUrl}
              onClick={handleGetStartedClick}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 inline-flex items-center justify-center"
            >
              Get Started →
            </Link>
            
            <button 
              onClick={handleLearnMoreClick}
              className="w-full sm:w-auto text-gray-700 px-8 py-4 rounded-lg hover:bg-gray-50 transition-colors text-lg font-medium inline-flex items-center justify-center"
            >
              Learn More
            </button>
          </div>

          {/* Social proof */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-4">
              Trusted by diners at these restaurants:
            </p>
            <div className="flex flex-wrap justify-center gap-8 opacity-60">
              {/* Placeholder restaurant logos - in real app, these would be actual partner logos */}
              <div className="flex items-center space-x-2 text-gray-400">
                <span className="text-lg">🍕</span>
                <span className="font-medium">Tony&apos;s Pizza</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <span className="text-lg">🍣</span>
                <span className="font-medium">Sakura Sushi</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <span className="text-lg">🥗</span>
                <span className="font-medium">Garden Fresh</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <span className="text-lg">🍔</span>
                <span className="font-medium">Burger Bar</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 w-full">
        <svg viewBox="0 0 1200 120" fill="none" className="w-full h-auto">
          <path
            d="M0,120 L0,60 Q300,20 600,60 T1200,60 L1200,120 Z"
            fill="url(#wave-gradient)"
          />
          <defs>
            <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}