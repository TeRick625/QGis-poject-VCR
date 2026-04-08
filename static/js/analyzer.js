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

// ==================== Выбор элемента из основных списков ====================
function selectItem(element, type, id) {
    document.querySelectorAll('.item, .sub-item').forEach(el => {
        el.classList.remove('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');
    });

    // Если клик на уже выбранный — снимаем выбор
    if (selectedItem && selectedItem.id === id && selectedItem.type === type) {
        selectedItem = null;
        selectedNN = null;
        const displayContainer = document.getElementById('selectedSubItemContainer');
        if (displayContainer) displayContainer.classList.add('hidden');
        updateNeuralNetworks();
        checkRunButton();
        return;
    }

    element.classList.add('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');

    selectedItem = {
        type,
        id,
        name: element.querySelector('p:first-child').textContent.trim(),
        isSubItem: false
    };

    // Если выбран не подэлемент — прячем блок выбранного снимка из подсписка
    const displayContainer = document.getElementById('selectedSubItemContainer');
    if (displayContainer) displayContainer.classList.add('hidden');

    updateNeuralNetworks();
    checkRunButton();

    const findBtn = document.getElementById('findImagesBtn');
    if (findBtn) findBtn.disabled = (type !== 'area');
}

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
            // Для полигонов без выбранного подэлемента — показываем только универсальную
            if (selectedItem.type === 'area' && !selectedItem.isSubItem) {
                visible = (nn.type === 'universal');
            }
            // Для спутниковых снимков (включая из подсписка) — скрываем Aero
            else if (selectedItem.type === 'satellite' || selectedItem.type === 'satellite_from_area') {
                if (nn.type === 'aero') visible = false;
            }
            // Для аэрофото — скрываем Satellite
            else if (selectedItem.type === 'aero') {
                if (nn.type === 'satellite') visible = false;
            }
        }

        if (!visible) return;

        const div = document.createElement('div');
        div.className = `p-5 rounded-3xl border transition-all cursor-pointer hover:shadow-md ${selectedNN === nn.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`;
        div.innerHTML = `<h4 class="font-semibold">${nn.name}</h4><p class="text-sm text-slate-600 mt-2">${nn.desc}</p>`;
        div.onclick = () => {
            selectedNN = nn.id;
            updateNeuralNetworks();
            checkRunButton();
        };
        container.appendChild(div);
    });
}

function checkRunButton() {
    const btn = document.getElementById('runAnalysisBtn');
    if (!btn) return;

    // Кнопка активна ТОЛЬКО если выбран элемент из подсписка полигона + нейросеть
    const canRun = selectedItem &&
                   selectedItem.isSubItem === true &&
                   selectedItem.type === 'satellite_from_area' &&
                   selectedNN !== null;

    btn.disabled = !canRun;
}

function runAnalysis() {
    if (!selectedItem || !selectedNN) return;
    alert(`Запущен анализ:\nЭлемент: ${selectedItem.name}\nНейросеть: #${selectedNN}`);
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

// ==================== Раскрытие/закрытие подсписка ====================
function toggleSubList(headerElement) {
    const subList = document.getElementById('subList');
    const arrow = headerElement.querySelector('.sub-arrow');

    subList.classList.toggle('hidden');
    arrow.style.transform = subList.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)';
}

// ==================== Выбор элемента из подсписка ====================
function selectSubItem(element, subId) {
    // Снимаем все выделения
    document.querySelectorAll('.item, .sub-item').forEach(el => {
        el.classList.remove('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');
    });

    // Повторный клик — снимаем выбор
    if (selectedItem && selectedItem.id === subId && selectedItem.type === 'satellite_from_area') {
        selectedItem = null;
        selectedNN = null;
        const displayContainer = document.getElementById('selectedSubItemContainer');
        if (displayContainer) displayContainer.classList.add('hidden');
        // Снимаем обводку с родительского полигона
        const parent = document.getElementById('polygonWithSub');
        if (parent) parent.classList.remove('ring-2', 'ring-blue-600', 'ring-inset');
        updateNeuralNetworks();
        checkRunButton();
        return;
    }

    element.classList.add('ring-2', 'ring-blue-600', 'bg-blue-50', 'ring-inset');

    selectedItem = {
        type: 'satellite_from_area',
        id: subId,
        name: element.querySelector('p:first-child').textContent.trim(),
        isSubItem: true,
        parentPolygon: "Тестовая область (модальное окно)"
    };

    // Показываем выбранный элемент
    const displayContainer = document.getElementById('selectedSubItemContainer');
    const displayEl = document.getElementById('selectedSubItemDisplay');
    displayEl.innerHTML = `
        <p class="font-medium text-sm">${selectedItem.name}</p>
        <p class="text-xs text-slate-500">Выбран для анализа</p>
    `;
    displayContainer.classList.remove('hidden');

    // Добавляем обводку на родительский полигон
    const parent = document.getElementById('polygonWithSub');
    if (parent) parent.classList.add('ring-2', 'ring-blue-600', 'ring-inset');

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
        .item:hover, .sub-item:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        /* Сохраняем hover даже если элемент уже выбран */
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