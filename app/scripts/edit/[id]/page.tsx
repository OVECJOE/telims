'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Mic, MicOff, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor, getPlainTextFromMarkdown } from '@/components/ui/rich-text-editor';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStorage } from '@/lib/storage-context';
import { Script, validateScript } from '@/lib/db';
import { toast } from 'sonner';

export default function EditScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { scripts, updateScript, deleteScript, isLoading } = useStorage();
  const [script, setScript] = useState<Script | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ title?: string; content?: string }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    const found = scripts.find(s => s.id === id);
    if (!isLoading && !found) {
      router.push('/');
      return;
    }
    if (found && !script) {
      setScript(found);
      setTitle(found.title);
      setContent(found.content);
    }
  }, [scripts, id, isLoading, router, script]);

  const handleSave = async () => {
    if (!script) return;
    
    const plainText = getPlainTextFromMarkdown(content);
    const validation = validateScript(title, plainText);
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors({});
    setIsSaving(true);
    
    try {
      await updateScript(script.id, {
        title: title.trim(),
        content: content.trim(),
      });
      toast.success('Script updated successfully');
      router.push(`/scripts/${script.id}`);
    } catch (error) {
      console.error('Failed to update script:', error);
      toast.error('Failed to update script');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!script) return;
    
    try {
      await deleteScript(script.id);
      toast.success('Script deleted');
      router.push('/');
    } catch (error) {
      console.error('Failed to delete script:', error);
      toast.error('Failed to delete script');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Recording started...');
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
        'Xenova/whisper-medium.en',
        { dtype: 'fp32' }
      );

      const arrayBuffer = await audioBlob.arrayBuffer();
      let audioBuffer;
      try {
        const audioContext = new AudioContext();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        // Resample if needed
        let audioData = audioBuffer.getChannelData(0);
        if (audioBuffer.sampleRate !== 16000) {
          // Simple resample to 16kHz (linear interpolation)
          const ratio = 16000 / audioBuffer.sampleRate;
          const newLength = Math.round(audioData.length * ratio);
          const resampled = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
            const origIdx = i / ratio;
            const left = Math.floor(origIdx);
            const right = Math.min(left + 1, audioData.length - 1);
            const frac = origIdx - left;
            resampled[i] = audioData[left] * (1 - frac) + audioData[right] * frac;
          }
          audioData = resampled;
        }
        if (!audioData || audioData.length === 0) {
          toast.error('No audio data found');
          setIsTranscribing(false);
          return;
        }
        const result = await transcriber(audioData);
        const transcribedText = Array.isArray(result) ? result[0]?.text : result.text;
        if (transcribedText && transcribedText.trim()) {
          setContent(prev => {
            if (!prev) return transcribedText;
            if (/\n\s*$/.test(prev)) return prev + transcribedText;
            return prev + '\n\n' + transcribedText;
          });
          toast.success('Transcription complete');
        } else {
          toast.error('No speech detected');
        }
      } catch (decodeError) {
        console.error('Audio decode failed:', decodeError);
        toast.error('Failed to decode audio');
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      toast.error('Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  if (!script) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground font-mono">Loading script...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <nav className="bg-background border-b-2 border-foreground sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-row justify-between items-center h-16 py-0">
              <div className="flex items-center gap-4">
                <Link href={`/scripts/${id}`}>
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </Link>
                <h1 className="text-lg sm:text-xl font-bold text-foreground font-mono uppercase tracking-wider truncate max-w-[60vw] sm:max-w-xs">
                  Edit Script
                </h1>
              </div>
              <div className="flex flex-row gap-2 items-center">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteOpen(true)}
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing}
                  className={isRecording ? 'bg-destructive text-destructive-foreground' : ''}
                  size="sm"
                >
                  {isTranscribing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : isRecording ? (
                    <MicOff className="w-4 h-4 mr-2" />
                  ) : (
                    <Mic className="w-4 h-4 mr-2" />
                  )}
                  <span className="hidden sm:inline">{isTranscribing ? 'Transcribing...' : isRecording ? 'Stop' : 'Voice'}</span>
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !title.trim() || !content.trim()}
                  size="sm"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              />
              {validationErrors.title && (
                <p className="text-sm text-destructive font-mono">{validationErrors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Script Content</Label>
              <RichTextEditor
                key={content.length + ':' + content.slice(0, 16)}
                content={content}
                onChange={(newContent) => {
                  setContent(newContent);
                  if (validationErrors.content) {
                    setValidationErrors(prev => ({ ...prev, content: undefined }));
                  }
                }}
                placeholder="Start writing your video script..."
              />
              {validationErrors.content && (
                <p className="text-sm text-destructive font-mono">{validationErrors.content}</p>
              )}
              <p className="text-xs text-muted-foreground font-mono">
                {getPlainTextFromMarkdown(content).length.toLocaleString()}/100,000 characters
              </p>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Script</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{script.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
