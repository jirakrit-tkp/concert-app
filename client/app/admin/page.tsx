'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { House, Inbox, LogOut, RefreshCcw, Save, Trash2, User } from 'lucide-react';
import SidebarLayout, { SidebarItem } from '../components/SidebarLayout';
import StatCard from '../components/StatCard';
import Snackbar from '../components/Snackbar';
import ConfirmModal from '../components/ConfirmModal';
import { API_BASE_URL } from '../config';
import type { AppUser, Concert, Reservation } from '../types/api';

StatCard.displayName = 'StatCard';

type AdminTab = 'overview' | 'create';

const AdminHomePage = () => {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    totalSeats: '',
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [concertPendingDelete, setConcertPendingDelete] = useState<Concert | null>(null);
  const [isDeletingConcert, setIsDeletingConcert] = useState(false);

  const clearStatusMessages = useCallback(() => {
    setFeedback(null);
    setError(null);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (!storedUser) {
      router.replace('/login');
      return;
    }

    try {
      const parsed: AppUser = JSON.parse(storedUser);
      if (parsed.role !== 'admin') {
        router.replace('/');
        return;
      }
      setAuthUser(parsed);
    } catch (err) {
      console.error('Failed to parse stored user', err);
      localStorage.removeItem('authUser');
      router.replace('/login');
    }
  }, [router]);

  const handleLogout = useCallback(() => {
    clearStatusMessages();
    localStorage.removeItem('authUser');
    setAuthUser(null);
    setConcerts([]);
    setReservations([]);
    router.replace('/login');
  }, [clearStatusMessages, router]);

  const handleError = useCallback((message: string, err: unknown) => {
    console.error(message, err);
    setError(message);
  }, []);

  const fetchConcerts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/concerts`);
      if (!response.ok) {
        throw new Error('Failed to load concerts');
      }
      const data: Concert[] = await response.json();
      setConcerts(data);
    } catch (err) {
      handleError('Unable to load concerts', err);
    }
  }, [handleError]);

  const fetchReservations = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/reservations`);
      if (!response.ok) {
        throw new Error('Failed to load reservations');
      }
      const data: Reservation[] = await response.json();
      setReservations(data);
    } catch (err) {
      handleError('Unable to load reservations', err);
    }
  }, [handleError]);

  const refreshConcertsAndReservations = useCallback(async () => {
    await Promise.all([fetchConcerts(), fetchReservations()]);
  }, [fetchConcerts, fetchReservations]);

  useEffect(() => {
    if (authUser === null) {
      return;
    }

    setIsLoading(true);
    refreshConcertsAndReservations()
      .catch((err) => console.error('Initial load error', err))
      .finally(() => setIsLoading(false));
  }, [authUser, refreshConcertsAndReservations]);

  const totalSeats = useMemo(
    () => concerts.reduce((sum, concert) => sum + concert.total_seats, 0),
    [concerts],
  );

  const reservedSeats = useMemo(
    () => concerts.reduce((sum, concert) => sum + (concert.total_seats - concert.available_seats), 0),
    [concerts],
  );

  const cancelledCount = useMemo(
    () => reservations.filter((reservation) => reservation.status === 'cancelled').length,
    [reservations],
  );

  const handleCreateConcert = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearStatusMessages();

      const parsedSeats = Number(createForm.totalSeats);
      if (!Number.isFinite(parsedSeats) || parsedSeats <= 0) {
        setError('Total seats must be a number greater than 0');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/concerts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: createForm.name,
            description: createForm.description,
            totalSeats: parsedSeats,
          }),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message);
        }

        setCreateForm({ name: '', description: '', totalSeats: '' });
        setAdminTab('overview');
        setFeedback('Concert created successfully');
        await refreshConcertsAndReservations();
      } catch (err) {
        handleError('Unable to create concert', err);
      }
    },
    [clearStatusMessages, createForm.description, createForm.name, createForm.totalSeats, handleError, refreshConcertsAndReservations],
  );

  const handleDeleteConcert = useCallback(
    async (concertId: number) => {
      clearStatusMessages();
      try {
        const response = await fetch(`${API_BASE_URL}/concerts/${concertId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message);
        }

        setFeedback('Concert deleted successfully');
        await refreshConcertsAndReservations();
      } catch (err) {
        handleError('Unable to delete concert', err);
      }
    },
    [clearStatusMessages, handleError, refreshConcertsAndReservations],
  );

  const openDeleteModal = useCallback((concert: Concert) => {
    setConcertPendingDelete(concert);
    setIsDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (isDeletingConcert) {
      return;
    }
    setConcertPendingDelete(null);
    setIsDeleteModalOpen(false);
  }, [isDeletingConcert]);

  const confirmDelete = useCallback(async () => {
    if (concertPendingDelete === null) {
      return;
    }

    setIsDeletingConcert(true);
    try {
      await handleDeleteConcert(concertPendingDelete.id);
    } finally {
      setIsDeletingConcert(false);
      setConcertPendingDelete(null);
      setIsDeleteModalOpen(false);
    }
  }, [concertPendingDelete, handleDeleteConcert]);

  const sidebarItems = useMemo<SidebarItem[]>(
    () => [
      { id: 'admin-home', label: 'Home', icon: <House size={16} aria-hidden="true" /> },
      { id: 'admin-history', label: 'History', icon: <Inbox size={16} aria-hidden="true" /> },
      { id: 'user-home', label: 'Switch to User', icon: <RefreshCcw size={16} aria-hidden="true" /> },
    ],
    [],
  );

  const footerItems = useMemo<SidebarItem[]>(() => {
    if (!authUser) {
      return [];
    }

    return [
      {
        id: 'logout',
        label: 'Logout',
        icon: <LogOut size={16} aria-hidden="true" />,
      },
    ];
  }, [authUser, handleLogout]);

  const handleNavigation = useCallback(
    (id: string) => {
      if (id === 'logout') {
        handleLogout();
        return;
      }

      if (id === 'admin-history') {
        router.push('/admin/history');
        return;
      }

      if (id === 'user-home') {
        router.push('/');
      }
    },
    [handleLogout, router],
  );

  useEffect(() => {
    if (!feedback && !error) {
      return;
    }

    const timeout = window.setTimeout(() => {
      clearStatusMessages();
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [feedback, error, clearStatusMessages]);

  if (authUser === null) {
    return null;
  }

  return (
    <SidebarLayout title="Admin" items={sidebarItems} activeId="admin-home" onSelect={handleNavigation} footerItems={footerItems}>
      {isLoading ? (
        <p className="text-sm text-zinc-500">กำลังโหลดข้อมูล...</p>
      ) : null}
      <section className="mb-10 flex flex-col items-center gap-4 sm:flex-col sm:items-center lg:flex-row lg:flex-nowrap lg:justify-between">
        <StatCard label="Total of seats" value={totalSeats} tone="info" />
        <StatCard label="Reserve" value={reservedSeats} tone="success" />
        <StatCard label="Cancel" value={cancelledCount} tone="danger" />
      </section>
      <section>
        <div className="mb-6 flex items-center gap-6">
          <button
            type="button"
            className={`pb-3 text-sm font-semibold transition-colors ${
              adminTab === 'overview' ? 'border-b-2 border-blue-2 text-blue-2' : 'text-zinc-500 hover:text-zinc-700'
            }`}
            onClick={() => setAdminTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`pb-3 text-sm font-semibold transition-colors ${
              adminTab === 'create' ? 'border-b-2 border-blue-2 text-blue-2' : 'text-zinc-500 hover:text-zinc-700'
            }`}
            onClick={() => setAdminTab('create')}
          >
            Create
          </button>
        </div>

        {adminTab === 'overview' ? (
          <section className="space-y-4">
            {concerts.map((concert) => (
              <article key={concert.id} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                <header className="mb-6">
                  <h3 className="text-xl font-semibold text-blue-2">{concert.name}</h3>
                  <div className="mt-4 border-t border-zinc-200" />
                  <p className="mt-3 text-sm text-zinc-600 wrap-break-word">{concert.description}</p>
                </header>
                <footer className="flex flex-col gap-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <User size={16} aria-hidden="true" className="text-zinc-400" />
                    <span className="font-semibold text-zinc-700">{concert.total_seats}</span>
                    <span className="mx-2 text-zinc-300">|</span>
                    <span className="text-zinc-500">Available {concert.available_seats}</span>
                  </div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-1 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-2 sm:w-auto sm:min-w-[160px]"
                    onClick={() => openDeleteModal(concert)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Delete
                  </button>
                </footer>
              </article>
            ))}
            {concerts.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
                No concerts available yet
              </p>
            ) : null}
          </section>
        ) : (
          <section className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
            <header className="mb-6">
              <h2 className="text-3xl font-semibold text-blue-2">Create</h2>
              <div className="mt-4 border-t border-zinc-200" />
            </header>
            <form className="space-y-6" onSubmit={handleCreateConcert}>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col text-sm font-medium text-zinc-700">
                  Concert Name
                  <input
                    className="mt-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    type="text"
                    value={createForm.name}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Please input concert name"
                    required
                  />
                </label>
                <label className="flex flex-col text-sm font-medium text-zinc-700">
                  Total of seat
                  <div className="relative mt-2">
                    <input
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 pr-10 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                      type="number"
                      min={1}
                      value={createForm.totalSeats}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, totalSeats: event.target.value }))}
                      placeholder="Please input total seat"
                      required
                    />
                    <User size={16} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </label>
              </div>
              <label className="flex flex-col text-sm font-medium text-zinc-700">
                Description
                <textarea
                  className="mt-2 h-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Please input description"
                  required
                />
              </label>
              <div className="flex flex-col items-stretch justify-end gap-3 sm:flex-row">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 sm:w-auto sm:min-w-[160px]"
                >
                  <Save size={16} aria-hidden="true" />
                  Save
                </button>
              </div>
            </form>
          </section>
        )}
      </section>

      <Snackbar message={feedback} tone="success" onDismiss={clearStatusMessages} />
      <Snackbar message={error} tone="danger" onDismiss={clearStatusMessages} />

      <ConfirmModal
        isOpen={isDeleteModalOpen && concertPendingDelete !== null}
        iconTone="danger"
        title="Are you sure to delete?"
        description={concertPendingDelete ? `"${concertPendingDelete.name}"` : undefined}
        confirmLabel={isDeletingConcert ? 'Deleting...' : 'Yes, Delete'}
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
        confirmDisabled={isDeletingConcert}
        cancelDisabled={isDeletingConcert}
      />
    </SidebarLayout>
  );
};

AdminHomePage.displayName = 'AdminHomePage';

export default AdminHomePage;

