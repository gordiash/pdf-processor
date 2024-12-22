import { PDFProcessor } from '../index.js';
import { FileHandler } from '../services/FileHandler.js';
import { PDFParser } from '../services/PDFParser.js';
import { ChatGPTService } from '../services/ChatGPTService.js';
import { ExportService } from '../services/ExportService.js';

async function runAllTests() {
    console.log('🔄 Rozpoczynam testy...');
    
    console.log('\n1. Test inicjalizacji:');
    await testInitialization();
    
    console.log('\n2. Test przetwarzania PDF:');
    await testPDFProcessing();
    
    console.log('\n3. Test czyszczenia prefiksów:');
    testContentCleaning();
    
    console.log('\n4. Test eksportu:');
    testExport();
    
    console.log('\n5. Test interfejsu:');
    testUI();
    
    console.log('\n✨ Testy zakończone');
}

// Funkcje testowe
async function testInitialization() {
    try {
        const processor = new PDFProcessor();
        await processor.initializeComponents();
        console.log('✅ Inicjalizacja komponentów poprawna');
    } catch (error) {
        console.error('❌ Błąd inicjalizacji:', error);
    }
}

async function testPDFProcessing() {
    try {
        // Przygotuj przykładowy plik PDF
        const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
        
        // Test walidacji pliku
        const fileHandler = new FileHandler();
        await fileHandler.validateFiles([testFile]);
        console.log('✅ Walidacja pliku poprawna');

        // Test parsowania PDF
        const pdfParser = new PDFParser();
        const result = await pdfParser.parsePDF(testFile);
        console.log('✅ Parsowanie PDF poprawne');
        console.log('Wynik parsowania:', result);
    } catch (error) {
        console.error('❌ Błąd przetwarzania PDF:', error);
    }
}

function testContentCleaning() {
    const chatGPTService = new ChatGPTService();
    const testCases = [
        {
            input: 'Zamówienie - Test 1',
            expected: 'Test 1'
        },
        {
            input: 'Zamówienie-Test 2',
            expected: 'Test 2'
        },
        {
            input: 'ZAMÓWIENIE - Test 3',
            expected: 'Test 3'
        },
        {
            input: 'Zwykły tekst',
            expected: 'Zwykły tekst'
        }
    ];

    testCases.forEach((testCase, index) => {
        const result = chatGPTService.cleanContent(testCase.input);
        const passed = result === testCase.expected;
        console.log(`Test ${index + 1}: ${passed ? '✅' : '❌'}`);
        if (!passed) {
            console.log(`Oczekiwano: "${testCase.expected}"`);
            console.log(`Otrzymano: "${result}"`);
        }
    });
}

function testExport() {
    const exportService = new ExportService();
    const testData = [
        { content: 'Test 1' },
        { content: 'Test 2' }
    ];

    try {
        // Test CSV
        const csvResult = exportService.toCSV(testData);
        console.log('✅ Export CSV poprawny:', csvResult);

        // Test TXT
        const txtResult = exportService.toTXT(testData);
        console.log('✅ Export TXT poprawny:', txtResult);

        // Test JSON
        const jsonResult = exportService.toJSON(testData);
        console.log('✅ Export JSON poprawny:', jsonResult);
    } catch (error) {
        console.error('❌ Błąd eksportu:', error);
    }
}

function testUI() {
    // Test przycisków
    const buttons = {
        'pdf-btn': document.getElementById('pdf-btn'),
        'clear-btn': document.getElementById('clear-btn'),
        'theme-toggle': document.getElementById('theme-toggle'),
        'select-all': document.getElementById('select-all')
    };

    Object.entries(buttons).forEach(([name, button]) => {
        if (button) {
            console.log(`✅ Przycisk ${name} znaleziony`);
        } else {
            console.error(`❌ Brak przycisku ${name}`);
        }
    });

    // Test kontenera wyników
    const resultsList = document.getElementById('results-list');
    if (resultsList) {
        console.log('✅ Kontener wyników znaleziony');
    } else {
        console.error('❌ Brak kontenera wyników');
    }
}

// Uruchom testy po załadowaniu strony
document.addEventListener('DOMContentLoaded', runAllTests); 