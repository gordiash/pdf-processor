export class ChatGPTService {
    constructor() {
        this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        this.assistantId = import.meta.env.VITE_OPENAI_ASSISTANT_ID;
        this.apiUrl = 'https://api.openai.com/v1';
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.validateConfig();
    }

    validateConfig() {
        if (!this.apiKey || !this.apiKey.startsWith('sk-')) {
            throw new Error('Nieprawidłowy klucz API OpenAI. Klucz musi zaczynać się od "sk-"');
        }

        if (!this.assistantId || !this.assistantId.startsWith('asst_')) {
            throw new Error('Nieprawidłowe ID asystenta. ID musi zaczynać się od "asst_"');
        }
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'assistants=v2',
            'OpenAI-Organization': import.meta.env.VITE_OPENAI_ORG_ID
        };
    }

    async processOrderData(pdfData) {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const thread = await this.createThread();
                await this.addMessage(thread.id, pdfData);
                const run = await this.runAssistant(thread.id);
                await this.waitForCompletion(thread.id, run.id);
                
                const messages = await this.getMessages(thread.id);
                const assistantMessage = messages.find(msg => msg.role === 'assistant');
                
                if (!assistantMessage) {
                    throw new Error('Brak odpowiedzi od asystenta');
                }

                await this.deleteThread(thread.id);
                return this.parseResponse(assistantMessage.content[0].text.value);
            } catch (error) {
                retries++;
                if (retries === this.maxRetries) {
                    console.error('Przekroczono maksymalną liczbę prób:', error);
                    throw new Error(`Błąd przetwarzania po ${this.maxRetries} próbach: ${error.message}`);
                }
                console.warn(`Próba ${retries}/${this.maxRetries} nie powiodła się, ponawiam...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * retries));
            }
        }
    }

    async createThread() {
        console.log('Tworzenie nowego wątku...');
        const response = await fetch(`${this.apiUrl}/threads`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Błąd tworzenia wątku: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        return await response.json();
    }

    async addMessage(threadId, pdfData) {
        const prompt = this.createPrompt(pdfData);
        
        console.log('Wysyłanie wiadomości o długości:', prompt.length);

        const response = await fetch(`${this.apiUrl}/threads/${threadId}/messages`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                role: 'user',
                content: prompt
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (process.env.NODE_ENV === 'production') {
                console.error('Błąd dodawania wiadomości:', response.status);
            } else {
                console.error('Pełna odpowiedź:', errorData);
            }
            throw new Error(`Błąd dodawania wiadomości: ${response.status}`);
        }

        return await response.json();
    }

    async runAssistant(threadId) {
        const response = await fetch(`${this.apiUrl}/threads/${threadId}/runs`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                assistant_id: this.assistantId,
                instructions: 'Analizuj dane zamówienia i przedstaw wnioski w jasny i zwięzły sposób.'
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Błąd uruchamiania asystenta: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        return await response.json();
    }

    async waitForCompletion(threadId, runId) {
        let attempts = 0;
        const maxAttempts = 30; // Maksymalnie 30 sekund oczekiwania
        
        while (attempts < maxAttempts) {
            try {
                const response = await fetch(
                    `${this.apiUrl}/threads/${threadId}/runs/${runId}`,
                    {
                        headers: this.getHeaders()
                    }
                );

                if (!response.ok) {
                    throw new Error(`Błąd sprawdzania statusu: ${response.status}`);
                }

                const run = await response.json();
                
                if (run.status === 'completed') {
                    return run;
                } else if (run.status === 'failed' || run.status === 'cancelled') {
                    throw new Error(`Analiza zakończona statusem: ${run.status}`);
                }

                attempts++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                attempts++;
                if (attempts === maxAttempts) {
                    throw new Error('Przekroczono limit czasu oczekiwania na odpowiedź');
                }
                console.warn(`Próba ${attempts}/${maxAttempts} sprawdzenia statusu nie powiodła się`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        throw new Error('Przekroczono limit czasu oczekiwania na odpowiedź');
    }

    async getMessages(threadId) {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const response = await fetch(
                    `${this.apiUrl}/threads/${threadId}/messages`,
                    {
                        headers: this.getHeaders()
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
                }

                const data = await response.json();
                
                if (!data.data || data.data.length === 0) {
                    throw new Error('Brak wiadomości w odpowiedzi');
                }

                return data.data;
            } catch (error) {
                retries++;
                if (retries === this.maxRetries) {
                    throw new Error(`Błąd pobierania wiadomości po ${this.maxRetries} próbach: ${error.message}`);
                }
                console.warn(`Próba ${retries}/${this.maxRetries} pobrania wiadomości nie powiodła się, ponawiam...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * retries));
            }
        }
    }

    async deleteThread(threadId) {
        const response = await fetch(
            `${this.apiUrl}/threads/${threadId}`,
            {
                method: 'DELETE',
                headers: this.getHeaders()
            }
        );

        if (!response.ok) {
            console.warn(`Błąd usuwania wątku: ${response.status}`);
        }
    }

    createPrompt(pdfData) {
        if (!pdfData || !pdfData.text) {
            throw new Error('Brak tekstu do analizy');
        }

        console.log('Tworzenie promptu dla dokumentu o długości:', pdfData.text.length);

        return `Przeanalizuj poniższą zawartość dokumentu i wyodrębnij kluczowe informacje. Przedstaw każdą informację w osobnej linii:

${pdfData.text}

Wyodrębnij:
- istotne informacje wynikające z otrzymanych danych
- dane w formacie JSON

Nie dodawaj żadnych nagłówków ani opisów - tylko same dane.
Ucz się schematów plików pdf z których otrzymujesz dane aby zmieniać się w zależności od ich struktury i poprawnie je analizować.`;
    }

    parseResponse(response) {
        if (!response) {
            throw new Error('Brak treści odpowiedzi');
        }

        try {
            console.log('Przetwarzanie odpowiedzi o długości:', response.length);

            // Znajdź JSON w odpowiedzi
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                // Jeśli znaleziono JSON, parsuj go
                const jsonData = JSON.parse(jsonMatch[0]);
                const data = [];

                // Konwertuj każdą parę klucz-wartość na element listy
                Object.entries(jsonData).forEach(([key, value]) => {
                    if (Array.isArray(value)) {
                        value.forEach((item, index) => {
                            if (typeof item === 'object') {
                                Object.entries(item).forEach(([itemKey, itemValue]) => {
                                    data.push({
                                        content: this.cleanContent(`${key} ${index + 1} - ${itemKey}: ${itemValue}`)
                                    });
                                });
                            } else {
                                data.push({
                                    content: this.cleanContent(`${key} ${index + 1}: ${item}`)
                                });
                            }
                        });
                    } else if (typeof value === 'object') {
                        Object.entries(value).forEach(([subKey, subValue]) => {
                            data.push({
                                content: this.cleanContent(`${key} - ${subKey}: ${subValue}`)
                            });
                        });
                    } else {
                        data.push({
                            content: this.cleanContent(`${key}: ${value}`)
                        });
                    }
                });

                return {
                    type: 'gpt_analysis',
                    content: response,
                    sections: data
                };
            } else {
                // Jeśli nie znaleziono JSON, podziel tekst na linie
                const lines = response.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.match(/^\d+\./)) // Usuń numerację
                    .map(line => ({
                        content: this.cleanContent(line.replace(/^[-•]\s*/, '')) // Usuń myślniki i kropki
                    }));

                return {
                    type: 'gpt_analysis',
                    content: response,
                    sections: lines
                };
            }
        } catch (error) {
            console.error('Błąd parsowania odpowiedzi');
            throw error;
        }
    }

    // Dodaj nową metodę do czyszczenia contentu
    cleanContent(text) {
        return text.replace(/^Zamówienie\s*-\s*/i, '');
    }

    extractSections(response) {
        // Podziel odpowiedź na sekcje
        const sections = [];
        let currentSection = '';
        let currentTitle = '';

        response.split('\n').forEach(line => {
            if (line.match(/^\d+\./)) {
                if (currentTitle) {
                    sections.push({ title: currentTitle, content: currentSection.trim() });
                }
                currentTitle = line;
                currentSection = '';
            } else {
                currentSection += line + '\n';
            }
        });

        if (currentTitle) {
            sections.push({ title: currentTitle, content: currentSection.trim() });
        }

        return sections;
    }

    async checkConnection() {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Błąd połączenia z API OpenAI: ${error.error.message}`);
            }

            console.log('Połączenie z API OpenAI działa prawidłowo');
            return true;
        } catch (error) {
            console.error('Błąd podczas sprawdzania połączenia:', error);
            throw error;
        }
    }
} 