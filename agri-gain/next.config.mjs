/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // Suppress punycode deprecation warnings
    config.ignoreWarnings = [
      { message: /punycode/ },
    ];
    return config;
  },
}

export default nextConfig
