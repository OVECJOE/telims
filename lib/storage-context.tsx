'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { db, Script, SESSION_EXPIRY, Settings } from "./db";
import { toast } from "sonner";

interface StorageContextType {
    isUnlocked: boolean;
    unlock: (passphrase: string, isFirstTime?: boolean) => Promise<boolean>;
    lock: () => void;
    scripts: Script[];
    currentScript: Script | null;
    settings: Settings | null;
    loadScripts: () => Promise<void>;
    saveScript: (script: Omit<Script, "id" | "createdAt" | "updatedAt">) => Promise<Script>;
    updateScript: (id: string, updates: Partial<Script>) => Promise<void>;
    deleteScript: (id: string) => Promise<void>;
    setCurrentScript: (script: Script | null) => void;
    updateSettings: (settings: Partial<Settings>) => Promise<void>;
    isLoading: boolean;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export function StorageProvider({ children }: { children: ReactNode }) {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [scripts, setScripts] = useState<Script[]>([]);
    const [currentScript, setCurrentScript] = useState<Script | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkSession = () => {
            const expiry = localStorage.getItem(SESSION_EXPIRY);
            if (expiry && Date.now() < parseInt(expiry, 10) && db.isUnlocked()) {
                setIsUnlocked(true);
                loadScripts();
                db.getSettings().then(setSettings);
            } else {
                // Clear expired session data
                localStorage.removeItem(SESSION_EXPIRY);
            }
        };
        checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const unlock = async (passphrase: string, isFirstTime?: boolean): Promise<boolean> => {
        setIsLoading(true);
        try {
            const success = await db.unlock(passphrase, isFirstTime);
            if (success) {
                setIsUnlocked(true);
                await loadScripts();
                const loadedSettings = await db.getSettings();
                setSettings(loadedSettings);
            }
            return success;
        } catch {
            return false;
        } finally {
            setIsLoading(false);
        }
    }

    const lock = () => {
        db.lock();
        setIsUnlocked(false);
        setScripts([]);
        setCurrentScript(null);
        setSettings(null);
    };

    const loadScripts = async () => {
        setIsLoading(true);
        try {
            const loadedScripts = await db.getAllScripts();
            setScripts(loadedScripts);
        } catch (error) {
            toast.error(`Failed to load scripts: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const saveScript = async (script: Omit<Script, 'id' | 'createdAt' | 'updatedAt'>): Promise<Script> => {
        const newScript = await db.saveScript(script);
        await loadScripts();
        return newScript;
    };

    const updateScript = async (id: string, updates: Partial<Script>) => {
        await db.updateScript(id, updates);
        await loadScripts();
        if (currentScript && currentScript.id === id) {
        const updated = await db.getScript(id);
        setCurrentScript(updated);
        }
    };

    const deleteScript = async (id: string) => {
        await db.deleteScript(id);
        await loadScripts();
        if (currentScript && currentScript.id === id) {
        setCurrentScript(null);
        }
    };

    const updateSettings = async (newSettings: Partial<Settings>) => {
        const updated = await db.updateSettings(newSettings);
        setSettings(updated);
    };

    return (
        <StorageContext.Provider
            value={{
                isUnlocked,
                unlock,
                lock,
                scripts,
                currentScript,
                settings,
                loadScripts,
                saveScript,
                updateScript,
                deleteScript,
                setCurrentScript,
                updateSettings,
                isLoading
            }}
        >
            {children}
        </StorageContext.Provider>
    )
}

export function useStorage(): StorageContextType {
    const context = useContext(StorageContext);
    if (!context) {
        throw new Error("useStorage must be used within a StorageProvider");
    }
    return context;
}
