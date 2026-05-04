'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('Missing sign-in token.');
      return;
    }

    let cancelled = false;
    axios
      .post(`${API_URL}/auth/doctor/verify`, { token }, { withCredentials: true })
      .then(() => {
        if (cancelled) return;
        router.replace('/doctor/today');
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        setError(status === 401 ? 'This link has expired or already been used.' : 'Sign-in failed. Try again.');
      });

    return () => { cancelled = true; };
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-md">
        {error ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Sign-in failed</h1>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <a
              href="/doctor/login"
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Request a new link
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
            <p className="text-sm text-gray-600">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function DoctorVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-md">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="text-sm text-gray-600">Signing you in…</p>
          </div>
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
