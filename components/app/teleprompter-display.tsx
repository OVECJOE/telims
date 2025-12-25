'use client';

import { useState, useEffect, useRef } from 'react';
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

export function TeleprompterDisplay({ script: initialScript, onClose }: TeleprompterDisplayProps) {
  const { updateScript } = useStorage();
  const [script, setScript] = useState(initialScript);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    scrollPositionRef.current = scrollPosition;
  }, [scrollPosition]);

  useEffect(() => {
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
      }
    };
  }, [isPlaying, script.scrollSpeed]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  useEffect(() => {
    if (script.voiceControlEnabled && !isVoiceActive) {
      startVoiceControl();
    } else if (!script.voiceControlEnabled && isVoiceActive) {
      stopVoiceControl();
    }

    return () => {
      if (isVoiceActive) {
        stopVoiceControl();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.voiceControlEnabled]);

  const handleVoiceCommand = (result: VoiceRecognitionResult) => {
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

    setTimeout(() => setVoiceStatus(''), 3000);
  };

  const startVoiceControl = async () => {
    try {
      await voiceService.startListening(handleVoiceCommand);
      setIsVoiceActive(true);
      setVoiceStatus('Voice control active');
    } catch (error) {
      console.error('Failed to start voice control:', error);
      setVoiceStatus('Microphone access denied');
    }
  };

  const stopVoiceControl = () => {
    voiceService.stopListening();
    setIsVoiceActive(false);
    setVoiceStatus('');
  };

  const updateScriptSetting = async (updates: Partial<Script>) => {
    const updated = { ...script, ...updates };
    setScript(updated);
    await updateScript(script.id, updates);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const mirrorStyle = script.mirrorMode ? { transform: 'scaleX(-1)' } : {};

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Control Bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-background/80 to-transparent z-10 p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 justify-between w-full md:w-auto md:justify-start">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Button>
            <h3 className="text-foreground font-bold font-mono uppercase text-lg truncate md:truncate-none">{script.title}</h3>
          </div>

          <div className="flex items-center gap-1 justify-between w-full md:w-auto md:justify-end bg-foreground/10 backdrop-blur-md rounded-full px-2 py-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
              className="rounded-full hover:bg-foreground/20"
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
            >
              <RotateCcw className="w-5 h-5 text-foreground" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateScriptSetting({ fontSize: Math.max(script.fontSize - 4, 24) })}
              className="rounded-full hover:bg-foreground/20"
            >
              <ZoomOut className="w-5 h-5 text-foreground" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateScriptSetting({ fontSize: Math.min(script.fontSize + 4, 120) })}
              className="rounded-full hover:bg-foreground/20"
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

      {/* Teleprompter Content */}
      <div
        ref={containerRef}
        className="h-full overflow-hidden pt-24 pb-12"
        style={{
          backgroundColor: script.backgroundColor,
          ...mirrorStyle,
        }}
      >
        <div
          ref={contentRef}
          className="max-w-4xl mx-auto px-8 py-12 prose prose-invert font-mono text-sm"
          style={{
            fontSize: `${script.fontSize}px`,
            color: script.textColor,
            lineHeight: 1.8,
            fontFamily: "'Courier New', monospace",
          }}
        >
          <ReactMarkdown>{script.content}</ReactMarkdown>
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
              <Label>Scroll Speed: {script.scrollSpeed}</Label>
              <Slider
                value={[script.scrollSpeed]}
                onValueChange={([value]) => updateScriptSetting({ scrollSpeed: value })}
                min={1}
                max={10}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Font Size: {script.fontSize}px</Label>
              <Slider
                value={[script.fontSize]}
                onValueChange={([value]) => updateScriptSetting({ fontSize: value })}
                min={24}
                max={120}
                step={4}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Mirror Mode</Label>
              <Switch
                checked={script.mirrorMode}
                onCheckedChange={(checked) => updateScriptSetting({ mirrorMode: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Voice Control</Label>
              <Switch
                checked={script.voiceControlEnabled}
                onCheckedChange={(checked) => updateScriptSetting({ voiceControlEnabled: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Background Color</Label>
              <input
                type="color"
                value={script.backgroundColor}
                onChange={(e) => updateScriptSetting({ backgroundColor: e.target.value })}
                className="w-full h-10 cursor-pointer border-2 border-foreground bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label>Text Color</Label>
              <input
                type="color"
                value={script.textColor}
                onChange={(e) => updateScriptSetting({ textColor: e.target.value })}
                className="w-full h-10 cursor-pointer border-2 border-foreground bg-background"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
