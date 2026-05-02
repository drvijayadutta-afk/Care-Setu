import axios from "axios";

interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

interface TelegramGetFileResponse {
  ok: boolean;
  result: TelegramFile;
}

export class TelegramApi {
  private botToken: string;
  private apiBase = "https://api.telegram.org/bot";

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  async getFile(fileId: string): Promise<TelegramFile> {
    const response = await axios.get<TelegramGetFileResponse>(
      `${this.apiBase}${this.botToken}/getFile`,
      { params: { file_id: fileId } }
    );

    if (!response.data.ok) {
      throw new Error(`Telegram getFile failed: ${response.data}`);
    }

    return response.data.result;
  }
}
