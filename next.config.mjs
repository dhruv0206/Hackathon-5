/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    outputFileTracingIncludes: {
      '/api/projects': ['./hvac_data.db'],
      '/api/stats': ['./hvac_data.db'],
      '/api/chat': ['./hvac_data.db'],
    },
  },
  outputFileTracingIncludes: {
    '/api/projects': ['./hvac_data.db'],
    '/api/stats': ['./hvac_data.db'],
    '/api/chat': ['./hvac_data.db'],
  },
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
