'use client';

import { useState } from 'react';
import { FiPlus, FiFileText } from 'react-icons/fi';
import { createPathologyReport, getPatientPathology, PathologyReport } from '@/lib/api';
import { toast } from '@/lib/toast';

interface PathologyTabProps {
  patientId: string;
  pathology: PathologyReport[];
  onPathologyUpdate?: (pathology: PathologyReport[]) => void;
}

const SPECIMEN_TYPES = [
  { value: 'Biopsy',    label: 'Biopsy — small tissue sample taken for diagnosis' },
  { value: 'Resection', label: 'Surgical Resection — tumour removed during surgery' },
  { value: 'Excision',  label: 'Excision — growth removed completely' },
  { value: 'FNA',       label: 'Fine Needle Aspiration (FNA) — cells collected by needle' },
  { value: 'Core',      label: 'Core Needle Biopsy' },
  { value: 'Other',     label: 'Other specimen type' },
];

const EMPTY = { reportDate: '', specimenType: 'Biopsy', site: '', diagnosis: '', grade: '', stage: '', margins: '', notes: '' };
const inp = 'w-full rounded border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

export function PathologyTab({ patientId, pathology, onPathologyUpdate }: PathologyTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!form.reportDate) {
      toast({ type: 'error', message: 'Please enter the date of the pathology report' });
      return;
    }
    if (!form.site.trim()) {
      toast({ type: 'error', message: 'Please enter the biopsy site or organ' });
      return;
    }
    if (!form.diagnosis.trim()) {
      toast({ type: 'error', message: 'Please enter the pathological diagnosis' });
      return;
    }
    setSubmitting(true);
    try {
      await createPathologyReport(patientId, { ...form, source: 'manual' });
      setForm(EMPTY);
      setShowForm(false);
      toast({ type: 'success', message: 'Pathology report saved' });
      if (onPathologyUpdate) {
        const updated = await getPatientPathology(patientId);
        onPathologyUpdate(updated);
      }
    } catch {
      toast({ type: 'error', message: 'Could not save pathology report — please try again' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800">Pathology Reports</h3>
          <p className="text-xs text-gray-500 mt-0.5">Biopsy results and tissue analysis reports from the pathology lab.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          <FiPlus size={14} /> Record Pathology
        </button>
      </div>

      {showForm && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <p className="text-xs text-indigo-700 font-medium">Fields marked * are required. Leave optional fields blank if not available in the report.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Report Date *</label>
              <input type="date" value={form.reportDate}
                onChange={e => setForm({ ...form, reportDate: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Specimen / Sample Type *</label>
              <select value={form.specimenType}
                onChange={e => setForm({ ...form, specimenType: e.target.value })}
                className={inp}>
                {SPECIMEN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Biopsy Site / Organ *</label>
              <input placeholder="e.g. Left breast, Liver, Lymph node (axillary), Colon"
                value={form.site}
                onChange={e => setForm({ ...form, site: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Pathological Diagnosis *</label>
              <input placeholder="e.g. Invasive ductal carcinoma, Adenocarcinoma, Squamous cell carcinoma"
                value={form.diagnosis}
                onChange={e => setForm({ ...form, diagnosis: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Tumour Grade
                <span className="text-gray-400 font-normal ml-1">(how aggressive the cells look)</span>
              </label>
              <input placeholder="e.g. Grade 2, Grade III, Moderately differentiated"
                value={form.grade}
                onChange={e => setForm({ ...form, grade: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Stage (from this report)
                <span className="text-gray-400 font-normal ml-1">(if mentioned)</span>
              </label>
              <input placeholder="e.g. pT2 N1 M0, Stage IIIA"
                value={form.stage}
                onChange={e => setForm({ ...form, stage: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">
                Surgical Margins
                <span className="text-gray-400 font-normal ml-1">(for resections — whether edges are clear of cancer)</span>
              </label>
              <input placeholder="e.g. Clear / Negative margins, R0 resection, Positive margin at medial edge"
                value={form.margins}
                onChange={e => setForm({ ...form, margins: e.target.value })}
                className={inp} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Additional Notes (receptor status, molecular markers, etc.)</label>
              <textarea placeholder="e.g. ER+, PR+, HER2-, Ki-67 30%. BRCA mutation detected. Lymphovascular invasion present."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className={inp} rows={3} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={submitting}
              className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Pathology Report'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={submitting}
              className="flex-1 rounded border border-gray-300 bg-white py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {pathology.map(p => {
          const specimenLabel = SPECIMEN_TYPES.find(t => t.value === p.specimenType)?.value ?? p.specimenType;
          return (
            <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3 mb-2">
                <div className="rounded-lg bg-teal-50 p-2 text-teal-600 flex-shrink-0">
                  <FiFileText size={16} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">{p.diagnosis}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {p.site} · {specimenLabel} · {new Date(p.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                {p.grade && (
                  <span className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-xs text-orange-700">
                    Grade: {p.grade}
                  </span>
                )}
                {p.stage && (
                  <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs text-indigo-700">
                    Stage: {p.stage}
                  </span>
                )}
                {p.margins && (
                  <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs text-gray-700">
                    Margins: {p.margins}
                  </span>
                )}
              </div>

              {p.notes && (
                <div className="mt-3 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <span className="font-medium">Molecular / Additional: </span>{p.notes}
                </div>
              )}
            </div>
          );
        })}

        {pathology.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <FiFileText size={24} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm font-medium">No pathology reports yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Click <strong>Record Pathology</strong> to add biopsy results. Reports can also be auto-extracted when documents are uploaded.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
