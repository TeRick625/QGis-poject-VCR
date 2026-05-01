// static/js/modules/tab1.js

/**
 * Инициализация вкладки 1 (вызывается при переходе на неё)
 * @param {Object} state - реактивное состояние из Alpine
 */
export function initTab1(state) {
    console.log("✅ initTab1() вызван");
    renderUploadedFiles(state);
}

/**
 * Отобразить количество загруженных файлов (пока просто лог)
 * @param {Object} state
 */
export function renderUploadedFiles(state) {
    console.log(`Загружено файлов: ${state.uploadedFiles.length}`);
}

/**
 * Обработчик получения файлов (из drag&drop или input)
 * @param {FileList} files
 * @param {Object} state
 */
export async function handleFiles(files, state) {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
        const result = await uploadFile(file, state);
        if (result && result.success) {
            state.uploadedFiles.push(result);
            renderUploadedFiles(state);
        }
    }
}

/**
 * Отправка одного файла на сервер
 * @param {File} file
 * @param {Object} state (не обязательно здесь, но для единообразия)
 * @returns {Promise<Object>}
 */
async function uploadFile(file, state) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            return {
                success: true,
                name: data.name,
                path: data.path,
                date: data.date || new Date().toLocaleDateString('ru-RU')
            };
        }
        return { success: false };
    } catch (error) {
        console.error('Ошибка загрузки файла:', error);
        return { success: false };
    }
}

/**
 * Удалить один файл из списка загруженных
 * @param {number} index
 * @param {Object} state
 */
export function removeFile(index, state) {
    state.uploadedFiles.splice(index, 1);
}

/**
 * Очистить весь список загруженных файлов
 * @param {Object} state
 */
export function clearUploadedFiles(state) {
    if (confirm("Очистить все загруженные снимки?")) {
        state.uploadedFiles = [];
    }
}