export class ExportService {
    async export(items, format) {
        let content = '';
        
        switch (format) {
            case 'csv':
                content = this.toCSV(items);
                break;
            case 'txt':
                content = this.toTXT(items);
                break;
            case 'json':
                content = this.toJSON(items);
                break;
            default:
                throw new Error('Nieobsługiwany format eksportu');
        }

        this.downloadFile(content, format);
    }

    toCSV(items) {
        // Eksportuj tylko treść, każda w nowej linii
        return items
            .map(item => `"${item.content.replace(/"/g, '""')}"`)
            .join('\n');
    }

    toTXT(items) {
        // Eksportuj treść, każda w nowej linii
        return items
            .map(item => item.content)
            .join('\n\n');
    }

    toJSON(items) {
        // Eksportuj tablicę treści
        const data = items.map(item => item.content);
        return JSON.stringify(data, null, 2);
    }

    downloadFile(content, format) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        a.href = url;
        a.download = `export-${timestamp}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
} 