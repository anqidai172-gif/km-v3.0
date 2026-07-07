export interface KnowledgeCategory {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type KnowledgeStatus = 'draft' | 'confirmed' | 'archived';

export interface Discrepancy {
  field: 'title' | 'content' | 'category';
  parsed: string;
  source: string;
  severity: 'low' | 'medium' | 'high';
}

export interface VerificationResult {
  matchScore: number;
  discrepancies: Discrepancy[];
  sourceQuote: string;
  verificationLogic: string;
  referenceLinks: string[];
}

export interface KnowledgeItem {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  contentPreview: string;
  sourceURL?: string;
  sourceType: 'url' | 'text' | 'voice';
  tags: string[];
  embeddingPQ?: number[];
  aiSummary?: string;
  aiClassificationScore?: number;
  aiVerificationResult?: VerificationResult;
  status: KnowledgeStatus;
  createdAt: string;
  updatedAt: string;
}
