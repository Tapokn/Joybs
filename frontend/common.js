// ========== Глобальные переменные ==========
let currentTab = 'about';
let contextType = 'all';
let contextValue = '';
let currentOffset = 0;
const LIMIT = 20;
let totalVacancies = 0;
let isLoading = false;
let hasMore = true;

// Все загруженные вакансии (для клиентской фильтрации)
let allVacancies = [];
let filteredVacancies = [];

// Таймер для debounce
let filterTimeout = null;

// Chart.js инстансы
let pieChart, medianBarChart, histogramChart, workFormatChart, experienceChart, topSkillsChart, salaryImpactChart;

// ========== ЗАГЛУШКА ДЛЯ ФУНКЦИИ ГРАФА (переопределяется в about.js) ==========
function loadProfessionGraph() {
    console.warn('loadProfessionGraph is not loaded yet');
}

// ========== Переключение вкладок ==========
document.querySelectorAll('.header__tab').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.header__tab').forEach(b => b.classList.remove('header__tab--active'));
        this.classList.add('header__tab--active');
        const tab = this.dataset.tab;
        currentTab = tab;
        document.querySelectorAll('.section').forEach(s => s.classList.remove('section--active'));
        document.getElementById('section-' + tab).classList.add('section--active');
        if (tab === 'about' || tab === 'analytics') {
            document.getElementById('leftPanel').style.display = '';
            document.getElementById('rightPanel').style.display = '';
        } else {
            document.getElementById('leftPanel').style.display = 'none';
            document.getElementById('rightPanel').style.display = 'none';
        }
        if (tab === 'about') {
            loadProfessionGraph();
        } else if (tab === 'analytics') {
            loadAnalytics();
        } else if (tab === 'aggregator') {
            if (allVacancies.length === 0) {
                loadAllVacancies();
            } else {
                applyFiltersAndRender();
            }
        }
    });
});

// По умолчанию показываем "О проекте"
document.querySelector('.header__tab[data-tab="about"]').click();

// ========== Контекст ==========
document.querySelectorAll('.context-tab').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.context-tab').forEach(b => b.classList.remove('context-tab--active'));
        this.classList.add('context-tab--active');
        contextType = this.dataset.context;
        document.getElementById('contextSelector').style.display = (contextType === 'all') ? 'none' : 'block';
        if (currentTab === 'analytics') loadAnalytics();
        if (currentTab === 'about') loadProfessionGraph();
    });
});
document.getElementById('contextSelector').style.display = 'none';

document.getElementById('applyContext').addEventListener('click', function() {
    contextValue = document.getElementById('contextValue').value.trim();
    if (currentTab === 'analytics') loadAnalytics();
    if (currentTab === 'about') loadProfessionGraph();
});