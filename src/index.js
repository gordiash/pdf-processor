import { PDFViewer } from './components/PDFViewer.js';
import { FileHandler } from './services/FileHandler.js';
import { ExportService } from './services/ExportService.js';
import { PDFParser } from './services/PDFParser.js';
import { TextProcessor } from './services/TextProcessor.js';

export class PDFProcessor {
    constructor() {
        this.currentResults = [];
        // Inicjalizacja przy tworzeniu instancji
        this.initialize();
    }

    async initialize() {
        try {
            // Poczekaj na załadowanie DOM
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Inicjalizuj komponenty
            await this.initializeComponents();
            
            // Inicjalizuj interfejs
            this.setupEventListeners();
            this.initializeTheme();
            
            console.log('Aplikacja zainicjalizowana pomyślnie');
        } catch (error) {
            console.error('Błąd podczas inicjalizacji aplikacji:', error);
        }
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
        try {
            this.fileHandler = new FileHandler();
            this.pdfViewer = new PDFViewer();
            this.exportService = new ExportService();
            this.pdfParser = new PDFParser();
            this.textProcessor = new TextProcessor();

            // Poczekaj na inicjalizację ChatGPT
            await this.pdfParser.chatGPTService.checkConnection();
            
            console.log('Komponenty zainicjalizowane pomyślnie');
        } catch (error) {
            console.error('Błąd podczas inicjalizacji komponentów:', error);
            this.showError('Błąd konfiguracji:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Upewnij się, że komponenty są zainicjalizowane
        if (!this.pdfParser || !this.pdfViewer || !this.fileHandler) {
            console.error('Komponenty nie zostały prawidłowo zainicjalizowane');
            return;
        }

        // Pobierz referencje do elementów DOM
        const elements = {
            fileInput: document.getElementById('file-input'),
            pdfBtn: document.getElementById('pdf-btn'),
            ocrBtn: document.getElementById('ocr-btn'),
            clearBtn: document.getElementById('clear-btn'),
            themeToggle: document.getElementById('theme-toggle'),
            selectAll: document.getElementById('select-all')
        };

        // Dodaj nasłuchiwacze zdarzeń
        if (elements.fileInput) {
            elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
        
        if (elements.pdfBtn) {
            elements.pdfBtn.addEventListener('click', () => this.handlePDFExtract());
        }
        
        if (elements.ocrBtn) {
            elements.ocrBtn.addEventListener('click', () => this.handleOCR());
        }
        
        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', () => this.clearAll());
        }
        
        if (elements.themeToggle) {
            elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        if (elements.selectAll) {
            elements.selectAll.addEventListener('change', (e) => this.handleSelectAll(e.target.checked));
        }

        // Dodaj nasłuchiwacze do przycisków eksportu
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
            // Sprawdź czy elementy istnieją
            const ocrBtn = document.getElementById('ocr-btn');
            const pdfBtn = document.getElementById('pdf-btn');
            
            if (!event.target.files) {
                throw new Error('Nie wybrano plików');
            }

            const files = await this.fileHandler.validateFiles(event.target.files);
            await this.pdfViewer.loadFiles(files);
            
            // Bezpiecznie włącz przyciski
            if (ocrBtn) ocrBtn.disabled = false;
            if (pdfBtn) pdfBtn.disabled = false;
        } catch (error) {
            this.showError('Błąd wczytywania pliku:', error);
        }
    }

    async handlePDFExtract() {
        if (!this.pdfParser) {
            this.showError('Błąd:', new Error('System nie jest gotowy do przetwarzania PDF'));
            return;
        }

        try {
            this.showProgress('Przetwarzanie PDF...');
            const files = this.pdfViewer.getLoadedFiles();
            const results = [];

            for (const file of files) {
                const parsedData = await this.pdfParser.parsePDF(file);
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
        if (!this.textProcessor) {
            this.showError('Błąd:', new Error('System nie jest gotowy do przetwarzania OCR'));
            return;
        }

        try {
            this.showProgress('Przetwarzanie OCR...');
            const files = this.pdfViewer.getLoadedFiles();
            const ocrResults = await this.textProcessor.processWithOCR(files);
            
            // Przygotuj wyniki do analizy przez asystenta
            const results = [];
            
            for (const ocrResult of ocrResults) {
                try {
                    const cleanedText = this.cleanOCRText(ocrResult.text);
                    const parsedData = await this.pdfParser.chatGPTService.processOrderData({
                        text: cleanedText,
                        source: ocrResult.source
                    });

                    // Formatuj odpowiedź przed dodaniem do wyników
                    const formattedResponse = this.formatGPTResponse(parsedData);
                    
                    // Dodaj sformatowane wyniki
                    if (formattedResponse) {
                        results.push({
                            text: '',
                            confidence: ocrResult.confidence,
                            source: ocrResult.source,
                            type: 'ocr',
                            group: 'analysis',
                            metadata: {
                                gptAnalysis: formattedResponse.metadata?.gptAnalysis
                            }
                        });
                    }
                } catch (error) {
                    console.error(`Błąd analizy OCR dla ${ocrResult.source}:`, error);
                    // Dodaj błędny wynik w podstawowym formacie
                    results.push({
                        text: ocrResult.text,
                        confidence: ocrResult.confidence,
                        source: ocrResult.source,
                        type: 'ocr',
                        group: 'error',
                        metadata: {
                            gptAnalysis: {
                                sections: [{
                                    content: `Błąd analizy: ${error.message}`
                                }]
                            }
                        }
                    });
                }
            }

            // Formatuj wyniki tak samo jak dla PDF
            this.currentResults = this.formatResults(results);
            this.displayResults();
            this.enableExport();
        } catch (error) {
            this.showError('Błąd przetwarzania OCR:', error);
        } finally {
            this.hideProgress();
        }
    }

    formatResults(results) {
        const formattedResults = [];
        
        results.forEach((result, resultIndex) => {
            if (result.metadata?.gptAnalysis?.sections) {
                // Dla każdej sekcji tworzymy osobny element
                result.metadata.gptAnalysis.sections.forEach((section, sectionIndex) => {
                    // Pomijamy nagłówki grup przy wyświetlaniu confidence
                    const showConfidence = !section.isHeader;
                    
                    formattedResults.push({
                        id: `result-${resultIndex}-${sectionIndex}`,
                        content: section.content,
                        metadata: {
                            source: section.isHeader ? '' : `${result.source}`,
                            type: result.type,
                            group: result.group,
                            confidence: showConfidence ? result.confidence : undefined,
                            isHeader: section.isHeader
                        }
                    });
                });
            } else {
                formattedResults.push({
                    id: `result-${resultIndex}`,
                    content: result.text || '',
                    metadata: {
                        source: result.source || '',
                        type: result.type || 'unknown',
                        confidence: result.confidence || 0,
                        group: result.group || 'other'
                    }
                });
            }
        });

        return formattedResults;
    }

    displayResults() {
        const resultsList = document.getElementById('results-list');
        if (!resultsList) return;

        resultsList.innerHTML = '';
        
        this.currentResults.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            // Różne style dla nagłówków i zwykłych wyników
            if (result.metadata.isHeader) {
                resultItem.className += ' result-header-item';
                resultItem.innerHTML = `
                    <div class="result-content header-content">${result.content}</div>
                `;
            } else {
                resultItem.innerHTML = `
                    <div class="result-header">
                        <label class="checkbox">
                            <input type="checkbox" data-id="${result.id}">
                            ${result.metadata.source}
                        </label>
                        ${result.metadata.confidence !== undefined ? 
                            `<span class="confidence">${result.metadata.confidence}%</span>` : 
                            ''}
                    </div>
                    <div class="result-content">${result.content}</div>
                `;
            }
            
            resultsList.appendChild(resultItem);
        });

        // Włącz przyciski eksportu jeśli są wyniki
        if (this.currentResults.length > 0) {
            this.enableExport();
        }
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
        // Wyczyść pliki
        if (this.fileHandler) {
            this.fileHandler.clear();
        }

        // Wyczyść podgląd PDF
        if (this.pdfViewer) {
            this.pdfViewer.clear();
        }

        // Wyczyść wyniki
        this.currentResults = [];
        const resultsList = document.getElementById('results-list');
        if (resultsList) {
            resultsList.innerHTML = '';
        }

        // Zresetuj przyciski
        const pdfBtn = document.getElementById('pdf-btn');
        const ocrBtn = document.getElementById('ocr-btn');
        if (pdfBtn) pdfBtn.disabled = true;
        if (ocrBtn) ocrBtn.disabled = true;

        // Wyczyść zaznaczenia
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }

        // Wyłącz przyciski eksportu
        this.disableExport();

        // Wyczyść komunikaty
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => notification.remove());
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

    // Dodaj nową metodę do czyszczenia tekstu OCR
    cleanOCRText(text) {
        if (!text) return '';

        return text
            // Usuń wielokrotne spacje
            .replace(/\s+/g, ' ')
            // Usuń wielokrotne nowe linie
            .replace(/(\r?\n\s*){2,}/g, '\n')
            // Usuń spacje na początku i końcu linii
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0) // Usuń puste linie
            // Popraw typowe błędy OCR
            .map(line => line
                // Popraw 'O' na '0' w liczbach
                .replace(/(?<=\d)O(?=\d)/g, '0')
                .replace(/(?<=\d)o(?=\d)/g, '0')
                // Popraw 'l' lub 'I' na '1' w liczbach
                .replace(/(?<=\d)[lI](?=\d)/g, '1')
                // Popraw 'S' na '5' w liczbach
                .replace(/(?<=\d)S(?=\d)/g, '5')
                // Popraw 'Z' na '2' w liczbach
                .replace(/(?<=\d)Z(?=\d)/g, '2')
                // Popraw 'B' na '8' w liczbach
                .replace(/(?<=\d)B(?=\d)/g, '8')
                // Usuń znaki specjalne (zachowaj polskie znaki)
                .replace(/[^\w\s,.:;/\-()złąćęńóśźżĄĆĘŁŃÓŚŹŻ]/g, '')
            )
            // Połącz linie z powrotem
            .join('\n')
            // Usuń spacje przed znakami interpunkcyjnymi
            .replace(/\s+([,.:])/g, '$1')
            // Dodaj spacje po znakach interpunkcyjnych jeśli ich nie ma
            .replace(/([,.:])(?!\s)/g, '$1 ')
            // Końcowe czyszczenie
            .trim();
    }

