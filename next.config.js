/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enforce React strict mode to catch side effects in development.
  reactStrictMode: true,
  // Since this app is entirely client‑side and relies on browser APIs (e.g. maplibre),
  // disable static export warning. The pages router will hydrate on the client.
  trailingSlash: false,
};

module.exports = nextConfig;