'use client';

import { useState, useRef } from 'react';
import { FiPlus, FiDownload, FiTrash2 } from 'react-icons/fi';
import { initiateDocumentUpload, confirmDocumentUpload, getDocumentDownloadUrl, deleteDocument, getPatientDocuments, PatientDocument } from '@/lib/api';

interface DocumentsTabProps {
  patientId: string;
  documents: PatientDocument[];
  onDocumentsUpdate?: (documents: PatientDocument[]) => void;
}

export function DocumentsTab({ patientId, documents, onDocumentsUpdate }: DocumentsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'Medical Report', title: '', description: '' });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!form.title) return alert('Fill required fields');
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

      setForm({ category: 'Medical Report', title: '', description: '' });
      setShowForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onDocumentsUpdate) {
        const updated = await getPatientDocuments(patientId);
        onDocumentsUpdate(updated);
      }
    } catch { alert('Failed to upload document'); }
    finally { setUploading(false); }
  };

  const handleDownload = async (docId: string) => {
    try {
      const { downloadUrl } = await getDocumentDownloadUrl(docId);
      window.open(downloadUrl, '_blank');
    } catch { alert('Failed to download document'); }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await deleteDocument(docId);
      if (onDocumentsUpdate) {
        const updated = await getPatientDocuments(patientId);
        onDocumentsUpdate(updated);
      }
    } catch { alert('Failed to delete document'); }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Documents</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"><FiPlus /> Upload</button>
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
              {['Medical Report', 'Scan Report', 'Lab Report', 'Prescription', 'Other'].map(c => <option key={c}>{c}</option>)}
            </select>
            <input placeholder="Document Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="rounded border px-2 py-1.5 text-sm col-span-2" />
            <input type="file" ref={fileInputRef} className="rounded border px-2 py-1.5 text-sm col-span-2" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex-1 rounded bg-indigo-600 py-2 text-sm font-semibold text-white disabled:opacity-50">Browse File</button>
            <button onClick={() => fileInputRef.current && handleUpload(fileInputRef.current.files![0])} disabled={!fileInputRef.current?.files?.length || uploading} className="flex-1 rounded bg-green-600 py-2 text-sm font-semibold text-white disabled:opacity-50">{uploading ? 'Uploading...' : 'Upload'}</button>
            <button onClick={() => setShowForm(false)} disabled={uploading} className="flex-1 rounded bg-gray-300 py-2 text-sm disabled:opacity-50">Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {documents.map(d => (
          <div key={d.id} className="flex items-center justify-between rounded border border-gray-200 p-3">
            <div className="text-sm">
              <div className="font-semibold text-gray-800">{d.title}</div>
              <div className="text-xs text-gray-500">{d.category} • {new Date(d.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleDownload(d.id)} className="p-1 text-gray-500 hover:text-indigo-600"><FiDownload size={16} /></button>
              <button onClick={() => handleDelete(d.id)} className="p-1 text-gray-500 hover:text-red-600"><FiTrash2 size={16} /></button>
            </div>
          </div>
        ))}
        {documents.length === 0 && <p className="text-gray-400">No documents uploaded yet.</p>}
      </div>
    </div>
  );
}
