import { useState, useCallback, useRef, useEffect } from 'react';
import AudioModule from 'expo-audio/build/AudioModule';
import { createRecordingOptions } from 'expo-audio/build/utils/options';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';
import { sendToServerForTranscription } from '../services/voice/voiceService';

interface UseVoiceResult {
  isRecording: boolean;
  isTranscribing: boolean;
  transcription: string;
  startRecord: () => Promise<void>;
  stopRecord: () => Promise<string>;
  clearTranscription: () => void;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x2000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    parts.push(String.fromCharCode.apply(null, slice as unknown as number[]));
  }
  return btoa(parts.join(''));
}

export function useVoice(): UseVoiceResult {
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recordStartTime = useRef<number>(0);
  const isRecordingRef = useRef(false);
  const recorderRef = useRef<any>(null);

  // Create recorder directly (bypass useAudioRecorder hook + useReleasingSharedObject).
  // AudioModule.AudioRecorder expects flat platform-specific options (output of
  // createRecordingOptions), NOT the nested RecordingOptions with android/ios/web keys.
  useEffect(() => {
    const platformOptions = createRecordingOptions(
      RecordingPresets.LOW_QUALITY
    );
    const recorder = new AudioModule.AudioRecorder(platformOptions);
    recorderRef.current = recorder;
    return () => {
      try { recorder.stop(); } catch {}
    };
  }, []);

  const startRecord = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || isRecordingRef.current) return;
    try {
      // 1. Audio mode
      await setAudioModeAsync({ allowsRecording: true });

      // 2. Permission
      const { granted } = await getRecordingPermissionsAsync();
      if (!granted) {
        const { granted: requested } = await requestRecordingPermissionsAsync();
        if (!requested) throw new Error('请授权麦克风权限后使用语音输入');
      }

      // 3. Prepare — no arguments, use constructor-configured options
      console.log('[useVoice] Preparing...');
      try {
        await recorder.prepareToRecordAsync();
      } catch (e: any) {
        if (!e?.message?.includes('already been prepared')) throw e;
      }
      console.log('[useVoice] Prepared, uri:', recorder.uri);

      // 4. Record
      recorder.record();
      console.log('[useVoice] Recording started, isRecording:', recorder.isRecording);

      isRecordingRef.current = true;
      setIsRecording(true);
      recordStartTime.current = Date.now();
    } catch (error: any) {
      console.error('[useVoice] startRecord failed:', error);
      if (error?.message?.includes('permission')) {
        throw new Error('请授权麦克风权限后使用语音输入');
      }
      throw new Error('录音启动失败，请重试');
    }
  }, []);

  const stopRecord = useCallback(async (): Promise<string> => {
    const recorder = recorderRef.current;
    if (!recorder || !isRecordingRef.current) return '';
    try {
      const elapsed = (Date.now() - recordStartTime.current) / 1000;
      console.log('[useVoice] Stopping, JS elapsed:', elapsed.toFixed(1) + 's');

      // Get native status before stop
      const state = await recorder.getStatus();
      console.log('[useVoice] State before stop:', JSON.stringify({
        isRecording: state.isRecording,
        durationMillis: state.durationMillis,
        url: state.url,
      }));

      await recorder.stop();
      isRecordingRef.current = false;
      setIsRecording(false);

      console.log('[useVoice] stop() completed');
      console.log('[useVoice] Native duration:', state.durationMillis, 'ms');

      if (elapsed < 1) throw new Error('录音时间过短，请重新录制');

      await sleep(1000);

      const uri = recorder.uri;
      console.log('[useVoice] URI:', uri);
      if (!uri) throw new Error('录音文件未生成，请重试');

      setIsTranscribing(true);

      // Read file — try both text() and arrayBuffer() to diagnose
      // whether the file is truly empty or RN fetch has a read issue
      const fetchUri = uri;
      console.log('[useVoice] Fetching:', fetchUri);

      // Read as text first (to see raw content)
      const respText = await fetch(fetchUri);
      const textContent = await respText.text();
      console.log('[useVoice] Text length:', textContent.length, 'chars');

      // Read as arrayBuffer
      const resp = await fetch(fetchUri + '?_=' + Math.random());
      const buffer = await resp.arrayBuffer();
      console.log('[useVoice] Buffer size:', buffer.byteLength, 'bytes');

      // Also log the binary content as hex to see what's actually there
      if (buffer.byteLength < 200) {
        const bytes = new Uint8Array(buffer);
        const hex = Array.from(bytes.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log('[useVoice] First bytes (hex):', hex);
      }

      if (buffer.byteLength < 100) {
        console.error('[useVoice] ❌ File too small! Diagnostic:', JSON.stringify({
          uri,
          byteLength: buffer.byteLength,
          nativeDurationMs: state.durationMillis,
          jsElapsed: elapsed.toFixed(1),
        }));
        throw new Error('录音文件为空，请重试');
      }

      const base64 = arrayBufferToBase64(buffer);
      console.log('[useVoice] ✅ base64 length:', base64.length);

      const ext = uri.split('.').pop()?.toLowerCase() || '3gp';
      const mimeMap: Record<string, string> = {
        m4a: 'audio/m4a', mp4: 'audio/mp4', aac: 'audio/aac',
        mp3: 'audio/mp3', wav: 'audio/wav', webm: 'audio/webm',
        ogg: 'audio/ogg', '3gp': 'audio/3gpp', amr: 'audio/amr',
      };
      const mimeType = mimeMap[ext] || 'audio/3gpp';

      console.log('[useVoice] Sending to server...');
      const text = await sendToServerForTranscription(base64, mimeType);
      console.log('[useVoice] ✅ Transcription received, length:', text.length);
      setTranscription(text);
      return text;
    } catch (error: any) {
      isRecordingRef.current = false;
      setIsRecording(false);
      console.error('[useVoice] ❌ stopRecord failed:', error?.message || error);
      throw error;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const clearTranscription = useCallback(() => {
    setTranscription('');
  }, []);

  return {
    isRecording,
    isTranscribing,
    transcription,
    startRecord,
    stopRecord,
    clearTranscription,
  };
}
