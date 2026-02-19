import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white shadow-sm p-6 text-center">
        <h1 className="text-2xl font-semibold text-[#141414]">Unauthorized</h1>
        <p className="mt-2 text-sm text-black/70">
          You don’t have permission to access this page.
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="px-4 py-2 rounded-xl border border-black/15 hover:bg-black/5 transition"
          >
            Go Home
          </Link>
          <Link
            to="/login"
            className="px-4 py-2 rounded-xl bg-[#B9FF66] border border-black/10 hover:brightness-95 transition"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}