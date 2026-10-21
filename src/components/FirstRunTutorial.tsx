import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, MousePointer2, X } from 'lucide-react';

interface TutorialStep {
  target: string;
  title: string;
  description: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: 'navigation',
    title: 'Your workspace navigation',
    description: 'Open the company directory, dashboard, map, CRM, outreach tools, and account settings from here.',
  },
  {
    target: 'location',
    title: 'Choose your search location',
    description: 'Use device location or select a saved city. You can change the location at any time.',
  },
  {
    target: 'location-search',
    title: 'Search any city or area',
    description: 'Enter another city or neighborhood, then search to find companies there.',
  },
  {
    target: 'categories',
    title: 'Narrow the business type',
    description: 'Pick a category or use the custom business-type search for the companies you need.',
  },
  {
    target: 'company-results',
    title: 'Review real company listings',
    description: 'Open a company to see the details and source links available from Google Places. Unavailable details stay unknown.',
  },
];

interface FirstRunTutorialProps {
  onComplete: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function FirstRunTutorial({ onComplete }: FirstRunTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const step = TUTORIAL_STEPS[stepIndex];

  useEffect(() => {
    const updatePosition = () => {
      const target = [...document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)]
        .find((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      if (!target) {
        setTargetRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [step.target]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onComplete();
      if (event.key === 'ArrowRight') setStepIndex((current) => Math.min(current + 1, TUTORIAL_STEPS.length - 1));
      if (event.key === 'ArrowLeft') setStepIndex((current) => Math.max(current - 1, 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  const cardStyle: CSSProperties = {};
  if (targetRect) {
    const cardWidth = Math.min(384, window.innerWidth - 32);
    const left = Math.max(16, Math.min(
      targetRect.left + targetRect.width / 2 - cardWidth / 2,
      window.innerWidth - cardWidth - 16
    ));
    const measuredHeight = cardRef.current?.offsetHeight || 230;
    const below = targetRect.top + targetRect.height + 16 + measuredHeight < window.innerHeight;
    cardStyle.left = `${left}px`;
    cardStyle.top = below
      ? `${targetRect.top + targetRect.height + 16}px`
      : `${Math.max(16, targetRect.top - measuredHeight - 16)}px`;
  } else {
    cardStyle.left = '50%';
    cardStyle.top = '50%';
    cardStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <div className="fixed inset-0 z-[1000]" aria-label="LeadPebble first-time tutorial">
      <div className="pointer-events-none fixed inset-0 bg-slate-950/60" />
      {targetRect && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[1001] rounded-xl ring-2 ring-cyan-300 shadow-[0_0_0_9999px_rgba(2,6,23,0.62)] transition-all duration-300"
            style={{
              top: targetRect.top - 5,
              left: targetRect.left - 5,
              width: targetRect.width + 10,
              height: targetRect.height + 10,
            }}
          />
          <MousePointer2
            aria-hidden="true"
            className="tutorial-pointer pointer-events-none fixed z-[1002] h-7 w-7 fill-cyan-300 text-slate-950 drop-shadow-lg"
            style={{
              top: Math.min(targetRect.top + targetRect.height / 2, window.innerHeight - 36),
              left: Math.min(targetRect.left + targetRect.width / 2, window.innerWidth - 36),
            }}
          />
        </>
      )}

      <section
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-tutorial-title"
        className="fixed z-[1003] w-[min(384px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl shadow-slate-950/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-300">
            Quick tour · {stepIndex + 1} of {TUTORIAL_STEPS.length}
          </p>
          <button
            type="button"
            onClick={onComplete}
            aria-label="Skip tutorial"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="first-run-tutorial-title" className="mt-2 text-lg font-semibold tracking-tight">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onComplete}
            className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((current) => current - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (stepIndex === TUTORIAL_STEPS.length - 1) onComplete();
                else setStepIndex((current) => current + 1);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {stepIndex === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next'}
              {stepIndex !== TUTORIAL_STEPS.length - 1 && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
