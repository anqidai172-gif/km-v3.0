import type { ParseResult, ParsingRequest } from '../../types';
import { callAIWithJSON } from './aiClient';

const PARSING_SYSTEM_PROMPT = `你是一个知识提炼专家。用户会提供一段文本或URL内容，请你：

1. 总结提炼：提取核心知识要点，组织成结构化的知识条目
2. 分类建议：根据知识内容，从提供的分类列表中选择最合适的分类
3. 标签提取：提取3-5个关键词标签
4. 关键点提取：提取3-5个核心关键点

返回JSON格式：
{
  "title": "知识标题",
  "content": "结构化的知识内容，清晰阐述核心要点",
  "suggestedCategoryId": "匹配的分类ID",
  "suggestedCategoryName": "分类名称",
  "suggestedTags": ["标签1", "标签2"],
  "confidence": 0.85,
  "sourceSummary": "原始内容的一句话摘要",
  "extractedKeyPoints": ["关键点1", "关键点2", "关键点3"]
}`;

export async function parseContent(request: ParsingRequest): Promise<ParseResult> {
  const categoryList = request.targetCategories
    .map((c: { id: string; name: string }) => `${c.id}: ${c.name}`)
    .join(', ');

  const userMessage = `
输入类型: ${request.inputType}
内容: ${request.content}
可用分类: ${categoryList}

请分析以上内容并返回结构化的知识提炼结果。`;

  try {
    return await callAIWithJSON<ParseResult>(PARSING_SYSTEM_PROMPT, userMessage);
  } catch (error) {
    // Fallback: return a basic parse result
    return generateFallbackParseResult(request);
  }
}

function generateFallbackParseResult(request: ParsingRequest): ParseResult {
  const maxPreview = 30;
  const rawText = request.content.length > maxPreview
    ? request.content.slice(0, maxPreview) + '...'
    : request.content;

  return {
    title: rawText.replace(/\n/g, ' '),
    content: request.content,
    suggestedCategoryId: request.targetCategories[0]?.id || 'cat_other',
    suggestedCategoryName: request.targetCategories[0]?.name || '其他',
    suggestedTags: ['待分类'],
    confidence: 0.5,
    sourceSummary: '内容摘要（离线模式）',
    extractedKeyPoints: ['请配置API密钥以启用AI提炼'],
  };
}
