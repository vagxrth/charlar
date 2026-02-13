import { ConnectionStatus } from "./_components/connection-status";
import { RoomForm } from "./_components/room-form";

export default function Page() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-16">
      <div className="flex w-full flex-col items-center gap-10">
        {/* ── Header ──────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            charlar
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Connect. Chat. Call.
          </p>
          <ConnectionStatus />
        </div>

        {/* ── Actions ─────────────────────────────── */}
        <RoomForm />
      </div>
    </main>
  );
}