    formatGPTResponse(response) {
        if (!response) return null;

        try {
            // Sprawdź czy odpowiedź zawiera sekcje
            if (response.metadata?.gptAnalysis?.sections) {
                const sections = response.metadata.gptAnalysis.sections;
                
                // Grupuj sekcje według typu danych
                const groupedSections = {
                    order_info: [], // Informacje o zamówieniu
                    company_info: [], // Informacje o firmie
                    items: [], // Pozycje zamówienia
                    delivery: [], // Informacje o dostawie
                    payment: [], // Informacje o płatności
                    other: [] // Pozostałe informacje
                };

                sections.forEach(section => {
                    const content = section.content.trim();
                    
                    // Przypisz sekcję do odpowiedniej grupy na podstawie zawartości
                    if (content.match(/zamówien|numer|data zamów/i)) {
                        groupedSections.order_info.push(section);
                    }
                    else if (content.match(/firma|nip|regon|adres|siedziba/i)) {
                        groupedSections.company_info.push(section);
                    }
                    else if (content.match(/dostaw|termin|miejsce|data dostaw/i)) {
                        groupedSections.delivery.push(section);
                    }
                    else if (content.match(/płatnoś|termin płat|warunki płat/i)) {
                        groupedSections.payment.push(section);
                    }
                    else if (content.match(/pozycj|produkt|towar|sztuk|cena|wartość/i)) {
                        groupedSections.items.push(section);
                    }
                    else {
                        groupedSections.other.push(section);
                    }
                });

                // Przygotuj posortowane sekcje
                const sortedSections = [];
                
                // Kolejność wyświetlania grup
                const groupOrder = ['order_info', 'company_info', 'delivery', 'items', 'payment', 'other'];
                
                groupOrder.forEach(group => {
                    if (groupedSections[group].length > 0) {
                        // Dodaj nagłówek grupy
                        sortedSections.push({
                            content: this.getGroupHeader(group),
                            isHeader: true
                        });
                        
                        // Dodaj posortowane sekcje z grupy
                        groupedSections[group]
                            .sort((a, b) => this.getSectionPriority(a.content) - this.getSectionPriority(b.content))
                            .forEach(section => sortedSections.push(section));
                    }
                });

                // Zaktualizuj sekcje w odpowiedzi
                response.metadata.gptAnalysis.sections = sortedSections;
            }

            return response;
        } catch (error) {
            console.error('Błąd podczas formatowania odpowiedzi GPT:', error);
            return response; // Zwróć oryginalną odpowiedź w przypadku błędu
        }
    }

    getGroupHeader(group) {
        const headers = {
            order_info: '📋 Informacje o zamówieniu',
            company_info: '🏢 Dane firmy',
            delivery: '🚚 Dostawa',
            items: '📦 Pozycje zamówienia',
            payment: '💰 Płatność',
            other: '📎 Pozostałe informacje'
        };
        return headers[group] || 'Inne';
    }

    getSectionPriority(content) {
        // Nadaj priorytet na podstawie zawartości
        if (content.match(/numer|nr zamów/i)) return 1;
        if (content.match(/data zamów/i)) return 2;
        if (content.match(/nip|regon/i)) return 3;
        if (content.match(/nazwa firm/i)) return 4;
        if (content.match(/adres|siedziba/i)) return 5;
        if (content.match(/termin dostaw/i)) return 6;
        if (content.match(/miejsce dostaw/i)) return 7;
        if (content.match(/warunki płat/i)) return 8;
        return 100; // Domyślny niski priorytet
    }
}

// Inicjalizacja aplikacji
const app = new PDFProcessor(); 