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