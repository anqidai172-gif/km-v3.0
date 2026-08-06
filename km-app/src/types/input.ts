export type DraftStatus = 'parsing' | 'pending_review' | 'confirmed' | 'discarded';

export interface ParseResult {
  title: string;
  content: string;
  suggestedCategoryId: string;
  suggestedCategoryName: string;
  suggestedSubCategoryName?: string;
  suggestedTags: string[];
  confidence: number;
  sourceSummary: string;
  extractedKeyPoints: string[];
  /** 视频转录文本（仅视频平台解析时填充） */
  videoText?: string;
  /** 页面抓取文本（仅平台链接解析时填充） */
  pageText?: string;
  /** 图片内容描述（仅图文平台解析时填充） */
  imageText?: string;
  /** 服务端解析错误信息（用于诊断） */
  serverError?: string;
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
