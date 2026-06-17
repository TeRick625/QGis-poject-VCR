export const state = {
    currentTab: 0,
    mode: 'selection',

    highlightedItemId: null,
    selectedWorkspaceItemId: null,
    editingItemId: null,

    workspaceFilter: { polygon: true, satellite: true, aero: true },
    workspaceSort: 'date',
    workspaceSortAsc: false,

    renamingItemId: null,
    renamingValue: '',

    selectedItem: null,
    selectedNN: null,

    workspaceItems: [],

    coordModalOpen: false,
    coordInputs: [{ value: '' }, { value: '' }, { value: '' }],

    neuralNetworks: [
        {
            id: 1,
            code_name: "satellite_multi",
            name: "Многодатный анализ изменений",
            shortDesc: "Сравнение серии снимков Sentinel-2 во времени",
            detail: "Анализирует архивные снимки за выбранный период. Строит композитную маску усыхания, устраняя облачность. Позволяет отследить динамику деградации.",
            type: "multidate",
            applicableTo: "Полигон (с привязанными снимками)",
            icon: "📊"
        },
        {
            id: 2,
            code_name: "satellite_single",
            name: "Спутниковый анализ (одиночный)",
            shortDesc: "Построение маски по одному снимку Sentinel-2",
            detail: "Рассчитывает NDVI для обнаружения зон усыхания на основе одного актуального снимка. Автоматически маскирует облака.",
            type: "satellite",
            applicableTo: "Спутниковый снимок (GeoTIFF / GEE)",
            icon: "🛰️"
        },
        {
            id: 3,
            code_name: "aerial_segment",
            name: "Аэрофото анализ (UNet)",
            shortDesc: "Нейросетевая сегментация крон деревьев",
            detail: "Использует U-Net для пиксельной классификации аэрофотоснимка. Если к снимку привязан KML-полигон, алгоритм автоматически рассчитает статистику усыхания строго внутри его границ.",
            type: "aero",
            applicableTo: "Аэрофотоснимок (с KML или без)",
            icon: "🌲"
        }
    ],
    selectedAlgorithmData: null,

    isFindModalOpen: false,
    currentModalStep: 1,
    selectedImageIds: [],
    maxSelectableImages: 20,  // Лимит на количество выбираемых снимков
    foundImages: [],  // Массив найденных снимков (заглушки удалены, теперь заполняется с сервера)

    analysisHistory: [],
    activeResult: null,
    currentResultIndex: -1,

    uploadModalOpen: false,
    uploadModal: {
        satelliteFiles: [],
        polygonFiles: [],
        aeroEntries: [],
        activeSection: null
    },

    activationModalOpen: false,
    activationShowParams: false,
    activationMethod: null,
    activationParams: { cloudMax: 30, yearFrom: 2023, yearTo: 2025, season: 'Любой' },
    uploadedSnapshots: [],
    uploadedSnapshotIds: [],

    uploadedAeroFile: null,
    deepAnalysisEnabled: false,
    resultViewType: null,
    polygonOpacity: 0.5,
    aeroOverlayOpacity: 0.6,
    openAreaId: null,

    selectedAreaId: null,
    selectedSatelliteId: null,
    selectedAeroId: null,

    // Состояние аккордеонов для полигонов со спутниковыми снимками
    expandedPolygons: {},
};