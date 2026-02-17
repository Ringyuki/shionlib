import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './pages/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          'var(--font-mono)',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'Monaco',
          'monospace',
        ],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },

        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },

        success: { DEFAULT: 'var(--success)', foreground: 'var(--success-foreground)' },
        warning: { DEFAULT: 'var(--warning)', foreground: 'var(--warning-foreground)' },
        info: { DEFAULT: 'var(--info)', foreground: 'var(--info-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },

        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'content-subtle': '0 4px 20px rgba(0,0,0,0.06)',
        'content-strong': '0 10px 40px rgba(0,0,0,0.10)',
        card: '0 8px 24px rgba(0,0,0,0.08)',
        'card-hover': '0 12px 32px rgba(0,0,0,0.12)',
        'card-hero': '0 16px 60px rgba(0,0,0,0.14)',
      },
      keyframes: {
        'mobile-nav-in': {
          '0%': {
            opacity: '0',
            transform: 'scaleY(0.95)',
          },
          '100%': {
            opacity: '1',
            transform: 'scaleY(1)',
          },
        },
        'mobile-nav-out': {
          '0%': {
            opacity: '1',
            transform: 'scaleY(1)',
          },
          '100%': {
            opacity: '0',
            transform: 'scaleY(0.95)',
          },
        },
        'nav-item-in': {
          '0%': {
            opacity: '0',
            transform: 'translateX(-12px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
      },
      animation: {
        'mobile-nav-in': 'mobile-nav-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'mobile-nav-out': 'mobile-nav-out 0.25s cubic-bezier(0.4, 0, 1, 1)',
        'nav-item-in': 'nav-item-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config
