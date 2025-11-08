'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { House, LogOut, RefreshCcw, User } from 'lucide-react';
import SidebarLayout, { SidebarItem } from './components/SidebarLayout';
import { API_BASE_URL } from './config';
import type { AppUser, Concert, Reservation } from './types/api';
import Snackbar from './components/Snackbar';

const UserHomePage = () => {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  const currentUser = authUser;

  const getReservationForConcert = useCallback(
    (concertId: number, userId: number) =>
      reservations.find(
        (reservation) => reservation.concert.id === concertId && reservation.user.id === userId,
      ),
    [reservations],
  );

  const reserveSeat = useCallback(
    async (concertId: number) => {
      if (currentUser === null) {
        setError('Please sign in again to reserve a seat');
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
          setFeedback('You already reserved a seat for this concert');
          return;
        }

        setFeedback('Seat reserved successfully');
        await refreshConcertsAndReservations();
      } catch (err) {
        handleError('Unable to reserve seat', err);
      }
    },
    [clearStatusMessages, currentUser, getReservationForConcert, handleError, refreshConcertsAndReservations],
  );

  const cancelReservation = useCallback(
    async (concertId: number) => {
      if (currentUser === null) {
        setError('Please sign in again to cancel a reservation');
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
    [clearStatusMessages, currentUser, getReservationForConcert, handleError, refreshConcertsAndReservations],
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

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    if (!authUser) {
      return [];
    }

    const items: SidebarItem[] = [
      { id: 'user-home', label: 'Home', icon: <House size={16} aria-hidden="true" /> },
    ];

    if (authUser.role === 'admin') {
      items.push({ id: 'admin-home', label: 'Switch to Admin', icon: <RefreshCcw size={16} aria-hidden="true" /> });
    }

    return items;
  }, [authUser]);

  const handleNavigation = useCallback(
    (id: string) => {
      if (id === 'logout') {
        handleLogout();
        return;
      }

      if (id === 'admin-home') {
        router.push('/admin');
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
    <SidebarLayout title="User" items={sidebarItems} activeId="user-home" onSelect={handleNavigation} footerItems={footerItems}>
      {isLoading ? (
        <p className="text-sm text-zinc-500">กำลังโหลดข้อมูล...</p>
      ) : null}
      <section className="space-y-6">
        <section className="space-y-4">
          {[...concerts]
            .sort((concertA, concertB) => {
              const isSoldOutA = concertA.available_seats <= 0 ? 1 : 0;
              const isSoldOutB = concertB.available_seats <= 0 ? 1 : 0;

              if (isSoldOutA !== isSoldOutB) {
                return isSoldOutA - isSoldOutB;
              }

              return concertA.id - concertB.id;
            })
            .map((concert) => {
            const reservation = currentUser === null ? undefined : getReservationForConcert(concert.id, currentUser.id);
            const isReserved = reservation?.status === 'reserved';
            const isSoldOut = concert.available_seats <= 0;
            const buttonLabel = isReserved ? 'Cancel' : 'Reserve';
            const buttonStyle = isReserved
              ? 'bg-red-1 text-white hover:bg-red-2'
              : isSoldOut
                ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                : 'bg-sky-600 text-white hover:bg-sky-700';
            const handleButtonClick = () => {
              if (isReserved) {
                cancelReservation(concert.id);
                return;
              }
              if (isSoldOut) {
                return;
              }
              reserveSeat(concert.id);
            };
            const isDisabled = currentUser === null || (!isReserved && isSoldOut);

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
                    className={`flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:w-auto sm:min-w-[160px] ${buttonStyle}`}
                    onClick={handleButtonClick}
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
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
      <Snackbar message={feedback} tone="success" onDismiss={clearStatusMessages} />
      <Snackbar message={error} tone="danger" onDismiss={clearStatusMessages} />
    </SidebarLayout>
  );
};

UserHomePage.displayName = 'UserHomePage';

export default UserHomePage;
