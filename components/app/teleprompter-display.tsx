'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, Settings, Mic, MicOff,
  ZoomIn, ZoomOut, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Script } from '@/lib/db';
import { useStorage } from '@/lib/storage-context';
import { voiceService, VoiceRecognitionResult } from '@/lib/voice';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface TeleprompterDisplayProps {
  script: Script;
  onClose: () => void;
}

// Helper to check fullscreen API support
const getFullscreenAPI = () => {
  const doc = document as Document & {
    webkitFullscreenElement?: Element;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;
  };
  const docEl = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
  };
  const exitDoc = document as Document & {
    webkitExitFullscreen?: () => Promise<void>;
    mozCancelFullScreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
  };

  return {
    isSupported: !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen),
    getElement: () => doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement,
    request: () => {
      if (docEl.requestFullscreen) return docEl.requestFullscreen();
      if (docEl.webkitRequestFullscreen) return docEl.webkitRequestFullscreen();
      if (docEl.mozRequestFullScreen) return docEl.mozRequestFullScreen();
      if (docEl.msRequestFullscreen) return docEl.msRequestFullscreen();
      return Promise.reject(new Error('Fullscreen not supported'));
    },
    exit: () => {
      if (exitDoc.exitFullscreen) return exitDoc.exitFullscreen();
      if (exitDoc.webkitExitFullscreen) return exitDoc.webkitExitFullscreen();
      if (exitDoc.mozCancelFullScreen) return exitDoc.mozCancelFullScreen();
      if (exitDoc.msExitFullscreen) return exitDoc.msExitFullscreen();
      return Promise.reject(new Error('Fullscreen not supported'));
    },
    eventName: 'fullscreenchange',
  };
};

