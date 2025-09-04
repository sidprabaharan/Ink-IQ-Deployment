import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.VITE_SS_LOCAL_PROXY': JSON.stringify('http://localhost:8081'),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://eqdlaagjaikxdrkgvopn.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxZGxhYWdqYWlreGRya2d2b3BuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwOTUzOTMsImV4cCI6MjA3MDY3MTM5M30.DJO65QOnz7DRyUNmlyXa0wDqE5swy160Tkb_xINAsFE'),
  },
  server: {
    host: "localhost",
    port: 8080,
    strictPort: true,
    hmr: {
      host: "localhost",
      protocol: "ws",
      port: 8080,
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
