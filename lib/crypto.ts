export class CryptoService {
    private static SALT_LENGTH = 16;
    private static IV_LENGTH = 12;
    private static KEY_LENGTH = 256;

    static async deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const passphraseKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(passphrase),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-512',
            },
            passphraseKey,
            { name: 'AES-GCM', length: this.KEY_LENGTH },
            false,
            ['encrypt', 'decrypt']
        );
    }

    static async encryptWithKey(data: string, key: CryptoKey): Promise<string> {
        const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
        const encoder = new TextEncoder();
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(data)
        );

        const result = new Uint8Array(iv.length + encrypted.byteLength);
        result.set(iv, 0);
        result.set(new Uint8Array(encrypted), iv.length);
        return btoa(String.fromCharCode(...result));
    }

    static async decryptWithKey(encryptedData: string, key: CryptoKey): Promise<string> {
        const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
        
        const iv = data.slice(0, this.IV_LENGTH);
        const ciphertext = data.slice(this.IV_LENGTH);

        try {
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                ciphertext
            );

            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch {
            throw new Error('Invalid key or corrupted data');
        }
    }

    static async encrypt(data: string, passphrase: string): Promise<string> {
        const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
        const key = await this.deriveKey(passphrase, salt);

        const encoder = new TextEncoder();
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(data)
        );

        const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        result.set(salt, 0);
        result.set(iv, salt.length);
        result.set(new Uint8Array(encrypted), salt.length + iv.length);
        return btoa(String.fromCharCode(...result));
    }

    static async decrypt(encryptedData: string, passphrase: string): Promise<string> {
        const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
        
        const salt = data.slice(0, this.SALT_LENGTH);
        const iv = data.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
        const ciphertext = data.slice(this.SALT_LENGTH + this.IV_LENGTH);
        
        const key = await this.deriveKey(passphrase, salt);

        try {
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                ciphertext
            );

            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch {
            throw new Error('Invalid passphrase or corrupted data');
        }
    }

    static generateSalt(): string {
        const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
        return btoa(String.fromCharCode(...salt));
    }
}