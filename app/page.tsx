'use client';

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { StorageProvider, useStorage } from "@/lib/storage-context";
import { Script } from "@/lib/db";
import { UnlockScreen, ScriptList, TeleprompterDisplay, SettingsDialog } from "@/components/app";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";

function TeleprompterContent() {
  const router = useRouter();
  const { isUnlocked, unlock, lock } = useStorage();
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);

  if (!isUnlocked) {
    return <UnlockScreen onUnlock={unlock} />;
  }

  if (selectedScript) {
    return (
      <TeleprompterDisplay
        script={selectedScript}
        onClose={() => setSelectedScript(null)}
      />
    );
  }

  const openSettings = () => {
    router.push('?mode=settings');
  };

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-black border-b-2 border-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white font-mono uppercase tracking-wider">
                Telims
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={openSettings}>
                <Settings className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={lock}>
                <LogOut className="w-4 h-4 mr-2" />
                Lock
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ScriptList onSelectScript={setSelectedScript} />
      </main>

      <Suspense fallback={null}>
        <SettingsDialog />
      </Suspense>
    </div>
  );
}

export default function HomePage() {
  return (
    <StorageProvider>
      <Suspense fallback={null}>
        <TeleprompterContent />
      </Suspense>
    </StorageProvider>
  );
}
