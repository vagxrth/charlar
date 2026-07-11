import { CharlarMark } from "./_components/logo";
import { RoomForm } from "./_components/room-form";

export default function Page() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center px-5 py-16">
      <div className="bg-mesh" aria-hidden="true" />
      <div className="bg-grain" aria-hidden="true" />

      <div className="flex w-full max-w-md flex-col items-center gap-6 animate-fade-in">
        {/* Header */}
        <header className="flex flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-4 animate-shimmer-in">
            <CharlarMark
              size={50}
              decorative
              className="translate-y-[3px]"
            />
            <h1
              className="text-display text-6xl leading-none sm:text-7xl"
              style={{
                color: "var(--foreground)",
                fontWeight: 300,
              }}
            >
              charlar
            </h1>
          </div>
        </header>

        {/* Form */}
        <RoomForm />
      </div>
    </main>
  );
}
