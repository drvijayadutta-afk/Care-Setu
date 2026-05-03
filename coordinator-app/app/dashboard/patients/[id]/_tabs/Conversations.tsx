'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { FiSend } from 'react-icons/fi';
import { sendMessage, getPatientConversations, Conversation } from '@/lib/api';
import { toast } from '@/lib/toast';

interface ConversationsTabProps {
  patientId: string;
  conversations: Conversation[];
  onConversationsUpdate: (convs: Conversation[]) => void;
}

export function ConversationsTab({ patientId, conversations, onConversationsUpdate }: ConversationsTabProps) {
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations]);

  const handleSend = async () => {
    const text = messageInput.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage(patientId, text);
      setMessageInput('');
      const updated = await getPatientConversations(patientId);
      onConversationsUpdate(updated);
    } catch {
      toast({ type: 'error', message: 'Failed to send message — check connection and retry' });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !sending) {
      e.preventDefault();
      handleSend();
    }
  };

  // Show newest messages at the bottom; conversations arrive newest-first from API
  const sorted = [...conversations].reverse();

  return (
    <div className="flex flex-col h-[600px]">
      {/* Message history — scrollable */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2">
        {sorted.length === 0 ? (
          <p className="text-center text-gray-400 mt-16">No messages yet. Send the first message below.</p>
        ) : (
          sorted.map(c => {
            const isPatient = c.role === 'patient';
            return (
              <div key={c.id} className={`flex ${isPatient ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  isPatient
                    ? 'rounded-tl-none bg-gray-100 text-gray-800'
                    : 'rounded-tr-none bg-indigo-600 text-white'
                }`}>
                  <p className="leading-relaxed">{c.content}</p>
                  <p className={`mt-1 text-right text-[10px] ${isPatient ? 'text-gray-400' : 'text-indigo-200'}`}>
                    {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input — pinned to bottom */}
      <div className="border-t border-gray-200 pt-3 flex gap-2">
        <input
          type="text"
          value={messageInput}
          onChange={e => setMessageInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          disabled={sending}
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
        />
        <button
          onClick={handleSend}
          disabled={sending || !messageInput.trim()}
          className="flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          aria-label="Send"
        >
          <FiSend size={16} />
        </button>
      </div>
    </div>
  );
}
