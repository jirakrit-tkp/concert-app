'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type LoginResponse = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001') + '/api';

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      router.replace('/');
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid email or password');
      }

      const data: LoginResponse = await response.json();
      localStorage.setItem('authUser', JSON.stringify(data));
      router.replace('/');
    } catch (err) {
      console.error('Login failed', err);
      setError('Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-zinc-800">Concert Reservation</h1>
          <p className="mt-2 text-sm text-zinc-500">Sign in to continue</p>
        </header>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="flex flex-col text-sm font-medium text-zinc-700">
            Email
            <input
              className="mt-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-zinc-700">
            Password
            <input
              className="mt-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>
          {error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
};

LoginPage.displayName = 'LoginPage';

export default LoginPage;

