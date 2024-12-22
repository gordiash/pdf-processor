export class FileHandler {
    constructor() {
        this.allowedTypes = ['application/pdf'];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
    }

    async validateFiles(fileList) {
        const files = Array.from(fileList);
        
        // Sprawdź typ plików
        const invalidTypes = files.filter(file => 
            !this.allowedTypes.includes(file.type));
        if (invalidTypes.length > 0) {
            throw new Error('Dozwolone są tylko pliki PDF');
        }

        // Sprawdź rozmiar plików
        const oversizedFiles = files.filter(file => 
            file.size > this.maxFileSize);
        if (oversizedFiles.length > 0) {
            throw new Error('Maksymalny rozmiar pliku to 10MB');
        }

        return files;
    }

    async readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    clear() {
        // Wyczyść input plików
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.value = '';
        }
    }

    getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    }

    getFileName(file) {
        return file.name.replace(/\.[^/.]+$/, '');
    }
} 