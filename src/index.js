import { PDFViewer } from './components/PDFViewer.js';
import { FileHandler } from './services/FileHandler.js';
import { ExportService } from './services/ExportService.js';
import { PDFParser } from './services/PDFParser.js';

class PDFProcessor {
    constructor() {
        this.initializeComponents();
        this.setupEventListeners();
        this.currentResults = [];
        this.initializeTheme();
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        const body = document.body;
        const lightIcon = document.querySelector('.light-icon');
        const darkIcon = document.querySelector('.dark-icon');
        const themeToggle = document.getElementById('theme-toggle');

        if (savedTheme === 'dark') {
            body.classList.add('dark-mode');
            lightIcon.classList.add('is-hidden');
            darkIcon.classList.remove('is-hidden');
            themeToggle.classList.remove('is-light');
            themeToggle.classList.add('is-dark');
        } else {
            body.classList.remove('dark-mode');
            lightIcon.classList.remove('is-hidden');
            darkIcon.classList.add('is-hidden');
            themeToggle.classList.remove('is-dark');
            themeToggle.classList.add('is-light');
        }
    }

    async initializeComponents() {
        this.fileHandler = new FileHandler();
        this.pdfViewer = new PDFViewer();
        this.exportService = new ExportService();
        this.pdfParser = new PDFParser();

        try {
            await this.pdfParser.chatGPTService.checkConnection();
        } catch (error) {
            this.showError('Błąd konfiguracji OpenAI:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('file-input')
            .addEventListener('change', (e) => this.handleFileUpload(e));
        
        document.getElementById('pdf-btn')
            .addEventListener('click', () => this.handlePDFExtract());
        
        document.getElementById('clear-btn')
            .addEventListener('click', () => this.clearAll());
        
        document.getElementById('theme-toggle')
            .addEventListener('click', () => this.toggleTheme());
        
        document.getElementById('select-all')
            ?.addEventListener('change', (e) => this.handleSelectAll(e.target.checked));

        document.querySelectorAll('.export-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleExport(btn.dataset.format));
        });
    }

    toggleTheme() {
        const body = document.body;
        const isDark = body.classList.contains('dark-mode');
        const lightIcon = document.querySelector('.light-icon');
        const darkIcon = document.querySelector('.dark-icon');
        const themeToggle = document.getElementById('theme-toggle');

        if (isDark) {
            // Przełącz na jasny motyw
            body.classList.remove('dark-mode');
            lightIcon.classList.remove('is-hidden');
            darkIcon.classList.add('is-hidden');
            themeToggle.classList.remove('is-dark');
            themeToggle.classList.add('is-light');
            localStorage.setItem('theme', 'light');
        } else {
            // Przełącz na ciemny motyw
            body.classList.add('dark-mode');
            lightIcon.classList.add('is-hidden');
            darkIcon.classList.remove('is-hidden');
            themeToggle.classList.remove('is-light');
            themeToggle.classList.add('is-dark');
            localStorage.setItem('theme', 'dark');
        }
    }

    async handleFileUpload(event) {
        try {
            const files = await this.fileHandler.validateFiles(event.target.files);
            await this.pdfViewer.loadFiles(files);
            document.getElementById('ocr-btn').disabled = false;
            document.getElementById('pdf-btn').disabled = false;
        } catch (error) {
            this.showError('Błąd wczytywania pliku:', error);
        }
    }

    async handlePDFExtract() {
        try {
            this.showProgress('Przetwarzanie PDF...');
            const files = this.pdfViewer.getLoadedFiles();
            const results = [];

            for (const file of files) {
                const parsedData = await this.pdfParser.parsePDF(file);
                // Każda sekcja będzie osobnym wynikiem
                if (parsedData.metadata.gptAnalysis && parsedData.metadata.gptAnalysis.sections) {
                    results.push({
                        text: '',
                        confidence: 100,
                        source: file.name,
                        type: 'pdf',
                        group: 'analysis',
                        metadata: {
                            gptAnalysis: parsedData.metadata.gptAnalysis
                        }
                    });
                }
            }

            this.currentResults = this.formatResults(results);
            this.displayResults();
        } catch (error) {
            this.showError('Błąd przetwarzania PDF:', error);
        } finally {
            this.hideProgress();
        }
    }

    async handleOCR() {
        try {
            this.showProgress('Przetwarzanie OCR...');
            const files = this.pdfViewer.getLoadedFiles();
            this.currentResults = await this.textProcessor.processWithOCR(files);
            this.displayResults();
        } catch (error) {
            this.showError('Błąd przetwarzania OCR:', error);
        } finally {
            this.hideProgress();
        }
    }

    formatResults(results) {
        const formattedResults = [];
        
        results.forEach((result, resultIndex) => {
            if (result.metadata.gptAnalysis && result.metadata.gptAnalysis.sections) {
                // Dla każdej sekcji tworzymy osobny element
                result.metadata.gptAnalysis.sections.forEach((section, sectionIndex) => {
                    formattedResults.push({
                        id: `result-${resultIndex}-${sectionIndex}`,
                        content: section.content,
                        metadata: {
                            source: `${result.source} - Linia ${sectionIndex + 1}`,
                            type: result.type,
                            group: result.group,
                            confidence: result.confidence
                        }
                    });
                });
            } else {
                formattedResults.push({
                    id: `result-${resultIndex}`,
                    content: result.text,
                    metadata: result.metadata
                });
            }
        });

        return formattedResults;
    }

    displayResults() {
        const resultsList = document.getElementById('results-list');
        resultsList.innerHTML = '';

        // Resetuj stan checkboxa "zaznacz wszystkie"
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }

        this.currentResults.forEach((result, index) => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'result-item';
            
            // Dodaj nagłówek z metadanymi
            const header = document.createElement('div');
            header.className = 'result-header';
            header.innerHTML = `
                <input type="checkbox" id="${result.id}" />
                <label for="${result.id}">${result.metadata.source}</label>
                <span class="confidence">${Math.round(result.metadata.confidence)}</span>
            `;

            // Dodaj zawartość
            const content = document.createElement('div');
            content.className = 'result-content';
            content.textContent = result.content;

            resultDiv.appendChild(header);
            resultDiv.appendChild(content);
            
            // Dodajemy opóźnienie dla każdego kolejnego elementu
            setTimeout(() => {
                resultsList.appendChild(resultDiv);
            }, index * 50);
        });

