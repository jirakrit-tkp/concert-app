'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../config';

const RegisterPage = () => {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setError(null);
  }, [name, email, password, confirmPassword]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Unable to register. Please try again.');
      }

      await response.json();
      router.replace('/login?registered=1');
    } catch (err) {
      console.error('Registration failed', err);
      setError('Registration failed. Please check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-zinc-800">Create your account</h1>
          <p className="mt-2 text-sm text-zinc-500">Join the concert booking community</p>
        </header>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="flex flex-col text-sm font-medium text-zinc-700">
            Full name
            <input
              className="mt-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
              required
            />
          </label>
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
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-zinc-700">
            Confirm password
            <input
              className="mt-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
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
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
          <p className="text-center text-sm text-zinc-600">
            Already have an account?{' '}
            <Link className="font-semibold text-sky-600 hover:text-sky-700" href="/login">
              Sign in
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
};

RegisterPage.displayName = 'RegisterPage';

export default RegisterPage;

