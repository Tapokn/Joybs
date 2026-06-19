// ========== Глобальные переменные ==========
let currentTab = 'about';
let contextType = 'all';
let contextValue = '';
let currentOffset = 0;
const LIMIT = 20;
let totalVacancies = 0;
let isLoading = false;
let hasMore = true;

let allVacancies = [];
let filteredVacancies = [];
let filterTimeout = null;

let pieChart, medianBarChart, histogramChart, workFormatChart, experienceChart, topSkillsChart, salaryImpactChart;

// ========== ПЕРЕМЕННЫЕ ДЛЯ КОНТЕКСТНОГО МЕНЮ ==========
const contextTabs = document.querySelectorAll('.context-tab');
const contextDropdown = document.getElementById('contextDropdown');
let groupsData = [];
let professionsData = [];

// ========== ПЕРЕМЕННЫЕ ДЛЯ АГРЕГАТОРА (общие) ==========
// (будут использоваться в aggregator.js, но объявлены здесь, чтобы избежать дублирования)
let companiesData = [];
let selectedCompany = '';
let selectedProfession = '';
let experienceData = [];
let selectedExperience = '';
const sortOptions = [
    { value: 'relevance', label: 'По релевантности' },
    { value: 'date', label: 'По новизне' },
    { value: 'salary', label: 'По зарплате' }
];
let selectedSort = 'relevance';

// ========== ЗАГЛУШКА ДЛЯ ГРАФА ==========
function loadProfessionGraph() {
    console.warn('loadProfessionGraph is not loaded yet');
}

// ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========
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
                loadAllVacancies();  // определена в aggregator.js
            } else {
                applyFiltersAndRender();  // определена в aggregator.js
            }
        }
        // Скрываем выпадающее меню при переключении вкладки
        closeContextDropdown();
    });
});

document.querySelector('.header__tab[data-tab="about"]').click();

// ========== КОНТЕКСТ (левая панель) ==========

// Загрузка групп
async function loadGroups() {
    if (groupsData.length) return groupsData;
    try {
        const resp = await fetch('/api/analytics/overview?context_type=all');
        const data = await resp.json();
        groupsData = data.median_by_groups.map(d => d.label);
        return groupsData;
    } catch(e) {
        console.error('Ошибка загрузки групп:', e);
        return [];
    }
}

// Загрузка профессий
async function loadProfessions() {
    if (professionsData.length) return professionsData;
    try {
        const resp = await fetch('/api/vacancies/professions');
        professionsData = await resp.json();
        return professionsData;
    } catch(e) {
        console.error('Ошибка загрузки профессий:', e);
        return [];
    }
}

// Закрыть dropdown
function closeContextDropdown() {
    if (contextDropdown) {
        contextDropdown.classList.remove('active');
        contextDropdown.innerHTML = '';
    }
}

// Показать dropdown для группы
async function showGroupDropdown() {
    const groups = await loadGroups();
    if (!groups.length) {
        contextDropdown.innerHTML = '<div class="context-hint">Нет групп</div>';
        contextDropdown.classList.add('active');
        return;
    }
    contextDropdown.innerHTML = '';
    groups.forEach(group => {
        const item = document.createElement('div');
        item.className = 'context-item';
        item.textContent = group;
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            selectContextGroup(group);
        });
        contextDropdown.appendChild(item);
    });
    contextDropdown.classList.add('active');
}

// Показать dropdown для профессии
// Показать dropdown для профессии
async function showProfessionDropdown() {
    let professions = [];
    if (contextType === 'group' && contextValue) {
        try {
            const resp = await fetch(`/api/vacancies/professions/by-group?group=${encodeURIComponent(contextValue)}`);
            professions = await resp.json();
        } catch(e) {
            console.error('Ошибка загрузки профессий по группе:', e);
            professions = [];
        }
    } else {
        professions = await loadProfessions();
    }

    contextDropdown.innerHTML = '';
    // Поле ввода
    const wrapper = document.createElement('div');
    wrapper.className = 'context-input-wrapper';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Введите или выберите профессию...';
    input.autocomplete = 'off';
    input.addEventListener('input', function() {
        const val = this.value.trim();
        const filtered = professions.filter(p => p.toLowerCase().includes(val.toLowerCase()));
        renderProfessionItems(filtered, val);
    });
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const val = this.value.trim();
            if (val) {
                selectContextProfession(val);
            }
        }
    });
    wrapper.appendChild(input);
    contextDropdown.appendChild(wrapper);

    // Контейнер для списка профессий
    const listContainer = document.createElement('div');
    listContainer.className = 'context-profession-list';
    contextDropdown.appendChild(listContainer);

    function renderProfessionItems(items, searchVal) {
        listContainer.innerHTML = '';
        if (!items.length) {
            const hint = document.createElement('div');
            hint.className = 'context-hint';
            hint.textContent = 'Нет совпадений';
            listContainer.appendChild(hint);
            return;
        }
        items.forEach(prof => {
            const item = document.createElement('div');
            item.className = 'context-item';
            item.textContent = prof;
            // Используем mousedown с preventDefault, чтобы обработать до потери фокуса
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Выбрана профессия:', prof); // отладка
                selectContextProfession(prof);
            });
            listContainer.appendChild(item);
        });
    }

    renderProfessionItems(professions, '');
    contextDropdown.classList.add('active');
    setTimeout(() => input.focus(), 50);
}

