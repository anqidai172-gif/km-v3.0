import type { AIFeedback, ScoringRequest } from '../../types';
import { callAIWithJSON } from './aiClient';

const FEEDBACK_SYSTEM_PROMPT = `你是一位严格但富有建设性的表达训练导师。用户正在进行知识复述训练，你需要：

1. 出入对比：对比用户的口头表述与原始知识内容，指出具体有哪些出入（遗漏、偏差、新增）
2. 根本归因：判断问题是"表达技巧不足"还是"知识存储有误"
3. 表达技巧：总结本次表达中做得好的地方和可改进的技巧
4. 最优表达：给出一个优化后的表达模版版本
5. 即时评分（百分制）：
   - 准确度分（覆盖率+正确率，权重50%）
   - 流畅度分（表达流畅度+逻辑结构，权重30%）
   - 完整度分（关键要点覆盖，权重20%）

评分标准：
- 90-100: 几乎完美复述，表达流畅，逻辑清晰
- 80-89: 大部分要点覆盖，表达较流畅
- 70-79: 要点覆盖率约70%，表达基本清晰
- 60-69: 要点覆盖率约50%，表达有待提升
- <60: 严重遗漏或表述不清

返回JSON格式：
{
  "accuracyScore": 78,
  "fluencyScore": 82,
  "overallScore": 80,
  "comparison": "出入对比详细说明...",
  "rootCause": "根本归因说明...",
  "expressionTips": "表达技巧建议...",
  "optimalExpression": "优化后的表达模版...",
  "suggestions": ["改进建议1", "改进建议2", "改进建议3"],
  "modelUsed": "模型名称"
}`;

export async function generateFeedback(request: ScoringRequest): Promise<AIFeedback> {
  const userMessage = `
原始知识内容：
${request.originalContent}

用户的复述内容（语音转文字）：
${request.userTranscription}

${request.previousFeedback ? `之前的反馈：${request.previousFeedback}` : ''}
${request.appealReason ? `【申诉】用户认为之前的评分有问题，理由：${request.appealReason}` : ''}

请对用户的复述进行多维评估并返回反馈。`;

  try {
    console.log('[generateFeedback] → calling callAIWithJSON');
    return await callAIWithJSON<AIFeedback>(FEEDBACK_SYSTEM_PROMPT, userMessage);
  } catch (error: any) {
    console.log('[generateFeedback] ❌ failed:', error?.message);
    return generateFallbackFeedback(request);
  }
}

function generateFallbackFeedback(request: ScoringRequest): AIFeedback {
  const inputLen = request.userTranscription.length;
  const hash = inputLen % 100;
  const score = Math.max(60, Math.min(95, hash + 50));
  const snippet = request.userTranscription.slice(0, 60) + (inputLen > 60 ? '...' : '');

  return {
    accuracyScore: score - 2,
    fluencyScore: score + 2,
    overallScore: score,
    comparison: `[离线模式] 你的复述「${snippet}」共 ${inputLen} 字。请在「设置→AI模型配置」中填入 API Key 以启用 AI 精准分析。`,
    rootCause: 'AI 服务未连接：请在设置页配置 API Key 后重试。当前为离线评分，仅供参考。',
    expressionTips: '配置 AI 服务后，系统将针对你的复述内容给出：出入对比、表达诊断、优化建议等详细反馈。',
    optimalExpression: '（AI 服务未配置，无法生成优化表达模版）',
    suggestions: [
      '前往「设置 → AI 模型配置」填写 API Key',
      '支持 Anthropic / OpenAI / DeepSeek 等兼容 API',
      '配置完成后重新进行一次复述训练即可获得精准反馈',
    ],
    modelUsed: 'offline (API key not configured)',
  };
}
