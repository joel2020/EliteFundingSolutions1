/** @type {import('next').NextConfig} */
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';
const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])].join(' ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests` },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  images: { unoptimized: true },
  outputFileTracingRoot: path.join(__dirname),
  webpack(config, { isServer }) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        '@napi-rs/canvas',
      ];
    }
    return config;
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/:all*(png|jpg|jpeg|gif|svg|webp|ico)', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }] },
    ];
  },
};
module.exports = nextConfig;
