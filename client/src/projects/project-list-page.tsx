import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getProjects, archiveProject } from '../api/project-api';
import { useAuthStore } from '../modules/auth/auth-store';
import { Button } from '../shared/components/button';
import { Badge } from '../shared/components/badge';
import { Modal } from '../shared/components/modal';
import { ProjectForm } from './project-form';
import { formatDate } from '../shared/utils/format-date';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  owner: { id: string; full_name: string };
  created_at: string;
}

export function ProjectListPage() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const canCreate = user?.role === 'manager' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const fetchProjects = async (p = page) => {
    setLoading(true);
    try {
      const result = await getProjects({ page: p, limit: 20 });
      setProjects(result.data ?? []);
      setTotalPages(result.meta?.total_pages ?? 1);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects(page);
  }, [page]);

  const handleArchive = async (id: string, name: string) => {
    if (!window.confirm(`Archive project "${name}"?`)) return;
    try {
      await archiveProject(id);
      toast.success('Project archived');
      fetchProjects();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to archive');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Projects</h1>
        {canCreate && (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + New Project
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div key={project.id} className="card flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">{project.name}</h2>
                  <Badge type="status" value={project.status} />
                </div>
                {project.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{project.description}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Owner: {project.owner?.full_name} · Created {formatDate(project.created_at)}
                </p>
              </div>
              {isAdmin && project.status !== 'archived' && (
                <Button
                  variant="secondary"
                  onClick={() => handleArchive(project.id, project.name)}
                  className="shrink-0"
                >
                  Archive
                </Button>
              )}
            </div>
          ))}
          {projects.length === 0 && (
            <p className="text-center py-12 text-gray-500 dark:text-gray-400">No projects found</p>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-gray-600 dark:text-gray-400 px-3">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Project">
        <ProjectForm onSuccess={() => { setShowCreate(false); fetchProjects(); }} />
      </Modal>
    </div>
  );
}
