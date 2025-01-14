import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0
import path from 'path';

// Vite configuration for MyElixir healthcare data marketplace frontend
export default defineConfig({
  plugins: [
    // React plugin with healthcare-optimized settings
    react({
      fastRefresh: true,
      jsxRuntime: 'automatic',
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          '@babel/plugin-proposal-class-properties'
        ]
      }
    }),
    // TypeScript path resolution for healthcare domain modules
    tsconfigPaths({
      loose: false
    })
  ],

  // Development server configuration with HIPAA-compliant settings
  server: {
    port: 3000,
    host: true,
    https: {
      enabled: true,
      cert: './certs/localhost.crt',
      key: './certs/localhost.key'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        ws: true,
        headers: {
          'Connection': 'keep-alive'
        }
      }
    },
    cors: true,
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    }
  },

  // Production build optimization for healthcare data modules
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: true,
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          healthcare: ['@medplum/core', '@medplum/react']
        }
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },

  // Path aliases for healthcare domain organization
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@config': path.resolve(__dirname, './src/config'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@interfaces': path.resolve(__dirname, './src/interfaces'),
      '@types': path.resolve(__dirname, './src/types'),
      '@fhir': path.resolve(__dirname, './src/fhir'),
      '@security': path.resolve(__dirname, './src/security'),
      '@compliance': path.resolve(__dirname, './src/compliance')
    }
  },

  // SCSS preprocessing configuration
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @import "@/styles/utils/_variables.scss";
          @import "@/styles/utils/_mixins.scss";
        `
      }
    },
    modules: {
      localsConvention: 'camelCase'
    }
  },

  // Test environment configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/']
    }
  },

  // Environment variables and constants
  define: {
    __MEDPLUM_API_URL__: 'JSON.stringify(process.env.MEDPLUM_API_URL)',
    __APP_VERSION__: 'JSON.stringify(process.env.npm_package_version)',
    __HIPAA_COMPLIANCE_MODE__: 'JSON.stringify(process.env.NODE_ENV === "production")'
  },

  // Optimization settings for healthcare data processing
  optimizeDeps: {
    include: ['@medplum/core', '@medplum/react'],
    exclude: ['@medplum/mock']
  },

  // Performance monitoring for healthcare data operations
  esbuild: {
    jsxInject: `import React from 'react'`,
    legalComments: 'none',
    treeShaking: true
  }
});