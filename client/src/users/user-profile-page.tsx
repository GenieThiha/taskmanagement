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
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  const isSelf = currentUser?.id === id;
  const isAdmin = currentUser?.role === 'admin';
  const canEdit = isSelf || isAdmin;

  useEffect(() => {
    if (!id) return;
    getUser(id)
      .then((data) => {
        setProfile(data);
        setFullName(data.full_name);
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await updateUser(id, { full_name: fullName });
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

  if (!profile) return <div className="p-6 text-gray-500">User not found.</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="card space-y-6">
        <div className="flex items-center gap-4">
          <Avatar fullName={profile.full_name} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{profile.full_name}</h1>
              <Badge type="role" value={profile.role} />
              {!profile.is_active && (
                <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <p className="text-xs text-gray-400">Member since {formatDate(profile.created_at)}</p>
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <div className="flex gap-3">
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
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          )
        )}
      </div>
    </div>
  );
}
