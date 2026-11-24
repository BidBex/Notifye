import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

interface AuthViewProps {
  onSignIn: () => Promise<void>;
  error: string | null;
  busy: boolean;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSignIn, error, busy }) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen bg-[#0B0B0F] text-[#F5F5F7] flex flex-col overflow-hidden">
      {/* Animated Ambient Backdrop */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Primary warm amber drifting glow */}
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  x: ['-6%', '8%', '-4%'],
                  y: ['-8%', '6%', '-6%'],
                  scale: [1, 1.16, 0.96],
                  opacity: [0.22, 0.36, 0.22],
                }
          }
          transition={{ duration: 14, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(245,158,11,0.28) 0%, rgba(245,158,11,0.08) 45%, transparent 72%)',
          }}
        />

        {/* Secondary cool-rose/amber counter-drift aura */}
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  x: ['10%', '-8%', '10%'],
                  y: ['8%', '-10%', '8%'],
                  scale: [1.05, 0.92, 1.12],
                  opacity: [0.14, 0.26, 0.14],
                }
          }
          transition={{ duration: 18, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[26rem] h-[26rem] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(251,191,36,0.22) 0%, rgba(251,113,133,0.08) 50%, transparent 75%)',
          }}
        />

        {/* Subtle breathing orbital rings */}
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  scale: [0.96, 1.05, 0.96],
                  rotate: [0, 180, 360],
                  opacity: [0.14, 0.28, 0.14],
                }
          }
          transition={{
            scale: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
            opacity: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
            rotate: { duration: 48, repeat: Infinity, ease: 'linear' },
          }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[22rem] h-[22rem] sm:w-[28rem] sm:h-[28rem] rounded-full border border-amber-400/15"
        />
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  scale: [1.04, 0.94, 1.04],
                  rotate: [360, 180, 0],
                  opacity: [0.08, 0.2, 0.08],
                }
          }
          transition={{
            scale: { duration: 12, repeat: Infinity, ease: 'easeInOut' },
            opacity: { duration: 12, repeat: Infinity, ease: 'easeInOut' },
            rotate: { duration: 64, repeat: Infinity, ease: 'linear' },
          }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] sm:w-[38rem] sm:h-[38rem] rounded-full border border-white/[0.06]"
        />
      </div>

      <motion.header
        initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-8"
      >
        <span className="font-display text-xl font-medium tracking-tight text-zinc-100 whitespace-nowrap shrink-0">
          Notifye
        </span>
      </motion.header>

      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-5 py-8 flex items-center justify-center">
        <div className="w-full max-w-sm mx-auto text-center space-y-6">
          <motion.p
            initial={prefersReducedMotion ? { opacity: 0.32 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 0.32, y: 0 }}
            transition={{ duration: 0.95, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="text-xs sm:text-sm font-normal tracking-wide text-zinc-100 select-none"
          >
            Aplicatie de la mine pentru tine
          </motion.p>

          {error && (
            <motion.div
              role="alert"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-200 text-left"
            >
              {error}
            </motion.div>
          )}

          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.button
              type="button"
              whileHover={prefersReducedMotion || busy ? undefined : { scale: 1.015 }}
              whileTap={prefersReducedMotion || busy ? undefined : { scale: 0.98 }}
              onClick={() => void onSignIn()}
              disabled={busy}
              className="relative overflow-hidden w-full min-h-[48px] px-6 py-3 rounded-xl bg-amber-500 text-[#0B0B0F] font-semibold text-sm flex items-center justify-center gap-2.5 hover:bg-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shadow-[0_12px_36px_rgba(245,158,11,0.22)]"
            >
              {!prefersReducedMotion && !busy && (
                <motion.span
                  aria-hidden="true"
                  initial={{ x: '-120%' }}
                  animate={{ x: '220%' }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    repeatDelay: 3.5,
                    ease: 'easeInOut',
                  }}
                  className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-18deg]"
                />
              )}
              <svg className="relative z-10 w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.98h5.27c-.45 2.38-2.54 4.02-5.27 4.02a5.88 5.88 0 1 1 3.86-10.31l2.22-2.22A9 9 0 1 0 12.18 21c4.96 0 8.82-3.48 8.82-8.82c0-.37-.04-.73-.1-1.08Z"
                />
              </svg>
              <span className="relative z-10">{busy ? 'Signing in...' : 'Continue with Google'}</span>
              {!busy && <ArrowRight className="relative z-10 w-4 h-4 shrink-0" />}
            </motion.button>
          </motion.div>
        </div>
      </main>
    </div>
  );
};
