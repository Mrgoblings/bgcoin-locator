import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    allowedHosts: ['bgcoins.momchev.dev'],
  },
});
