import { getDocument } from 'pdfjs-dist';

export class PDFViewer {
    constructor() {
        this.currentPage = 1;
        this.numPages = 0;
        this.currentFiles = [];
        this.currentPdf = null;
        this.currentScale = 1.0;
        this.container = document.getElementById('pdf-preview');
        this.setupZoomControls();
    }

    setupZoomControls() {
        const zoomControls = document.createElement('div');
        zoomControls.className = 'zoom-controls';
        zoomControls.innerHTML = `
            <button class="zoom-btn" data-zoom="out" title="Pomniejsz">
                <i class="fas fa-search-minus"></i>
            </button>
            <span class="zoom-level">100%</span>
            <button class="zoom-btn" data-zoom="in" title="Powiększ">
                <i class="fas fa-search-plus"></i>
            </button>
        `;

        this.container.parentElement.insertBefore(zoomControls, this.container);

        // Obsługa przycisków zoom
        const zoomInBtn = zoomControls.querySelector('[data-zoom="in"]');
        const zoomOutBtn = zoomControls.querySelector('[data-zoom="out"]');

        zoomInBtn.addEventListener('click', () => this.zoom(1));  // Powiększanie
        zoomOutBtn.addEventListener('click', () => this.zoom(-1)); // Pomniejszanie

        // Dodaj obsługę klawiszy + i -
        document.addEventListener('keydown', (e) => {
            if (e.key === '+' || e.key === '=') {
                this.zoom(1);
            } else if (e.key === '-' || e.key === '_') {
                this.zoom(-1);
            }
        });
    }

    async zoom(delta) {
        // Oblicz nową skalę z ograniczeniami
        const minScale = 0.5;
        const maxScale = 3.0;
        const scaleStep = 0.25;
        
        // Oblicz nową skalę
        let newScale;
        if (delta > 0) {
            // Powiększanie
            newScale = Math.min(maxScale, this.currentScale + scaleStep);
        } else {
            // Pomniejszanie
            newScale = Math.max(minScale, this.currentScale - scaleStep);
        }

        // Sprawdź czy skala się zmieniła
        if (newScale !== this.currentScale) {
            console.log(`Zmiana skali: ${this.currentScale} -> ${newScale}`); // Debugging
            this.currentScale = newScale;
            
            // Aktualizuj wyświetlaną wartość skali
            const zoomLevel = document.querySelector('.zoom-level');
            if (zoomLevel) {
                zoomLevel.textContent = `${Math.round(this.currentScale * 100)}%`;
            }

            // Renderuj stronę z nową skalą
            try {
                await this.renderPage(this.currentPage);
            } catch (error) {
                console.error('Błąd podczas skalowania strony:', error);
                throw error;
            }
        }
    }

    async loadFiles(files) {
        try {
            this.currentFiles = files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type === 'application/pdf') {
                    await this.loadPDF(file);
                } else if (file.type.startsWith('image/')) {
                    await this.loadImage(file);
                }
            }
        } catch (error) {
            console.error('Błąd wczytywania pliku:', error);
            throw error;
        }
    }

    async loadPDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.currentPdf = await getDocument({
                data: arrayBuffer,
                useWorkerFetch: false,
                isEvalSupported: false,
                useSystemFonts: true
            }).promise;

            this.numPages = this.currentPdf.numPages;
            await this.renderPage(1);
            this.updatePagination();
        } catch (error) {
            console.error('Błąd wczytywania PDF:', error);
            throw error;
        }
    }

    async loadImage(file) {
        try {
            const url = URL.createObjectURL(file);
            const img = document.createElement('img');
            img.src = url;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';

            this.container.innerHTML = '';
            this.container.appendChild(img);
            this.numPages = 1;
            this.currentPage = 1;
            this.updatePagination();
        } catch (error) {
            console.error('Błąd wczytywania obrazu:', error);
            throw error;
        }
    }

    async renderPage(pageNumber) {
        if (!this.currentPdf) return;

        try {
            const page = await this.currentPdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: this.currentScale });

            // Wyczyść kontener
            this.container.innerHTML = '';

            // Stwórz nowy canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Dodaj canvas do kontenera w page-container
            const pageContainer = document.createElement('div');
            pageContainer.className = 'page-container';
            pageContainer.appendChild(canvas);
            this.container.appendChild(pageContainer);

            // Renderuj stronę
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            this.currentPage = pageNumber;
        } catch (error) {
            console.error('Błąd renderowania strony:', error);
            throw error;
        }
    }

    updatePagination() {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;

        pagination.innerHTML = `
            <button ${this.currentPage <= 1 ? 'disabled' : ''} onclick="this.previousPage()">
                <i class="fas fa-chevron-left"></i>
            </button>
            <span>Strona ${this.currentPage} z ${this.numPages}</span>
            <button ${this.currentPage >= this.numPages ? 'disabled' : ''} onclick="this.nextPage()">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    async previousPage() {
        if (this.currentPage > 1) {
            await this.renderPage(this.currentPage - 1);
            this.updatePagination();
        }
    }

    async nextPage() {
        if (this.currentPage < this.numPages) {
            await this.renderPage(this.currentPage + 1);
            this.updatePagination();
        }
    }

    getLoadedFiles() {
        return this.currentFiles;
    }

    clear() {
        this.container.innerHTML = '';
        this.currentFiles = [];
        this.currentPdf = null;
        this.currentPage = 1;
        this.numPages = 0;
        this.updatePagination();
    }
} 