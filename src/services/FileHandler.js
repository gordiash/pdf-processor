export class FileHandler {
    constructor() {
        this.allowedTypes = {
            'application/pdf': ['.pdf'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png']
        };
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
    }

    async validateFiles(files) {
        if (!files || files.length === 0) {
            throw new Error('Nie wybrano plików');
        }

        const validatedFiles = [];

        for (const file of files) {
            // Sprawdź typ pliku
            const isValidType = Object.keys(this.allowedTypes).includes(file.type);
            if (!isValidType) {
                throw new Error(`Nieprawidłowy format pliku: ${file.name}. Dozwolone formaty: PDF, JPG, PNG`);
            }

            // Sprawdź rozmiar
            if (file.size > this.maxFileSize) {
                throw new Error(`Plik ${file.name} jest za duży. Maksymalny rozmiar to ${this.maxFileSize / 1024 / 1024}MB`);
            }

            validatedFiles.push(file);
        }

        return validatedFiles;
    }

    getFileType(file) {
        if (file.type === 'application/pdf') {
            return 'pdf';
        } else if (file.type.startsWith('image/')) {
            return 'image';
        }
        return 'unknown';
    }

    clear() {
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.value = '';
        }
    }
} 