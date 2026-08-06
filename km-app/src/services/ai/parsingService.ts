import type { ParseResult, ParsingRequest } from '../../types';
import { callAIWithJSON } from './aiClient';
import { isPlatformVideoURL, getPlatformName, parseViaServer, extractURLFromShareText } from './videoParsingService';

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
  "suggestedCategoryName": "父分类名称（如"工作方法论"）",
  "suggestedSubCategoryName": "子分类名称（如"时间管理"），根据内容的具体领域细分生成",
  "suggestedTags": ["标签1", "标签2"],
  "confidence": 0.85,
  "sourceSummary": "原始内容的一句话摘要",
  "extractedKeyPoints": ["关键点1", "关键点2", "关键点3"]
}`;

export interface ParseContentOptions {
  /** [已废弃] server.js 地址。留空即可，resolveServerURL 会自动发现 */
  videoServerURL?: string;
  /** AI 配置，会转发给 server.js */
  serverApiConfig?: {
    apiKey?: string;
    provider?: string;
    baseURL?: string;
    model?: string;
    // ASR 配置
    asrProvider?: string;
    asrWhisperModel?: string;
    asrTencentSecretId?: string;
    asrTencentSecretKey?: string;
    asrAliyunAppKey?: string;
    asrAliyunAccessToken?: string;
    asrXunfeiAppId?: string;
    asrXunfeiApiKey?: string;
  };
}

export async function parseContent(
  request: ParsingRequest,
  options?: ParseContentOptions,
): Promise<ParseResult> {
  // ── 视频 / 社交平台 URL → 自动发现 server.js 并解析 ──
  if (request.inputType === 'url' && isPlatformVideoURL(request.content)) {
    const platform = getPlatformName(request.content);

    try {
      // 传空字符串让 resolveServerURL 自动发现 server.js
      const result = await parseViaServer(
        request,
        options?.videoServerURL || '',
        options?.serverApiConfig,
      );
      return result;
    } catch (serverErr: any) {
      // server 不可用 → 回退到纯 AI 解析
      const errMsg = serverErr?.message || String(serverErr);
      console.warn(
        `[parseContent] 视频解析服务不可用 (${platform}): ${errMsg}`,
      );
      const cleanURL = extractURLFromShareText(request.content);
      const taggedContent = `[${platform}分享链接]\n链接: ${cleanURL}\n原始输入: ${request.content}\n\n⚠️ 视频解析服务未连接，仅基于链接文本分析。`;
      try {
        const aiResult = await parseWithAI({ ...request, content: taggedContent });
        return { ...aiResult, serverError: errMsg };
      } catch {
        return {
          ...generateFallbackParseResult(request),
          serverError: errMsg,
        };
      }
    }
  }

  // ── 普通文本 / URL → 直接 AI 解析 ──
  return parseWithAI(request);
}

/** 使用 AI 直接解析（原有逻辑） */
async function parseWithAI(request: ParsingRequest): Promise<ParseResult> {
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
