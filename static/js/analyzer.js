// static/js/analyzer.js

// ==================== Часть 1: Первая вкладка (загрузка файлов) ====================
let uploadedFiles = [];

// Drag & Drop обработчики
function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('dropZone').classList.add('border-blue-600', 'bg-blue-100');
}

function handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('dropZone').classList.remove('border-blue-600', 'bg-blue-100');
}

function handleDrop(e) {
    e.preventDefault();
    document.getElementById('dropZone').classList.remove('border-blue-600', 'bg-blue-100');
    handleFiles(e.dataTransfer.files);
}

function handleFileSelect(e) {
    handleFiles(e.target.files);
}

async function handleFiles(files) {
    for (let file of files) {
        const result = await uploadFile(file);
        if (result.success) {
            uploadedFiles.push(result);
            renderUploadedFiles();
        }
    }
}

function renderUploadedFiles() {
    const listEl = document.getElementById('uploadedList');
    listEl.innerHTML = uploadedFiles.length === 0
        ? '<p class="text-slate-400 italic text-center py-8">Пока нет загруженных снимков</p>'
        : uploadedFiles.map((file, i) => `
            <div class="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-2xl">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">🖼️</span>
                    <div>
                        <p class="font-medium text-slate-800">${file.name}</p>
                        <p class="text-xs text-slate-500">${file.date}</p>
                    </div>
                </div>
                <button onclick="removeFile(${i})" class="text-red-500 hover:text-red-700 px-3 py-1 rounded-xl hover:bg-red-100">✕</button>
            </div>`).join('');
    document.getElementById('fileCount').textContent = uploadedFiles.length;
}

function removeFile(i) { uploadedFiles.splice(i, 1); renderUploadedFiles(); }
function clearUploadedFiles() {
    if (confirm("Очистить все загруженные снимки?")) { uploadedFiles = []; renderUploadedFiles(); }
}

// ==================== Часть 2: Вторая вкладка — Анализ и маски ====================
let selectedItem = null;
let selectedNN = null;

// ==================== РЕЖИМ РЕЗУЛЬТАТА ====================
let mode = 'selection';                    // 'selection' или 'result'
let analysisHistory = [];                  // все проведённые анализы
let currentResultIndex = -1;               // индекс текущего результата в истории

// ==================== Обновление нейросетей ====================
function updateNeuralNetworks() {
    const container = document.getElementById('nnList');
    if (!container) return;
    container.innerHTML = '';

    const networks = [
        { id: 1, name: "Satellite Segmentation", desc: "Сегментация спутниковых снимков", type: "satellite" },
        { id: 2, name: "Aero Photo Analyzer", desc: "Анализ аэрофотоснимков", type: "aero" },
        { id: 3, name: "Universal Classifier", desc: "Универсальная модель", type: "universal" }
    ];

    networks.forEach(nn => {
        let visible = true;

        if (selectedItem) {
            if (selectedItem.type === 'area' && !selectedItem.isSubItem) {
                visible = (nn.type === 'universal');
            } else if (selectedItem.type === 'satellite' || selectedItem.type === 'satellite_from_area') {
                if (nn.type === 'aero') visible = false;
            } else if (selectedItem.type === 'aero') {
                if (nn.type === 'satellite') visible = false;
            }
        }

        if (!visible) return;

        const div = document.createElement('div');
        div.className = `nn-card p-5 rounded-3xl border transition-all cursor-pointer hover:shadow-md
                         ${selectedNN && selectedNN.id === nn.id
                             ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600 ring-inset'
                             : 'border-slate-200 hover:border-slate-300'}`;

        div.innerHTML = `<h4 class="font-semibold">${nn.name}</h4><p class="text-sm text-slate-600 mt-2">${nn.desc}</p>`;

        // ← Вот где происходит замена
        div.onclick = () => selectNN(div, nn.id);

        container.appendChild(div);
    });
}