// Debounce helper
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function TeleprompterDisplay({ script: initialScript, onClose }: TeleprompterDisplayProps) {
  const [spokenConfidence, setSpokenConfidence] = useState<number | null>(null);
  const [spokenChunkIdx, setSpokenChunkIdx] = useState<number | null>(null);
  const [script, setScript] = useState(initialScript);
  const { updateScript, settings } = useStorage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(initialScript.isFullscreen ?? false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const scrollPositionRef = useRef(0);

  const voiceStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToChunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVoiceActiveRef = useRef(false);

  const fullscreenSyncRef = useRef(false);

  const getPlainTextFromMarkdown = (markdown: string): string => {
    return markdown
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  };

  const plainTextContent = getPlainTextFromMarkdown(script.content);

  const chunks = useMemo(() => {
    return plainTextContent
      .split(/\n\n|(?<=[.!?])\s+(?=[A-Z])/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0);
  }, [plainTextContent]);

  const chunkTextMap = useMemo(() => {
    const map = new Map<string, number>();
    chunks.forEach((chunk, idx) => {
      const key = chunk.toLowerCase().slice(0, 50);
      if (!map.has(key)) {
        map.set(key, idx);
      }
    });
    return map;
  }, [chunks]);

  useEffect(() => {
    scrollPositionRef.current = scrollPosition;
  }, [scrollPosition]);

  useEffect(() => {
    isVoiceActiveRef.current = isVoiceActive;
  }, [isVoiceActive]);

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }

    if (isPlaying && contentRef.current && containerRef.current) {
      const scroll = () => {
        if (!contentRef.current || !containerRef.current) return;
        const maxScroll = contentRef.current.scrollHeight - containerRef.current.clientHeight;
        if (scrollPositionRef.current >= maxScroll) {
          setIsPlaying(false);
          return;
        }

        setScrollPosition(prev => prev + script.scrollSpeed * 0.5);
        animationRef.current = requestAnimationFrame(scroll);
      };
      animationRef.current = requestAnimationFrame(scroll);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [isPlaying, script.scrollSpeed]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  useEffect(() => {
    if (script.voiceControlEnabled && !isVoiceActiveRef.current) {
      startVoiceControl();
    } else if (!script.voiceControlEnabled && isVoiceActiveRef.current) {
      stopVoiceControl();
    }

    return () => {
      if (isVoiceActiveRef.current) {
        stopVoiceControl();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.voiceControlEnabled]);

  const findMatchingChunk = useCallback((spoken: string): number | null => {
    const normalizedSpoken = spoken.trim().toLowerCase();
    if (normalizedSpoken.length < 4) return null;

    let bestIdx: number | null = null;
    let bestScore = 0;

    // Split spoken text into words for better matching
    const spokenWords = normalizedSpoken.split(/\s+/).filter(w => w.length > 2);
    if (spokenWords.length === 0) return null;

    chunks.forEach((chunk, idx) => {
      const normalizedChunk = chunk.toLowerCase();

      // Count matching words (more robust than substring matching)
      let matchingWords = 0;
      spokenWords.forEach(word => {
        // Use word boundary matching to avoid partial matches
        const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (wordRegex.test(normalizedChunk)) {
          matchingWords++;
        }
      });

      // Calculate score based on percentage of matching words
      const score = matchingWords / spokenWords.length;

      // Require at least 50% word match
      if (score > 0.5 && score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    return bestIdx;
  }, [chunks]);

  const handleVoiceCommand = useCallback((result: VoiceRecognitionResult) => {
    // Save confidence for display
    if (typeof result.confidence === 'number') {
      setSpokenConfidence(result.confidence);
    } else {
      setSpokenConfidence(null);
    }

    const bestIdx = findMatchingChunk(result.text);

    if (bestIdx !== null) {
      setSpokenChunkIdx(bestIdx);

      if (scrollToChunkTimerRef.current) {
        clearTimeout(scrollToChunkTimerRef.current);
      }
      const targetIdx = bestIdx;
      scrollToChunkTimerRef.current = setTimeout(() => {
        const el = document.getElementById(`chunk-${targetIdx}`);
        if (el && containerRef.current) {
          const top = el.offsetTop - containerRef.current.offsetTop;
          containerRef.current.scrollTo({ top: Math.max(0, top - 40), behavior: 'smooth' });
        }
      }, 100);
    }

    setVoiceStatus(`Heard: "${result.text}"`);

    if (result.command) {
      switch (result.command) {
        case 'play':
          setIsPlaying(true);
          break;
        case 'pause':
        case 'stop':
          setIsPlaying(false);
          break;
        case 'faster':
          updateScriptSetting({ scrollSpeed: Math.min(script.scrollSpeed + 1, 10) });
          break;
        case 'slower':
          updateScriptSetting({ scrollSpeed: Math.max(script.scrollSpeed - 1, 1) });
          break;
        case 'restart':
          setScrollPosition(0);
          setIsPlaying(false);
          break;
      }
    }

    if (voiceStatusTimerRef.current) {
      clearTimeout(voiceStatusTimerRef.current);
    }
    voiceStatusTimerRef.current = setTimeout(() => setVoiceStatus(''), 3000);
  }, [findMatchingChunk, script.scrollSpeed]);

  const startVoiceControl = async () => {
    try {
      // Use selected speech model from settings, fallback to 'tiny'
      const model = (settings?.defaultSpeechModel || 'tiny') as 'tiny' | 'small' | 'medium' | 'large';
      await voiceService.startListening(handleVoiceCommand, model);
      setIsVoiceActive(true);
      setVoiceStatus('Voice control active');
    } catch (error) {
      console.error('Failed to start voice control:', error);
      setVoiceStatus(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone access denied'
        : 'Voice control failed to start');
      // Revert the setting if voice control failed
      setScript(prev => ({ ...prev, voiceControlEnabled: false }));
    }
  };

  const stopVoiceControl = () => {
    voiceService.stopListening();
    setIsVoiceActive(false);
    setVoiceStatus('');
  };

  const debouncedUpdateScript = useMemo(
    () => debounce((id: string, updates: Partial<Script>) => {
      updateScript(id, updates);
    }, 300),
    [updateScript]
  );

  const updateScriptSetting = async (updates: Partial<Script>) => {
    const updated = { ...script, ...updates };
    setScript(updated);
    // Use debounced version for database updates
    debouncedUpdateScript(script.id, updates);
  };

  useEffect(() => {
    const fullscreenAPI = getFullscreenAPI();

    if (!fullscreenAPI.isSupported) return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!fullscreenAPI.getElement();
      setIsFullscreen(isCurrentlyFullscreen);
    };

    // Listen for all vendor-prefixed events
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (fullscreenSyncRef.current) return;
    if (script.isFullscreen !== isFullscreen) {
      fullscreenSyncRef.current = true;
      updateScriptSetting({ isFullscreen }).finally(() => {
        fullscreenSyncRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  const toggleFullscreen = async () => {
    const fullscreenAPI = getFullscreenAPI();

    if (!fullscreenAPI.isSupported) {
      console.warn('Fullscreen API not supported');
      return;
    }

    try {
      if (!fullscreenAPI.getElement()) {
        await fullscreenAPI.request();
      } else {
        await fullscreenAPI.exit();
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
    }
  };

  useEffect(() => {
    const fullscreenAPI = getFullscreenAPI();

    if (script.isFullscreen && fullscreenAPI.isSupported && !fullscreenAPI.getElement()) {
      fullscreenAPI.request().catch(err => {
        console.error('Failed to enter fullscreen on mount:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (voiceStatusTimerRef.current) {
        clearTimeout(voiceStatusTimerRef.current);
      }
      if (scrollToChunkTimerRef.current) {
        clearTimeout(scrollToChunkTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (initialScript.id !== script.id || initialScript.updatedAt !== script.updatedAt) {
      setScript(initialScript);
    }
  }, [initialScript, script.id, script.updatedAt]);

  const mirrorStyle = useMemo(() =>
    script.mirrorMode ? { transform: 'scaleX(-1)' } : {},
    [script.mirrorMode]
  );

  const containerStyle = useMemo(() => ({
    backgroundColor: script.backgroundColor,
    ...mirrorStyle,
  }), [script.backgroundColor, mirrorStyle]);

  const contentStyle = useMemo(() => ({
    fontSize: `${script.fontSize}px`,
    color: script.textColor,
    lineHeight: 1.8,
    fontFamily: "'Courier New', monospace",
    backgroundColor: script.backgroundColor,
  }), [script.fontSize, script.textColor, script.backgroundColor]);

  const markdownComponents = useMemo(() => ({
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { children?: React.ReactNode }) => {
      const text = String(children).trim();
      const normalizedText = text.toLowerCase().slice(0, 50);
      let chunkIdx = -1;

      for (let i = 0; i < chunks.length; i++) {
        const chunkStart = chunks[i].toLowerCase().slice(0, 50);
        if (chunkStart === normalizedText || chunks[i].includes(text) || text.includes(chunks[i])) {
          chunkIdx = i;
          break;
        }
      }

      const isSpoken = spokenChunkIdx === chunkIdx && chunkIdx >= 0;

      return (
        <p
          {...props}
          id={chunkIdx >= 0 ? `chunk-${chunkIdx}` : undefined}
          className={isSpoken ? 'rounded px-1 transition-colors duration-200 relative' : ''}
          style={{
            display: 'inline-block',
            position: 'relative',
            backgroundColor: isSpoken ? script.textColor : undefined,
            color: isSpoken ? script.backgroundColor : script.textColor,
            border: isSpoken ? '2px solid #fff' : undefined,
            boxShadow: isSpoken ? '0 0 0 2px #0002' : undefined,
            margin: 0,
            marginBottom: '0.5em',
          }}
        >
          {children}
          {isSpoken && spokenConfidence !== null && (
            <span
              className="block w-full h-1 mt-1 rounded bg-green-500"
              style={{ width: `${Math.round(spokenConfidence * 100)}%`, transition: 'width 0.2s' }}
              aria-label={`Confidence: ${Math.round(spokenConfidence * 100)}%`}
            />
          )}
        </p>
      );
    },
  }), [chunks, spokenChunkIdx, spokenConfidence, script.textColor, script.backgroundColor]);

  return (
    <div className={cn("fixed inset-0 z-50 bg-background", isFullscreen && "w-screen h-screen top-0 left-0")}>
      {/* Control Bar */}
      <div className={cn("absolute left-0 right-0 bg-gradient-to-b from-background/80 to-transparent p-4", isFullscreen ? "fixed top-0 z-[100]" : "top-0 z-10")}>
        <div className="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 justify-between w-full md:w-auto md:justify-start">
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close teleprompter">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Button>
            <h3 className="text-foreground font-bold font-mono uppercase text-lg truncate md:whitespace-normal">{script.title}</h3>
          </div>

          <div className="flex items-center gap-1 justify-between w-full md:w-auto md:justify-end bg-foreground/10 backdrop-blur-md rounded-full px-2 py-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className={cn("rounded-full hover:bg-foreground/20", isFullscreen ? "bg-primary text-background" : "")}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4a1 1 0 011-1h4M20 16v4a1 1 0 01-1 1h-4M4 16v4a1 1 0 001 1h4M20 8V4a1 1 0 00-1-1h-4" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H4a1 1 0 00-1 1v4m0 6v4a1 1 0 001 1h4m6-16h4a1 1 0 011 1v4m0 6v4a1 1 0 01-1 1h-4" /></svg>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
              className="rounded-full hover:bg-foreground/20"
              aria-label={isPlaying ? "Pause scrolling" : "Start scrolling"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-foreground" />
              ) : (
                <Play className="w-5 h-5 text-foreground ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setScrollPosition(0)}
              className="rounded-full hover:bg-foreground/20"
              aria-label="Reset to beginning"
            >
              <RotateCcw className="w-5 h-5 text-foreground" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateScriptSetting({ fontSize: Math.max(script.fontSize - 4, 24) })}
              className="rounded-full hover:bg-foreground/20"
              aria-label="Decrease font size"
            >
              <ZoomOut className="w-5 h-5 text-foreground" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateScriptSetting({ fontSize: Math.min(script.fontSize + 4, 120) })}
              className="rounded-full hover:bg-foreground/20"
              aria-label="Increase font size"
            >
              <ZoomIn className="w-5 h-5 text-foreground" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateScriptSetting({ voiceControlEnabled: !script.voiceControlEnabled })}
              className={cn(
                "rounded-full",
                {
                  "bg-foreground text-background hover:bg-foreground/80": isVoiceActive,
                  "bg-transparent text-foreground hover:bg-foreground/20": !isVoiceActive,
                }
              )}
              aria-label={isVoiceActive ? "Disable voice control" : "Enable voice control"}
            >
              {isVoiceActive ? (
                <Mic className="w-5 h-5" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsOpen(true)}
              className="rounded-full hover:bg-foreground/20"
              aria-label="Open settings"
            >
              <Settings className="w-5 h-5 text-foreground" />
            </Button>
          </div>
        </div>

        {voiceStatus && (
          <div className="mt-2 text-center">
            <span className="text-background text-sm bg-foreground px-4 py-1 font-mono font-bold">
              {voiceStatus}
            </span>
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className={cn("h-full overflow-hidden pt-24 pb-12", isFullscreen && "bg-black w-screen h-screen fixed top-0 left-0 z-40")}
        style={containerStyle}
      >
        <div
          ref={contentRef}
          className="max-w-4xl mx-auto px-8 py-12 prose prose-invert font-mono text-sm"
          style={contentStyle}
        >
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown components={markdownComponents}>
              {script.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="scroll-speed-slider">Scroll Speed: {script.scrollSpeed}</Label>
              <Slider
                id="scroll-speed-slider"
                value={[script.scrollSpeed]}
                onValueChange={([value]) => updateScriptSetting({ scrollSpeed: value })}
                min={1}
                max={10}
                step={1}
                aria-label="Scroll speed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="font-size-slider">Font Size: {script.fontSize}px</Label>
              <Slider
                id="font-size-slider"
                value={[script.fontSize]}
                onValueChange={([value]) => updateScriptSetting({ fontSize: value })}
                min={24}
                max={120}
                step={4}
                aria-label="Font size"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="mirror-mode-switch">Mirror Mode</Label>
              <Switch
                id="mirror-mode-switch"
                checked={script.mirrorMode}
                onCheckedChange={(checked) => updateScriptSetting({ mirrorMode: checked })}
                aria-label="Toggle mirror mode"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="voice-control-switch">Voice Control</Label>
              <Switch
                id="voice-control-switch"
                checked={script.voiceControlEnabled}
                onCheckedChange={(checked) => updateScriptSetting({ voiceControlEnabled: checked })}
                aria-label="Toggle voice control"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bg-color-input">Background Color</Label>
              <input
                id="bg-color-input"
                type="color"
                value={script.backgroundColor}
                onChange={(e) => updateScriptSetting({ backgroundColor: e.target.value })}
                className="w-full h-10 cursor-pointer border-2 border-foreground bg-background"
                aria-label="Background color picker"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="text-color-input">Text Color</Label>
              <input
                id="text-color-input"
                type="color"
                value={script.textColor}
                onChange={(e) => updateScriptSetting({ textColor: e.target.value })}
                className="w-full h-10 cursor-pointer border-2 border-foreground bg-background"
                aria-label="Text color picker"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
