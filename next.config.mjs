/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  outputFileTracingIncludes: {
    '/api/**': ['./hvac_data.db'],
  },
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