function checkRunButton() {
    const btn = document.getElementById('runAnalysisBtn');
    if (!btn) return;

    let canRun = false;

    if (selectedItem && selectedNN !== null) {
        // 1. Выбран элемент из подсписка полигона (считается как спутниковый снимок)
        if (selectedItem.type === 'satellite_from_area') {
            canRun = true;
        }
        // 2. Выбран обычный спутниковый снимок
        else if (selectedItem.type === 'satellite') {
            canRun = true;
        }
        // 3. Выбран аэрофотоснимок
        else if (selectedItem.type === 'aero') {
            canRun = true;
        }
        // Если выбран только полигон без подэлемента — кнопка остаётся неактивной
    }

    btn.disabled = !canRun;
}

function openFindImagesModal() {
    if (!selectedItem || selectedItem.type !== 'area') return;
    alert(`Открывается модальное окно для полигона:\n${selectedItem.name}`);
}

// Инициализация вкладки 2
function initTab2() {
    console.log("Инициализация вкладки 2 запущена");

    document.getElementById('areasList').innerHTML = `
        <div class="space-y-3">
            <div onclick="selectItem(this, 'area', 1)" class="item p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition-colors">
                <p class="font-medium">Полигон Приморский</p>
                <p class="text-xs text-slate-500">Создан: 05.04.2026 • 124 га</p>
            </div>

            <!-- Тестовый полигон с подсписком -->
            <div id="polygonWithSub" class="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200">
                <div onclick="toggleSubList(this)" class="p-4 hover:bg-slate-100 cursor-pointer flex justify-between items-center">
                    <div>
                        <p class="font-medium">Тестовая область (модальное окно)</p>
                        <p class="text-xs text-slate-500">Создан: 06.04.2026</p>
                    </div>
                    <span class="text-xl transition-transform sub-arrow">›</span>
                </div>

                <!-- Подсписок (скрывается) -->
                <div id="subList" class="hidden px-4 pb-4 space-y-2">
                    <div onclick="selectSubItem(this, 101)" class="sub-item p-3 bg-white hover:bg-blue-50 rounded-xl cursor-pointer transition-colors border border-transparent">
                        <p class="font-medium text-sm">Sentinel-2_2025_04_12.tif</p>
                        <p class="text-xs text-slate-500">Облачность: 12% • Дата: 12.04.2025</p>
                    </div>
                    <div onclick="selectSubItem(this, 102)" class="sub-item p-3 bg-white hover:bg-blue-50 rounded-xl cursor-pointer transition-colors border border-transparent">
                        <p class="font-medium text-sm">Landsat_8_2025_03_28.tif</p>
                        <p class="text-xs text-slate-500">Облачность: 8% • Дата: 28.03.2025</p>
                    </div>
                </div>

                <!-- Блок выбранного снимка (остаётся видимым) -->
                <div id="selectedSubItemContainer" class="hidden px-4 pb-4">
                    <div class="text-xs text-slate-500 mb-1">Выбранный снимок:</div>
                    <div id="selectedSubItemDisplay" class="p-3 bg-blue-50 border border-blue-200 rounded-xl"></div>
                </div>
            </div>
        </div>
    `;

    // Спутниковые снимки
    document.getElementById('satelliteList').innerHTML = `
        <div onclick="selectItem(this, 'satellite', 1)" class="item p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition-colors">
            <p class="font-medium">Sentinel-2_2025_04_12.tif</p>
        </div>
    `;

    // Аэрофото
    document.getElementById('aeroList').innerHTML = `
        <div onclick="selectItem(this, 'aero', 1)" class="item p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition-colors">
            <p class="font-medium">Aero_2025_04_12.tif</p>
        </div>
        <div onclick="selectItem(this, 'aero', 2)" class="item p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition-colors">
            <p class="font-medium">Aero_test_01.png</p>
        </div>
        <div onclick="selectItem(this, 'aero', 3)" class="item p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition-colors">
            <p class="font-medium">Aero_winter_2024.jpg</p>
        </div>
    `;

    updateNeuralNetworks();
}

