// Użyj globalnych instancji z CDN
const pdfjsLib = window.pdfjsLib;
const { createWorker } = window.Tesseract;

export class TextProcessor {
    constructor() {
        this.worker = null;
        this.currentLines = [];
        this.currentLineIndex = 0;
    }

    async initializeOCR() {
        if (!this.worker) {
            try {
                // Uproszczona inicjalizacja workera
                this.worker = await createWorker();
                
                // Konfiguracja rozpoznawania
                await this.worker.setParameters({
                    tessedit_ocr_engine_mode: '1',
                    tessedit_pageseg_mode: '1',
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyząćęłńóśźżĄĆĘŁŃÓŚŹŻ0123456789.,/-():; ',
                    preserve_interword_spaces: '1',
                    language_model_penalty_non_dict_word: '0.5',
                    language_model_penalty_case: '0.1'
                });
            } catch (error) {
                console.error('Błąd inicjalizacji OCR:', error);
                throw error;
            }
        }
    }

    async processWithOCR(files) {
        try {
            await this.initializeOCR();
            const results = [];

            for (const file of files) {
                console.log(`Przetwarzanie pliku: ${file.name}`);
                const pages = await this.extractPagesFromPDF(file);
                
                for (let i = 0; i < pages.length; i++) {
                    console.log(`Przetwarzanie strony ${i + 1}/${pages.length}`);
                    const { data } = await this.worker.recognize(pages[i]);
                    
                    const groups = this.groupTextData(data);
                    groups.forEach(group => {
                        results.push({
                            text: group.text,
                            confidence: group.confidence,
                            source: `${file.name} (strona ${i + 1}, ${group.type})`,
                            type: 'ocr',
                            group: group.type
                        });
                    });
                }
            }

            await this.worker.terminate();
            this.worker = null;

            return this.formatResults(results);
        } catch (error) {
            console.error('OCR processing error:', error);
            if (this.worker) {
                await this.worker.terminate();
                this.worker = null;
            }
            throw error;
        }
    }

    groupTextData(data) {
        this.currentLines = (data.lines || [])
            .map(line => line.text.trim())
            .filter(text => text.length > 0);
        this.currentLineIndex = 0;

        const groups = [];
        let currentGroup = null;

        while (this.currentLineIndex < this.currentLines.length) {
            const text = this.currentLines[this.currentLineIndex];
            const analysis = this.analyzeText(text);

            if (!currentGroup || 
                (currentGroup.type !== analysis.type) || 
                this.shouldStartNewGroup(currentGroup, text, analysis)) {
                
                if (currentGroup && currentGroup.lineCount > 0) {
                    currentGroup.confidence = currentGroup.confidence / currentGroup.lineCount;
                    groups.push({...currentGroup});
                }

                currentGroup = {
                    text: text,
                    confidence: data.confidence,
                    type: analysis.type,
                    subtype: analysis.subtype,
                    lineCount: 1,
                    properties: analysis.properties
                };
            } else {
                currentGroup.text += '\n' + text;
                currentGroup.confidence += data.confidence;
                currentGroup.lineCount++;
                Object.assign(currentGroup.properties, analysis.properties);
            }

            this.currentLineIndex++;
        }

        if (currentGroup && currentGroup.lineCount > 0) {
            currentGroup.confidence = currentGroup.confidence / currentGroup.lineCount;
            groups.push(currentGroup);
        }

        this.currentLines = [];
        this.currentLineIndex = 0;

        return this.mergeRelatedGroups(groups);
    }

    peekNextLine() {
        if (this.currentLineIndex + 1 < this.currentLines.length) {
            return this.currentLines[this.currentLineIndex + 1];
        }
        return null;
    }

    peekPreviousLine() {
        if (this.currentLineIndex > 0) {
            return this.currentLines[this.currentLineIndex - 1];
        }
        return null;
    }

