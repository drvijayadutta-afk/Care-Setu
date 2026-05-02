// Storage Port — abstraction for file storage + signed URLs
// Enables dependency inversion + PHI-aware TTL enforcement

export interface StoragePort {
  generateUploadUrl(storagePath: string, fileType: string): Promise<{ uploadUrl: string }>;
  generateDownloadUrl(storagePath: string): Promise<{ downloadUrl: string }>;
  downloadFileBytes(storagePath: string): Promise<Buffer>;
  deleteFile(storagePath: string): Promise<void>;
}