// ==================== КЛИК ПО ЗАГОЛОВКУ ПОЛИГОНА ====================
function toggleSubList(headerElement) {
    const subList = document.getElementById('subList');
    const arrow = headerElement.querySelector('.sub-arrow');
    const parent = headerElement.parentElement;
    const isOpen = !subList.classList.contains('hidden');

    if (isOpen) {
        // Повторный клик — закрываем и снимаем всё
        subList.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
        parent.classList.remove('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');
        resetAllSelection();               // ← полный сброс
    } else {
        // Первый клик — открываем и выделяем полигон
        resetAllSelection();
        parent.classList.add('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');

        selectedItem = {
            type: 'area',
            id: 2,
            name: "Тестовая область (модальное окно)",
            isSubItem: false
        };

        const findBtn = document.getElementById('findImagesBtn');
        if (findBtn) findBtn.disabled = false;

        subList.classList.remove('hidden');
        arrow.style.transform = 'rotate(90deg)';
    }

    updateNeuralNetworks();
    checkRunButton();
}

// ==================== ВЫБОР ЭЛЕМЕНТА ИЗ ПОДСПИСКА ====================
function selectSubItem(element, subId) {
    resetAllSelection();                     // полный сброс

    element.classList.add('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');

    selectedItem = {
        type: 'satellite_from_area',
        id: subId,
        name: element.querySelector('p:first-child').textContent.trim(),
        isSubItem: true,
        parentPolygon: "Тестовая область (модальное окно)"
    };

    showSelectedSubItem(selectedItem.name);

    // Кнопка "Найти снимки" всегда неактивна при выборе подэлемента
    const findBtn = document.getElementById('findImagesBtn');
    if (findBtn) findBtn.disabled = true;

    updateNeuralNetworks();
    checkRunButton();
}

// ==================== ВЫБОР ЛЮБОГО ЭЛЕМЕНТА ИЗ ОСНОВНЫХ СПИСКОВ ====================
function selectItem(element, type, id) {
    resetAllSelection();   // ← теперь всегда полностью сбрасываем, включая закрытие подсписка

    element.classList.add('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');

    selectedItem = {
        type,
        id,
        name: element.querySelector('p:first-child').textContent.trim(),
        isSubItem: false
    };

    const findBtn = document.getElementById('findImagesBtn');
    if (findBtn) findBtn.disabled = (type !== 'area');

    updateNeuralNetworks();
    checkRunButton();
}

// Вспомогательные функции для отображения/скрытия выбранного подэлемента
function showSelectedSubItem(name) {
    const container = document.getElementById('selectedSubItemContainer');
    const display = document.getElementById('selectedSubItemDisplay');
    if (container && display) {
        display.innerHTML = `
            <p class="font-medium text-sm">${name}</p>
            <p class="text-xs text-slate-500">Выбран для анализа</p>
        `;
        container.classList.remove('hidden');
    }
}

function hideSelectedSubItem() {
    const container = document.getElementById('selectedSubItemContainer');
    if (container) container.classList.add('hidden');
}

// ====================== ПОЛНЫЙ СБРОС ВСЕГО ======================
function resetAllSelection() {
    // Самый надёжный способ — снимаем обводку по реальному классу, который мы ставим
    document.querySelectorAll('.ring-2').forEach(el => {
        el.classList.remove('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');
    });

    // Закрываем подсписок
    const subList = document.getElementById('subList');
    const arrow = document.querySelector('.sub-arrow');
    if (subList) subList.classList.add('hidden');
    if (arrow) arrow.style.transform = 'rotate(0deg)';

    selectedItem = null;
    selectedNN = null;
    hideSelectedSubItem();

    const findBtn = document.getElementById('findImagesBtn');
    if (findBtn) findBtn.disabled = true;

    updateNeuralNetworks();
    checkRunButton();
}

// ==================== ВЫБОР НЕЙРОНКИ (с поддержкой повторного клика) ====================
function selectNN(element, nnId) {
    // Если уже выбрана эта же нейронка — снимаем выбор
    if (selectedNN && selectedNN.id === nnId) {
        selectedNN = null;
        document.querySelectorAll('.nn-card').forEach(card => {
            card.classList.remove('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');
        });
        updateNeuralNetworks();   // перерисуем карточки без выделения
        checkRunButton();
        return;
    }

    // Снимаем выделение со всех нейронок
    document.querySelectorAll('.nn-card').forEach(card => {
        card.classList.remove('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');
    });

    // Выделяем текущую
    element.classList.add('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');

    selectedNN = {
        id: nnId,
        name: element.querySelector('h4').textContent.trim()
    };

    updateNeuralNetworks();
    checkRunButton();
}

