import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
        define: {
            'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
            'process.env.OPENAI_ASSISTANT_ID': JSON.stringify(env.OPENAI_ASSISTANT_ID)
        },
        resolve: {
            alias: {
                'pdfjs-dist': resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.js'),
            },
        },
        optimizeDeps: {
            include: ['pdfjs-dist'],
        },
        build: {
            rollupOptions: {
                external: ['/pdf.worker.min.js']
            }
        },
        server: {
            fs: {
                strict: false
            }
        }
    };
}); 