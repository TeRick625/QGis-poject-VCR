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
        { id: 1, name: "Многодатный анализ изменений", shortDesc: "...", type: "multidate", applicableTo: "Полигон...", detail: "..." },
        { id: 2, name: "Спутниковый анализ (из подсписка)", shortDesc: "...", type: "satellite", applicableTo: "...", detail: "..." },
        { id: 3, name: "Спутниковый анализ (загруженный)", shortDesc: "...", type: "satellite", applicableTo: "...", detail: "..." },
        { id: 4, name: "Аэрофото анализ", shortDesc: "...", type: "aero", applicableTo: "...", detail: "..." },
        { id: 5, name: "Аэрофото анализ с геопривязкой", shortDesc: "...", type: "aero", applicableTo: "...", detail: "..." }
    ],
    selectedAlgorithmData: null,

    isFindModalOpen: false,
    currentModalStep: 1,
    selectedImageIds: [],
    fakeFoundImages: [
        {id:1, date:'2025-03-15', cloud:12, name:'SN-20250315-1432'},
        // ... остальные заглушки
    ],

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
};