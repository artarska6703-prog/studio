/** @type {import('next').NextConfig} */
const nextConfig = {
  serverRuntimeConfig: {
    // Will only be available on the server side
    HELIUS_API_KEY: process.env.HELIUS_API_KEY,
  },
  // ✅ Allow Firebase Studio & Cloud Workstations Preview Domains
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://localhost:9000",
    "http://localhost:9001",
    "https://studio.firebase.google.com",
    "https://*.web.app",
    "https://*.firebaseapp.com",
    "https://*.cloudworkstations.dev",
    "https://*.cluster-*.cloudworkstations.dev"
  ],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "clipboard-write=*",
          },
        ],
      },
    ];
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
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;
