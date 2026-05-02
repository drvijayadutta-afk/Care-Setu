'use client';

import { useState } from 'react';
import { FiSend } from 'react-icons/fi';
import { sendMessage, getPatientConversations, Conversation } from '@/lib/api';

interface ConversationsTabProps {
  patientId: string;
  conversations: Conversation[];
  onConversationsUpdate: (convs: Conversation[]) => void;
}

export function ConversationsTab({ patientId, conversations, onConversationsUpdate }: ConversationsTabProps) {
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    setSendingMessage(true);
    try {
      await sendMessage(patientId, messageInput);
      setMessageInput('');
      const updated = await getPatientConversations(patientId);
      onConversationsUpdate(updated);
    } catch { alert('Failed to send message'); }
    finally { setSendingMessage(false); }
  };

  return (
    <div className="space-y-3">
      {/* Message Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={messageInput}
          onChange={e => setMessageInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && !sendingMessage && handleSendMessage()}
          placeholder="Send a message..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleSendMessage}
          disabled={sendingMessage || !messageInput.trim()}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-400"
        >
          <FiSend /> Send
        </button>
      </div>

      {/* Conversation History */}
      {conversations.length === 0 ? (
        <p className="text-gray-400">No conversations yet.</p>
      ) : (
        conversations.map(c => (
          <div key={c.id} className={`rounded-lg p-3 ${c.role === 'patient' ? 'bg-green-50 border-l-4 border-green-500' : 'bg-indigo-50 border-l-4 border-indigo-400'}`}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span className="font-semibold">{c.role === 'patient' ? '🧑 Patient' : '🤖 Assistant'}</span>
              <span>{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-700">{c.content}</p>
          </div>
        ))
      )}
    </div>
  );
}
