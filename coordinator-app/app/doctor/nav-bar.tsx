'use client';

import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/doctor/today', icon: '🗓', label: 'Today' },
  { href: '/doctor/inbox', icon: '📥', label: 'Inbox' },
];

export function DoctorNavBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide nav on login / verify flows
  if (pathname.startsWith('/doctor/login')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 bg-white">
      {NAV.map(({ href, icon, label }) => {
        const active = pathname.startsWith(href);
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs transition-colors ${
              active ? 'text-indigo-700' : 'text-gray-500'
            }`}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span className="font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
