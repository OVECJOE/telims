'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Trash2, Play, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStorage } from '@/lib/storage-context';
import { Script } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useState } from 'react';

interface ScriptListProps {
  onSelectScript: (script: Script) => void;
}

export function ScriptList({ onSelectScript }: ScriptListProps) {
  const router = useRouter();
  const { scripts, deleteScript } = useStorage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (pendingDeleteId) {
      try {
        await deleteScript(pendingDeleteId);
        setPendingDeleteId(null);
        setDialogOpen(false);
      } catch (error) {
        console.error('Failed to delete script:', error);
      }
    }
  };

  const cancelDelete = () => {
    setPendingDeleteId(null);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold font-mono uppercase tracking-wider text-foreground">My Scripts</h2>
        <Link href="/scripts/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Script
          </Button>
        </Link>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Script?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this script? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {scripts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4 font-mono">
              No scripts yet. Create your first teleprompter script!
            </p>
            <Link href="/scripts/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Script
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scripts.map((script) => (
            <Card key={script.id} className="hover:bg-muted transition-colors">
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
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3 font-mono">
                  {script.content.substring(0, 100)}...
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => onSelectScript(script)}
                    className="flex-1"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Present
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => router.push(`/scripts/${script.id}`)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDeleteClick(script.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}