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
    return await callAIWithJSON<AIFeedback>(FEEDBACK_SYSTEM_PROMPT, userMessage);
  } catch (error) {
    return generateFallbackFeedback(request);
  }
}

function generateFallbackFeedback(request: ScoringRequest): AIFeedback {
  const hash = request.userTranscription.length % 100;
  const score = Math.max(60, Math.min(95, hash + 50));

  return {
    accuracyScore: score - 2,
    fluencyScore: score + 2,
    overallScore: score,
    comparison: `用户复述与原始内容相比，整体把握了核心方向。部分细节表述略有偏差。`,
    rootCause: '判定为表达技巧问题：用户理解正确但表达时组织不够条理。',
    expressionTips: '建议采用"总-分-总"结构，先概述再展开细节。注意使用逻辑连接词增强连贯性。',
    optimalExpression: '根据原始内容重新组织的优化表达模版...',
    suggestions: [
      '使用更简洁的句式表达复杂概念',
      '注意控制语速，给听众留出理解时间',
      '尝试用举例的方式辅助说明抽象概念',
    ],
    modelUsed: 'fallback-mode',
  };
}
