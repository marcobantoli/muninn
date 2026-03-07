import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
    plugins: [
        react(),
        electron([
            {
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        rollupOptions: {
                            external: ['express', 'cors', 'electron', 'path', 'fs', 'crypto']
                        }
                    }
                }
            },
            {
                entry: 'electron/preload.ts',
                onstart(options) {
                    options.reload();
                },
                vite: {
                    build: {
                        outDir: 'dist-electron'
                    }
                }
            }
        ]),
        electronRenderer()
    ],
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, 'shared'),
            '@frontend': path.resolve(__dirname, 'frontend')
        }
    },
    root: '.',
    build: {
        outDir: 'dist'
    }
});
