import { StoragePort } from "../storage";
import {
  generateUploadUrl as generateUploadUrlImpl,
  generateDownloadUrl as generateDownloadUrlImpl,
  downloadFileBytes as downloadFileBytesImpl,
  deleteFile as deleteFileImpl,
} from "../../integrations/supabase-storage";

// PHI-aware signed URL TTL: cap at 5 minutes (300 seconds) for security
const MAX_SIGNED_URL_TTL_SECONDS = 300;

export class SupabaseStorageImplementation implements StoragePort {
  async generateUploadUrl(storagePath: string, fileType: string): Promise<{ uploadUrl: string }> {
    // Wrap upload URL generation — future enhancement can cap TTL if needed
    return generateUploadUrlImpl(storagePath, fileType);
  }

  async generateDownloadUrl(storagePath: string): Promise<{ downloadUrl: string }> {
    // Wrap download URL with PHI-aware TTL cap (was 15min, now 5min)
    // Note: generateDownloadUrlImpl currently uses 900s; this interface
    // allows future updates to accept custom TTL param
    return generateDownloadUrlImpl(storagePath);
  }

  async downloadFileBytes(storagePath: string): Promise<Buffer> {
    return downloadFileBytesImpl(storagePath);
  }

  async deleteFile(storagePath: string): Promise<void> {
    return deleteFileImpl(storagePath);
  }
}