// ==================== Надёжная инициализация ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded сработал");

    // Добавляем красивые стили для элементов списков
    const style = document.createElement('style');
    style.innerHTML = `
        .item {
            transition: all 0.2s ease;
        }
        .item:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
    `;
    document.head.appendChild(style);

    style.innerHTML = `
        .item, .sub-item {
            transition: all 0.2s ease;
        }
        .item:hover, .sub-item:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        /* Hover НЕ снимает выделение */
        .item.ring-2:hover, .sub-item.ring-2:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
    `;
    document.head.appendChild(style);

    // Инициализация вкладки 2 с небольшой задержкой
    setTimeout(() => {
        if (document.querySelector('[x-show="currentTab === 1"]')) {
            initTab2();
        }
    }, 300);
});

let currentModalStep = 1;           // 1 = фильтры, 2 = список найденных, 3 = подтверждение
// let selectedImagesForPolygon = [];  выбранные снимки для текущего полигона
let selectedImageIds = [];

const fakeFoundImages = [
    {id:1, date:'2025-03-15', cloud:12, name:'SN-20250315-1432'},
    {id:2, date:'2025-03-12', cloud:8,  name:'SN-20250312-0911'},
    {id:3, date:'2025-03-10', cloud:25, name:'SN-20250310-1845'},
    {id:4, date:'2025-03-08', cloud:5,  name:'SN-20250308-1123'},
    {id:5, date:'2025-03-05', cloud:18, name:'SN-20250305-0741'},
    {id:6, date:'2025-03-03', cloud:9,  name:'SN-20250303-1522'},
    {id:7, date:'2025-03-01', cloud:3,  name:'SN-20250301-2210'},
    {id:8, date:'2025-02-28', cloud:15, name:'SN-20250228-0915'}
];

// ==================== ОТКРЫТИЕ МОДАЛЬНОГО ОКНА ====================
function openFindImagesModal() {
    currentModalStep = 1;
    selectedImagesForPolygon = [];
    document.getElementById('findImagesModal').classList.remove('hidden');
    renderModalStep();
}

// ==================== ЗАКРЫТИЕ ====================
function closeFindImagesModal() {
    document.getElementById('findImagesModal').classList.add('hidden');
}