// Выбор профессии (убедитесь, что функция существует и вызывает applyContext)
function selectContextProfession(prof) {
    contextValue = prof;
    contextType = 'profession';
    contextTabs.forEach(tab => {
        tab.classList.toggle('context-tab--active', tab.dataset.context === 'profession');
    });
    closeContextDropdown();
    // Принудительно применяем контекст
    applyContext();
    console.log('Контекст применён: профессия =', contextValue);
}

// Выбор группы
function selectContextGroup(group) {
    contextValue = group;
    contextType = 'group';
    contextTabs.forEach(tab => {
        tab.classList.toggle('context-tab--active', tab.dataset.context === 'group');
    });
    const graphGroupFilter = document.getElementById('graphGroupFilter');
    if (graphGroupFilter) {
        graphGroupFilter.value = group;
    }
    closeContextDropdown();
    applyContext();
}

// Выбор профессии
function selectContextProfession(prof) {
    contextValue = prof;
    contextType = 'profession';
    contextTabs.forEach(tab => {
        tab.classList.toggle('context-tab--active', tab.dataset.context === 'profession');
    });
    closeContextDropdown();
    applyContext();
}

// Применение контекста
function applyContext() {
    if (currentTab === 'analytics') loadAnalytics();
    if (currentTab === 'about') loadProfessionGraph();
    if (currentTab === 'aggregator' && typeof applyFiltersAndRender === 'function') {
        applyFiltersAndRender(true);
    }
}

// Обработчики кликов на кнопки контекста
contextTabs.forEach(tab => {
    tab.addEventListener('click', function(e) {
        e.stopPropagation();
        const type = this.dataset.context;
        if (this.classList.contains('context-tab--active') && contextDropdown.classList.contains('active')) {
            closeContextDropdown();
            return;
        }
        if (type === 'all') {
            contextType = 'all';
            contextValue = '';
            contextTabs.forEach(t => t.classList.remove('context-tab--active'));
            this.classList.add('context-tab--active');
            closeContextDropdown();
            // Очищаем селектор графа, если он ещё существует (для безопасности)
            const graphGroupFilter = document.getElementById('graphGroupFilter');
            if (graphGroupFilter) {
                graphGroupFilter.value = '';
            }
            applyContext();
            return;
        }
        if (type === 'group') {
            if (contextDropdown.classList.contains('active')) {
                closeContextDropdown();
            }
            showGroupDropdown();
        } else if (type === 'profession') {
            if (contextDropdown.classList.contains('active')) {
                closeContextDropdown();
            }
            showProfessionDropdown();
        }
    });
});

// Закрытие dropdown при клике вне его
document.addEventListener('click', function(e) {
    if (!e.target.closest('.context-tabs')) {
        closeContextDropdown();
    }
});

// ========== СТАРЫЙ КОНТЕКСТНЫЙ СЕЛЕКТОР (оставляем для совместимости) ==========
document.getElementById('contextSelector').style.display = 'none';

document.getElementById('applyContext').addEventListener('click', function() {
    contextValue = document.getElementById('contextValue').value.trim();
    if (currentTab === 'analytics') loadAnalytics();
    if (currentTab === 'about') loadProfessionGraph();
});

// ========== СКРЫТИЕ ХЕДЕРА ПРИ СКРОЛЛЕ ==========
let lastScrollY = window.scrollY;
const header = document.querySelector('.header');

window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
        header.classList.add('header--hidden');
    } else {
        header.classList.remove('header--hidden');
    }
    lastScrollY = currentScrollY;
});