import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
// `vitest/config` re-exports defineConfig with the `test` field typed; importing
// it from `vite` makes `vue-tsc` reject the config as an unknown property.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    vue(),
    // Element Plus on demand *for JavaScript*: only the components actually
    // used in templates get pulled in (~90 KB vs ~340 KB for the full barrel).
    // Styles stay on the single full stylesheet imported in main.ts, because
    // `ElMessage`/`ElMessageBox` are called imperatively — the resolver cannot
    // see those call sites and their styles would silently go missing.
    AutoImport({ resolvers: [ElementPlusResolver()], dts: 'src/auto-imports.d.ts' }),
    Components({ resolvers: [ElementPlusResolver()], dts: 'src/components.d.ts' }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // With on-demand imports the dep optimizer only discovers an Element Plus
  // style sheet when a page using it is first visited — each discovery triggers
  // a mid-session re-optimization and a full page reload. Declaring them all
  // here makes the pre-bundle complete on server start: no surprise reloads,
  // no half-written caches.
  optimizeDeps: {
    include: [
      'element-plus/es/components/base/style/css',
      'element-plus/es/components/alert/style/css',
      'element-plus/es/components/button/style/css',
      'element-plus/es/components/checkbox/style/css',
      'element-plus/es/components/config-provider/style/css',
      'element-plus/es/components/date-picker/style/css',
      'element-plus/es/components/drawer/style/css',
      'element-plus/es/components/dropdown/style/css',
      'element-plus/es/components/dropdown-item/style/css',
      'element-plus/es/components/dropdown-menu/style/css',
      'element-plus/es/components/form/style/css',
      'element-plus/es/components/form-item/style/css',
      'element-plus/es/components/icon/style/css',
      'element-plus/es/components/input/style/css',
      'element-plus/es/components/input-number/style/css',
      'element-plus/es/components/loading/style/css',
      'element-plus/es/components/message/style/css',
      'element-plus/es/components/message-box/style/css',
      'element-plus/es/components/option/style/css',
      'element-plus/es/components/pagination/style/css',
      'element-plus/es/components/radio-button/style/css',
      'element-plus/es/components/radio-group/style/css',
      'element-plus/es/components/result/style/css',
      'element-plus/es/components/select/style/css',
      'element-plus/es/components/skeleton/style/css',
      'element-plus/es/components/table/style/css',
      'element-plus/es/components/table-column/style/css',
      'element-plus/es/components/tag/style/css',
      'element-plus/es/components/timeline/style/css',
      'element-plus/es/components/timeline-item/style/css',
      'element-plus/es/components/tooltip/style/css',
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false, // Disable sourcemap generation for production
    // Warn early instead of discovering a 2 MB bundle on deploy day.
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        manualChunks: {
          // ECharts is ~300 KB by itself and only two routes need it; keeping it
          // in its own chunk means other routes never download it.
          echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          vendor: ['vue', 'vue-router', 'pinia', 'axios', 'dayjs'],
          // NOTE: deliberately NO 'element-plus' entry here. Keying the chunk on
          // the bare package name forces the full barrel into the graph and
          // defeats the on-demand resolver (832 KB vs ~120 KB for what we use).
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
