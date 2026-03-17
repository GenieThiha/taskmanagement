import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTask, addComment, deleteTask } from '../../../api/task-api';
import { Task } from '../task-store';
import { Badge } from '../../../shared/components/badge';
import { Avatar } from '../../../shared/components/avatar';
import { Button } from '../../../shared/components/button';
import { Modal } from '../../../shared/components/modal';
import { TaskForm } from '../components/task-form';
import { formatDate } from '../../../shared/utils/format-date';

interface Comment {
  id: string;
  body: string;
  author: { id: string; full_name: string };
  created_at: string;
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // Stable reference so the edit-modal onSuccess callback never closes over a
  // stale version of the function after the component re-renders.
  const fetchTask = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getTask(id);
      setTask(data);
      setComments(data.comments ?? []);
    } catch {
      toast.error('Failed to load task');
      navigate('/tasks');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() || !id) return;

    setSubmittingComment(true);
    try {
      const comment = await addComment(id, commentBody.trim());
      setComments((prev) => [...prev, comment]);
      setCommentBody('');
      toast.success('Comment added');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Delete this task?')) return;
    try {
      await deleteTask(id);
      toast.success('Task deleted');
      navigate('/tasks');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/tasks')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            ← Back to tasks
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
          {task.project && (
            <p className="text-sm text-gray-500 mt-1">{task.project.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowEdit(true)}>Edit</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Description</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {task.description ?? 'No description provided.'}
            </p>
          </div>

          {/* Comments */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Comments ({comments.length})
            </h2>
            <div className="space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar fullName={c.author.full_name} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{c.author.full_name}</span>
                      <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{c.body}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-gray-400">No comments yet.</p>
              )}
            </div>

            {/* Add comment */}
            <form onSubmit={handleAddComment} className="mt-4 flex gap-2">
              <input
                type="text"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button type="submit" variant="primary" disabled={submittingComment}>
                {submittingComment ? '…' : 'Post'}
              </Button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <Badge type="status" value={task.status} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Priority</p>
              <Badge type="priority" value={task.priority} />
            </div>
            {task.assignee && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Assignee</p>
                <div className="flex items-center gap-2">
                  <Avatar fullName={task.assignee.full_name} size="sm" />
                  <span className="text-sm">{task.assignee.full_name}</span>
                </div>
              </div>
            )}
            {task.reporter && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Reporter</p>
                <div className="flex items-center gap-2">
                  <Avatar fullName={task.reporter.full_name} size="sm" />
                  <span className="text-sm">{task.reporter.full_name}</span>
                </div>
              </div>
            )}
            {task.due_date && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Due date</p>
                <p className="text-sm">{formatDate(task.due_date)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">Created</p>
              <p className="text-sm">{formatDate(task.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Task">
        <TaskForm
          task={task}
          onSuccess={() => {
            setShowEdit(false);
            fetchTask();
          }}
        />
      </Modal>
    </div>
  );
}
