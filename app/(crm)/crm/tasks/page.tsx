'use client';

import { useCallback, useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Plus, MoreVertical, CheckCircle2, Circle, Edit, Trash2, Calendar } from 'lucide-react';
import type { Task } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const priorityConfig = {
  low: { label: 'Low', color: 'bg-blue-100 text-blue-700' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
};

const statusConfig = {
  open: { label: 'Open', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

interface TaskFormData {
  title: string;
  description: string;
  due_date: string;
  priority: string;
  status: string;
}

const emptyForm: TaskFormData = {
  title: '',
  description: '',
  due_date: '',
  priority: 'medium',
  status: 'open',
};

export default function TasksPage() {
  const { profile: crmProfile, organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<TaskFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', organizationId)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {
      toast.error('Failed to load tasks');
      console.error(error);
    } else if (data) {
      setTasks(data as Task[]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadTasks();
  }, [crmUserLoading, organizationId, loadTasks]);

  const handleAdd = () => {
    setSelectedTask(null);
    setFormData(emptyForm);
    setShowDialog(true);
  };

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date || '',
      priority: task.priority,
      status: task.status,
    });
    setShowDialog(true);
  };

  const handleDelete = (task: Task) => {
    setSelectedTask(task);
    setShowDeleteDialog(true);
  };

  const saveTask = async () => {
    if (!formData.title) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    
    const taskData = {
      ...formData,
      organization_id: organizationId,
    };

    if (selectedTask) {
      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', selectedTask.id);

      if (error) {
        toast.error('Failed to update task');
        console.error(error);
      } else {
        toast.success('Task updated successfully');
        setShowDialog(false);
        loadTasks();
      }
    } else {
      const { error } = await supabase
        .from('tasks')
        .insert([taskData]);

      if (error) {
        toast.error('Failed to create task');
        console.error(error);
      } else {
        toast.success('Task created successfully');
        setShowDialog(false);
        loadTasks();
      }
    }
    
    setSaving(false);
  };

  const toggleComplete = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'open' : 'completed';
    const { error } = await supabase
      .from('tasks')
      .update({ 
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', task.id);

    if (error) {
      toast.error('Failed to update task');
    } else {
      toast.success(newStatus === 'completed' ? 'Task completed' : 'Task reopened');
      loadTasks();
    }
  };

  const confirmDelete = async () => {
    if (!selectedTask) return;
    
    setSaving(true);
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', selectedTask.id);

    if (error) {
      toast.error('Failed to delete task');
      console.error(error);
    } else {
      toast.success('Task deleted successfully');
      setShowDeleteDialog(false);
      loadTasks();
    }
    setSaving(false);
  };

  const openTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Tasks"
        subtitle={`${openTasks.length} open tasks, ${completedTasks.length} completed`}
        actions={
          <div className="flex items-center gap-3">
            <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'calendar')}>
              <TabsList>
                <TabsTrigger value="list">List</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {view === 'list' ? (
          <div className="space-y-6">
            {/* Open Tasks */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-[#09090B]">Open Tasks ({openTasks.length})</h3>
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-8 text-[#A1A1AA]">Loading…</div>
                ) : openTasks.length === 0 ? (
                  <div className="text-center py-8 text-[#A1A1AA]">No open tasks</div>
                ) : (
                  openTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white border border-[#E4E4E7] rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        <button
                          onClick={() => toggleComplete(task)}
                          className="mt-1 text-[#71717A] hover:text-[#2563EB] transition-colors"
                        >
                          <Circle className="w-5 h-5" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="font-medium text-[#09090B] mb-1">{task.title}</h4>
                              {task.description && (
                                <p className="text-sm text-[#71717A] mb-2">{task.description}</p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={priorityConfig[task.priority as keyof typeof priorityConfig]?.color}>
                                  {priorityConfig[task.priority as keyof typeof priorityConfig]?.label}
                                </Badge>
                                {task.due_date && (
                                  <div className="flex items-center gap-1 text-xs text-[#71717A]">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </div>
                                )}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(task)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleComplete(task)}>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Mark Complete
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(task)} className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-[#09090B]">Completed ({completedTasks.length})</h3>
                <div className="space-y-2">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white border border-[#E4E4E7] rounded-lg p-4 opacity-60"
                    >
                      <div className="flex items-start gap-4">
                        <button
                          onClick={() => toggleComplete(task)}
                          className="mt-1 text-[#10B981]"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        <div className="flex-1">
                          <h4 className="font-medium text-[#09090B] line-through">{task.title}</h4>
                          {task.completed_at && (
                            <p className="text-xs text-[#71717A] mt-1">
                              Completed {new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-[#E4E4E7] rounded-lg p-6">
            <p className="text-center text-[#71717A]">Calendar view is available after calendar integration is configured</p>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTask ? 'Edit Task' : 'New Task'}</DialogTitle>
            <DialogDescription>
              {selectedTask ? 'Update task details' : 'Create a new task'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveTask} disabled={saving || !formData.title}>
              {saving ? 'Saving...' : selectedTask ? 'Update Task' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
