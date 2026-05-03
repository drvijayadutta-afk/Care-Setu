'use client';

import { useState } from 'react';
import { FiRefreshCw, FiMessageSquare, FiAlertCircle, FiCalendar, FiActivity } from 'react-icons/fi';
import { getPatientOutboundMessages, OutboundMessage } from '@/lib/api';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  checkin_prompt:        { label: 'Check-in',        color: 'bg-blue-100 text-blue-800' },
  appointment_reminder:  { label: 'Appt Reminder',   color: 'bg-indigo-100 text-indigo-800' },
  appointment_brief:     { label: 'Appt Brief',      color: 'bg-indigo-100 text-indigo-800' },
  medication_reminder:   { label: 'Medication',      color: 'bg-green-100 text-green-800' },
  caregiver_brief:       { label: 'Caregiver Brief', color: 'bg-teal-100 text-teal-800' },
  doctor_signal:         { label: 'Doctor Signal',   color: 'bg-purple-100 text-purple-800' },
  coordinator_manual:    { label: 'Manual',          color: 'bg-gray-100 text-gray-700' },
  alert_followup:        { label: 'Alert Follow-up', color: 'bg-red-100 text-red-800' },
  referral_notification: { label: 'Referral',        color: 'bg-orange-100 text-orange-800' },
};

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '💬',
  telegram: '✈️',
};

interface Props {
  patientId: string;
  messages: OutboundMessage[];
}

export function OutboundMessagesTab({ patientId, messages: initial }: Props) {
  const [messages, setMessages] = useState<OutboundMessage[]>(initial);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const reload = async () => {
    setLoading(true);
    try {
      const fresh = await getPatientOutboundMessages(patientId, { limit: 100 });
      setMessages(fresh);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Outbound Communication Log</h3>
          <p className="text-xs text-gray-500 mt-0.5">All messages sent to this patient via WhatsApp / Telegram</p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {messages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">
          <FiMessageSquare size={24} className="mx-auto mb-2 opacity-40" />
          No outbound messages recorded yet
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => {
            const meta = TYPE_LABELS[msg.messageType] ?? { label: msg.messageType, color: 'bg-gray-100 text-gray-700' };
            const isOpen = expanded.has(msg.id);
            const isFailed = msg.status === 'failed';
            return (
              <div
                key={msg.id}
                className={`rounded-lg border px-4 py-3 text-sm transition-colors ${isFailed ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base" title={msg.channel}>{CHANNEL_ICONS[msg.channel] ?? '📨'}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>{meta.label}</span>
                  {isFailed && (
                    <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      <FiAlertCircle size={11} /> Failed
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                    <FiCalendar size={11} /> {fmt(msg.sentAt)}
                  </span>
                </div>

                <div className="mt-2 text-gray-700">
                  {isOpen ? (
                    <p className="whitespace-pre-wrap text-xs leading-relaxed">{msg.content}</p>
                  ) : (
                    <p className="text-xs text-gray-600 line-clamp-2">{msg.content}</p>
                  )}
                  {msg.content.length > 120 && (
                    <button
                      onClick={() => toggle(msg.id)}
                      className="mt-1 text-xs text-indigo-600 hover:underline"
                    >
                      {isOpen ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>

                {isFailed && msg.failureReason && (
                  <p className="mt-1 text-xs text-red-600">Reason: {msg.failureReason}</p>
                )}

                <div className="mt-1.5 flex gap-3 text-xs text-gray-400">
                  <span>via {msg.recipientRef}</span>
                  {msg.externalId && <span className="flex items-center gap-1"><FiActivity size={10} /> ID: {msg.externalId.slice(0, 12)}…</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
