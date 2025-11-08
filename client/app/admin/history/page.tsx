'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { House, Inbox, LogOut, RefreshCcw } from 'lucide-react';
import SidebarLayout, { SidebarItem } from '../../components/SidebarLayout';
import { API_BASE_URL } from '../../config';
import type { AppUser, Reservation } from '../../types/api';

const transformToDisplayDate = (input: string) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleString();
};

const AdminHistoryPage = () => {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
    localStorage.removeItem('authUser');
    setAuthUser(null);
    setReservations([]);
    router.replace('/login');
  }, [router]);

  const handleError = useCallback((message: string, err: unknown) => {
    console.error(message, err);
    setError(message);
  }, []);

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

  useEffect(() => {
    if (authUser === null) {
      return;
    }

    setIsLoading(true);
    fetchReservations()
      .catch((err) => console.error('Initial load error', err))
      .finally(() => setIsLoading(false));
  }, [authUser, fetchReservations]);

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

      if (id === 'admin-home') {
        router.push('/admin');
        return;
      }

      if (id === 'user-home') {
        router.push('/');
      }
    },
    [handleLogout, router],
  );

  if (authUser === null) {
    return null;
  }

  return (
    <SidebarLayout title="Admin" items={sidebarItems} activeId="admin-history" onSelect={handleNavigation} footerItems={footerItems}>
      {isLoading ? (
        <p className="text-sm text-zinc-500">กำลังโหลดข้อมูล...</p>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
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
    </SidebarLayout>
  );
};

AdminHistoryPage.displayName = 'AdminHistoryPage';

export default AdminHistoryPage;

