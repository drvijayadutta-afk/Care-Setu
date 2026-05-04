'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';

type Stage = 'idle' | 'recording' | 'processing' | 'review' | 'signed';

interface SoapFields {
  hpi: string;
  exam: string;
  assessment: string;
  plan: string;
}

interface ProcessResult {
  noteId: string;
  transcript: string;
  soap: SoapFields;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'mr', label: 'मराठी' },
  { code: 'bn', label: 'বাংলা' },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VoiceNotePage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params?.patientId as string;

  const [stage, setStage] = useState<Stage>('idle');
  const [language, setLanguage] = useState('en');
  const [duration, setDuration] = useState(0);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [soap, setSoap] = useState<SoapFields>({ hpi: '', exam: '', assessment: '', plan: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(100); // collect every 100ms
      mediaRecorderRef.current = recorder;
      setStage('recording');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      setError('Microphone access denied. Please allow microphone in browser settings.');
    }
  }

  async function stopAndProcess() {
    if (!mediaRecorderRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const recorder = mediaRecorderRef.current;
    recorder.stream.getTracks().forEach((t) => t.stop());

    setStage('processing');

    // Wait for final data
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    if (chunksRef.current.length === 0) {
      setError('No audio captured. Please try again.');
      setStage('idle');
      return;
    }

    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-note.webm');
      formData.append('language', language);

      const res = await axios.post(
        `${API_URL}/doctor/patients/${patientId}/voice-note`,
        formData,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      const data: ProcessResult = res.data;
      setResult(data);
      setSoap(data.soap);
      setStage('review');
    } catch (err: any) {
      if (err?.response?.status === 401) router.replace('/doctor/login');
      else setError(err?.response?.data?.error ?? 'Processing failed. Please try again.');
      setStage('idle');
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      // Save edits
      await axios.patch(
        `${API_URL}/doctor/voice-notes/${result.noteId}`,
        soap,
        { withCredentials: true }
      );
      // Sign
      await axios.post(
        `${API_URL}/doctor/voice-notes/${result.noteId}/sign`,
        {},
        { withCredentials: true }
      );
      setStage('signed');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const soapLabels: { key: keyof SoapFields; label: string; hint: string }[] = [
    { key: 'hpi', label: 'HPI', hint: 'History of Present Illness' },
    { key: 'exam', label: 'Exam', hint: 'Examination findings' },
    { key: 'assessment', label: 'Assessment', hint: 'Clinical impression' },
    { key: 'plan', label: 'Plan', hint: 'Next steps & management' },
  ];

  return (
    <div className="mx-auto max-w-md pb-16">

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
          aria-label="Back"
        >
          ‹
        </button>
        <div>
          <p className="text-sm font-semibold text-gray-900">🎙️ Voice Note</p>
          <p className="text-xs text-gray-500">Speak → SOAP note in seconds</p>
        </div>
      </div>

      <div className="px-4 pt-6">

        {/* Signed state */}
        {stage === 'signed' && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="text-5xl">✅</div>
            <p className="text-lg font-semibold text-gray-900">Note Signed</p>
            <p className="text-sm text-gray-500">Your SOAP note has been saved and signed.</p>
            <button
              onClick={() => { setStage('idle'); setResult(null); setDuration(0); setError(''); }}
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white"
            >
              Record another note
            </button>
            <button
              onClick={() => router.back()}
              className="text-sm text-indigo-600"
            >
              Back to patient
            </button>
          </div>
        )}

        {/* Review / edit SOAP */}
        {stage === 'review' && result && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Transcript ({formatDuration(duration)})
              </p>
              <p className="text-sm text-gray-700 italic">"{result.transcript}"</p>
            </div>

            {soapLabels.map(({ key, label, hint }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  {label}
                  <span className="ml-1 font-normal text-gray-400">— {hint}</span>
                </label>
                <textarea
                  value={soap[key]}
                  onChange={(e) => setSoap((s) => ({ ...s, [key]: e.target.value }))}
                  rows={key === 'hpi' || key === 'plan' ? 3 : 2}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none"
                />
              </div>
            ))}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving…
                </>
              ) : (
                '✍️ Confirm & Sign'
              )}
            </button>
            <button
              onClick={() => { setStage('idle'); setResult(null); setDuration(0); }}
              className="w-full py-2 text-sm text-gray-500"
            >
              Discard and re-record
            </button>
          </div>
        )}

        {/* Processing spinner */}
        {stage === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="text-sm font-medium text-gray-700">Transcribing & structuring…</p>
            <p className="text-xs text-gray-400">This takes 5–15 seconds</p>
          </div>
        )}

        {/* Idle / recording */}
        {(stage === 'idle' || stage === 'recording') && (
          <div className="flex flex-col items-center gap-6 pt-8">

            {/* Language selector */}
            {stage === 'idle' && (
              <div className="flex w-full gap-2 overflow-x-auto pb-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLanguage(l.code)}
                    className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      language === l.code
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}

            {/* Record button */}
            <div className="flex flex-col items-center gap-3">
              {stage === 'recording' && (
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                  <span className="font-mono text-xl font-semibold text-gray-900">
                    {formatDuration(duration)}
                  </span>
                </div>
              )}
              <button
                onClick={stage === 'idle' ? startRecording : stopAndProcess}
                className={`flex h-24 w-24 items-center justify-center rounded-full shadow-lg transition-all active:scale-95 ${
                  stage === 'recording'
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                <span className="text-3xl">{stage === 'recording' ? '⏹' : '🎙️'}</span>
              </button>
              <p className="text-sm text-gray-500">
                {stage === 'idle' ? 'Tap to start recording' : 'Tap to stop & process'}
              </p>
            </div>

            {stage === 'idle' && (
              <div className="rounded-xl bg-indigo-50 px-4 py-3 text-center">
                <p className="text-xs text-indigo-700">
                  Speak naturally for 15–60 seconds. Describe what the patient reported, your exam findings, assessment, and plan.
                </p>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
