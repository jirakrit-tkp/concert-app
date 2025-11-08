'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { House, Inbox, LogOut, RefreshCcw, Save, Trash2, User } from 'lucide-react';
import SidebarLayout, { SidebarItem } from './components/SidebarLayout';
import StatCard from './components/StatCard';

type Panel = 'admin-home' | 'admin-history' | 'user-home';
type AdminTab = 'overview' | 'create';

interface Concert {
  id: number;
  name: string;
  description: string;
  total_seats: number;
  available_seats: number;
}

interface Reservation {
  id: number;
  status: 'reserved' | 'cancelled';
  created_at: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  concert: {
    id: number;
    name: string;
    description: string;
    total_seats: number;
    available_seats: number;
  };
}

type AppUser = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001') + '/api';

StatCard.displayName = 'StatCard';

const transformToDisplayDate = (input: string) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleString();
};

const panelIds: Panel[] = ['admin-home', 'admin-history', 'user-home'];

const adminNavItems: SidebarItem[] = [
  { id: 'admin-home', label: 'Home', icon: <House size={16} aria-hidden="true" /> },
  { id: 'admin-history', label: 'History', icon: <Inbox size={16} aria-hidden="true" /> },
  { id: 'user-home', label: 'Switch to User', icon: <RefreshCcw size={16} aria-hidden="true" /> },
];

const adminUserNavItems: SidebarItem[] = [
  { id: 'user-home', label: 'Home', icon: <House size={16} aria-hidden="true" /> },
  { id: 'admin-home', label: 'Switch to Admin', icon: <RefreshCcw size={16} aria-hidden="true" /> },
];

const userNavItems: SidebarItem[] = [{ id: 'user-home', label: 'Home', icon: <House size={16} aria-hidden="true" /> }];

