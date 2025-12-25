'use client';

import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { db, validatePassphraseStrength } from '@/lib/db';

interface UnlockScreenProps {
    onUnlock: (passphrase: string, isFirstTime: boolean) => Promise<boolean>;
}

export function UnlockScreen({ onUnlock }: UnlockScreenProps) {
    const [passphrase, setPassphrase] = useState('');
    const [confirmPassphrase, setConfirmPassphrase] = useState('');
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [showConfirmPassphrase, setShowConfirmPassphrase] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
    const [isCheckingVault, setIsCheckingVault] = useState(true);

    useEffect(() => {
        const checkExistingVault = async () => {
            try {
                const hasVault = await db.hasExistingVault();
                setIsFirstTime(!hasVault);
            } catch {
                setIsFirstTime(true);
            } finally {
                setIsCheckingVault(false);
            }
        };
        checkExistingVault();
    }, []);

    const passphraseValidation = validatePassphraseStrength(passphrase);
    const passphraseRequirements = [
        { label: 'At least 12 characters', met: passphrase.length >= 12 },
        { label: 'One lowercase letter', met: /[a-z]/.test(passphrase) },
        { label: 'One uppercase letter', met: /[A-Z]/.test(passphrase) },
        { label: 'One number', met: /[0-9]/.test(passphrase) },
        { label: 'One special character', met: /[^a-zA-Z0-9]/.test(passphrase) },
    ];

    const handleUnlock = async () => {
        if (!passphrase.trim()) {
            setError('Please enter a passphrase.');
            return;
        }

        if (isFirstTime) {
            if (!passphraseValidation.isValid) {
                setError('Please meet all passphrase requirements.');
                return;
            }
            if (passphrase !== confirmPassphrase) {
                setError('Passphrases do not match.');
                return;
            }
        }

        setIsUnlocking(true);
        setError(null);

        try {
            const success = await onUnlock(passphrase, isFirstTime ?? false);
            if (!success) {
                setError('Invalid passphrase. Please try again.');
            }
        } catch {
            setError('An error occurred while unlocking. Please try again.');
        } finally {
            setIsUnlocking(false);
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && passphrase.trim()) {
            if (!isFirstTime || (passphraseValidation.isValid && passphrase === confirmPassphrase)) {
                handleUnlock();
            }
        }
    }

    if (isCheckingVault) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="flex items-center justify-center py-12">
                        <p className="text-white font-mono">Initializing...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <div className="flex items-center justify-center mb-5">
                        <div className="p-3 border-2 border-white">
                            <Lock className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <div className="text-center mb-2">
                        <CardTitle className="text-2xl text-center font-mono uppercase tracking-wider">
                        {isFirstTime ? 'Create Passphrase' : 'Unlock Telims'}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {isFirstTime
                            ? 'Set a secure passphrase to encrypt your scripts'
                            : 'Enter your passphrase to access your scripts'}
                    </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="relative">
                                <Input
                                    type={showPassphrase ? 'text' : 'password'}
                                    placeholder={isFirstTime ? "Create passphrase" : "Enter passphrase"}
                                    value={passphrase}
                                    onChange={(e) => setPassphrase(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="pr-10"
                                    disabled={isUnlocking}
                                    aria-label={isFirstTime ? "Create passphrase" : "Enter passphrase"}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassphrase(!showPassphrase)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-[#a0a0a0]"
                                    aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
                                >
                                    {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {isFirstTime && (
                            <>
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Input
                                            type={showConfirmPassphrase ? 'text' : 'password'}
                                            placeholder="Confirm passphrase"
                                            value={confirmPassphrase}
                                            onChange={(e) => setConfirmPassphrase(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                            className="pr-10"
                                            disabled={isUnlocking}
                                            aria-label="Confirm passphrase"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassphrase(!showConfirmPassphrase)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-[#a0a0a0]"
                                            aria-label={showConfirmPassphrase ? "Hide confirmation" : "Show confirmation"}
                                        >
                                            {showConfirmPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {confirmPassphrase && passphrase !== confirmPassphrase && (
                                        <p className="text-sm text-red-500 font-mono">Passphrases do not match</p>
                                    )}
                                </div>

                                <div className="p-3 bg-[#1a1a1a] border-2 border-white space-y-1">
                                    <p className="text-xs text-[#a0a0a0] font-mono mb-2">Passphrase Requirements:</p>
                                    {passphraseRequirements.map((req, index) => (
                                        <div key={index} className="flex items-center gap-2 text-xs font-mono">
                                            {req.met ? (
                                                <Check className="w-3 h-3 text-green-500" />
                                            ) : (
                                                <X className="w-3 h-3 text-red-500" />
                                            )}
                                            <span className={req.met ? 'text-green-500' : 'text-[#a0a0a0]'}>
                                                {req.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Button
                                onClick={handleUnlock}
                                className="w-full"
                                disabled={
                                    isUnlocking || 
                                    !passphrase.trim() || 
                                    (isFirstTime === true && (!passphraseValidation.isValid || passphrase !== confirmPassphrase))
                                }
                            >
                                {isUnlocking ? 'Unlocking...' : isFirstTime ? 'Create & Unlock' : 'Unlock'}
                            </Button>
                        </div>
                    </div>

                    <div className="mt-6 p-4 bg-[#1a1a1a] border-2 border-white">
                        <p className="text-sm text-white font-mono">
                            <strong>Note:</strong> Your passphrase encrypts all data locally.
                            There is no password recovery. Keep it safe!
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
