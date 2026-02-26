import { ConnectionStatus } from "./_components/connection-status";
import { RoomForm } from "./_components/room-form";

export default function Page() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-16">
      {/* Soft ambient background glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
      >
        <div
          className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
        />
      </div>

      <div className="flex w-full flex-col items-center gap-12 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <h1
            className="text-4xl font-light tracking-tight sm:text-5xl font-[family-name:var(--font-display)]"
            style={{ color: "var(--foreground)" }}
          >
            charlar
          </h1>
          <p
            className="text-sm tracking-wide"
            style={{ color: "var(--muted)", letterSpacing: "0.12em" }}
          >
            connect &middot; chat &middot; call
          </p>
          <ConnectionStatus />
        </div>

        {/* Form */}
        <RoomForm />
      </div>
    </main>
  );
}
