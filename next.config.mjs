import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

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
  // تحديد الـ root لـ Turbopack لتفادي تعارض package-lock.json
  turbopack: {
    root: __dirname,
  },
  // استخدام .next مباشرة بدون متغير بيئة (يتجنب مشكلة Windows absolute paths)
  distDir: ".next",
};

export default nextConfig;
