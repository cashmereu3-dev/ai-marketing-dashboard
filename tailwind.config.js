/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(var(--primary))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: 'hsl(var(--surface))',
        accent: 'hsl(var(--accent))',
        glass: 'rgba(255,255,255,0.1)'
      },
      borderRadius: {
        lg: 'var(--radius)'
      },
      boxShadow: {
        glow: '0 0 20px rgba(255,255,255,.1)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
