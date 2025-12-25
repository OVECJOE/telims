'use client';

import { Suspense } from 'react';
import { StorageProvider, useStorage } from '@/lib/storage-context';
import { UnlockScreen } from '@/components/app';

function ScriptsLayoutContent({ children }: { children: React.ReactNode }) {
  const { isUnlocked, unlock } = useStorage();

  if (!isUnlocked) {
    return <UnlockScreen onUnlock={unlock} />;
  }

  return <>{children}</>;
}

export default function ScriptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StorageProvider>
      <Suspense fallback={null}>
        <ScriptsLayoutContent>{children}</ScriptsLayoutContent>
      </Suspense>
    </StorageProvider>
  );
}
