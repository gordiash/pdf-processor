export class ProcessingModal {
    constructor() {
        this.modal = null;
        this.createModal();
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'modal-overlay';
        this.modal.innerHTML = `
            <div class="modal-popup">
                <div class="modal-header">
                    <h2>Wybierz metodę przetwarzania</h2>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-content">
                    <div class="processing-options">
                        <button id="ocr-option" class="option-btn">
                            <i class="fas fa-robot"></i>
                            <div class="option-details">
                                <span class="option-title">OCR</span>
                                <span class="option-desc">Automatyczne rozpoznawanie tekstu</span>
                            </div>
                        </button>
                        <button id="manual-option" class="option-btn">
                            <i class="fas fa-hand-pointer"></i>
                            <div class="option-details">
                                <span class="option-title">Ręczne zaznaczanie</span>
                                <span class="option-desc">Wybierz tekst manualnie</span>
                            </div>
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="modal-cancel" class="cancel-btn">Anuluj</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
        this.setupEventListeners();
    }

    setupEventListeners() {
        const closeBtn = this.modal.querySelector('.close-btn');
        const cancelBtn = this.modal.querySelector('#modal-cancel');
        const ocrBtn = this.modal.querySelector('#ocr-option');
        const manualBtn = this.modal.querySelector('#manual-option');

        closeBtn.addEventListener('click', () => this.hide());
        cancelBtn.addEventListener('click', () => this.hide());
        ocrBtn.addEventListener('click', () => this.selectOption('ocr'));
        manualBtn.addEventListener('click', () => this.selectOption('manual'));

        // Zamykanie modalu po kliknięciu w tło
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // Obsługa klawisza ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'flex') {
                this.hide();
            }
        });
    }

    show() {
        this.modal.style.display = 'flex';
        // Animacja wejścia
        requestAnimationFrame(() => {
            this.modal.querySelector('.modal-popup').classList.add('show');
        });
    }

    hide() {
        const popup = this.modal.querySelector('.modal-popup');
        popup.classList.remove('show');
        // Czekaj na zakończenie animacji
        setTimeout(() => {
            this.modal.style.display = 'none';
        }, 300);
    }

    selectOption(option) {
        const event = new CustomEvent('processingOptionSelected', {
            detail: { option }
        });
        document.dispatchEvent(event);
        this.hide();
    }

    showProgress(progress) {
        const progressBar = this.modal.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.textContent = `${progress}%`;
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'modal-error';
        errorDiv.textContent = message;
        
        const content = this.modal.querySelector('.modal-content');
        content.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }
} 