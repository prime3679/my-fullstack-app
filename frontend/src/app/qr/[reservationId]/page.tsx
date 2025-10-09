'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE } from '../../../lib/api';

interface QRData {
  success: boolean;
  data?: {
    qrData: string;
    qrUrl: string;
    reservation: {
      id: string;
      status: string;
      restaurant: {
        name: string;
        slug: string;
      };
      user: {
        name: string;
        email: string;
      };
    };
  };
  error?: string;
}

export default function QRCodePage() {
  const params = useParams();
  const reservationId = params.reservationId as string;

  const { data: qrData, isLoading } = useQuery({
    queryKey: ['qr-code', reservationId],
    queryFn: () => fetchQRData(reservationId),
    enabled: !!reservationId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating QR code...</p>
        </div>
      </div>
    );
  }

  if (!qrData?.success || !qrData.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">QR Code Error</h1>
            <p className="text-gray-600">
              Unable to generate QR code for this reservation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { qrUrl, reservation } = qrData.data;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {reservation.restaurant.name}
            </h1>
            <p className="text-gray-600">Check-in QR Code</p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-8">
            <div className="bg-white p-4 rounded-lg border">
              <QRCodeSVG
                value={qrUrl}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>

          {/* Reservation Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Reservation Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Guest:</span>
                <span className="font-medium">{reservation.user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="font-medium capitalize">{reservation.status.toLowerCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reservation ID:</span>
                <span className="font-medium font-mono text-xs">{reservation.id}</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-center">
            <h4 className="font-semibold text-gray-900 mb-2">How to use:</h4>
            <ol className="text-sm text-gray-600 text-left space-y-1">
              <li>1. Show this QR code to your guests</li>
              <li>2. They can scan it with their phone camera</li>
              <li>3. This will take them to the check-in page</li>
              <li>4. Kitchen will be notified automatically</li>
            </ol>
          </div>

          {/* Direct Link */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Direct link:</strong>
            </p>
            <a 
              href={qrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm break-all underline"
            >
              {qrUrl}
            </a>
          </div>

          {/* Print Button */}
          <div className="mt-6 text-center">
            <button
              onClick={() => window.print()}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Print QR Code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// API function
async function fetchQRData(reservationId: string): Promise<QRData> {
  const response = await fetch(`${API_BASE}/checkin/qr/${reservationId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch QR data');
  }
  return response.json();
}