    analyzeText(text) {
        const analysis = {
            type: 'unknown',
            subtype: null,
            properties: {}
        };

        // Zabezpieczenie przed null/undefined
        if (!text || typeof text !== 'string') {
            return analysis;
        }

        try {
            // Usuń zbędne białe znaki i ujednolić spacje
            text = text.replace(/\s+/g, ' ').trim();

            // Numer zamówienia
            const orderNumberMatch = text.match(/^(nr|numer|zamówienie|zam\.?)\s*:?\s*([A-Z0-9\/-]+)/i);
            if (orderNumberMatch) {
                analysis.type = 'order_number';
                analysis.properties.number = orderNumberMatch[2];
                return analysis;
            }

            // Data zamówienia
            const orderDateMatch = text.match(/data\s*(zam\.?|zamówienia)\s*:?\s*(\d{2}[\.-]\d{2}[\.-]\d{4})/i);
            if (orderDateMatch) {
                analysis.type = 'order_date';
                analysis.properties.date = orderDateMatch[2];
                return analysis;
            }

            // Zamawiający
            if (text.match(/^(zamawiający|nabywca|odbiorca)[\s:]+/i)) {
                analysis.type = 'customer_header';
                return analysis;
            }

            // Dane firmy (po nagłówku zamawiającego)
            const prevLine = this.peekPreviousLine();
            if (prevLine && prevLine.match(/^(zamawiający|nabywca|odbiorca)[\s:]+/i)) {
                analysis.type = 'customer_name';
                analysis.properties.name = text;
                return analysis;
            }

            // Data dostawy
            const deliveryDateMatch = text.match(/(termin|data)\s*dostawy\s*:?\s*(\d{2}[\.-]\d{2}[\.-]\d{4})/i);
            if (deliveryDateMatch) {
                analysis.type = 'delivery_date';
                analysis.properties.date = deliveryDateMatch[2];
                return analysis;
            }

            // Miejsce dostawy
            if (text.match(/^(miejsce|adres)\s*dostawy[\s:]+/i)) {
                analysis.type = 'delivery_place_header';
                return analysis;
            }

            // Adres
            const addressMatch = text.match(/^(ul\.|ulica|al\.|aleja|pl\.|plac)/i);
            const postalCodeMatch = text.match(/^\d{2}-\d{3}\s+[A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ\s]+/);
            
            if (addressMatch || postalCodeMatch || 
                (prevLine && prevLine.match(/^(miejsce|adres)\s*dostawy[\s:]+/i))) {
                analysis.type = 'delivery_address';
                analysis.properties.address = text;
                return analysis;
            }

            // Nagłówek tabeli produktów
            if (text.match(/^(lp|l\.p\.|poz)\.?\s+.*?(nazwa|produkt|towar).*?(ilość|sztuk|szt)/i)) {
                analysis.type = 'products_header';
                return analysis;
            }

            // Pozycje produktów
            const productMatch = text.match(/^(\d+\.?\)?\s*)?([^0-9]+?)\s+(\d+(?:[,.]\d+)?)\s*(szt\.?|kg|l|m|op\.?)\s*$/i);
            if (productMatch) {
                analysis.type = 'product';
                analysis.properties = {
                    name: productMatch[2].trim(),
                    quantity: parseFloat(productMatch[3].replace(',', '.')),
                    unit: productMatch[4].toLowerCase().replace('.', '')
                };
                return analysis;
            }

            // Jeśli nie rozpoznano typu, zwróć unknown
            return analysis;
        } catch (error) {
            console.error('Błąd podczas analizy tekstu:', error);
            return analysis;
        }
    }

    shouldStartNewGroup(currentGroup, text, analysis) {
        // Sprawdź czy należy rozpocząć nową grupę mimo tego samego typu
        if (currentGroup.type === 'address' && 
            analysis.type === 'address' && 
            currentGroup.subtype !== analysis.subtype) {
            return true;
        }

        // Dodaj więcej warunków dla innych typów jeśli potrzeba
        return false;
    }

    mergeRelatedGroups(groups) {
        const mergedGroups = [];
        let currentGroup = null;
        let inProductsSection = false;

        groups.forEach(group => {
            // Rozpocznij nową sekcję produktów
            if (group.type === 'products_header') {
                inProductsSection = true;
                currentGroup = {
                    type: 'products',
                    text: group.text,
                    items: [],
                    confidence: group.confidence
                };
                mergedGroups.push(currentGroup);
                return;
            }

            // Dodaj produkt do bieżącej sekcji
            if (inProductsSection && group.type === 'product') {
                currentGroup.items.push(group.properties);
                currentGroup.text += '\n' + group.text;
                return;
            }

            // Zakończ sekcję produktów
            if (inProductsSection && group.type !== 'product') {
                inProductsSection = false;
                currentGroup = null;
            }

            // Połącz adresy dostawy
            if (currentGroup?.type === 'delivery_address' && 
                (group.type === 'delivery_address' || group.text.match(/^\d{2}-\d{3}/))) {
                currentGroup.text += '\n' + group.text;
                Object.assign(currentGroup.properties, group.properties);
                return;
            }

            // Nowa grupa dla pozostałych przypadków
            currentGroup = {
                type: group.type,
                text: group.text,
                properties: group.properties,
                confidence: group.confidence
            };
            mergedGroups.push(currentGroup);
        });

        return mergedGroups;
    }

    async extractPagesFromPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const pages = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            pages.push(canvas);
        }

        return pages;
    }

    formatResults(results) {
        return results.map((result, index) => ({
            id: `text-${index}`,
            content: result.text,
            metadata: {
                source: result.source,
                type: result.type,
                group: result.group,
                confidence: result.confidence,
                timestamp: new Date().toISOString()
            }
        }));
    }

    clear() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
} 