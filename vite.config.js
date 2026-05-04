import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // ── استراتيجية التسجيل: تلقائي عند تحميل الصفحة ─────────────────────
      registerType: 'autoUpdate',

      // ── ملفات يجب تضمينها في cache مسبقاً (precache) ────────────────────
      includeAssets: ['icons/icon.svg'],

      // ── Web App Manifest ──────────────────────────────────────────────────
      manifest: {
        name: 'مهام اليوم — إنجاز ومتابعة',
        short_name: 'مهام اليوم',
        description: 'تطبيق إدارة المهام اليومية مع مزامنة سحابية ودعم الصلوات',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#1a1209',
        background_color: '#1a1209',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['productivity', 'lifestyle'],
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },

      // ── Workbox: استراتيجيات الـ Cache ───────────────────────────────────
      workbox: {
        // كل الملفات الثابتة تدخل الـ precache
        globPatterns: ['**/*.{js,css,html,svg,ico,woff,woff2}'],

        // لا نُدرج API calls في الـ precache (تُعالَج في runtimeCaching)
        navigateFallback: '/index.html',

        runtimeCaching: [
          // ── Google Fonts: CacheFirst (تتغيّر نادراً) ─────────────────
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Prayer Times API: NetworkFirst مع cache 24 ساعة ────────────
          // إذا انقطع الاتصال، يعطي آخر مواقيت محفوظة
          {
            urlPattern: /^https:\/\/api\.aladhan\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'prayer-times-cache',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 7,          // أسبوع من المواقيت
                maxAgeSeconds: 60 * 60 * 24, // يوم واحد
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Netlify Functions (/api/db): NetworkFirst ─────────────────
          // البيانات حرجة → نفضّل الشبكة دائماً، مع fallback للـ cache
          {
            urlPattern: /\/api\/db.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-db-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24, // يوم واحد كـ fallback
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      // ── خيارات التطوير ────────────────────────────────────────────────────
      devOptions: {
        enabled: false,  // لا نُفعّل SW في dev (لتجنب تعقيد الـ HMR)
      },
    }),
  ],
});
