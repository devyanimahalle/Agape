import { useState, useEffect, useMemo } from 'react';
import { Badge, Button, Card, EmptyState, LoadingState, Modal, StatusPill } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { deleteUser, fetchUsers, patchUser, resetAccounts } from './api';
import Page from './components/Page';
import Toast from './components/Toast';

// Backend verification statuses -> shared StatusPill keys.
const PILL = { approved: 'verified', pending: 'pending', rejected: 'rejected' };
const ROLE_LABEL = { admin: 'Admin', provider: 'Donor', ngo: 'NGO' };

const SUBTITLE = 'Manage platform users and their access.';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [confirm, setConfirm] = useState(null); // { kind: 'user', user } | { kind: 'reset' }
  const [deleting, setDeleting] = useState(false);
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

  const canDelete = (user) => user.role !== 'admin' && user.id !== me?.id;
  const accountCount = users.filter((u) => u.role !== 'admin').length;

  const handleConfirmDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      if (confirm.kind === 'reset') {
        const { deleted } = await resetAccounts();
        setUsers((prev) => prev.filter((u) => u.role === 'admin'));
        showToast(`Reset done. ${deleted} account${deleted === 1 ? '' : 's'} deleted.`);
      } else {
        await deleteUser(confirm.user.id);
        setUsers((prev) => prev.filter((u) => u.id !== confirm.user.id));
        showToast(`${confirm.user.name} was deleted.`);
      }
      setConfirm(null);
    } catch (err) {
      showToast(`Failed to delete: ${err.message}`, 'error');
    } finally {
      setDeleting(false);
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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="block w-full max-w-md text-xs font-semibold">
          Search users
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, role or organisation"
            className="mt-1.5 w-full rounded-[6px] bg-panel px-4 py-3 text-sm font-normal"
          />
        </label>
        <Button variant="danger" disabled={accountCount === 0} onClick={() => setConfirm({ kind: 'reset' })}>
          Reset demo accounts
        </Button>
      </div>

      <div className="mt-6">
        {filteredUsers.length === 0 ? (
          <EmptyState title="No users found">{search ? 'Try adjusting your search terms.' : undefined}</EmptyState>
        ) : (
          <>
          <ul className="grid gap-3 md:hidden" aria-label="Users">
            {filteredUsers.map((user) => {
              const verification = getVerificationInfo(user);
              return (
                <li key={user.id}>
                  <Card className="p-6">
                    <h3 className="text-2xl leading-none">{user.name}</h3>
                    <p className="mt-2 break-all text-xs text-muted">{user.email}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge>{ROLE_LABEL[user.role] ?? user.role}</Badge>
                      {verification?.category && <span className="text-xs capitalize text-muted">{verification.category}</span>}
                      {verification && <StatusPill status={PILL[verification.status] ?? verification.status} />}
                      <Badge tone={user.is_active ? 'ok' : 'bad'}>{user.is_active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    {getOrgInfo(user) !== '—' && <p className="mt-3 text-sm">{getOrgInfo(user)}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant={user.is_active ? 'dark' : 'brand'}
                        onClick={() => handleToggleActive(user)}
                        disabled={togglingId === user.id}
                        className="!px-3 !py-1.5 !text-xs"
                      >
                        {togglingId === user.id ? '…' : user.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      {canDelete(user) && (
                        <Button variant="danger" onClick={() => setConfirm({ kind: 'user', user })} className="!px-3 !py-1.5 !text-xs">Delete</Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          <Card className="hidden overflow-hidden !p-0 md:block">
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
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant={user.is_active ? 'dark' : 'brand'}
                              onClick={() => handleToggleActive(user)}
                              disabled={togglingId === user.id}
                              className="!px-3 !py-1.5 !text-xs"
                            >
                              {togglingId === user.id ? '…' : user.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            {canDelete(user) && (
                              <Button variant="danger" onClick={() => setConfirm({ kind: 'user', user })} className="!px-3 !py-1.5 !text-xs">Delete</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          </>
        )}
      </div>

      <p className="mt-3 text-right text-xs text-muted">
        Showing {filteredUsers.length} of {users.length} users
      </p>

      <Modal
        open={!!confirm}
        onClose={() => !deleting && setConfirm(null)}
        title={confirm?.kind === 'reset' ? 'Reset demo accounts?' : `Delete ${confirm?.user?.name ?? 'this account'}?`}
      >
        <p className="text-sm leading-relaxed text-muted">
          {confirm?.kind === 'reset'
            ? `This deletes all ${accountCount} donor and NGO accounts with their verification requests, listings, proofs and uploaded documents. Admin accounts are kept. It cannot be undone. Run the demo seed afterwards to restore the demo donor and NGO.`
            : 'This deletes the account with its verification requests, listings, proofs and uploaded documents. It cannot be undone.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="danger" onClick={handleConfirmDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : confirm?.kind === 'reset' ? 'Delete all accounts' : 'Delete account'}
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(null)} disabled={deleting}>Cancel</Button>
        </div>
      </Modal>
    </Page>
  );
}
