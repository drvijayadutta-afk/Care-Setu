import { AiPort } from "../ai";
import { extractDocumentData, generateMdtSummary as generateMdtSummaryImpl } from "../../integrations/claude";

export class ClaudeAiImplementation implements AiPort {
  async extractDocument(storagePath: string, category: string, fileType: string): Promise<unknown> {
    return extractDocumentData(storagePath, category, fileType);
  }

  async generateMdtSummary(patient: any): Promise<string> {
    return generateMdtSummaryImpl(patient);
  }
}
