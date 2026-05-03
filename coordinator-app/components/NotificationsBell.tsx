'use client';

import { useState, useEffect, useRef } from 'react';
import { FiBell, FiCheck, FiAlertCircle, FiFileText, FiCalendar, FiX } from 'react-icons/fi';
import Link from 'next/link';

export interface NotificationItem {
  id: string;
  type: 'alert' | 'document_uploaded' | 'tumor-board';
  patientId: string;
  message: string;
  severity?: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'care_setu_notifications';
const MAX_ITEMS = 30;

function loadFromStorage(): NotificationItem[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NotificationItem[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: NotificationItem[]) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore quota errors
  }
}

// Module-level event bus so any code (e.g. WebSocket handlers) can push notifications
type Listener = (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
const listeners = new Set<Listener>();
export function pushNotification(item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) {
  listeners.forEach(l => l(item));
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load on mount
  useEffect(() => {
    setItems(loadFromStorage());
  }, []);

  // Subscribe to push events
  useEffect(() => {
    const handler: Listener = (incoming) => {
      setItems(prev => {
        const next: NotificationItem[] = [
          {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            read: false,
            ...incoming,
          },
          ...prev,
        ].slice(0, MAX_ITEMS);
        saveToStorage(next);
        return next;
      });
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unreadCount = items.filter(i => !i.read).length;

  const markAllRead = () => {
    setItems(prev => {
      const next = prev.map(i => ({ ...i, read: true }));
      saveToStorage(next);
      return next;
    });
  };

  const dismiss = (id: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.id !== id);
      saveToStorage(next);
      return next;
    });
  };

  const iconFor = (type: string) => {
    if (type === 'alert') return <FiAlertCircle className="text-red-600" size={14} />;
    if (type === 'document_uploaded') return <FiFileText className="text-blue-600" size={14} />;
    if (type === 'tumor-board') return <FiCalendar className="text-purple-600" size={14} />;
    return <FiBell className="text-gray-600" size={14} />;
  };

  const timeAgo = (ts: number) => {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-2 hover:bg-gray-100"
        aria-label="Notifications"
      >
        <FiBell className="text-gray-700" size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 rounded-lg border border-gray-200 bg-white shadow-xl z-50 max-h-[28rem] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
              >
                <FiCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                <FiBell className="mx-auto mb-2 text-gray-300" size={28} />
                No notifications yet
              </div>
            ) : (
              items.map(item => (
                <div
                  key={item.id}
                  className={`group relative flex items-start gap-3 border-b border-gray-100 px-4 py-3 hover:bg-gray-50 ${
                    !item.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="mt-0.5">{iconFor(item.type)}</div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/dashboard/patients/${item.patientId}`}
                      onClick={() => setOpen(false)}
                      className="text-sm text-gray-900 hover:text-indigo-700 line-clamp-2"
                    >
                      {item.message}
                    </Link>
                    <div className="text-xs text-gray-500 mt-1">{timeAgo(item.timestamp)}</div>
                  </div>
                  <button
                    onClick={() => dismiss(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700"
                    aria-label="Dismiss"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