        this.enableExport();
    }

    formatOrderItems(items) {
        return `
            <table class="order-items-table">
                <thead>
                    <tr>
                        <th>Lp.</th>
                        <th>Nazwa</th>
                        <th>Ilość</th>
                        <th>Cena jedn.</th>
                        <th>Wartość</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${item.position}</td>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>${item.unitPrice.toFixed(2)}</td>
                            <td>${item.totalPrice.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async handleExport(format) {
        try {
            const selectedItems = this.getSelectedItems();
            if (selectedItems.length === 0) {
                this.showWarning('Nie wybrano żadnych pozycji do eksportu');
                return;
            }

            await this.exportService.export(selectedItems, format);
            this.showSuccess(`Eksport do formatu ${format.toUpperCase()} zakończony pomyślnie`);
        } catch (error) {
            this.showError('Błąd eksportu:', error);
        }
    }

    formatGroupName(group) {
        const names = {
            'header': 'Nagłówek',
            'number': 'Numery',
            'date': 'Daty',
            'amount': 'Kwoty',
            'address': 'Adresy',
            'postal_code': 'Kody pocztowe',
            'contact': 'Kontakt',
            'text': 'Tekst',
            'other': 'Inne'
        };
        return names[group] || group;
    }

    getSelectedItems() {
        return Array.from(
            document.querySelectorAll('#results-list input[type="checkbox"]:checked')
        ).map(checkbox => {
            // Znajdź element nadrzędny zawierający dane
            const resultItem = checkbox.closest('.result-item');
            const content = resultItem.querySelector('.result-content').textContent;
            const source = resultItem.querySelector('label').textContent;
            const confidence = parseInt(resultItem.querySelector('.confidence').textContent);

            return {
                content: content.trim(),
                source: source.trim(),
                type: 'pdf', // lub pobierz z metadanych jeśli potrzebne
                confidence: confidence
            };
        });
    }

    clearAll() {
        this.fileHandler.clear();
        this.pdfViewer.clear();
        this.textProcessor.clear();
        this.currentResults = [];
        document.getElementById('results-list').innerHTML = '';
        this.disableExport();
    }

    enableExport() {
        document.querySelectorAll('.export-btn').forEach(btn => 
            btn.disabled = false);
    }

    disableExport() {
        document.querySelectorAll('.export-btn').forEach(btn => 
            btn.disabled = true);
    }

    showProgress(message) {
        const resultsList = document.getElementById('results-list');
        
        // Usuń poprzednią animację jeśli istnieje
        const oldLoader = resultsList.querySelector('.loading-animation');
        if (oldLoader) {
            oldLoader.remove();
        }

        // Stwórz nową animację
        const loader = document.createElement('div');
        loader.className = 'loading-animation';
        loader.innerHTML = `
            <div class="loading-spinner"></div>
            <p>${message}</p>
        `;

        resultsList.appendChild(loader);
        
        // Wymuszamy reflow przed dodaniem klasy visible
        loader.offsetHeight;
        loader.classList.add('visible');
    }

    hideProgress() {
        const loader = document.querySelector('.loading-animation');
        if (loader) {
            loader.classList.remove('visible');
            setTimeout(() => loader.remove(), 300); // Czekamy na zakończenie animacji
        }
    }

    showError(prefix, error) {
        console.error(prefix, error);
        this.showNotification(`${prefix} ${error.message}`, 'danger');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    formatGPTAnalysis(analysis) {
        if (!analysis) return '';
        
        return `
            <div class="gpt-analysis">
                <ul class="analysis-list">
                    ${analysis.sections.map(section => `
                        <li class="analysis-item">${section.content}</li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    // Nowa metoda do czyszczenia tylko zaznaczeń
    clearSelections() {
        // Odznacz wszystkie checkboxy w wynikach
        document.querySelectorAll('#results-list input[type="checkbox"]:checked')
            .forEach(checkbox => checkbox.checked = false);
        
        // Odznacz checkbox "zaznacz wszystkie"
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
        
        // Wyłącz przyciski eksportu
        this.disableExport();
    }

    handleSelectAll(checked) {
        // Zaznacz/odznacz wszystkie checkboxy
        document.querySelectorAll('#results-list input[type="checkbox"]')
            .forEach(checkbox => checkbox.checked = checked);
        
        // Włącz/wyłącz przyciski eksportu
        if (checked) {
            this.enableExport();
        } else {
            this.disableExport();
        }
    }

    // Dodajmy nową metodę do wyświetlania ostrzeżeń
    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    // Dodajmy nową metodę do zarządzania powiadomieniami
    showNotification(message, type = 'info') {
        // Usuń poprzednie powiadomienie
        const oldNotification = document.querySelector('.notification');
        if (oldNotification) {
            oldNotification.remove();
        }

        // Stwórz nowe powiadomienie
        const notification = document.createElement('div');
        notification.className = `notification is-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            min-width: 300px;
            z-index: 1000;
            margin: 0;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;

        // Dodaj ikonę w zależności od typu
        const icon = this.getNotificationIcon(type);
        
        notification.innerHTML = `
            <button class="delete"></button>
            <div class="icon-text">
                <span class="icon">
                    <i class="fas ${icon}"></i>
                </span>
                <span>${message}</span>
            </div>
        `;

        // Dodaj obsługę przycisku zamknięcia
        const closeButton = notification.querySelector('.delete');
        closeButton.addEventListener('click', () => {
            this.hideNotification(notification);
        });

        // Dodaj do dokumentu i pokaż
        document.body.appendChild(notification);
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });

        // Automatyczne ukrycie
        const timeout = type === 'success' ? 5000 : 3000;
        setTimeout(() => {
            if (document.body.contains(notification)) {
                this.hideNotification(notification);
            }
        }, timeout);
    }

    hideNotification(notification) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            warning: 'fa-exclamation-triangle',
            danger: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }
}

// Inicjalizacja aplikacji po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    new PDFProcessor();
}); 