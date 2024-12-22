import { ChatGPTService } from './ChatGPTService.js';

export class PDFParser {
    constructor() {
        this.currentDocument = null;
        this.chatGPTService = new ChatGPTService();
    }

    async parsePDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            const textContent = await this.extractText(pdf);
            
            // Przekaż tekst do analizy GPT
            const gptAnalysis = await this.chatGPTService.processOrderData({
                text: textContent,
                metadata: {
                    pageCount: pdf.numPages,
                    info: await pdf.getMetadata()
                }
            });

            return {
                text: textContent,
                metadata: {
                    pageCount: pdf.numPages,
                    info: await pdf.getMetadata(),
                    gptAnalysis: gptAnalysis
                }
            };
        } catch (error) {
            console.error('Błąd podczas parsowania PDF:', error);
            throw error;
        }
    }

    async extractText(pdf) {
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const textItems = textContent.items.sort((a, b) => {
                if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
                    return a.transform[4] - b.transform[4];
                }
                return b.transform[5] - a.transform[5];
            });

            let lastY = null;
            textItems.forEach(item => {
                const y = item.transform[5];
                if (lastY !== null && Math.abs(y - lastY) > 5) {
                    fullText += '\n';
                }
                fullText += item.str + ' ';
                lastY = y;
            });
            fullText += '\n\n';
        }
        return fullText.trim();
    }

    parseTextToStructure(text) {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const data = {
            orderNumber: null,
            orderDate: null,
            deliveryDate: null,
            supplier: {
                name: null,
                address: null,
                code: null
            },
            items: [],
            totalValue: null
        };

        let inItemsSection = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Numer zamówienia i data
            const orderMatch = line.match(/Zamówienie.*Nr\s*zam[óo]wienia\s*\/\s*data\s*zam[óo]wienia:\s*(\d+)\s*\/\s*(\d{2}\.\d{2}\.\d{4})/i);
            if (orderMatch) {
                data.orderNumber = orderMatch[1];
                data.orderDate = this.parseDate(orderMatch[2]);
                continue;
            }

            // Data dostawy
            const deliveryMatch = line.match(/Data\s*dostawy:\s*(\d{2}\.\d{2}\.\d{4})(?:,\s*godz\.\s*(\d{2}:\d{2}))?/i);
            if (deliveryMatch) {
                data.deliveryDate = this.parseDate(deliveryMatch[1]);
                data.deliveryTime = deliveryMatch[2] || null;
                continue;
            }

            // Dostawca
            if (line.includes('Dostawca:')) {
                let j = i + 1;
                let supplierLines = [];
                while (j < lines.length && 
                       !lines[j].includes('Miejsce dostawy:') && 
                       !lines[j].includes('Data dostawy:') &&
                       !lines[j].includes('____________')) {
                    supplierLines.push(lines[j].trim());
                    j++;
                }
                
                if (supplierLines.length > 0) {
                    data.supplier.name = supplierLines[0];
                    data.supplier.address = supplierLines.slice(1).join(' ');
                }
                
                i = j - 1;
                continue;
            }

            // Pozycje zamówienia
            if (line.includes('____________')) {
                const nextLine = lines[i + 1];
                if (nextLine && nextLine.includes('Nazwa') && nextLine.includes('Ilość')) {
                    inItemsSection = true;
                    i += 2; // Pomiń linię nagłówka i separator
                    continue;
                }
            }

            if (inItemsSection) {
                if (line.includes('Ilość pozycji na zamówieniu')) {
                    inItemsSection = false;
                    continue;
                }

                // Rozpoznawanie pozycji zamówienia - usunięto separator tysięcy
                const itemMatch = line.match(/^(\d{4})\s+([^0-9]+?)\s+(\d+)\s+(SZT|KG|L|M|OP)\s+(\d+,\d+)\/(?:SZT|KG|L|M|OP)\s+(\d+,\d+)/i);
                if (itemMatch) {
                    data.items.push({
                        position: itemMatch[1],
                        name: itemMatch[2].trim(),
                        quantity: parseInt(itemMatch[3]),
                        unit: itemMatch[4].toLowerCase(),
                        unitPrice: this.parseNumber(itemMatch[5]),
                        totalPrice: this.parseNumber(itemMatch[6])
                    });
                }
            }

            // Wartość całkowita - usunięto separator tysięcy
            const totalMatch = line.match(/Całk\.\s*wart\.\s*netto\s*PLN\s*(\d+,\d+)/i);
            if (totalMatch) {
                data.totalValue = this.parseNumber(totalMatch[1]);
            }
        }

        return data;
    }

    parseDate(dateStr) {
        try {
            const [day, month, year] = dateStr.split('.');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('Błąd parsowania daty:', dateStr);
            return null;
        }
    }

    parseNumber(numStr) {
        try {
            // Zamień tylko przecinek na kropkę, bez usuwania spacji
            const cleanNum = numStr.replace(',', '.');
            const result = parseFloat(cleanNum);
            if (isNaN(result)) {
                console.error('Nieprawidłowy format liczby:', numStr);
                return null;
            }
            return result;
        } catch (error) {
            console.error('Błąd parsowania liczby:', numStr);
            return null;
        }
    }
} 