'use client';

import { useState, useRef } from 'react';
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

export default function NewScriptPage() {
  const router = useRouter();
  const { saveScript, settings } = useStorage();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ title?: string; content?: string }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    toast.info('Transcribing audio...');

    try {
      const { pipeline } = await import('@huggingface/transformers');
      // Use a larger, more accurate model
      const transcriber = await pipeline(
        'automatic-speech-recognition',
        "google/medasr",
        { dtype: 'auto' }
      );

      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const audioData = audioBuffer.getChannelData(0);

      const result = await transcriber(audioData);
      const transcribedText = Array.isArray(result) ? result[0]?.text : result.text;

      if (transcribedText) {
        setContent(prev => prev ? `${prev}\n\n${transcribedText}` : transcribedText);
        toast.success('Transcription complete');
      } else {
        toast.error('No speech detected');
      }
    } catch (error) {
      toast.error('Failed to transcribe audio');
    } finally {
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
            <div className="flex flex-row gap-2 items-center">
              <Button
                variant="outline"
                onClick={handleVoiceInput}
                disabled={isTranscribing}
                className={isRecording ? 'bg-destructive text-destructive-foreground' : ''}
                size="sm"
              >
                {isTranscribing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                <span className="hidden sm:inline ml-2">{isTranscribing ? 'Transcribing...' : isRecording ? 'Stop' : 'Voice Input'}</span>
              </Button>
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
