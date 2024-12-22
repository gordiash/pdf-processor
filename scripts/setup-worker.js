import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setupWorker() {
    const workerSrc = path.resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.js');
    const publicDir = path.resolve(__dirname, '../public');
    const workerDest = path.resolve(publicDir, 'pdf.worker.min.js');

    try {
        await fs.ensureDir(publicDir);
        await fs.copy(workerSrc, workerDest);
        console.log('Worker skopiowany pomyślnie');
    } catch (error) {
        console.error('Błąd kopiowania workera:', error);
        process.exit(1);
    }
}

setupWorker(); 