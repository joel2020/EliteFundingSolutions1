'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface DeleteConfirmButtonProps {
  /** Label shown in the confirmation dialog, e.g. "broker John Doe" */
  itemLabel: string;
  /** API endpoint to DELETE, e.g. "/api/crm/iso-brokers/123" */
  endpoint: string;
  /** Called after successful deletion so the parent can refresh its list */
  onDeleted: () => void;
  /** Optional: disable the button (e.g. while another action is in flight) */
  disabled?: boolean;
}

export function DeleteConfirmButton({
  itemLabel,
  endpoint,
  onDeleted,
  disabled = false,
}: DeleteConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete. Please try again.');
      } else {
        toast.success(`${itemLabel} deleted successfully`);
        setOpen(false);
        onDeleted();
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{itemLabel}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
