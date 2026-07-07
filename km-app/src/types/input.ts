export type DraftStatus = 'parsing' | 'pending_review' | 'confirmed' | 'discarded';

export interface ParseResult {
  title: string;
  content: string;
  suggestedCategoryId: string;
  suggestedCategoryName: string;
  suggestedTags: string[];
  confidence: number;
  sourceSummary: string;
  extractedKeyPoints: string[];
}

export interface InputDraft {
  id: string;
  inputType: 'url' | 'text';
  rawInput: string;
  status: DraftStatus;
  parseResult?: ParseResult;
  confirmedKnowledgeItemId?: string;
  createdAt: string;
  updatedAt: string;
}
