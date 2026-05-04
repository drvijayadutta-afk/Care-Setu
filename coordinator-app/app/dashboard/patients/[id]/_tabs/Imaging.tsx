'use client';

import { useState } from 'react';
import { FiPlus, FiImage } from 'react-icons/fi';
import { createImagingReport, getPatientImaging, ImagingReport } from '@/lib/api';
import { toast } from '@/lib/toast';

interface ImagingTabProps {
  patientId: string;
  imaging: ImagingReport[];
  onImagingUpdate?: (imaging: ImagingReport[]) => void;
}

const MODALITIES = [
  { value: 'CT',         label: 'CT Scan (Computed Tomography)' },
  { value: 'MRI',        label: 'MRI (Magnetic Resonance Imaging)' },
  { value: 'PET',        label: 'PET Scan (Positron Emission Tomography)' },
  { value: 'Ultrasound', label: 'Ultrasound / Sonography' },
  { value: 'X-Ray',      label: 'X-Ray / Chest X-Ray' },
  { value: 'Mammogram',  label: 'Mammogram' },
  { value: 'Bone Scan',  label: 'Bone Scan (Scintigraphy)' },
  { value: 'Other',      label: 'Other' },
];

const EMPTY = { studyDate: '', modality: 'CT', bodyPart: '', indication: '', findings: '', impression: '' };
const inp = 'w-full rounded border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

export function ImagingTab({ patientId, imaging, onImagingUpdate }: ImagingTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!form.studyDate) {
      toast({ type: 'error', message: 'Please enter the date the scan was performed' });
      return;
    }
    if (!form.bodyPart.trim()) {
      toast({ type: 'error', message: 'Please enter the body part or region scanned' });
      return;
    }
    setSubmitting(true);
    try {
      await createImagingReport(patientId, { ...form, source: 'manual' });
      setForm(EMPTY);
      setShowForm(false);
      toast({ type: 'success', message: 'Imaging report saved' });
      if (onImagingUpdate) {
        const updated = await getPatientImaging(patientId);
        onImagingUpdate(updated);
      }
    } catch {
      toast({ type: 'error', message: 'Could not save imaging report — please try again' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800">Imaging Reports</h3>
          <p className="text-xs text-gray-500 mt-0.5">CT scans, MRIs, PET scans, X-rays, and other radiology reports.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          <FiPlus size={14} /> Record Imaging
        </button>
      </div>

      {showForm && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <p className="text-xs text-indigo-700 font-medium">Fields marked * are required. Leave other fields blank if not available.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Date of Scan *</label>
              <input type="date" value={form.studyDate}
                onChange={e => setForm({ ...form, studyDate: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Type of Scan *</label>
              <select value={form.modality} onChange={e => setForm({ ...form, modality: e.target.value })} className={inp}>
                {MODALITIES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Body Region / Part Scanned *</label>
              <input placeholder="e.g. Chest, Abdomen, Brain, Pelvis, Whole body"
                value={form.bodyPart}
                onChange={e => setForm({ ...form, bodyPart: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Indication / Reason for Scan</label>
              <textarea placeholder="Why was this scan ordered? e.g. Staging workup, Response assessment, Follow-up for known lesion"
                value={form.indication}
                onChange={e => setForm({ ...form, indication: e.target.value })}
                className={inp} rows={2} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Findings</label>
              <textarea placeholder="What the radiologist observed in the scan — copy from the radiology report if available"
                value={form.findings}
                onChange={e => setForm({ ...form, findings: e.target.value })}
                className={inp} rows={3} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Impression / Conclusion</label>
              <textarea placeholder="The radiologist's summary / conclusion — usually the last paragraph of the report"
                value={form.impression}
                onChange={e => setForm({ ...form, impression: e.target.value })}
                className={inp} rows={2} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={submitting}
              className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Imaging Report'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={submitting}
              className="flex-1 rounded border border-gray-300 bg-white py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {imaging.map(i => {
          const modalityLabel = MODALITIES.find(m => m.value === i.modality)?.label ?? i.modality;
          return (
            <div key={i.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                    <FiImage size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">{modalityLabel}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {i.bodyPart} · {new Date(i.studyDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
              {i.indication && (
                <div className="mt-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-600">Indication: </span>{i.indication}
                </div>
              )}
              {i.findings && (
                <div className="mt-2">
                  <div className="text-xs font-medium text-gray-600 mb-1">Findings</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{i.findings}</p>
                </div>
              )}
              {i.impression && (
                <div className="mt-2 rounded bg-purple-50 px-3 py-2">
                  <div className="text-xs font-medium text-purple-700 mb-0.5">Impression / Conclusion</div>
                  <p className="text-sm text-purple-800">{i.impression}</p>
                </div>
              )}
            </div>
          );
        })}

        {imaging.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <FiImage size={24} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm font-medium">No imaging reports yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Click <strong>Record Imaging</strong> above to add a scan report. Reports can also be auto-extracted from uploaded documents.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
