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