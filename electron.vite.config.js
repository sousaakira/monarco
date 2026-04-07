import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  main: {
    // Main process entry point
    build: {
      lib: {
        entry: 'electron/main.js',
        formats: ['cjs']
      },
      // Don't externalize dependencies for Electron main process
      externalizeDeps: {
        exclude: [
          'node-pty', // Terminal emulation library
          'fs-extra', // File system utilities
          'marked'    // Markdown parser
        ]
      }
    }
  },
  preload: {
    // Preload script configuration
    build: {
      lib: {
        entry: 'electron/preload.js',
        formats: ['cjs']
      },
      // Preload scripts should bundle all dependencies
      externalizeDeps: true
    }
  },
  renderer: {
    // Renderer process configuration (Vue app)
    root: '.',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: 'index.html'
      }
    },
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag === 'webview'
          }
        }
      }),
      viteStaticCopy({
        targets: [
          {
            src: 'assets/icons/*',
            dest: 'icons'
          }
        ]
      })
    ],
    server: {
      port: 5175,
      strictPort: true
    }
  }
})
