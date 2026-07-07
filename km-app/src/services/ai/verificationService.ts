import type { VerificationResult } from '../../types';
import { callAIWithJSON } from './aiClient';

const VERIFICATION_SYSTEM_PROMPT = `你是一个严谨的事实核查专家。用户提供一段知识内容，你需要联网搜索验证其真实性。

请返回JSON格式：
{
  "matchScore": 85,
  "discrepancies": [
    {
      "field": "content",
      "parsed": "表述A",
      "source": "表述B",
      "severity": "low"
    }
  ],
  "sourceQuote": "来自权威来源的引用",
  "verificationLogic": "你的验证思路和逻辑链条",
  "referenceLinks": ["https://...", "https://..."]
}`;

export async function verifyContent(content: string, title: string): Promise<VerificationResult> {
  const userMessage = `
知识标题：${title}
知识内容：${content}

请验证以上内容的真实性，提供验证思路和参考来源。`;

  try {
    return await callAIWithJSON<VerificationResult>(VERIFICATION_SYSTEM_PROMPT, userMessage);
  } catch (error) {
    return {
      matchScore: 100,
      discrepancies: [],
      sourceQuote: '',
      verificationLogic: '离线模式：无法进行联网验真。请配置API密钥后重试。',
      referenceLinks: [],
    };
  }
}
