'use client';

import { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

export default function DoctorLoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post(
        `${API_URL}/auth/doctor/request-magic-link`,
        { email: email.trim() },
        { withCredentials: true }
      );
      // Server always returns 200 — never reveal whether the email is registered
      setSent(true);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        setError('Too many attempts. Try again in 15 minutes.');
      } else {
        setError('Could not send link. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-md">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Check your WhatsApp</h1>
            <p className="mt-2 text-sm text-gray-600">
              If <strong>{email}</strong> is registered, we&apos;ve sent a sign-in link to your WhatsApp. The link expires in 15 minutes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-indigo-900">Care Setu</h1>
          <p className="mt-1 text-sm text-gray-600">Doctor sign-in</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-md">
          <label className="block text-sm font-medium text-gray-700">Your registered email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dr.name@hospital.com"
            required
            disabled={loading}
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-indigo-500 focus:outline-none"
            autoComplete="email"
            inputMode="email"
          />
          <button
            type="submit"
            disabled={loading || !email}
            className="mt-4 w-full rounded-lg bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send WhatsApp sign-in link'}
          </button>
          <p className="mt-3 text-xs text-gray-500">
            No password needed. We&apos;ll send a one-time link to your WhatsApp number on file.
          </p>
        </form>
      </div>
    </div>
  );
}
