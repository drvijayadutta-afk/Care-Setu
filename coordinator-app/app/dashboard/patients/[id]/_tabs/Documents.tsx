'use client';

import { useState, useRef } from 'react';
import { FiPlus, FiDownload, FiTrash2, FiFile, FiUpload } from 'react-icons/fi';
import { initiateDocumentUpload, confirmDocumentUpload, getDocumentDownloadUrl, deleteDocument, getPatientDocuments, PatientDocument } from '@/lib/api';
import { useFormDraft } from '@/lib/useFormDraft';
import { toast } from '@/lib/toast';

interface DocumentsTabProps {
  patientId: string;
  documents: PatientDocument[];
  onDocumentsUpdate?: (documents: PatientDocument[]) => void;
}

const CATEGORIES = [
  { value: 'Medical Report',  label: 'Medical Report (general clinical report)' },
  { value: 'Scan Report',     label: 'Scan / Radiology Report (CT, MRI, PET, X-ray)' },
  { value: 'Lab Report',      label: 'Lab / Blood Test Report' },
  { value: 'Pathology',       label: 'Pathology / Biopsy Report' },
  { value: 'Prescription',    label: 'Prescription / Medication List' },
  { value: 'Discharge',       label: 'Discharge Summary' },
  { value: 'Consent',         label: 'Consent Form / Informed Consent' },
  { value: 'Insurance',       label: 'Insurance / Authorisation Document' },
  { value: 'Other',           label: 'Other' },
];

const EMPTY_FORM = { category: 'Medical Report', title: '', description: '' };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab({ patientId, documents, onDocumentsUpdate }: DocumentsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { clearDraft } = useFormDraft(`doc-draft-${patientId}`, form, setForm);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Please enter a document title';
    if (!fileInputRef.current?.files?.length) e.file = 'Please select a file to upload';
    return e;
  };

  const handleUpload = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});

    const file = fileInputRef.current!.files![0];
    setUploading(true);
    setUploadProgress('Getting upload link…');
    try {
      const { uploadUrl, documentId } = await initiateDocumentUpload(patientId, {
        category: form.category,
        fileType: file.type,
        title: form.title,
        description: form.description,
      });

      setUploadProgress('Uploading file…');
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      setUploadProgress('Confirming upload…');
      await confirmDocumentUpload(documentId, {
        fileSizeBytes: file.size,
        uploadedBy: 'Coordinator',
      });

      clearDraft();
      setForm(EMPTY_FORM);
      setShowForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({ type: 'success', message: 'Document uploaded — AI extraction will run in the background' });
      if (onDocumentsUpdate) {
        const updated = await getPatientDocuments(patientId);
        onDocumentsUpdate(updated);
      }
    } catch {
      toast({ type: 'error', message: 'Upload failed — check file size (max 50 MB) and your connection, then try again' });
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleDownload = async (docId: string) => {
    try {
      const { downloadUrl } = await getDocumentDownloadUrl(docId);
      window.open(downloadUrl, '_blank', 'noopener');
    } catch {
      toast({ type: 'error', message: 'Could not generate download link — please try again' });
    }
  };

  const handleDelete = async (doc: PatientDocument) => {
    if (onDocumentsUpdate) {
      onDocumentsUpdate(documents.filter(d => d.id !== doc.id));
    }

    let undone = false;
    toast({
      type: 'info',
      message: `"${doc.title}" removed`,
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          if (onDocumentsUpdate) onDocumentsUpdate([...documents]);
        },
      },
    });

    await new Promise(resolve => setTimeout(resolve, 10000));
    if (undone) return;

    try {
      await deleteDocument(doc.id);
    } catch {
      toast({ type: 'error', message: 'Could not delete document — it has been restored' });
      if (onDocumentsUpdate) {
        const updated = await getPatientDocuments(patientId);
        onDocumentsUpdate(updated);
      }
    }
  };

  const inpCls = (key: string) =>
    `w-full rounded border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors[key] ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300'}`;

  const catLabel = (val: string) => CATEGORIES.find(c => c.value === val)?.value ?? val;

  return (
    <div>
      <div className="flex justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800">Documents</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload scans, lab reports, prescriptions, or any clinical document.
            Key data will be automatically extracted after upload.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          <FiPlus size={14} /> Upload Document
        </button>
      </div>

      {showForm && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <p className="text-xs text-indigo-700 font-medium">
            After upload, our AI will automatically extract lab values, imaging findings, and other clinical data from the document.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Document Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inpCls('category')}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Document Title *</label>
              <input
                placeholder="e.g. CT Chest — June 2025, CBC Report — Pre-Chemo Cycle 3"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className={inpCls('title')} />
              {errors.title && <span className="text-xs text-red-600">{errors.title}</span>}
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Description (optional)</label>
              <input
                placeholder="Any additional context about this document"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className={inpCls('description')} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-700">Select File * <span className="text-gray-400 font-normal">(PDF, JPG, PNG — max 50 MB)</span></label>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.jpg,.jpeg,.png,.heic"
                onChange={() => setErrors(prev => ({ ...prev, file: '' }))}
                className={inpCls('file')} />
              {errors.file && <span className="text-xs text-red-600">{errors.file}</span>}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleUpload} disabled={uploading}
              className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {uploading ? (uploadProgress || 'Uploading…') : 'Upload Document'}
            </button>
            <button onClick={() => { setShowForm(false); setErrors({}); }} disabled={uploading}
              className="flex-1 rounded border border-gray-300 bg-white py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {documents.map(d => (
          <div key={d.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex-shrink-0 rounded-lg bg-gray-100 p-2 text-gray-500">
              <FiFile size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-800 truncate">{d.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {catLabel(d.category)} · {new Date(d.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                {(d as any).fileSizeBytes ? ` · ${formatBytes((d as any).fileSizeBytes)}` : ''}
              </div>
              {d.description && (
                <div className="text-xs text-gray-400 mt-0.5 truncate">{d.description}</div>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleDownload(d.id)}
                className="rounded p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                title="Download document"
              >
                <FiDownload size={15} />
              </button>
              <button
                onClick={() => handleDelete(d)}
                className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50"
                title="Delete document"
              >
                <FiTrash2 size={15} />
              </button>
            </div>
          </div>
        ))}

        {documents.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <FiUpload size={24} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm font-medium">No documents uploaded yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Upload scan reports, lab results, prescriptions, or any clinical document.
              Our AI will automatically extract key data from each upload.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