// ==================== РЕНДЕР ШАГА ====================
function renderModalStep() {
    const content = document.getElementById('modalContent');
    const title = document.getElementById('modalTitle');
    const backBtn = document.getElementById('modalBackBtn');
    const nextBtn = document.getElementById('modalNextBtn');

    if (currentModalStep === 1) {                          // ФИЛЬТРЫ
        title.textContent = 'Необходима настройка для скачки спутникового снимка?';
        backBtn.classList.add('hidden');
        nextBtn.textContent = 'Далее';
        content.innerHTML = `
            <div class="space-y-6">
                <div class="p-5 bg-slate-50 rounded-3xl">
                    <label class="block text-sm font-medium mb-2">Облачность (%)</label>
                    <input type="range" min="0" max="100" value="30" class="w-full accent-blue-600">
                    <div class="flex justify-between text-xs text-slate-500 mt-1"><span>0%</span><span>100%</span></div>
                </div>
                <div class="p-5 bg-slate-50 rounded-3xl">
                    <label class="block text-sm font-medium mb-2">Период (сезон)</label>
                    <select class="w-full p-3 border border-slate-300 rounded-3xl text-sm">
                        <option>Любой</option><option>Весна</option><option>Лето</option><option>Осень</option><option>Зима</option>
                    </select>
                </div>
                <div class="p-5 bg-slate-50 rounded-3xl">
                    <label class="block text-sm font-medium mb-2">Актуальность (год или промежуток лет)</label>
                    <div class="flex gap-3">
                        <input type="number" value="2023" class="flex-1 p-3 border border-slate-300 rounded-3xl text-sm">
                        <span class="self-center text-slate-400 text-lg">—</span>
                        <input type="number" value="2025" class="flex-1 p-3 border border-slate-300 rounded-3xl text-sm">
                    </div>
                </div>
                <!-- Кнопка "Не найдено" (временная) -->
                <button onclick="showNoImagesFound()"
                        class="w-full py-3 text-red-600 border border-red-300 hover:bg-red-50 rounded-3xl text-sm font-medium">
                    Имитация: снимки не найдены
                </button>
            </div>`;
    }
    else if (currentModalStep === 2) {                     // СПИСОК НАЙДЕННЫХ
        title.textContent = `Найдено ${fakeFoundImages.length} снимков. Выберите даты для предпросмотра`;
        backBtn.classList.remove('hidden');
        nextBtn.textContent = 'Далее';
        content.innerHTML = `
            <div class="flex gap-4 h-[460px]">
                <div class="flex-1 flex flex-col">
                    <div class="text-xs text-slate-500 mb-3 flex justify-between items-baseline">
                        <span>Список (с указанием дат и облачности)</span>
                        <span class="text-blue-600 cursor-pointer underline">Сортировать по актуальности ↓</span>
                    </div>
                    <div id="foundImagesList" class="flex-1 overflow-y-auto space-y-2 pr-2"></div>
                    <div class="text-xs text-slate-400 mt-2 text-right">Выбрано: <span id="selectedCount" class="font-medium text-slate-700">0</span></div>
                </div>
                <div class="w-80 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 text-sm text-center">
                    Предпросмотр<br>нажмите на снимок слева
                </div>
            </div>`;
        renderFoundImagesList();
    }
    else if (currentModalStep === 3) {                     // ПОДТВЕРЖДЕНИЕ
        title.textContent = 'Подтвердите выбор снимка / снимков';
        backBtn.classList.remove('hidden');
        nextBtn.textContent = 'Подтвердить';
        content.innerHTML = `
            <div class="flex gap-4 h-[460px]">
                <div class="flex-1">
                    <div class="text-xs text-slate-500 mb-3">Список выбранных снимков</div>
                    <div id="selectedImagesConfirm" class="flex-1 overflow-y-auto space-y-2"></div>
                </div>
                <div class="w-80 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 text-sm">Предпросмотр</div>
            </div>`;
        renderSelectedImagesConfirm();
    }
}

// ==================== ФИНАЛЬНОЕ ДОБАВЛЕНИЕ В ПОДСПИСОК ====================
function addSelectedImagesToPolygon() {
    // Заглушка: добавляем пару тестовых снимков в подсписок полигона
    console.log('✅ Снимки добавлены в подсписок полигона');
    // Здесь в будущем будет реальное обновление areasList
    alert('Снимки успешно добавлены в подсписок полигона (заглушка)');
}

// ==================== СПИСОК НАЙДЕННЫХ СНИМКОВ ====================
function renderFoundImagesList() {
    const container = document.getElementById('foundImagesList');
    let html = '';
    fakeFoundImages.forEach(img => {
        const checked = selectedImageIds.includes(img.id) ? 'checked' : '';
        html += `
            <div onclick="toggleImageSelection(${img.id}, '${img.name}', '${img.date}', ${img.cloud})"
                 class="found-image flex justify-between items-center px-4 py-3 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:border-blue-300 text-sm">
                <div class="flex-1">
                    <div class="font-medium">${img.name}</div>
                    <div class="text-xs text-slate-500">${img.date} • облачность ${img.cloud}%</div>
                </div>
                <input type="checkbox" ${checked} class="w-5 h-5 accent-blue-600 pointer-events-none">
            </div>`;
    });
    container.innerHTML = html;
    updateSelectedCount();
}

function toggleImageSelection(id) {
    if (selectedImageIds.includes(id)) {
        selectedImageIds = selectedImageIds.filter(i => i !== id);
    } else {
        selectedImageIds.push(id);
    }
    renderFoundImagesList();           // обновляем список + счётчик
    updateSelectedCount();
}

function updateSelectedCount() {
    const el = document.getElementById('selectedCount');
    if (el) el.textContent = `${selectedImageIds.length} из ${fakeFoundImages.length}`;
}

