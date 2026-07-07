// Voice recording and speech-to-text service
// Uses expo-audio for recording and expo-speech-recognition for STT
// When expo-speech-recognition is not installed, provides mock functionality

let isRecording = false;

export function getIsRecording(): boolean {
  return isRecording;
}

export async function startRecording(): Promise<void> {
  try {
    // In production, use expo-audio:
    // const { recording } = await Audio.Recording.createAsync(
    //   Audio.RecordingOptionsPresets.HIGH_QUALITY
    // );
    isRecording = true;
    console.log('[VoiceService] Recording started');
  } catch (error) {
    console.error('[VoiceService] Failed to start recording:', error);
    isRecording = false;
    throw error;
  }
}

export async function stopRecording(): Promise<string> {
  try {
    // In production, stop the recording and get URI:
    // await recording.stopAndUnloadAsync();
    // const uri = recording.getURI();
    // Then use expo-speech-recognition to transcribe

    isRecording = false;
    console.log('[VoiceService] Recording stopped');

    // Return mock transcription for now
    return generateMockTranscription();
  } catch (error) {
    console.error('[VoiceService] Failed to stop recording:', error);
    isRecording = false;
    throw error;
  }
}

export async function transcribeAudio(audioUri: string): Promise<string> {
  try {
    // In production, use expo-speech-recognition:
    // const result = await SpeechRecognition.startListeningAsync({
    //   lang: 'zh-CN',
    //   interimResults: true,
    // });
    console.log('[VoiceService] Transcribing:', audioUri);
    return generateMockTranscription();
  } catch (error) {
    console.error('[VoiceService] Transcription failed:', error);
    throw error;
  }
}

function generateMockTranscription(): string {
  const templates = [
    '这个知识点主要讲的是如何通过系统化的方法将碎片化信息转化为可内化的知识体系。核心思想是建立一个输入、解析、验真、入库、复述、打分的完整闭环...',
    '我认为这个知识的核心要点有三个：第一是要有结构化的输入方式，第二是要经过AI辅助的验证过程，第三是通过反复的口头表达来加深记忆...',
    '根据我的理解，知识内化的关键不在于存储了多少信息，而在于能否在需要的时候准确地调用和表达。这需要通过刻意练习来实现...',
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}
