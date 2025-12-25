'use client';

import { useState } from 'react';
import { Plus, FileText, Trash2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useStorage } from '@/lib/storage-context';
import { Script, validateScript } from '@/lib/db';

interface ScriptListProps {
  onSelectScript: (script: Script) => void;
}

export function ScriptList({ onSelectScript }: ScriptListProps) {
  const { scripts, saveScript, deleteScript, settings } = useStorage();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newScriptTitle, setNewScriptTitle] = useState('');
  const [newScriptContent, setNewScriptContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ title?: string; content?: string }>({});

  const handleCreateScript = async () => {
    const validation = validateScript(newScriptTitle, newScriptContent);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors({});
    setIsCreating(true);
    try {
      await saveScript({
        title: newScriptTitle.trim(),
        content: newScriptContent.trim(),
        fontSize: settings?.defaultFontSize || 48,
        scrollSpeed: settings?.defaultScrollSpeed || 2,
        backgroundColor: settings?.defaultBackgroundColor || '#000000',
        textColor: settings?.defaultTextColor || '#ffffff',
        mirrorMode: false,
        voiceControlEnabled: false,
      });
      setNewScriptTitle('');
      setNewScriptContent('');
      setIsCreateOpen(false);
    } catch (error) {
      console.error('Failed to create script:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setValidationErrors({});
      setNewScriptTitle('');
      setNewScriptContent('');
    }
    setIsCreateOpen(open);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold font-mono uppercase tracking-wider text-white">My Scripts</h2>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Script
        </Button>
      </div>

      {scripts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-16 h-16 text-[#a0a0a0] mb-4" />
            <p className="text-[#a0a0a0] text-center mb-4 font-mono">
              No scripts yet. Create your first teleprompter script!
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Script
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scripts.map((script) => (
            <Card key={script.id} className="hover:bg-[#1a1a1a] transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-mono">
                  <FileText className="w-5 h-5" />
                  {script.title}
                </CardTitle>
                <CardDescription>
                  Updated {formatDate(script.updatedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#a0a0a0] mb-4 line-clamp-3 font-mono">
                  {script.content.substring(0, 100)}...
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => onSelectScript(script)}
                    className="flex-1"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => deleteScript(script.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Script</DialogTitle>
            <DialogDescription>
              Add a title and content for your teleprompter script
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="script-title">Title</Label>
              <Input
                id="script-title"
                placeholder="Script Title"
                value={newScriptTitle}
                onChange={(e) => {
                  setNewScriptTitle(e.target.value);
                  if (validationErrors.title) {
                    setValidationErrors(prev => ({ ...prev, title: undefined }));
                  }
                }}
                maxLength={200}
                aria-invalid={!!validationErrors.title}
                aria-describedby={validationErrors.title ? "title-error" : undefined}
              />
              {validationErrors.title && (
                <p id="title-error" className="text-sm text-red-500 font-mono">{validationErrors.title}</p>
              )}
              <p className="text-xs text-[#a0a0a0] font-mono">{newScriptTitle.length}/200 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="script-content">Content</Label>
              <Textarea
                id="script-content"
                placeholder="Script Content"
                value={newScriptContent}
                onChange={(e) => {
                  setNewScriptContent(e.target.value);
                  if (validationErrors.content) {
                    setValidationErrors(prev => ({ ...prev, content: undefined }));
                  }
                }}
                rows={20}
                maxLength={100000}
                className="resize-none overflow-y-auto max-h-60"
                aria-invalid={!!validationErrors.content}
                aria-describedby={validationErrors.content ? "content-error" : undefined}
              />
              {validationErrors.content && (
                <p id="content-error" className="text-sm text-red-500 font-mono">{validationErrors.content}</p>
              )}
              <p className="text-xs text-[#a0a0a0] font-mono">{newScriptContent.length.toLocaleString()}/100,000 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateScript}
              disabled={isCreating || !newScriptTitle.trim() || !newScriptContent.trim()}
            >
              {isCreating ? 'Creating...' : 'Create Script'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}