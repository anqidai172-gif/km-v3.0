// Voice recording transcription service
// Sends recorded audio (base64) to server.js for ASR transcription
// Recording itself is handled by useVoice hook via expo-audio

import { resolveServerURL } from '../ai/videoParsingService';
import { useSettingsStore } from '../../stores/useSettingsStore';

/** 将 base64 音频发送到 server.js 做语音转写，返回文本 */
export async function sendToServerForTranscription(
  audioBase64: string,
  mimeType: string,
): Promise<string> {
  const settings = useSettingsStore.getState().settings;
  const { url: baseURL } = await resolveServerURL();

  const body: Record<string, string> = {
    audio: audioBase64,
    mimeType: mimeType || 'audio/m4a',
    asrProvider: settings.asrProvider || 'local_whisper',
    asrWhisperModel: settings.asrWhisperModel || 'tiny',
  };
  if (settings.asrTencentSecretId) body.asrTencentSecretId = settings.asrTencentSecretId;
  if (settings.asrTencentSecretKey) body.asrTencentSecretKey = settings.asrTencentSecretKey;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout for long audio

  let resp: Response;
  try {
    resp = await fetch(`${baseURL}/api/transcribe-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('语音转写超时，请检查服务器是否正常运行');
    }
    throw new Error('无法连接语音转写服务，请检查设置中的服务器地址');
  }
  clearTimeout(timeoutId);

  const data = await resp.json().catch(() => null);
  if (!data) {
    throw new Error('语音转写服务返回异常，请重试');
  }
  if (!data.success) {
    throw new Error(data.error || '语音转写失败');
  }
  if (!data.text || data.text.trim().length === 0) {
    throw new Error('未识别到语音内容，请重试');
  }
  return data.text;
}
