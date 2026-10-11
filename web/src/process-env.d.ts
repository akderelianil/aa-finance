// Registry components read process.env.NODE_ENV; Vite replaces it at build time.
declare const process: { env: { NODE_ENV?: string } }
