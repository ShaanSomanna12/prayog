/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Background system ────────────────────────────────────────────────
        canvas:   '#080a0d',
        surface:  '#0f1114',
        elevated: '#13161a',
        overlay:  '#1a1d22',
        // ── Borders ──────────────────────────────────────────────────────────
        rim:      'rgba(255,255,255,0.07)',
        'rim-strong': 'rgba(255,255,255,0.14)',
        // ── Typography ───────────────────────────────────────────────────────
        ink:      '#eceef1',
        'ink-2':  '#9ba3b2',
        'ink-3':  '#5a6070',
        // ── Brand / accent ───────────────────────────────────────────────────
        brand:    '#3b82f6',         // blue-500
        'brand-dim': 'rgba(59,130,246,0.15)',
        // ── Status semantics ─────────────────────────────────────────────────
        ok:       '#22c55e',         // green-500
        'ok-dim': 'rgba(34,197,94,0.12)',
        warn:     '#f59e0b',         // amber-500
        'warn-dim': 'rgba(245,158,11,0.12)',
        danger:   '#ef4444',         // red-500
        'danger-dim': 'rgba(239,68,68,0.12)',
        idle:     '#38bdf8',         // sky-400
        'idle-dim': 'rgba(56,189,248,0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'Cascadia Code', 'Roboto Mono', 'Menlo', 'monospace'],
      },
      keyframes: {
        // Card-level flash for confirmed failure
        cardFlash: {
          '0%, 100%': { borderColor: 'rgba(239,68,68,0.9)', boxShadow: '0 0 0 0 rgba(239,68,68,0.5)' },
          '50%':      { borderColor: 'rgba(239,68,68,0.3)', boxShadow: '0 0 0 8px rgba(239,68,68,0)' },
        },
        // Status dot pulse
        ping: {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
        // Reconnection shimmer
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // Fade-in for new cards / anomaly overlay
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        // Spin for reconnecting indicator
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'card-flash':    'cardFlash 1.4s ease-in-out infinite',
        'ping':          'ping 1s cubic-bezier(0,0,0.2,1) infinite',
        'shimmer':       'shimmer 1.6s linear infinite',
        'fade-up':       'fadeUp 240ms cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in':       'fadeIn 180ms ease forwards',
        'spin':          'spin 700ms linear infinite',
      },
    },
  },
  plugins: [],
};

