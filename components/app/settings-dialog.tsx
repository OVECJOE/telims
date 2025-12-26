'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
} from '@/components/ui/form';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/lib/storage-context';
import { Settings } from '@/lib/db';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem
} from '@/components/ui/select';

type SettingsFormValues = {
    defaultFontSize: number;
    defaultScrollSpeed: number;
    defaultBackgroundColor: string;
    defaultTextColor: string;
    sessionTimeout: number;
    inactivityTimeout: number;
    defaultSpeechModel: string;
};

export function SettingsDialog() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { settings, updateSettings } = useStorage();
    const isOpen = searchParams.get('mode') === 'settings';

    const form = useForm<SettingsFormValues>({
        defaultValues: {
            defaultFontSize: 48,
            defaultScrollSpeed: 2,
            defaultBackgroundColor: '#000000',
            defaultTextColor: '#ffffff',
            sessionTimeout: 120,
            inactivityTimeout: 30,
            defaultSpeechModel: 'tiny',
        },
    });

    useEffect(() => {
        if (settings) {
            form.reset({
                defaultFontSize: settings.defaultFontSize,
                defaultScrollSpeed: settings.defaultScrollSpeed,
                defaultBackgroundColor: settings.defaultBackgroundColor,
                defaultTextColor: settings.defaultTextColor,
                sessionTimeout: Math.round(settings.sessionTimeout / 60000),
                inactivityTimeout: Math.round(settings.inactivityTimeout / 60000),
                defaultSpeechModel: settings.defaultSpeechModel || 'tiny',
            });
        }
    }, [settings, form]);

    const handleOpenChange = (open: boolean) => {
        if (open) {
            router.push('?mode=settings');
        } else {
            router.push('/');
        }
    };

    const onSubmit = async (values: SettingsFormValues) => {
        const settingsToSave: Partial<Settings> = {
            defaultFontSize: values.defaultFontSize,
            defaultScrollSpeed: values.defaultScrollSpeed,
            defaultBackgroundColor: values.defaultBackgroundColor,
            defaultTextColor: values.defaultTextColor,
            sessionTimeout: values.sessionTimeout * 60000,
            inactivityTimeout: values.inactivityTimeout * 60000,
            defaultSpeechModel: values.defaultSpeechModel,
        };
        await updateSettings(settingsToSave);
        handleOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md overflow-y-auto max-h-[90vh] scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Configure your default teleprompter settings below.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="defaultFontSize"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Default Font Size: {field.value}px
                                    </FormLabel>
                                    <FormControl>
                                        <Slider
                                            value={[field.value]}
                                            onValueChange={([value]) => field.onChange(value)}
                                            min={24}
                                            max={120}
                                            step={4}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="defaultScrollSpeed"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Default Scroll Speed: {field.value}
                                    </FormLabel>
                                    <FormControl>
                                        <Slider
                                            value={[field.value]}
                                            onValueChange={([value]) => field.onChange(value)}
                                            min={1}
                                            max={10}
                                            step={1}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="defaultBackgroundColor"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Default Background Color</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="color"
                                            className="h-10 cursor-pointer"
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="defaultTextColor"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Default Text Color</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="color"
                                            className="h-10 cursor-pointer"
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="sessionTimeout"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Session Timeout (minutes)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={5}
                                            max={480}
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        How long before you need to re-enter your passphrase
                                    </FormDescription>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="inactivityTimeout"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Inactivity Timeout (minutes)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={5}
                                            max={120}
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Auto-lock after this period of inactivity
                                    </FormDescription>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="defaultSpeechModel"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Default Speech Model</FormLabel>
                                    <FormControl>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <SelectTrigger className="w-full h-10 font-mono">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="tiny">Whisper Tiny (fastest, least accurate)</SelectItem>
                                                <SelectItem value="small">Whisper Small (faster, less accurate)</SelectItem>
                                                <SelectItem value="medium">Whisper Medium (slower, more accurate)</SelectItem>
                                                <SelectItem value="large">Whisper Large (slowest, most accurate)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormDescription>
                                        Choose the default speech recognition model for transcription. Reload required for changes to take effect.
                                    </FormDescription>
                                </FormItem>
                            )}
                        />
                        <div className="flex gap-2 mt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button type="submit" className="flex-1">
                                Save
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
