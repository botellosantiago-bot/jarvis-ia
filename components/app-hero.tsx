import type { ReactNode } from "react";
import { Aurora } from "@/components/aurora";
import { Nav } from "@/components/nav";

export function AppHero({
  eyebrow,
  title,
  description,
  current,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  current: string;
}) {
  return (
    <header className="relative px-4 pt-8 pb-24 sm:px-6 sm:pt-14 sm:pb-28">
      <div className="pointer-events-none absolute inset-0 isolate overflow-hidden" aria-hidden>
        <Aurora />
      </div>
      <div className="relative mx-auto w-full max-w-6xl">
        <div className="flex justify-end">
          <Nav current={current} />
        </div>
        <div className="mt-5 max-w-3xl sm:mt-7">
          <p className="label-caps text-[10px] font-medium text-text-muted first-letter:uppercase">
            {eyebrow}
          </p>
          <h1 className="display mt-2 text-balance text-4xl font-semibold sm:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-text-muted sm:text-base">
              {description}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
