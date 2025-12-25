'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Edit2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/lib/storage-context';
import { Script } from '@/lib/db';

export default function ScriptLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { scripts } = useStorage();
  const [script, setScript] = useState<Script | null>(null);

  useEffect(() => {
    const found = scripts.find(s => s.id === id);
    setScript(found || null);
  }, [scripts, id]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-background border-b-2 border-foreground sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center h-auto sm:h-16 py-3 sm:py-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Link href="/">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </Link>
                <h1 className="text-lg sm:text-xl font-bold text-foreground font-mono uppercase tracking-wider truncate max-w-[90vw] sm:max-w-xs">
                  {script?.title || 'Loading...'}
                </h1>
              </div>
            </div>
            <div className="flex flex-row gap-2 mt-2 sm:mt-0 sm:self-center self-end">
              <Link href={`/scripts/edit/${id}`}>
                <Button variant="outline" size="sm">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </Link>
              <Link href={`/scripts/${id}/present`}>
                <Button size="sm">
                  <Play className="w-4 h-4 mr-2" />
                  Present
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
