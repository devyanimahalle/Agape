import { useState, useEffect, useMemo } from 'react';
import { Badge, Button, Card, EmptyState, LoadingState, StatusPill } from '../../components/ui';
import { fetchUsers, patchUser } from './api';
import Page from './components/Page';
import Toast from './components/Toast';

// Backend verification statuses -> shared StatusPill keys.
const PILL = { approved: 'verified', pending: 'pending', rejected: 'rejected' };
const ROLE_LABEL = { admin: 'Admin', provider: 'Donor', ngo: 'NGO' };

const SUBTITLE = 'Manage platform users and their access.';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchUsers()
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.profile?.org_name || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggleActive = async (user) => {
    setTogglingId(user.id);
    try {
      const updated = await patchUser(user.id, { is_active: !user.is_active });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
      showToast(`${user.name} has been ${updated.is_active ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      showToast(`Failed to update user: ${err.message}`, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const getOrgInfo = (user) => (user.profile ? user.profile.org_name || '—' : '—');

  const getVerificationInfo = (user) => {
    if (user.role === 'provider' && user.profile) {
      return { category: user.profile.category, status: user.profile.verification_status };
    }
    if (user.role === 'ngo' && user.profile) {
      return { status: user.profile.status };
    }
    return null;
  };

  if (loading) {
    return <Page title="Users" subtitle={SUBTITLE}><LoadingState label="Loading users…" /></Page>;
  }
  if (error) {
    return (
      <Page title="Users" subtitle={SUBTITLE}>
        <EmptyState title="Failed to load users">{error}</EmptyState>
      </Page>
    );
  }

  const th = 'px-5 py-3 text-xs font-semibold uppercase tracking-[1px] text-muted';

  return (
    <Page title="Users" subtitle={SUBTITLE}>
      <Toast toast={toast} />

      <label className="block max-w-md text-xs font-semibold">
        Search users
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, email, role or organisation"
          className="mt-1.5 w-full rounded-[6px] bg-panel px-4 py-3 text-sm font-normal"
        />
      </label>

      <div className="mt-6">
        {filteredUsers.length === 0 ? (
          <EmptyState title="No users found">{search ? 'Try adjusting your search terms.' : undefined}</EmptyState>
        ) : (
          <Card className="overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-canvas-dim">
                    <th scope="col" className={th}>Name</th>
                    <th scope="col" className={th}>Email</th>
                    <th scope="col" className={th}>Role</th>
                    <th scope="col" className={th}>Organisation</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const verification = getVerificationInfo(user);
                    return (
                      <tr key={user.id} className="odd:bg-panel even:bg-canvas/50">
                        <td className="px-5 py-4 font-semibold">{user.name}</td>
                        <td className="px-5 py-4 text-muted">{user.email}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{ROLE_LABEL[user.role] ?? user.role}</Badge>
                            {verification?.category && <span className="text-xs capitalize text-muted">{verification.category}</span>}
                            {verification && <StatusPill status={PILL[verification.status] ?? verification.status} />}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-muted">{getOrgInfo(user)}</td>
                        <td className="px-5 py-4">
                          <Badge tone={user.is_active ? 'ok' : 'bad'}>{user.is_active ? 'Active' : 'Inactive'}</Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Button
                            variant={user.is_active ? 'dark' : 'brand'}
                            onClick={() => handleToggleActive(user)}
                            disabled={togglingId === user.id}
                            className="!px-3 !py-1.5 !text-xs"
                          >
                            {togglingId === user.id ? '…' : user.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <p className="mt-3 text-right text-xs text-muted">
        Showing {filteredUsers.length} of {users.length} users
      </p>
    </Page>
  );
}
