import { createWorker } from 'tesseract.js';

export class TextProcessor {
    constructor() {
        this.worker = null;
        this.currentLines = [];
        this.currentLineIndex = 0;
    }

    async initializeOCR() {
        if (!this.worker) {
            try {
                this.worker = await createWorker();
                await this.worker.loadLanguage('pol');
                await this.worker.initialize('pol');
                
                // Konfiguracja rozpoznawania
                await this.worker.setParameters({
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyząćęłńóśźżĄĆĘŁŃÓŚŹŻ0123456789.,/-():; ',
                    preserve_interword_spaces: '1'
                });
            } catch (error) {
                console.error('Błąd inicjalizacji OCR:', error);
                throw error;
            }
        }
    }

    async processWithOCR(files) {
        await this.initializeOCR();
        const results = [];

        for (const file of files) {
            try {
                if (file.type === 'application/pdf') {
                    const pages = await this.convertPDFToImages(file);
                    for (let i = 0; i < pages.length; i++) {
                        const { data: { text, confidence } } = await this.worker.recognize(pages[i]);
                        results.push({
                            text,
                            confidence,
                            source: `${file.name} - Strona ${i + 1}`
                        });
                    }
                } else if (file.type.startsWith('image/')) {
                    const { data: { text, confidence } } = await this.worker.recognize(file);
                    results.push({
                        text,
                        confidence,
                        source: file.name
                    });
                }
            } catch (error) {
                console.error(`Błąd OCR dla pliku ${file.name}:`, error);
                throw error;
            }
        }

        return results;
    }

    async convertPDFToImages(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            pages.push(canvas);
        }

        return pages;
    }

    clear() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
} 