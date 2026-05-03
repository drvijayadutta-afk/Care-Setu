'use client';

import { useState, useRef } from 'react';
import { FiPlus, FiDownload, FiTrash2 } from 'react-icons/fi';
import { initiateDocumentUpload, confirmDocumentUpload, getDocumentDownloadUrl, deleteDocument, getPatientDocuments, PatientDocument } from '@/lib/api';
import { useFormDraft } from '@/lib/useFormDraft';
import { toast } from '@/lib/toast';

interface DocumentsTabProps {
  patientId: string;
  documents: PatientDocument[];
  onDocumentsUpdate?: (documents: PatientDocument[]) => void;
}

const EMPTY_FORM = { category: 'Medical Report', title: '', description: '' };

export function DocumentsTab({ patientId, documents, onDocumentsUpdate }: DocumentsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { clearDraft } = useFormDraft(`doc-draft-${patientId}`, form, setForm);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Required';
    if (!fileInputRef.current?.files?.length) e.file = 'Select a file';
    return e;
  };

  const handleUpload = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});

    const file = fileInputRef.current!.files![0];
    setUploading(true);
    try {
      const { uploadUrl, documentId } = await initiateDocumentUpload(patientId, {
        category: form.category,
        fileType: file.type,
        title: form.title,
        description: form.description,
      });

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      await confirmDocumentUpload(documentId, {
        fileSizeBytes: file.size,
        uploadedBy: 'Coordinator',
      });

      clearDraft();
      setForm(EMPTY_FORM);
      setShowForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({ type: 'success', message: 'Document uploaded' });
      if (onDocumentsUpdate) {
        const updated = await getPatientDocuments(patientId);
        onDocumentsUpdate(updated);
      }
    } catch {
      toast({ type: 'error', message: 'Upload failed — check file size and connection, then try again' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (docId: string) => {
    try {
      const { downloadUrl } = await getDocumentDownloadUrl(docId);
      window.open(downloadUrl, '_blank', 'noopener');
    } catch {
      toast({ type: 'error', message: 'Could not generate download link' });
    }
  };

  const handleDelete = async (doc: PatientDocument) => {
    // Optimistically remove from UI
    if (onDocumentsUpdate) {
      onDocumentsUpdate(documents.filter(d => d.id !== doc.id));
    }

    let undone = false;
    const toastId = toast({
      type: 'info',
      message: `"${doc.title}" deleted`,
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          // Restore document in UI
          if (onDocumentsUpdate) {
            onDocumentsUpdate([...documents]);
          }
        },
      },
    });

    // Wait the undo window (10 s) before actually deleting on the server
    await new Promise(resolve => setTimeout(resolve, 10000));
    if (undone) return;

    try {
      await deleteDocument(doc.id);
    } catch {
      // Server delete failed — restore the item
      toast({ type: 'error', message: 'Delete failed — document restored' });
      if (onDocumentsUpdate) {
        const updated = await getPatientDocuments(patientId);
        onDocumentsUpdate(updated);
      }
    }
  };

  const fieldClass = (key: string) =>
    errors[key]
      ? 'rounded border border-red-400 px-2 py-1.5 text-sm ring-1 ring-red-400'
      : 'rounded border px-2 py-1.5 text-sm';

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Documents</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          <FiPlus /> Upload
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className={fieldClass('category')}
            >
              {['Medical Report', 'Scan Report', 'Lab Report', 'Prescription', 'Other'].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <div className="flex flex-col gap-0.5">
              <input
                placeholder="Document Title *"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className={fieldClass('title')}
              />
              {errors.title && <span className="text-xs text-red-600">{errors.title}</span>}
            </div>
            <input
              placeholder="Description (optional)"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className={`${fieldClass('description')} col-span-2`}
            />
            <div className="col-span-2 flex flex-col gap-0.5">
              <input
                type="file"
                ref={fileInputRef}
                onChange={() => setErrors(prev => ({ ...prev, file: '' }))}
                className={`${fieldClass('file')} col-span-2`}
              />
              {errors.file && <span className="text-xs text-red-600">{errors.file}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 rounded bg-green-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button
              onClick={() => { setShowForm(false); setErrors({}); }}
              disabled={uploading}
              className="flex-1 rounded bg-gray-300 py-2 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {documents.map(d => (
          <div key={d.id} className="flex items-center justify-between rounded border border-gray-200 p-3">
            <div className="text-sm">
              <div className="font-semibold text-gray-800">{d.title}</div>
              <div className="text-xs text-gray-500">
                {d.category} • {new Date(d.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload(d.id)}
                className="p-1 text-gray-500 hover:text-indigo-600"
                title="Download"
              >
                <FiDownload size={16} />
              </button>
              <button
                onClick={() => handleDelete(d)}
                className="p-1 text-gray-500 hover:text-red-600"
                title="Delete"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            No documents uploaded yet. Click <strong>Upload</strong> to add a scan, report, or prescription.
          </p>
        )}
      </div>
    </div>
  );
}
