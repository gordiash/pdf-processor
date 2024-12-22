export class OrderParser {
    constructor() {
        this.resetParsedData();
    }

    async parsePDF(file) {
        try {
            // Zresetuj dane
            this.resetParsedData();
            
            // Wczytaj PDF używając pdf.js
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';

            // Wyodrębnij tekst ze wszystkich stron
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ');
                fullText += pageText + '\n';
            }

            // Podziel tekst na linie i usuń puste
            const lines = fullText.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            // Parsuj poszczególne sekcje
            this.parseOrderHeader(lines);
            this.parseSupplierInfo(lines);
            this.parseOrderItems(lines);
            this.parseTotalValue(lines);

            // Podstawowa walidacja
            this.validateParsedData();

            return this.parsedData;
        } catch (error) {
            console.error('Błąd parsowania dokumentu:', error);
            if (this.hasPartialData()) {
                console.log('Zwracam częściowe dane');
                return this.parsedData;
            }
            throw error;
        }
    }

    parseOrderItems(lines) {
        let inItemsSection = false;
        let currentItems = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Rozpoznaj początek sekcji produktów
            if (line.includes('____________________________________________________________________________')) {
                const nextLine = lines[i + 1]?.trim() || '';
                if (nextLine.includes('Nazwa') && nextLine.includes('Ilość')) {
                    inItemsSection = true;
                    i++; // Pomiń linię nagłówka
                    continue;
                }
            }

            // Jeśli jesteśmy w sekcji produktów
            if (inItemsSection) {
                // Zakończ sekcję produktów
                if (line.includes('Ilość pozycji na zamówieniu')) {
                    break;
                }

                // Parsuj pozycję zamówienia
                const itemMatch = line.match(/^(\d{4})\s+([^0-9]+?)\s+(\d+)\s+(SZT|KG|L|M|OP)\s+(\d+[.,]\d+)\/(?:SZT|KG|L|M|OP)\s+(\d+[.,]\d+)/i);
                if (itemMatch) {
                    const item = {
                        position: itemMatch[1],
                        name: itemMatch[2].trim(),
                        quantity: parseInt(itemMatch[3]),
                        unit: itemMatch[4].toLowerCase(),
                        unitPrice: this.parseNumber(itemMatch[5]),
                        totalPrice: this.parseNumber(itemMatch[6])
                    };
                    currentItems.push(item);
                }
            }
        }

        if (currentItems.length > 0) {
            this.parsedData.items = currentItems;
        }
    }

    parseSupplierInfo(lines) {
        let inSupplierSection = false;
        let supplierInfo = {
            name: '',
            address: ''
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line === 'Dostawca:') {
                inSupplierSection = true;
                let j = i + 1;
                
                // Zbierz następne linie jako dane dostawcy
                while (j < lines.length) {
                    const nextLine = lines[j].trim();
                    if (nextLine.startsWith('Miejsce dostawy:') || 
                        nextLine.startsWith('Data dostawy:') ||
                        nextLine.includes('____________')) {
                        break;
                    }
                    
                    if (nextLine && !nextLine.startsWith('Kod dostawcy:')) {
                        if (!supplierInfo.name) {
                            supplierInfo.name = nextLine;
                        } else {
                            supplierInfo.address += (supplierInfo.address ? ' ' : '') + nextLine;
                        }
                    }
                    j++;
                }
                break;
            }
        }

        if (supplierInfo.name) {
            this.parsedData.supplier = supplierInfo;
        }
    }

    hasPartialData() {
        // Sprawdź, czy mamy przynajmniej podstawowe dane
        return this.parsedData.orderNumber || 
               this.parsedData.orderDate || 
               this.parsedData.items.length > 0;
    }

    parseOrderHeader(lines) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Numer zamówienia i data zamówienia
            const orderMatch = line.match(/Nr\s*zam[óo]wienia\s*\/\s*data\s*zam[óo]wienia:\s*(\d+)\s*\/\s*(\d{2}\.\d{2}\.\d{4})/i);
            if (orderMatch) {
                this.parsedData.orderNumber = orderMatch[1];
                this.parsedData.orderDate = this.parseDate(orderMatch[2]);
                continue;
            }

            // Data dostawy - rozszerzone wyrażenie regularne
            const deliveryMatch = line.match(/Data\s*dostawy:\s*(\d{2}\.\d{2}\.\d{4})(?:,?\s*godz\.\s*(\d{2}:\d{2}))?/i);
            if (deliveryMatch) {
                this.parsedData.deliveryDate = this.parseDate(deliveryMatch[1]);
                this.parsedData.deliveryTime = deliveryMatch[2] || null;
                continue;
            }

            // Miejsce dostawy - poprawione parsowanie
            if (line.includes('Miejsce dostawy:')) {
                let deliveryPlace = line.replace('Miejsce dostawy:', '').trim();
                let j = i + 1;
                
                while (j < lines.length) {
                    const nextLine = lines[j].trim();
                    if (nextLine.includes('Data dostawy:') || 
                        nextLine.includes('Fakturę') || 
                        nextLine.includes('_____') ||
                        nextLine.startsWith('Nr telefonu:')) {
                        break;
                    }
                    if (nextLine) {
                        deliveryPlace += ' ' + nextLine;
                    }
                    j++;
                }
                
                this.parsedData.deliveryPlace = deliveryPlace.trim();
                i = j - 1;
                continue;
            }
        }
    }

    parseTotalValue(lines) {
        for (const line of lines) {
            const totalMatch = line.match(/Całk\.\s*wart\.\s*netto\s*PLN\s*(\d+[\s.,]\d+)/i);
            if (totalMatch) {
                const value = totalMatch[1].replace(/\s+/g, '');
                this.parsedData.totalValue = this.parseNumber(value);
                break;
            }
        }
    }

    parseDate(dateStr) {
        try {
            const [day, month, year] = dateStr.split('.');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error(`Błąd parsowania daty: ${dateStr}`, error);
            return null;
        }
    }

    parseNumber(numStr) {
        try {
            const cleanNum = numStr.replace(/\s+/g, '').replace(',', '.');
            const result = parseFloat(cleanNum);
            return isNaN(result) ? 0 : result;
        } catch (error) {
            console.error(`Błąd parsowania liczby: ${numStr}`, error);
            return 0;
        }
    }

    validateParsedData() {
        const warnings = [];
        const errors = [];

        // Sprawdź wymagane pola
        if (!this.parsedData.orderNumber) warnings.push('Brak numeru zamówienia');
        if (!this.parsedData.orderDate) warnings.push('Brak daty zamówienia');
        if (!this.parsedData.deliveryDate) warnings.push('Brak daty dostawy');
        if (!this.parsedData.deliveryPlace) warnings.push('Brak miejsca dostawy');

        // Sprawdź pozycje zamówienia
        if (this.parsedData.items.length === 0) {
            warnings.push('Brak pozycji zamówienia');
        } else {
            // Sprawdź kompletność danych pozycji
            this.parsedData.items.forEach((item, index) => {
                if (!item.unitPrice) warnings.push(`Brak ceny jednostkowej dla pozycji ${index + 1}`);
                if (!item.totalPrice) warnings.push(`Brak wartości całkowitej dla pozycji ${index + 1}`);
            });
        }

        // Wyświetl ostrzeżenia, ale nie blokuj przetwarzania
        if (warnings.length > 0) {
            console.warn('Ostrzeżenia podczas parsowania:', warnings.join(', '));
        }
    }

    resetParsedData() {
        this.parsedData = {
            orderNumber: null,
            orderDate: null,
            deliveryDate: null,
            deliveryTime: null,
            deliveryPlace: null,
            supplier: {
                name: null,
                address: null,
                code: null
            },
            items: [],
            totalValue: null
        };
    }
} 