'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

type FilterTab = 'urgent' | 'routine' | 'educational';

interface InboxMessage {
  messageId: string;
  patientId: string;
  patientName: string;
  cancerType: string;
  stage?: string;
  treatmentProtocol: string;
  currentCycle: number;
  lastCheckinScore?: number;
  activeAlertSeverity?: string;
  content: string;
  triageCategory: string;
  triageUrgency: string;
  suggestedReply?: string;
  receivedAt: string;
}

interface Counts {
  urgent: number;
  routine: number;
  educational: number;
  total: number;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const URGENCY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

const TAB_STYLE = (active: boolean) =>
  active
    ? 'border-b-2 border-indigo-600 text-indigo-700 font-semibold'
    : 'text-gray-500';

export default function DoctorInboxPage() {
  const router = useRouter();
  const [tab, setTab] = useState<FilterTab>('urgent');
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [counts, setCounts] = useState<Counts>({ urgent: 0, routine: 0, educational: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [escalating, setEscalating] = useState<string | null>(null);

  const loadMessages = useCallback(
    async (status: FilterTab) => {
      setLoading(true);
      try {
        const [msgRes, cntRes] = await Promise.all([
          axios.get(`${API_URL}/doctor/inbox?status=${status}`, { withCredentials: true }),
          axios.get(`${API_URL}/doctor/inbox/counts`, { withCredentials: true }),
        ]);
        setMessages(msgRes.data.messages ?? []);
        setCounts(cntRes.data);
      } catch (err: any) {
        if (err?.response?.status === 401) router.replace('/doctor/login');
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadMessages(tab);
  }, [tab, loadMessages]);

  async function escalate(messageId: string) {
    setEscalating(messageId);
    try {
      await axios.post(`${API_URL}/doctor/inbox/${messageId}/escalate`, {}, { withCredentials: true });
      // Refresh
      loadMessages(tab);
    } catch {
      // ignore
    } finally {
      setEscalating(null);
    }
  }

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'urgent', label: '🔴 Urgent', count: counts.urgent },
    { key: 'routine', label: '🟡 Routine', count: counts.routine },
    { key: 'educational', label: '🟢 Educational', count: counts.educational },
  ];

  return (
    <div className="mx-auto max-w-md pb-16">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
            aria-label="Back"
          >
            ‹
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">📥 Patient Inbox</p>
            <p className="text-xs text-gray-500">{counts.total} unread messages</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-gray-200 px-4">
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 text-xs transition-colors ${TAB_STYLE(tab === key)}`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  key === 'urgent' ? 'bg-red-100 text-red-700' :
                  key === 'routine' ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl">✅</div>
            <p className="mt-3 text-sm font-medium text-gray-700">All clear</p>
            <p className="mt-1 text-xs text-gray-400">No {tab} messages right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isExpanded = expandedId === msg.messageId;
              return (
                <div
                  key={msg.messageId}
                  className="overflow-hidden rounded-xl bg-white shadow-sm"
                >
                  {/* Card header */}
                  <button
                    className="flex w-full items-start gap-3 p-4 text-left"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : msg.messageId)
                    }
                  >
                    <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${URGENCY_DOT[msg.triageUrgency] ?? 'bg-gray-300'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">{msg.patientName}</span>
                        <span className="text-xs text-gray-400">{timeAgo(msg.receivedAt)}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {msg.cancerType}{msg.stage ? ` · ${msg.stage}` : ''} · C{msg.currentCycle}
                        {msg.lastCheckinScore != null && (
                          <span className={`ml-1 font-medium ${
                            msg.lastCheckinScore <= 2 ? 'text-red-600' :
                            msg.lastCheckinScore <= 3 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            · score {msg.lastCheckinScore}/5
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm text-gray-800 line-clamp-2">{msg.content}</p>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                      <p className="mb-3 text-sm text-gray-800">{msg.content}</p>

                      {msg.suggestedReply && (
                        <div className="mb-3 rounded-lg bg-indigo-50 px-3 py-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                            AI-suggested reply
                          </p>
                          <p className="text-sm text-indigo-900">{msg.suggestedReply}</p>
                          <p className="mt-1 text-[10px] text-indigo-400">
                            Review and send via WhatsApp (full reply feature coming soon)
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/doctor/patients/${msg.patientId}`)}
                          className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white"
                        >
                          Open Patient
                        </button>
                        {msg.triageCategory === 'urgent' && (
                          <button
                            onClick={() => escalate(msg.messageId)}
                            disabled={escalating === msg.messageId}
                            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                          >
                            {escalating === msg.messageId ? '…' : '⚑ Escalate'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
