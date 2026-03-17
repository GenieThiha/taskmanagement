import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getUser, updateUser } from '../api/user-api';
import { useAuthStore } from '../modules/auth/auth-store';
import { Avatar } from '../shared/components/avatar';
import { Badge } from '../shared/components/badge';
import { Button } from '../shared/components/button';
import { Input } from '../shared/components/input';
import { formatDate } from '../shared/utils/format-date';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state — pre-filled when edit mode opens
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState(true);

  const isSelf = currentUser?.id === id;
  const isAdmin = currentUser?.role === 'admin';
  const canEdit = isSelf || isAdmin;

  useEffect(() => {
    if (!id) return;
    getUser(id)
      .then((data) => {
        setProfile(data);
        setFullName(data.full_name);
        setRole(data.role);
        setIsActive(data.is_active);
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [id]);

  const openEdit = () => {
    // Re-sync form fields with current profile values each time edit opens
    if (profile) {
      setFullName(profile.full_name);
      setRole(profile.role);
      setIsActive(profile.is_active);
    }
    setEditing(true);
  };

  const handleSave = async () => {
    if (!id) return;
    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }
    setSaving(true);
    try {
      const payload: { full_name?: string; role?: string; is_active?: boolean } = {
        full_name: fullName,
      };
      // role and is_active can only be changed by admins — the server enforces
      // this too, but we only send them when the viewer is actually an admin.
      if (isAdmin) {
        payload.role = role;
        payload.is_active = isActive;
      }
      const updated = await updateUser(id, payload);
      setProfile(updated);
      setEditing(false);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) return <div className="p-6 text-gray-500 dark:text-gray-400">User not found.</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="card space-y-6">
        {/* Profile header */}
        <div className="flex items-center gap-4">
          <Avatar fullName={profile.full_name} size="lg" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{profile.full_name}</h1>
              <Badge type="role" value={profile.role} />
              {!profile.is_active && (
                <span className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Member since {formatDate(profile.created_at)}
            </p>
          </div>
        </div>

        {/* Edit form */}
        {editing ? (
          <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-5">
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name"
            />

            {/* Admin-only fields */}
            {isAdmin && (
              <>
                <div>
                  <label className="form-label" htmlFor="edit-role">
                    Role
                  </label>
                  <select
                    id="edit-role"
                    name="edit-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="member">Member</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Active account
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Inactive users cannot log in
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive((v) => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                      isActive ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                    aria-label="Toggle active status"
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          canEdit && (
            <Button variant="secondary" onClick={openEdit}>
              Edit profile
            </Button>
          )
        )}
      </div>
    </div>
  );
}
