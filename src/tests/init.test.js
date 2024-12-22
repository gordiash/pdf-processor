async function testInitialization() {
    try {
        const processor = new PDFProcessor();
        await processor.initializeComponents();
        console.log('✅ Inicjalizacja komponentów poprawna');
    } catch (error) {
        console.error('❌ Błąd inicjalizacji:', error);
    }
} 