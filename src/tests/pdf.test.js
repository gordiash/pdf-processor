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