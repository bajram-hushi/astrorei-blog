import { loginWithAstrorei, loginWithGoogle, signUpAstrorei } from "./actions";

type Props = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Astrorei Internal Blog</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Login is allowed only with Google or @astrorei.io credentials.
        </p>

        {params.error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Error: {params.error}
          </p>
        )}

        {params.message && (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {params.message}
          </p>
        )}

        <form action={loginWithGoogle} className="mt-5">
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700"
          >
            Continue with Google
          </button>
        </form>

        <div className="my-6 h-px bg-zinc-200" />

        <form action={loginWithAstrorei} className="space-y-3">
          <h2 className="text-sm font-semibold">Sign in with Astrorei account</h2>
          <input
            name="email"
            type="email"
            required
            placeholder="name@astrorei.io"
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
          <button
            type="submit"
            className="w-full rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-100"
          >
            Login with Astrorei account
          </button>
        </form>

        <form action={signUpAstrorei} className="mt-4 space-y-3">
          <h2 className="text-sm font-semibold">Create Astrorei account</h2>
          <input
            name="email"
            type="email"
            required
            placeholder="name@astrorei.io"
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Minimum 8 characters"
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
          <button
            type="submit"
            className="w-full rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-100"
          >
            Sign up with Astrorei account
          </button>
        </form>
      </div>
    </main>
  );
}
