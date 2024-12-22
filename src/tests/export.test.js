function testExport() {
    const exportService = new ExportService();
    const testData = [
        { content: 'Test 1' },
        { content: 'Test 2' }
    ];

    try {
        // Test CSV
        const csvResult = exportService.toCSV(testData);
        console.log('✅ Export CSV poprawny');

        // Test TXT
        const txtResult = exportService.toTXT(testData);
        console.log('✅ Export TXT poprawny');

        // Test JSON
        const jsonResult = exportService.toJSON(testData);
        console.log('✅ Export JSON poprawny');
    } catch (error) {
        console.error('❌ Błąd eksportu:', error);
    }
} 