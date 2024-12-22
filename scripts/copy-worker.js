import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konkretna ścieżka dla wersji 3.11.174
const possiblePaths = [
    '../node_modules/pdfjs-dist/build/pdf.worker.js',
    '../node_modules/pdfjs-dist/build/pdf.worker.min.js'
];

const targetDir = path.resolve(__dirname, '../public');
const targetFile = path.resolve(targetDir, 'pdf.worker.min.js');

async function findWorkerFile() {
    for (const workerPath of possiblePaths) {
        const fullPath = path.resolve(__dirname, workerPath);
        console.log('Sprawdzanie ścieżki:', fullPath);
        if (await fs.pathExists(fullPath)) {
            console.log('Znaleziono plik workera w:', fullPath);
            return fullPath;
        }
    }
    return null;
}

async function copyWorker() {
    try {
        // Znajdź plik workera
        const sourceFile = await findWorkerFile();
        if (!sourceFile) {
            throw new Error('Nie znaleziono pliku workera w żadnej z możliwych lokalizacji');
        }

        // Upewnij się, że katalog public istnieje
        await fs.ensureDir(targetDir);
        
        // Skopiuj plik workera
        await fs.copy(sourceFile, targetFile);
        
        console.log('Worker został pomyślnie skopiowany do katalogu public');
    } catch (error) {
        console.error('Błąd podczas kopiowania workera:', error);
        process.exit(1);
    }
}

copyWorker(); 