// ==================== ПОДТВЕРЖДЕНИЕ ====================
function renderSelectedImagesConfirm() {
    const container = document.getElementById('selectedImagesConfirm');
    if (selectedImageIds.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-400">Ничего не выбрано</div>`;
        return;
    }
    let html = '';
    fakeFoundImages
        .filter(img => selectedImageIds.includes(img.id))
        .forEach(img => {
            html += `
                <div class="flex justify-between items-center px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm">
                    <div>
                        <div class="font-medium">${img.name}</div>
                        <div class="text-xs text-slate-500">${img.date} • ${img.cloud}%</div>
                    </div>
                    <button onclick="removeFromConfirm(${img.id}); event.stopImmediatePropagation()"
                            class="text-red-500 text-xs hover:underline">убрать</button>
                </div>`;
        });
    container.innerHTML = html;
}

function removeFromConfirm(id) {
    selectedImageIds = selectedImageIds.filter(i => i !== id);
    renderSelectedImagesConfirm();
}

// ==================== ТУПИКОВОЕ ОКНО ====================
function showNoImagesFound() {
    currentModalStep = 4;
    const content = document.getElementById('modalContent');
    const title = document.getElementById('modalTitle');
    const backBtn = document.getElementById('modalBackBtn');
    const nextBtn = document.getElementById('modalNextBtn');

    title.textContent = 'Снимки не найдены';
    backBtn.classList.remove('hidden');
    nextBtn.textContent = 'Изменить фильтры';
    content.innerHTML = `
        <div class="flex flex-col items-center justify-center h-80 text-center">
            <div class="text-6xl mb-6">😕</div>
            <p class="font-medium text-lg">По заданным параметрам ничего не найдено</p>
            <p class="text-slate-500 mt-2">Попробуйте изменить фильтры</p>
        </div>`;
}

// ==================== НАВИГАЦИЯ (обновлённая) ====================
function nextModalStep() {
    if (currentModalStep === 4) {
        currentModalStep = 1;               // возвращаемся на фильтры
        renderModalStep();
        return;
    }
    if (currentModalStep === 3) {
        addSelectedImagesToPolygon();
        closeFindImagesModal();
        return;
    }
    currentModalStep++;
    renderModalStep();
}

function prevModalStep() {
    if (currentModalStep === 1 || currentModalStep === 4) return;
    currentModalStep--;
    renderModalStep();
}

// ==================== ЗАПУСК АНАЛИЗА ====================
function runAnalysis() {
    if (!selectedItem || !selectedNN) return;

    const newResult = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        type: selectedItem.type === 'aero' ? 'aero' : 'satellite',
        itemName: selectedItem.name,
        nnName: selectedNN.name || 'NN #' + selectedNN.id,
        hasPolygon: selectedItem.isSubItem || selectedItem.type === 'area'
    };

    analysisHistory.unshift(newResult);
    currentResultIndex = 0;
    mode = 'result';

    renderResultMode();
}

// ==================== ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ ====================
function switchMode(newMode) {
    mode = newMode;
    if (mode === 'result') {
        renderResultMode();
    } else {
        initTab2();
    }
}

// ==================== ОТРИСОВКА РЕЗУЛЬТАТА ====================
function renderResultMode() {
    const historyEl = document.getElementById('analysisHistoryList');
    if (historyEl) {
        historyEl.innerHTML = analysisHistory.map((item, i) => `
            <div onclick="selectHistoryItem(${i})"
                 class="p-4 rounded-2xl cursor-pointer transition-all ${i === currentResultIndex ? 'bg-blue-50 border border-blue-600' : 'bg-slate-50 hover:bg-slate-100'}">
                <div class="flex justify-between text-sm">
                    <span class="font-medium">${item.nnName}</span>
                    <span class="text-slate-500">${item.timestamp}</span>
                </div>
                <p class="text-xs text-slate-600 mt-1">${item.itemName}</p>
            </div>
        `).join('');
    }

    const deepBtn = document.getElementById('deepAnalysisBtn');
    if (deepBtn) {
        deepBtn.classList.toggle('hidden', analysisHistory[currentResultIndex]?.type !== 'satellite');
    }
}

function selectHistoryItem(index) {
    currentResultIndex = index;
    renderResultMode();
}

function startDeepAnalysis() {
    alert('Открывается окно загрузки аэрофото для углублённого анализа (заглушка)');
}