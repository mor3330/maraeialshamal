/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // منع كاش الـ fetch نهائياً في كل الـ API routes
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
  // استخدام .next مباشرة (بدون OneDrive path issues)
  distDir: ".next",
  // تضمين sync.py في bundle الـ Vercel لخدمته من API
  outputFileTracingIncludes: {
    "/api/pos/agent-update": ["./aronium-sync/sync.py"],
  },
};

export default nextConfig;
