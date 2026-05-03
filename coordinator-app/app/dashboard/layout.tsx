'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCoordinatorStore } from '@/lib/store';
import { getMe } from '@/lib/api';
import Link from 'next/link';
import { FiLogOut, FiUsers, FiHome, FiSettings, FiUserCheck, FiGitBranch, FiShield, FiTrendingUp } from 'react-icons/fi';
import { ToastProvider } from '@/lib/toast';
import { NotificationsBell } from '@/components/NotificationsBell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const {
    isAuthenticated, coordinatorName, coordinatorRole,
    setAuthenticated, setCoordinatorRole, setCoordinatorName, logout,
  } = useCoordinatorStore();

  // Hydrate auth state by calling /auth/me — the HttpOnly cookie is sent
  // automatically by the browser. Missing/expired cookie → 401 → redirect to login.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isAuthenticated) return;
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        setAuthenticated(true);
        setCoordinatorRole(me.role || 'COORDINATOR');
        if (me.name) setCoordinatorName(me.name);
      })
      .catch(() => {
        if (!cancelled) router.push('/');
      });
    return () => { cancelled = true; };
  }, [isAuthenticated, router, setAuthenticated, setCoordinatorRole, setCoordinatorName]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!isAuthenticated) {
    return null;
  }

  const isAdmin = coordinatorRole === 'ADMIN';

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 text-white relative">
        <div className="p-6">
          <h1 className="text-2xl font-bold">Care Setu</h1>
          <p className="mt-2 text-indigo-200">Coordinator Dashboard</p>
        </div>

        <nav className="mt-8 space-y-2 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-indigo-800"
          >
            <FiHome className="text-xl" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/patients"
            className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-indigo-800"
          >
            <FiUsers className="text-xl" />
            Patients
          </Link>
          <Link
            href="/dashboard/doctors"
            className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-indigo-800"
          >
            <FiUserCheck className="text-xl" />
            Doctors
          </Link>
          <Link
            href="/dashboard/referrals"
            className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-indigo-800"
          >
            <FiGitBranch className="text-xl" />
            Referrals
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/dashboard/admin"
                className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-indigo-800"
              >
                <FiSettings className="text-xl" />
                Admin
              </Link>
              <Link
                href="/dashboard/admin/outcomes"
                className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-indigo-800"
              >
                <FiTrendingUp className="text-xl" />
                Outcomes
              </Link>
              <Link
                href="/dashboard/admin/compliance"
                className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-indigo-800"
              >
                <FiShield className="text-xl" />
                Compliance
              </Link>
            </>
          )}
        </nav>

        <div className="absolute bottom-0 w-64 border-t border-indigo-800 p-4">
          <div className="mb-1 text-sm text-indigo-200">
            {coordinatorName || 'Coordinator'}
          </div>
          <div className="mb-3 text-xs text-indigo-300">
            {isAdmin ? 'Hospital Admin' : 'Care Coordinator'}
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg bg-indigo-800 px-4 py-2 text-sm hover:bg-indigo-700"
          >
            <FiLogOut />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Top bar with notifications bell */}
        <div className="sticky top-0 z-10 flex items-center justify-end gap-3 border-b border-gray-200 bg-white px-6 py-3">
          <NotificationsBell />
        </div>
        <div className="p-8">{children}</div>
      </main>

      <ToastProvider />
    </div>
  );
}
