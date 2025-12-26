'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Mic, MicOff, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor, getPlainTextFromMarkdown } from '@/components/ui/rich-text-editor';
import { useStorage } from '@/lib/storage-context';
import { validateScript } from '@/lib/db';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export default function NewScriptPage() {
  const router = useRouter();
  const { saveScript, settings } = useStorage();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [validationErrors, setValidationErrors] = useState<{ title?: string; content?: string }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize worker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const worker = new Worker(new URL('../../../lib/voice-worker.ts', import.meta.url));
      workerRef.current = worker;

      worker.onmessage = (event) => {
        const { type, status, result, error, progress: progressObj } = event.data;

        if (type === 'status') {
          if (status === 'loading') {
            setProgress(0);
          } else if (status === 'ready') {
            setWorkerReady(true);
            setProgress(100);
          }
        } else if (type === 'progress') {
          if (typeof progressObj?.progress === 'number') {
            setProgress(Math.max(0, Math.min(100, progressObj.progress)));
          }
        } else if (type === 'result') {
          const transcribedText = result?.text || '';
          if (transcribedText) {
            setContent(prev => prev ? `${prev}\n\n${transcribedText}` : transcribedText);
            toast.success('Transcription complete');
          } else {
            toast.error('No speech detected');
          }
          setIsTranscribing(false);
        } else if (type === 'error') {
          console.error('Worker error:', error);
          toast.error('Transcription failed');
          setIsTranscribing(false);
        }
      };

      // Load the model
      worker.postMessage({ type: 'load' });

      return () => {
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
    }
  }, []);

  const handleSave = async () => {
    const plainText = getPlainTextFromMarkdown(content);
    const validation = validateScript(title, plainText);

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors({});
    setIsSaving(true);

    try {
      const script = await saveScript({
        title: title.trim(),
        content: content.trim(),
        fontSize: settings?.defaultFontSize || 48,
        scrollSpeed: settings?.defaultScrollSpeed || 2,
        backgroundColor: settings?.defaultBackgroundColor || '#000000',
        textColor: settings?.defaultTextColor || '#ffffff',
        mirrorMode: false,
        voiceControlEnabled: false,
      });
      toast.success('Script created successfully');
      router.push(`/scripts/${script.id}`);
    } catch (error) {
      console.error('Failed to save script:', error);
      toast.error('Failed to save script');
    } finally {
      setIsSaving(false);
    }
  };

  const startRecording = async () => {
    if (!workerReady) {
      toast.error('Speech recognition is still loading. Please wait...');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Recording started... Speak your script');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    toast.info('Transcribing audio...');

    try {
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get audio data as Float32Array
      const audioData = audioBuffer.getChannelData(0);

      // Send to worker for transcription
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'transcribe',
          audio: audioData,
        });
      }
    } catch (error) {
      console.error('Audio processing error:', error);
      toast.error('Failed to process audio');
      setIsTranscribing(false);
    }
  };

  const handleVoiceInput = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-background border-b-2 border-foreground sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-row justify-between items-center h-16 py-0">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-lg sm:text-xl font-bold text-foreground font-mono uppercase tracking-wider truncate max-w-[60vw] sm:max-w-xs">
                New Script
              </h1>
            </div>
            <div className="flex flex-row gap-2 items-center relative">
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={handleVoiceInput}
                  disabled={isTranscribing || !workerReady}
                  className={isRecording ? 'bg-destructive text-destructive-foreground' : ''}
                  size="sm"
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  {isTranscribing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : isRecording ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline ml-2">
                    {!workerReady ? 'Loading...' : isTranscribing ? 'Transcribing...' : isRecording ? 'Stop' : 'Voice Input'}
                  </span>
                </Button>
                {/* Progress bar overlays the button, animates left to right */}
                {!workerReady && (
                  <div
                    aria-label="Model loading progress"
                    className={cn([
                      'absolute left-0 top-0 h-full',
                      'transition-all duration-200',
                      'opacity-50 z-20 pointer-events-none',
                      isRecording ? 'bg-destructive' : 'bg-primary',
                      'border-r-4 border-white', // thick white right border
                    ])}
                    style={{ width: `${progress}%` }}
                  />
                )}
              </div>
              <Button
                onClick={handleSave}
                disabled={isSaving || !title.trim() || !content.trim()}
                size="sm"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="hidden sm:inline ml-2">{isSaving ? 'Saving...' : 'Save Script'}</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="script-title">Title</Label>
            <Input
              id="script-title"
              placeholder="Enter script title..."
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationErrors.title) {
                  setValidationErrors(prev => ({ ...prev, title: undefined }));
                }
              }}
              maxLength={200}
              aria-invalid={!!validationErrors.title}
              className="w-full text-base px-3 py-2 rounded-md"
            />
            {validationErrors.title && (
              <p className="text-sm text-destructive font-mono">{validationErrors.title}</p>
            )}
            <p className="text-xs text-muted-foreground font-mono">{title.length}/200 characters</p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-row items-center justify-between gap-2">
              <Label>Script Content</Label>
              <div className="flex flex-row items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground cursor-not-allowed">
                      <Wand2 className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">AI Assist</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="center">
                    Coming Soon
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="w-full">
              <RichTextEditor
                key={content.length + ':' + content.slice(0, 16)}
                content={content}
                onChange={(newContent) => {
                  setContent(newContent);
                  if (validationErrors.content) {
                    setValidationErrors(prev => ({ ...prev, content: undefined }));
                  }
                }}
                placeholder="Start writing your video script... Use the toolbar to format your content."
                className="min-h-[300px] sm:min-h-[400px]"
              />
            </div>
            {validationErrors.content && (
              <p className="text-sm text-destructive font-mono">{validationErrors.content}</p>
            )}
            <p className="text-xs text-muted-foreground font-mono">
              {getPlainTextFromMarkdown(content).length.toLocaleString()}/100,000 characters
            </p>
          </div>

          <div className="p-4 bg-muted border border-foreground/20 rounded-md">
            <h3 className="font-mono font-bold text-sm mb-2">Tips for Video Scripts</h3>
            <ul className="text-sm text-muted-foreground font-mono space-y-1">
              <li>• Use headings to mark different sections or scenes</li>
              <li>• Bold important words or phrases for emphasis while reading</li>
              <li>• Use the voice input feature to dictate your script naturally</li>
              <li>• Keep paragraphs short for easier reading on the teleprompter</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}