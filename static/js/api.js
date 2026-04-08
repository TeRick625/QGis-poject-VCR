// static/js/api.js

// Загрузка файла
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Ошибка загрузки файла:', error);
        return { error: error.message };
    }
}

// Запуск анализа
async function startAnalysis(files, polygon) {
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: files,
                polygon: polygon
            })
        });

        return await response.json();
    } catch (error) {
        console.error('Ошибка анализа:', error);
        return { error: error.message };
    }
}