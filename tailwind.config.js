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
        primary: '#a8d600',
        'lime-glow': '#ccff00',
        bg: '#1c1f26',
        card: '#232730',
        dark: '#16181f',
        slate: '#272b35',
        fg: '#fafafa',
        muted: '#313540',
        'muted-fg': '#8f95a3',
        border: '#383c47',
        destructive: '#ff5f1f',
      },
    },
  },
  plugins: [],
}
