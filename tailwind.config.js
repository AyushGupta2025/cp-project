/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#0a0f1c', // Deep space dark mode
        },
        emerald: {
          400: '#34d399', // Free slots
        },
        rose: {
          500: '#f43f5e', // Occupied
        },
        amber: {
          500: '#f59e0b', // Hardware warnings
        }
      },
      boxShadow: {
        'glow-emerald': '0 0 10px rgba(52, 211, 153, 0.5)',
        'glow-rose': '0 0 20px -5px rgba(244, 63, 94, 0.4)',
        'glow-amber': '0 0 20px -5px rgba(245, 158, 11, 0.4)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }
    },
  },
  plugins: [],
}
