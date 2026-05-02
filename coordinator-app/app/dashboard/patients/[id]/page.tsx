'use client';

import { useEffect, useState } from 'react';
import {
  getPatient,
  getPatientConversations,
  getPatientCheckins,
  getPatientAppointments,
  sendMessage,
  createAppointment,
  Patient,
  Conversation,
  Checkin,
  Appointment,
} from '@/lib/api';
import { useWebSocket } from '@/lib/useWebSocket';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiMessageCircle, FiCheckCircle, FiCalendar, FiSend, FiPlus, FiWifi, FiWifiOff } from 'react-icons/fi';

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'conversations' | 'checkins' | 'appointments'>(
    'conversations'
  );
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState<{
    type: string;
    scheduledAt: string;
    notes: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  }>({
    type: '',
    scheduledAt: '',
    notes: '',
    status: 'pending',
  });
  const [creatingAppointment, setCreatingAppointment] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [patientData, convData, checkinData, appointmentData] = await Promise.all([
          getPatient(patientId),
          getPatientConversations(patientId),
          getPatientCheckins(patientId),
          getPatientAppointments(patientId),
        ]);

        setPatient(patientData);
        setConversations(convData);
        setCheckins(checkinData);
        setAppointments(appointmentData);
      } catch (err) {
        console.error('Error loading patient data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (patientId) {
      loadData();
    }
  }, [patientId]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !patientId) return;

    setSendingMessage(true);
    try {
      await sendMessage(patientId, messageInput);
      setMessageInput('');
      // Reload conversations
      const convData = await getPatientConversations(patientId);
      setConversations(convData);
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreateAppointment = async () => {
    if (!patientId || !appointmentForm.type || !appointmentForm.scheduledAt) {
      alert('Please fill in required fields');
      return;
    }

    setCreatingAppointment(true);
    try {
      await createAppointment(patientId, appointmentForm);
      setAppointmentForm({ type: '', scheduledAt: '', notes: '', status: 'pending' });
      setShowAppointmentForm(false);
      // Reload appointments
      const aptData = await getPatientAppointments(patientId);
      setAppointments(aptData);
    } catch (err) {
      console.error('Error creating appointment:', err);
      alert('Failed to create appointment');
    } finally {
      setCreatingAppointment(false);
    }
  };

  const handleWebSocketEvent = async (event: any) => {
    if (event.type === 'message' && event.patientId === patientId) {
      console.log('Real-time message received:', event.content);
      // Reload conversations
      const convData = await getPatientConversations(patientId);
      setConversations(convData);
    } else if (event.type === 'appointment' && event.patientId === patientId) {
      console.log('Real-time appointment update:', event.action);
      // Reload appointments
      const aptData = await getPatientAppointments(patientId);
      setAppointments(aptData);
    } else if (event.type === 'checkin' && event.patientId === patientId) {
      console.log('Real-time check-in received');
      // Reload check-ins
      const checkinData = await getPatientCheckins(patientId);
      setCheckins(checkinData);
    }
  };

  const { isConnected: wsConnectedStatus } = useWebSocket(patientId, handleWebSocketEvent);

  if (loading) {
    return (
      <div className="text-center text-gray-500">
        Loading patient data...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center text-gray-500">
        Patient not found
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/dashboard/patients"
        className="mb-6 flex items-center gap-2 text-indigo-600 hover:text-indigo-900"
      >
        <FiArrowLeft />
        Back to Patients
      </Link>

      {/* Patient Header */}
      <div className="mb-8 rounded-lg bg-white p-6 shadow">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {patient.name || 'Unnamed Patient'}
            </h1>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-semibold">Phone:</span> {patient.whatsappNumber}
              </div>
              <div>
                <span className="font-semibold">Age:</span> {patient.age || 'Not provided'}
              </div>
              <div>
                <span className="font-semibold">Cancer Type:</span>{' '}
                {patient.cancerType || 'Not provided'}
              </div>
              <div>
                <span className="font-semibold">Language:</span>{' '}
                {patient.language || 'English'}
              </div>
              <div>
                <span className="font-semibold">Joined:</span>{' '}
                {new Date(patient.createdAt).toLocaleDateString()}
              </div>
              <div>
                <span className="font-semibold">Onboarding:</span> Step {patient.onboardingStep}/9
              </div>
            </div>
          </div>
          <div
            className={`rounded-full px-6 py-2 text-white font-semibold ${
              patient.onboardingStep >= 9 ? 'bg-green-600' : 'bg-yellow-600'
            }`}
          >
            {patient.onboardingStep >= 9 ? 'Active' : 'Onboarding'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('conversations')}
          className={`flex items-center gap-2 pb-4 font-semibold ${
            activeTab === 'conversations'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600'
          }`}
        >
          <FiMessageCircle />
          Conversations ({conversations.length})
        </button>
        <button
          onClick={() => setActiveTab('checkins')}
          className={`flex items-center gap-2 pb-4 font-semibold ${
            activeTab === 'checkins'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600'
          }`}
        >
          <FiCheckCircle />
          Check-ins ({checkins.length})
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          className={`flex items-center gap-2 pb-4 font-semibold ${
            activeTab === 'appointments'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600'
          }`}
        >
          <FiCalendar />
          Appointments ({appointments.length})
        </button>
      </div>

      {/* Connection Status Indicator */}
      <div className={`mb-4 rounded-lg p-3 flex items-center gap-2 ${wsConnectedStatus ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
        {wsConnectedStatus ? (
          <>
            <FiWifi className="text-green-600" />
            <span className="text-sm font-medium">Real-time updates connected</span>
          </>
        ) : (
          <>
            <FiWifiOff className="text-yellow-600" />
            <span className="text-sm font-medium">Connecting to real-time updates...</span>
          </>
        )}
      </div>

      {/* Message Input Bar */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <div className="flex gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message to send via WhatsApp..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
            disabled={sendingMessage}
          />
          <button
            onClick={handleSendMessage}
            disabled={sendingMessage || !messageInput.trim()}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:bg-gray-400"
          >
            <FiSend />
            {sendingMessage ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-lg bg-white p-6 shadow">
        {activeTab === 'conversations' && (
          <div>
            {conversations.length === 0 ? (
              <p className="text-gray-500">No conversations yet</p>
            ) : (
              <div className="space-y-4">
                {conversations.map((conv) => (
                  <div key={conv.id} className="border-l-4 border-indigo-500 bg-gray-50 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {conv.role === 'patient' ? 'Patient' : 'Assistant'}
                        </div>
                        <p className="mt-2 text-gray-600">{conv.content}</p>
                      </div>
                      <div className="ml-4 text-xs text-gray-500">
                        {new Date(conv.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'checkins' && (
          <div>
            {checkins.length === 0 ? (
              <p className="text-gray-500">No check-ins yet</p>
            ) : (
              <div className="space-y-4">
                {checkins.map((checkin) => (
                  <div key={checkin.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">
                          Symptom Score: {checkin.symptomScore}/10
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          <div>Medications: {checkin.medications}</div>
                          <div className="mt-2">Notes: {checkin.notes}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(checkin.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'appointments' && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Appointments</h3>
              <button
                onClick={() => setShowAppointmentForm(!showAppointmentForm)}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700"
              >
                <FiPlus /> New Appointment
              </button>
            </div>

            {showAppointmentForm && (
              <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700">
                      Appointment Type
                    </label>
                    <input
                      type="text"
                      value={appointmentForm.type}
                      onChange={(e) =>
                        setAppointmentForm({ ...appointmentForm, type: e.target.value })
                      }
                      placeholder="e.g., Consultation, Surgery, Check-up"
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700">
                      Scheduled Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={appointmentForm.scheduledAt}
                      onChange={(e) =>
                        setAppointmentForm({ ...appointmentForm, scheduledAt: e.target.value })
                      }
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700">Notes</label>
                    <textarea
                      value={appointmentForm.notes}
                      onChange={(e) =>
                        setAppointmentForm({ ...appointmentForm, notes: e.target.value })
                      }
                      placeholder="Any notes about this appointment..."
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleCreateAppointment}
                      disabled={creatingAppointment}
                      className="flex-1 rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                      {creatingAppointment ? 'Creating...' : 'Create Appointment'}
                    </button>
                    <button
                      onClick={() => setShowAppointmentForm(false)}
                      className="flex-1 rounded bg-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {appointments.length === 0 ? (
              <p className="text-gray-500">No appointments yet</p>
            ) : (
              <div className="space-y-4">
                {appointments.map((apt) => (
                  <div key={apt.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{apt.type}</div>
                        <div className="mt-2 text-sm text-gray-600">
                          <div>
                            {new Date(apt.scheduledAt).toLocaleString()}
                          </div>
                          {apt.notes && <div className="mt-2">Notes: {apt.notes}</div>}
                        </div>
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          apt.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : apt.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {apt.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
