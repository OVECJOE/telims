'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Calendar, Clock, Type, Zap, Palette, Mic } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStorage } from '@/lib/storage-context';
import { Script } from '@/lib/db';
import { getPlainTextFromMarkdown } from '@/components/ui/rich-text-editor';

export default function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { scripts, isLoading } = useStorage();
  const [script, setScript] = useState<Script | null>(null);

  useEffect(() => {
    const found = scripts.find(s => s.id === id);
    if (!isLoading && !found) {
      router.push('/');
      return;
    }
    setScript(found || null);
  }, [scripts, id, isLoading, router]);

  if (!script) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground font-mono">Loading script...</p>
        </div>
      </main>
    );
  }

  const plainText = getPlainTextFromMarkdown(script.content);
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const estimatedReadTime = Math.ceil(wordCount / 150);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono">
                <FileText className="w-5 h-5" />
                Script Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="prose prose-invert max-w-none font-mono text-sm whitespace-pre-wrap"
                style={{ lineHeight: 1.8 }}
              >
                {script.content.split('\n').map((line, index) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={index} className="text-2xl font-bold mt-6 mb-4">{line.slice(2)}</h1>;
                  }
                  if (line.startsWith('## ')) {
                    return <h2 key={index} className="text-xl font-bold mt-5 mb-3">{line.slice(3)}</h2>;
                  }
                  if (line.startsWith('### ')) {
                    return <h3 key={index} className="text-lg font-bold mt-4 mb-2">{line.slice(4)}</h3>;
                  }
                  if (line.startsWith('> ')) {
                    return (
                      <blockquote key={index} className="border-l-4 border-foreground/30 pl-4 italic text-muted-foreground">
                        {line.slice(2)}
                      </blockquote>
                    );
                  }
                  if (line.startsWith('- ')) {
                    return <li key={index} className="ml-4">{line.slice(2)}</li>;
                  }
                  if (line === '---') {
                    return <hr key={index} className="border-foreground/20 my-4" />;
                  }
                  if (!line.trim()) {
                    return <br key={index} />;
                  }
                  return <p key={index} className="mb-2">{line}</p>;
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-mono">Script Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="font-mono">{formatDate(script.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Last Updated</p>
                  <p className="font-mono">{formatDate(script.updatedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Type className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Word Count</p>
                  <p className="font-mono">{wordCount.toLocaleString()} words</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Est. Read Time</p>
                  <p className="font-mono">~{estimatedReadTime} min</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-mono">Teleprompter Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Type className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Font Size</p>
                  <p className="font-mono">{script.fontSize}px</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Scroll Speed</p>
                  <p className="font-mono">{script.scrollSpeed}/10</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Colors</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div 
                      className="w-4 h-4 border border-foreground/30" 
                      style={{ backgroundColor: script.backgroundColor }}
                    />
                    <div 
                      className="w-4 h-4 border border-foreground/30" 
                      style={{ backgroundColor: script.textColor }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mic className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Voice Control</p>
                  <p className="font-mono">{script.voiceControlEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
