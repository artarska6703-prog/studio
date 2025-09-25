
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // This is required to allow the Next.js dev server to be accessed from the Firebase Studio preview.
  allowedDevOrigins: ["http://localhost:3000", "https://*.cluster-l6vkdperq5ebaqo3qy4ksvoqom.cloudworkstations.dev"],
  experimental: {
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
