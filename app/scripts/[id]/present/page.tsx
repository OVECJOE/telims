'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStorage } from '@/lib/storage-context';
import { TeleprompterDisplay } from '@/components/app';
import { Script } from '@/lib/db';

export default function PresentScriptPage({ params }: { params: Promise<{ id: string }> }) {
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-mono">Loading teleprompter...</p>
      </div>
    );
  }

  return (
    <TeleprompterDisplay
      script={script}
      onClose={() => router.push(`/scripts/${id}`)}
    />
  );
}
