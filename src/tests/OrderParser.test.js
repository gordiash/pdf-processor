import { OrderParser } from '../services/OrderParser';

describe('OrderParser', () => {
    let parser;

    beforeEach(() => {
        parser = new OrderParser();
    });

    test('should parse order number and date correctly', () => {
        const text = 'Nr zamówienia / data zamówienia: 3204385797 / 11.12.2024';
        parser.parseOrderHeader(text);
        
        expect(parser.parsedData.orderNumber).toBe('3204385797');
        expect(parser.parsedData.orderDate).toBe('2024-12-11');
    });

    test('should parse delivery date correctly', () => {
        const text = 'Data dostawy: 17.12.2024, godz. 04:00';
        parser.parseOrderHeader(text);
        
        expect(parser.parsedData.deliveryDate).toBe('2024-12-17');
    });

    test('should parse order items correctly', () => {
        const text = `
            _________________
            1 Produkt A 10 100,00 1000,00
            2 Produkt B 5 200,00 1000,00
            _________________
        `;
        parser.parseOrderItems(text);
        
        expect(parser.parsedData.items).toHaveLength(2);
        expect(parser.parsedData.items[0]).toEqual({
            position: '1',
            name: 'Produkt A',
            quantity: 10,
            unitPrice: 100.00,
            totalPrice: 1000.00
        });
    });

    test('should validate total value', () => {
        const text = 'Całk. wart. netto PLN 10.800,00';
        parser.parseTotalValue(text);
        
        expect(parser.parsedData.totalValue).toBe(10800.00);
    });

    test('should throw error for missing required fields', () => {
        expect(() => {
            parser.validateParsedData();
        }).toThrow('Brak wymaganych pól');
    });
}); 