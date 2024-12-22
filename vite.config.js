import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
        define: {
            'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
            'process.env.OPENAI_ASSISTANT_ID': JSON.stringify(env.OPENAI_ASSISTANT_ID)
        },
        optimizeDeps: {
            include: ['pdfjs-dist']
        },
        build: {
            rollupOptions: {
                input: {
                    main: resolve(__dirname, 'index.html'),
                },
                output: {
                    manualChunks: {
                        pdf: ['pdfjs-dist']
                    }
                }
            }
        },
        server: {
            headers: {
                'Cross-Origin-Embedder-Policy': 'require-corp',
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Resource-Policy': 'cross-origin'
            }
        },
        publicDir: 'public'
    };
}); 