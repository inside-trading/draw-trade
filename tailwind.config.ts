import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: '#3b82f6',
        secondary: '#1e293b',
        accent: '#10b981',
        'chart-bg': '#0f172a',
        'chart-grid': '#1e293b',
        'prediction-line': '#f59e0b',
        'average-line': '#6b7280',
      },
    },
  },
  plugins: [],
}
export default config
