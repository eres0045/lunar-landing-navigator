import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Served from a sub-path on GitHub Pages
  // (eres0045.github.io/lunar-landing-navigator/), so every emitted
  // asset URL is relative. Local preview still works at root.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 2500,
  },
  test: {
    environment: 'jsdom',
    globals: true, // lets @testing-library/react auto-cleanup between tests
    include: ['src/**/*.test.{js,jsx}'],
  },
});
