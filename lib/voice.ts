export type VoiceCommand = 'play' | 'pause' | 'faster' | 'slower' | 'restart' | 'stop' | 'next' | 'previous';

export interface VoiceRecognitionResult {
    command: VoiceCommand | null;
    text: string;
    confidence: number;
}

export class VoiceService {
    private static instance: VoiceService;
    private worker: Worker | null = null;
    private isReady: boolean = false;
    private isInitializing: boolean = false;
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private isListening: boolean = false;
    private onCommandCallback: ((result: VoiceRecognitionResult) => void) | null = null;
    private recordingInterval: ReturnType<typeof setInterval> | null = null;

    private commandPatterns: Record<VoiceCommand, RegExp[]> = {
        play: [/\b(play|start|resume|go)\b/i],
        pause: [/\b(pause|stop|halt|wait|hold)\b/i],
        faster: [/\b(faster|speed up|quicker)\b/i],
        slower: [/\b(slower|slow down)\b/i],
        restart: [/\b(restart|begin|start over|from the top)\b/i],
        stop: [/\b(stop|end|finish|quit)\b/i],
        next: [/\b(next|forward|skip)\b/i],
        previous: [/\b(previous|back|rewind)\b/i],
    };

    private constructor() {}

    static getInstance(): VoiceService {
        if (!VoiceService.instance) {
            VoiceService.instance = new VoiceService();
        }
        return VoiceService.instance;
    }

    async initialize(): Promise<void> {
        if (this.isReady || this.isInitializing) return;

        this.isInitializing = true;
        
        return new Promise((resolve, reject) => {
            try {
                this.worker = new Worker(
                    new URL('./voice-worker.ts', import.meta.url),
                    { type: 'module' }
                );

                this.worker.onmessage = (event) => {
                    const { type, status, result, error } = event.data;

                    if (type === 'status' && status === 'ready') {
                        this.isReady = true;
                        this.isInitializing = false;
                        resolve();
                    }

                    if (type === 'error') {
                        this.isInitializing = false;
                        reject(new Error(error));
                    }

                    if (type === 'result' && result && this.onCommandCallback) {
                        const text = (result.text || '').toLowerCase().trim();
                        if (text.length >= 2) {
                            const command = this.extractCommand(text);
                            this.onCommandCallback({
                                command,
                                text: result.text,
                                confidence: 0.8,
                            });
                        }
                    }
                };

                this.worker.postMessage({ type: 'load' });
            } catch (error) {
                this.isInitializing = false;
                reject(error);
            }
        });
    }

    async startListening(onCommand: (result: VoiceRecognitionResult) => void) {
        if (this.isListening) return;

        if (!this.isReady) {
            await this.initialize();
        }

        this.onCommandCallback = onCommand;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.processAudio(audioBlob);
                this.audioChunks = [];

                if (this.isListening && this.mediaRecorder) {
                    this.mediaRecorder.start();
                }
            };

            this.mediaRecorder.start();
            this.isListening = true;

            this.recordingInterval = setInterval(() => {
                if (this.mediaRecorder && this.isListening && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            }, 3000);
        } catch (error) {
            console.error('Failed to start listening:', error);
            throw error;
        }
    }

    stopListening() {
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }

        if (this.mediaRecorder && this.isListening) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.mediaRecorder = null;
            this.isListening = false;
        }

        this.onCommandCallback = null;
    }

    private async processAudio(audioBlob: Blob) {
        if (!this.worker) return;

        let audioContext: AudioContext | null = null;
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            audioContext = new AudioContext({ sampleRate: 16000 });
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const audioData = audioBuffer.getChannelData(0);

            this.worker.postMessage({ type: 'transcribe', audio: audioData });
        } catch (error) {
            console.error('Failed to process audio:', error);
        } finally {
            if (audioContext) {
                await audioContext.close();
            }
        }
    }

    private extractCommand(text: string): VoiceCommand | null {
        for (const [command, patterns] of Object.entries(this.commandPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    return command as VoiceCommand;
                }
            }
        }
        return null;
    }

    isActive(): boolean {
        return this.isListening;
    }

    async testMicrophone(): Promise<boolean> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch {
            return false;
        }
    }
}

export const voiceService = VoiceService.getInstance();
