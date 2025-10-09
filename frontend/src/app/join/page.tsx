'use client';

import { useEffect } from 'react';
import { OnboardingFlow } from '../../components/auth/OnboardingFlow';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClientLogger } from '../../lib/logger';

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get parameters from URL
  const restaurantId = searchParams.get('restaurant');
  const referralSource = searchParams.get('ref') || 'direct';

  useEffect(() => {
    // Log page visit for analytics
    ClientLogger.pageView('/join', { 
      referralSource,
      restaurantId: restaurantId || undefined
    });
  }, [referralSource, restaurantId]);

  const handleOnboardingComplete = () => {
    // Navigate to appropriate page after onboarding
    if (restaurantId) {
      router.push(`/restaurant/${restaurantId}`);
    } else {
      router.push('/');
    }
  };

  return (
    <OnboardingFlow
      restaurantId={restaurantId || undefined}
      referralSource={referralSource}
      onComplete={handleOnboardingComplete}
    />
  );
}
