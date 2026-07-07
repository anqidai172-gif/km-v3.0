import { useState, useCallback, useRef } from 'react';
import { startRecording, stopRecording } from '../services/voice/voiceService';

interface UseVoiceResult {
  isRecording: boolean;
  transcription: string;
  startRecord: () => Promise<void>;
  stopRecord: () => Promise<string>;
  clearTranscription: () => void;
}

export function useVoice(): UseVoiceResult {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const recordingRef = useRef(false);

  const startRecord = useCallback(async () => {
    if (recordingRef.current) return;
    try {
      await startRecording();
      recordingRef.current = true;
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, []);

  const stopRecord = useCallback(async (): Promise<string> => {
    if (!recordingRef.current) return '';
    try {
      const text = await stopRecording();
      recordingRef.current = false;
      setIsRecording(false);
      setTranscription(text);
      return text;
    } catch (error) {
      recordingRef.current = false;
      setIsRecording(false);
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }, []);

  const clearTranscription = useCallback(() => {
    setTranscription('');
  }, []);

  return {
    isRecording,
    transcription,
    startRecord,
    stopRecord,
    clearTranscription,
  };
}
