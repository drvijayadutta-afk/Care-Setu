// AI Port — abstraction for Claude-based services
// Enables dependency inversion + unit-testable services

export interface AiPort {
  extractDocument(storagePath: string, category: string, fileType: string): Promise<unknown>;
  generateMdtSummary(patient: any): Promise<string>;
}