const Home = () => {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<Panel>('admin-home');
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    totalSeats: '',
  });
  const [authUser, setAuthUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (!storedUser) {
      router.replace('/login');
      return;
    }

    try {
      const parsed: AppUser = JSON.parse(storedUser);
      setAuthUser(parsed);
      setActivePanel(parsed.role === 'user' ? 'user-home' : 'admin-home');
      setSelectedUserId(parsed.id);
    } catch (err) {
      console.error('Failed to parse stored user', err);
      localStorage.removeItem('authUser');
      router.replace('/login');
    }
  }, [router]);

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
  }, [authUser]);

  const clearStatusMessages = useCallback(() => {
    setFeedback(null);
    setError(null);
  }, []);

  const handleLogout = useCallback(() => {
    clearStatusMessages();
    localStorage.removeItem('authUser');
    setAuthUser(null);
    setSelectedUserId(null);
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

  const fetchUsers = useCallback(async () => {
    if (authUser?.role !== 'admin') {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      if (!response.ok) {
        throw new Error('Failed to load users');
      }
      const data: AppUser[] = await response.json();
      setUsers(data);
      setSelectedUserId((previous) => {
        if (previous !== null) {
          return previous;
        }
        const matchingUser = data.find((user) => authUser && user.id === authUser.id);
        if (matchingUser) {
          return matchingUser.id;
        }
        return data.length > 0 ? data[0].id : null;
      });
    } catch (err) {
      handleError('Unable to load users', err);
    }
  }, [authUser, handleError]);

  const currentUser = useMemo(() => {
    if (authUser === null) {
      return null;
    }
    if (authUser.role === 'user') {
      return authUser;
    }
    if (selectedUserId === null) {
      return null;
    }
    return users.find((user) => user.id === selectedUserId) ?? null;
  }, [authUser, selectedUserId, users]);

  const refreshConcertsAndReservations = useCallback(async () => {
    await Promise.all([fetchConcerts(), fetchReservations()]);
  }, [fetchConcerts, fetchReservations]);

  useEffect(() => {
    if (authUser === null) {
      return;
    }

    setIsLoading(true);
    const requests =
      authUser.role === 'admin'
        ? [fetchConcerts(), fetchReservations(), fetchUsers()]
        : [fetchConcerts(), fetchReservations()];

    Promise.all(requests)
      .catch((err) => console.error('Initial load error', err))
      .finally(() => setIsLoading(false));
  }, [authUser, fetchConcerts, fetchReservations, fetchUsers]);

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

  const handleNavigation = useCallback(
    (id: string) => {
      if (id === 'logout') {
        handleLogout();
        return;
      }

      clearStatusMessages();
      if (!panelIds.includes(id as Panel)) {
        return;
      }

      if (authUser?.role !== 'admin' && id !== 'user-home') {
        return;
      }

      setActivePanel(id as Panel);

      if (id === 'user-home') {
        setAdminTab('overview');
        setSelectedUserId((previous) => {
          if (authUser?.role === 'user') {
            return authUser.id;
          }
          if (previous !== null) {
            return previous;
          }
          if (users.length > 0) {
            return users[0].id;
          }
          return authUser?.id ?? null;
        });
      }
    },
    [authUser, clearStatusMessages, handleLogout, users],
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
    [API_BASE_URL, clearStatusMessages, createForm.description, createForm.name, createForm.totalSeats, handleError, refreshConcertsAndReservations],
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
    [API_BASE_URL, clearStatusMessages, handleError, refreshConcertsAndReservations],
  );

  const getReservationForConcert = useCallback(
    (concertId: number, userId: number | null) =>
      reservations.find(
        (reservation) => reservation.concert.id === concertId && reservation.user.id === userId,
      ),
    [reservations],
  );

  const reserveSeat = useCallback(
    async (concertId: number) => {
      if (currentUser === null) {
        setError('Please select a user before performing this action');
        return;
      }
      clearStatusMessages();

      const existingReservation = getReservationForConcert(concertId, currentUser.id);

      try {
        if (existingReservation === undefined) {
          const response = await fetch(`${API_BASE_URL}/reservations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: currentUser.id,
              concertId,
            }),
          });

          if (!response.ok) {
            const message = await response.text();
            throw new Error(message);
          }
        } else if (existingReservation.status === 'cancelled') {
          const response = await fetch(`${API_BASE_URL}/reservations/${existingReservation.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'reserved' }),
          });

          if (!response.ok) {
            const message = await response.text();
            throw new Error(message);
          }
        } else {
          setFeedback('This user already has a reservation for the concert');
          return;
        }

        setFeedback('Seat reserved successfully');
        await refreshConcertsAndReservations();
      } catch (err) {
        handleError('Unable to reserve seat', err);
      }
    },
    [API_BASE_URL, clearStatusMessages, currentUser, getReservationForConcert, handleError, refreshConcertsAndReservations],
  );

  const cancelReservation = useCallback(
    async (concertId: number) => {
      if (currentUser === null) {
        setError('Please select a user before performing this action');
        return;
      }
      clearStatusMessages();

      const existingReservation = getReservationForConcert(concertId, currentUser.id);
      if (!existingReservation || existingReservation.status !== 'reserved') {
        setError('No reservation found to cancel');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/reservations/${existingReservation.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'cancelled' }),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message);
        }

        setFeedback('Reservation cancelled successfully');
        await refreshConcertsAndReservations();
      } catch (err) {
        handleError('Unable to cancel reservation', err);
      }
    },
    [API_BASE_URL, clearStatusMessages, currentUser, getReservationForConcert, handleError, refreshConcertsAndReservations],
  );

  const renderStatCards = () => (
    <section className="mb-10 flex flex-col items-center gap-4 sm:flex-col sm:items-center lg:flex-row lg:flex-nowrap lg:justify-between">
      <StatCard label="Total of seats" value={totalSeats} tone="info" />
      <StatCard label="Reserve" value={reservedSeats} tone="success" />
      <StatCard label="Cancel" value={cancelledCount} tone="danger" />
    </section>
  );

  const renderAdminOverview = () => (
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
                  onClick={() => handleDeleteConcert(concert.id)}
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
  );

  const renderAdminHistory = () => (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-5">
        <h2 className="text-xl font-semibold text-sky-700">History</h2>
        <p className="mt-1 text-sm text-zinc-500">บันทึกการจองและการยกเลิกทั้งหมด</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] table-auto border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-100 text-left text-xs uppercase tracking-wider text-zinc-600">
              <th className="px-4 py-3">Date time</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Concert name</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reservation) => (
              <tr key={reservation.id} className="border-b border-zinc-100">
                <td className="px-4 py-3 text-zinc-600">{transformToDisplayDate(reservation.created_at)}</td>
                <td className="px-4 py-3 text-zinc-700">{reservation.user.name}</td>
                <td className="px-4 py-3 text-zinc-700">{reservation.concert.name}</td>
                <td className="px-4 py-3 font-semibold text-zinc-700">
                  {reservation.status === 'reserved' ? 'Reserve' : 'Cancel'}
                </td>
              </tr>
            ))}
            {reservations.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-zinc-500" colSpan={4}>
                  ยังไม่มีประวัติการจอง
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderUserHome = () => (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-blue-2">Available Concerts</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {currentUser ? `You are reserving as ${currentUser.name}` : 'No users available'}
          </p>
        </div>
      </header>
      <section className="space-y-4">
        {concerts.map((concert) => {
          const reservation = currentUser === null ? undefined : getReservationForConcert(concert.id, currentUser.id);
          const isReserved = reservation?.status === 'reserved';
          const buttonLabel = isReserved ? 'Cancel' : 'Reserve';
          const buttonStyle = isReserved ? 'bg-red-1 hover:bg-red-2' : 'bg-sky-600 hover:bg-sky-700';
          const onClickHandler = isReserved ? () => cancelReservation(concert.id) : () => reserveSeat(concert.id);

          return (
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
                  className={`flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors sm:w-auto sm:min-w-[160px] ${buttonStyle}`}
                  onClick={onClickHandler}
                  disabled={currentUser === null}
                >
                  {buttonLabel}
                </button>
              </footer>
            </article>
          );
        })}
        {concerts.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No concerts available to reserve
          </p>
        ) : null}
      </section>
    </section>
  );

  const sidebarItems = useMemo(() => {
    if (authUser?.role === 'admin') {
      return activePanel === 'user-home' ? adminUserNavItems : adminNavItems;
    }
    return userNavItems;
  }, [activePanel, authUser]);

  if (authUser === null) {
    return null;
  }

  return (
    <SidebarLayout title={activePanel === 'user-home' ? 'User' : 'Admin'} items={sidebarItems} activeId={activePanel} onSelect={handleNavigation} footerItems={footerItems}>
      {isLoading ? (
        <p className="text-sm text-zinc-500">กำลังโหลดข้อมูล...</p>
      ) : null}
      {feedback ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {renderStatCards()}
      {activePanel === 'admin-home' ? renderAdminOverview() : null}
      {activePanel === 'admin-history' ? renderAdminHistory() : null}
      {activePanel === 'user-home' ? renderUserHome() : null}
    </SidebarLayout>
  );
};

Home.displayName = 'HomePage';

export default Home;
