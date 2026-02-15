import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Audio Configuration
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

interface LiveSessionCallbacks {
  onConnect: () => void;
  onDisconnect: () => void;
  onError: (error: Error) => void;
  onAudioData: (audioBuffer: AudioBuffer) => void;
}

export class LiveSession {
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private stream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;

  constructor(private callbacks: LiveSessionCallbacks) { }

  async connect() {
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: INPUT_SAMPLE_RATE,
    });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: OUTPUT_SAMPLE_RATE,
    });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            this.callbacks.onConnect();
            this.startAudioStream();
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;

            if (base64Audio) {
              await this.playAudio(base64Audio);
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              this.stopAllAudio();
            }
          },
          onclose: () => {
            this.callbacks.onDisconnect();
          },
          onerror: (err) => {
            this.callbacks.onError(new Error("Live API Error"));
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: '你是一位熱心、專業的國小班級助理。你的名字是「Antigravity」。請用簡短、口語化的方式回應老師。你可以協助紀錄班級狀況，或提供教學建議。',
        },
      });

    } catch (error) {
      this.callbacks.onError(error as Error);
    }
  }

  private startAudioStream() {
    if (!this.inputAudioContext || !this.stream || !this.sessionPromise) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = this.createBlob(inputData);

      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.inputSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private createBlob(data: Float32Array) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }

    // Manual base64 encoding for raw PCM
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    return {
      data: base64Data,
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  private async playAudio(base64String: string) {
    if (!this.outputAudioContext) return;

    // Decode base64 to binary
    const binaryString = atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert to AudioBuffer
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = this.outputAudioContext.createBuffer(1, dataInt16.length, OUTPUT_SAMPLE_RATE);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }

    // Schedule playback
    this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
    const source = this.outputAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputAudioContext.destination);

    source.addEventListener('ended', () => {
      this.sources.delete(source);
    });

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
    this.sources.add(source);

    // Visualize (simple callback)
    this.callbacks.onAudioData(buffer);
  }

  private stopAllAudio() {
    for (const source of this.sources.values()) {
      source.stop();
    }
    this.sources.clear();
    this.nextStartTime = 0;
  }

  async disconnect() {
    this.sessionPromise?.then(session => session.close());
    this.stream?.getTracks().forEach(track => track.stop());
    this.inputSource?.disconnect();
    this.scriptProcessor?.disconnect();

    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();

    this.sessionPromise = null;
    this.stream = null;
    this.inputAudioContext = null;
    this.outputAudioContext = null;
  }
}