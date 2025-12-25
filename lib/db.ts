import { CryptoService } from './crypto';

export interface PassphraseValidation {
    isValid: boolean;
    errors: string[];
}

export function validatePassphraseStrength(passphrase: string): PassphraseValidation {
    const errors: string[] = [];
    
    if (passphrase.length < 12) {
        errors.push('Passphrase must be at least 12 characters long');
    }
    if (!/[a-z]/.test(passphrase)) {
        errors.push('Passphrase must contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(passphrase)) {
        errors.push('Passphrase must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(passphrase)) {
        errors.push('Passphrase must contain at least one number');
    }
    if (!/[^a-zA-Z0-9]/.test(passphrase)) {
        errors.push('Passphrase must contain at least one special character');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
    };
}

export interface ScriptValidation {
    isValid: boolean;
    errors: { title?: string; content?: string };
}

export function validateScript(title: string, content: string): ScriptValidation {
    const errors: { title?: string; content?: string } = {};
    
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    
    if (!trimmedTitle) {
        errors.title = 'Title is required';
    } else if (trimmedTitle.length > 200) {
        errors.title = 'Title must be 200 characters or less';
    }
    
    if (!trimmedContent) {
        errors.content = 'Content is required';
    } else if (trimmedContent.length > 100000) {
        errors.content = 'Content must be 100,000 characters or less';
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

export interface SettingsValidation {
    isValid: boolean;
    errors: Record<string, string>;
}

export function validateSettings(settings: Partial<Settings>): SettingsValidation {
    const errors: Record<string, string> = {};
    
    if (settings.defaultFontSize !== undefined) {
        if (settings.defaultFontSize < 24 || settings.defaultFontSize > 120) {
            errors.defaultFontSize = 'Font size must be between 24 and 120';
        }
    }
    
    if (settings.defaultScrollSpeed !== undefined) {
        if (settings.defaultScrollSpeed < 1 || settings.defaultScrollSpeed > 10) {
            errors.defaultScrollSpeed = 'Scroll speed must be between 1 and 10';
        }
    }
    
    if (settings.sessionTimeout !== undefined) {
        if (settings.sessionTimeout < 300000 || settings.sessionTimeout > 28800000) {
            errors.sessionTimeout = 'Session timeout must be between 5 minutes and 8 hours';
        }
    }
    
    if (settings.inactivityTimeout !== undefined) {
        if (settings.inactivityTimeout < 300000 || settings.inactivityTimeout > 7200000) {
            errors.inactivityTimeout = 'Inactivity timeout must be between 5 minutes and 2 hours';
        }
    }
    
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (settings.defaultBackgroundColor !== undefined) {
        if (!colorRegex.test(settings.defaultBackgroundColor)) {
            errors.defaultBackgroundColor = 'Invalid color format';
        }
    }
    
    if (settings.defaultTextColor !== undefined) {
        if (!colorRegex.test(settings.defaultTextColor)) {
            errors.defaultTextColor = 'Invalid color format';
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

export interface Script {
    id: string;
    title: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    fontSize: number;
    scrollSpeed: number;
    backgroundColor: string;
    textColor: string;
    mirrorMode: boolean;
    voiceControlEnabled: boolean;
}

export interface Settings {
    defaultFontSize: number;
    defaultScrollSpeed: number;
    defaultBackgroundColor: string;
    defaultTextColor: string;
    sessionTimeout: number;
    inactivityTimeout: number;
}

const DB_NAME = 'TelimsDB';
const DB_VERSION = 1;
const SCRIPTS_STORE = 'scripts';
const SETTINGS_STORE = 'settings';
export const SESSION_KEY = 'telims_session';
export const  SESSION_EXPIRY = 'telims_session_expiry';

export class DatabaseService {
    private db: IDBDatabase | null = null;
    private encryptionKey: CryptoKey | null = null;
    private keySalt: Uint8Array<ArrayBuffer> | null = null;
    private sessionCheckInterval: ReturnType<typeof setInterval> | null = null;
    private inactivityTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private boundFocusHandler: (() => void) | null = null;
    private boundBlurHandler: (() => void) | null = null;

    async initialize(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(SCRIPTS_STORE)) {
                    const scriptStore = db.createObjectStore(SCRIPTS_STORE, { keyPath: 'id' });
                    scriptStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                    db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
                }
            }
        });
    }

    async hasExistingVault(): Promise<boolean> {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([SETTINGS_STORE], 'readonly');
            const store = transaction.objectStore(SETTINGS_STORE);
            const request = store.get('validation_token');

            request.onsuccess = () => resolve(!!request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async unlock(passphrase: string, isFirstTime?: boolean): Promise<boolean> {
        try {
            await this.initialize();

            // Generate or retrieve salt for key derivation
            const salt = isFirstTime 
                ? crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>
                : await this.getStoredSalt();
            
            if (!salt) {
                return false;
            }

            // Derive the encryption key from passphrase
            this.encryptionKey = await CryptoService.deriveKey(passphrase, salt);
            this.keySalt = salt;

            if (isFirstTime) {
                await this.storeSalt(salt);
                await this.createValidationToken();
            } else {
                const isValid = await this.validatePassphrase();
                if (!isValid) {
                    this.encryptionKey = null;
                    this.keySalt = null;
                    return false;
                }
            }

            this.startSessionTimer();
            this.updateSessionExpiry();

            return true;
        } catch {
            this.encryptionKey = null;
            this.keySalt = null;
            return false;
        }
    }

    private async storeSalt(salt: Uint8Array<ArrayBuffer>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const saltRecord = {
            id: 'encryption_salt',
            value: btoa(String.fromCharCode(...salt)),
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([SETTINGS_STORE], 'readwrite');
            const store = transaction.objectStore(SETTINGS_STORE);
            const request = store.put(saltRecord);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    private async getStoredSalt(): Promise<Uint8Array<ArrayBuffer> | null> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([SETTINGS_STORE], 'readonly');
            const store = transaction.objectStore(SETTINGS_STORE);
            const request = store.get('encryption_salt');

            request.onsuccess = () => {
                const record = request.result;
                if (!record) {
                    resolve(null);
                    return;
                }
                const salt = Uint8Array.from(atob(record.value), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
                resolve(salt);
            };
            request.onerror = () => reject(request.error);
        });
    }

    private async createValidationToken(): Promise<void> {
        if (!this.db || !this.encryptionKey) throw new Error('Database not unlocked');

        const token = {
            id: 'validation_token',
            value: await CryptoService.encryptWithKey('telims_valid', this.encryptionKey),
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([SETTINGS_STORE], 'readwrite');
            const store = transaction.objectStore(SETTINGS_STORE);
            const request = store.put(token);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    private async validatePassphrase(): Promise<boolean> {
        if (!this.db || !this.encryptionKey) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([SETTINGS_STORE], 'readonly');
            const store = transaction.objectStore(SETTINGS_STORE);
            const request = store.get('validation_token');

            request.onsuccess = async () => {
                const token = request.result;
                if (!token) {
                    resolve(false);
                    return;
                }

                try {
                    const decrypted = await CryptoService.decryptWithKey(token.value, this.encryptionKey!);
                    resolve(decrypted === 'telims_valid');
                } catch {
                    resolve(false);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    lock() {
        this.encryptionKey = null;
        this.keySalt = null;
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_EXPIRY);
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
        if (this.inactivityTimeoutId) {
            clearTimeout(this.inactivityTimeoutId);
            this.inactivityTimeoutId = null;
        }
        if (typeof window !== 'undefined') {
            if (this.boundFocusHandler) {
                window.removeEventListener('focus', this.boundFocusHandler);
                this.boundFocusHandler = null;
            }
            if (this.boundBlurHandler) {
                window.removeEventListener('blur', this.boundBlurHandler);
                this.boundBlurHandler = null;
            }
            window.location.reload();
        }
    }

    isUnlocked(): boolean {
        return this.encryptionKey !== null;
    }

    async saveScript(script: Omit<Script, 'id' | 'createdAt' | 'updatedAt'>): Promise<Script> {
        if (!this.db || !this.encryptionKey) throw new Error('Database not unlocked');

        const now = Date.now();
        const fullScript: Script = {
            ...script,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
        };

        const encryptedContent = await CryptoService.encryptWithKey(fullScript.content, this.encryptionKey);
        const encryptedScript = { ...fullScript, content: encryptedContent };

        return new Promise<Script>((resolve, reject) => {
            const transaction = this.db!.transaction([SCRIPTS_STORE], 'readwrite');
            const store = transaction.objectStore(SCRIPTS_STORE);
            const request = store.add(encryptedScript);

            request.onsuccess = () => resolve(fullScript);
            request.onerror = () => reject(request.error);
        });
    }

    async updateScript(id: string, updates: Partial<Script>): Promise<Script> {
        if (!this.db || !this.encryptionKey) throw new Error('Database not unlocked');

        const existingScript = await this.getScript(id);
        if (!existingScript) throw new Error('Script not found');

        const updatedScript: Script = {
            ...existingScript,
            ...updates,
            updatedAt: Date.now(),
        };

        const encryptedContent = await CryptoService.encryptWithKey(updatedScript.content, this.encryptionKey);
        const encryptedScript = { ...updatedScript, content: encryptedContent };

        return new Promise<Script>((resolve, reject) => {
            const transaction = this.db!.transaction([SCRIPTS_STORE], 'readwrite');
            const store = transaction.objectStore(SCRIPTS_STORE);
            const request = store.put(encryptedScript);

            request.onsuccess = () => resolve(updatedScript);
            request.onerror = () => reject(request.error);
        });
    }

    async getScript(id: string): Promise<Script | null> {
        if (!this.db || !this.encryptionKey) throw new Error('Database not unlocked');

        return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([SCRIPTS_STORE], 'readonly');
        const store = transaction.objectStore(SCRIPTS_STORE);
        const request = store.get(id);

        request.onsuccess = async () => {
            const script = request.result;
            if (!script) {
            resolve(null);
            return;
            }

            try {
            const decryptedContent = await CryptoService.decryptWithKey(script.content, this.encryptionKey!);
            resolve({ ...script, content: decryptedContent });
            } catch (error) {
            reject(error);
            }
        };
        request.onerror = () => reject(request.error);
        });
    }

    async getAllScripts(): Promise<Script[]> {
        if (!this.db || !this.encryptionKey) throw new Error('Database not unlocked');

        const encryptedScripts = await new Promise<Script[]>((resolve, reject) => {
            const transaction = this.db!.transaction([SCRIPTS_STORE], 'readonly');
            const store = transaction.objectStore(SCRIPTS_STORE);
            const index = store.index('updatedAt');
            const request = index.openCursor(null, 'prev');
            const scripts: Script[] = [];

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    scripts.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(scripts);
                }
            };
            request.onerror = () => reject(request.error);
        });

        const decryptedScripts = await Promise.all(
            encryptedScripts.map(async (script) => {
                const decryptedContent = await CryptoService.decryptWithKey(script.content, this.encryptionKey!);
                return { ...script, content: decryptedContent };
            })
        );

        return decryptedScripts;
    }

    async deleteScript(id: string): Promise<void> {
        if (!this.db) throw new Error('Database not unlocked');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([SCRIPTS_STORE], 'readwrite');
            const store = transaction.objectStore(SCRIPTS_STORE);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSettings(): Promise<Settings> {
        if (!this.db) throw new Error('Database not unlocked');

        return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([SETTINGS_STORE], 'readonly');
        const store = transaction.objectStore(SETTINGS_STORE);
        const request = store.get('settings');

        request.onsuccess = () => {
            const settings = request.result || {
            id: 'settings',
            defaultFontSize: 48,
            defaultScrollSpeed: 2,
            defaultBackgroundColor: '#000000',
            defaultTextColor: '#ffffff',
            sessionTimeout: 7200000,
            inactivityTimeout: 1800000,
            };
            resolve(settings);
        };
        request.onerror = () => reject(request.error);
        });
    }

    async updateSettings(settings: Partial<Settings>): Promise<Settings> {
        if (!this.db) throw new Error('Database not unlocked');

        const currentSettings = await this.getSettings();
        const updatedSettings = { ...currentSettings, ...settings, id: 'settings' };

        return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([SETTINGS_STORE], 'readwrite');
        const store = transaction.objectStore(SETTINGS_STORE);
        const request = store.put(updatedSettings);

        request.onsuccess = () => resolve(updatedSettings);
        request.onerror = () => reject(request.error);
        });
    }

    private startSessionTimer() {
        this.sessionCheckInterval = setInterval(() => {
            const expiry = localStorage.getItem(SESSION_EXPIRY);
            if (expiry && Date.now() > parseInt(expiry, 10)) {
                this.lock();
            }
        }, 60000); // Check every minute

        if (typeof window !== 'undefined') {
            this.boundFocusHandler = () => this.updateSessionExpiry();
            this.boundBlurHandler = () => this.handleInactivity();
            window.addEventListener('focus', this.boundFocusHandler);
            window.addEventListener('blur', this.boundBlurHandler);
        }
    }

    private handleInactivity() {
        // Clear any existing inactivity timeout
        if (this.inactivityTimeoutId) {
            clearTimeout(this.inactivityTimeoutId);
        }
        const inactivityTimeout = 30 * 60 * 1000; // 30 minutes
        this.inactivityTimeoutId = setTimeout(() => {
            if (!document.hasFocus()) {
                this.lock();
            }
            this.inactivityTimeoutId = null;
        }, inactivityTimeout);
    }

    private updateSessionExpiry() {
        const sessionTimeout = 2 * 60 * 60 * 1000; // 2 hours
        const expiry = Date.now() + sessionTimeout;
        localStorage.setItem(SESSION_EXPIRY, expiry.toString());
    }
}

export const db = new DatabaseService();
