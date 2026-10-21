interface PebbleLoaderProps {
  message: string;
  detail?: string;
  compact?: boolean;
}

export function PebbleLoader({ message, detail, compact = false }: PebbleLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center text-center ${compact ? 'gap-2' : 'gap-4'}`}
    >
      <div className={`relative flex items-center justify-center ${compact ? 'h-14 w-14' : 'h-24 w-24'}`}>
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-fuchsia-400/40 to-cyan-400/40 blur-xl pebble-loader-glow" />
        <img
          src="/leadpebble-logo.png"
          alt=""
          aria-hidden="true"
          className={`relative z-10 object-contain pebble-loader-float ${compact ? 'h-11 w-11' : 'h-20 w-20'}`}
        />
      </div>
      <div className="space-y-1">
        <p className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-slate-700 dark:text-slate-200`}>
          {message}
        </p>
        {detail && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {detail}
          </p>
        )}
      </div>
      <div aria-hidden="true" className="flex items-center gap-1.5">
        <span className="pebble-loader-dot h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
        <span className="pebble-loader-dot h-1.5 w-1.5 rounded-full bg-indigo-400 [animation-delay:150ms]" />
        <span className="pebble-loader-dot h-1.5 w-1.5 rounded-full bg-cyan-400 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
