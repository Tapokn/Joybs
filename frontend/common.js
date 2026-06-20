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
const contextDropdownMobile = document.getElementById('contextDropdownMobile');
let groupsData = [];
let professionsData = [];

// ========== ПЕРЕМЕННЫЕ ДЛЯ АГРЕГАТОРА (общие) ==========
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
        const section = document.getElementById('section-' + tab);
        if (section) section.classList.add('section--active');

        // Управление панелями
        if (tab === 'about' || tab === 'analytics') {
            document.getElementById('leftPanel').style.display = '';
            document.getElementById('rightPanel').style.display = '';
            renderAnchors(tab);
        } else {
            document.getElementById('leftPanel').style.display = 'none';
            document.getElementById('rightPanel').style.display = 'none';
        }

        // Загрузка контента
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
        closeContextDropdown();
        updateMobileMenu(tab);
    });
});

// По умолчанию активируем вкладку "О проекте"
document.querySelector('.header__tab[data-tab="about"]').click();

// ========== КОНТЕКСТ (левая панель) ==========
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

function closeContextDropdown() {
    const dropdowns = document.querySelectorAll('.context-dropdown');
    dropdowns.forEach(d => d.classList.remove('active'));
    document.getElementById('dropdownOverlay').classList.remove('active');
}

document.getElementById('dropdownOverlay').addEventListener('click', closeContextDropdown);

window.addEventListener('resize', function() {
    if (window.innerWidth > 992) {
        closeContextDropdown();
    }
});

async function showGroupDropdown(targetDropdown) {
    const dropdown = targetDropdown || contextDropdown;
    const groups = await loadGroups();
    dropdown.innerHTML = '';
    if (!groups.length) {
        dropdown.innerHTML = '<div class="context-hint">Нет групп</div>';
        dropdown.classList.add('active');
        if (window.innerWidth <= 992) document.getElementById('dropdownOverlay').classList.add('active');
        return;
    }
    groups.forEach(group => {
        const item = document.createElement('div');
        item.className = 'context-item';
        item.textContent = group;
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            selectContextGroup(group);
            closeContextDropdown();
        });
        dropdown.appendChild(item);
    });
    dropdown.classList.add('active');
    if (window.innerWidth <= 992) document.getElementById('dropdownOverlay').classList.add('active');
}

async function showProfessionDropdown(targetDropdown) {
    const dropdown = targetDropdown || contextDropdown;
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

    dropdown.innerHTML = '';
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
                closeContextDropdown();
            }
        }
    });
    wrapper.appendChild(input);
    dropdown.appendChild(wrapper);

    const listContainer = document.createElement('div');
    listContainer.className = 'context-profession-list';
    dropdown.appendChild(listContainer);

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
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                e.stopPropagation();
                selectContextProfession(prof);
                closeContextDropdown();
            });
            listContainer.appendChild(item);
        });
    }

    renderProfessionItems(professions, '');
    dropdown.classList.add('active');
    if (window.innerWidth <= 992) document.getElementById('dropdownOverlay').classList.add('active');
    setTimeout(() => input.focus(), 50);
}

function selectContextGroup(group) {
    contextValue = group;
    contextType = 'group';
    contextTabs.forEach(tab => {
        tab.classList.toggle('context-tab--active', tab.dataset.context === 'group');
    });
    closeContextDropdown();
    applyContext();
}

function selectContextProfession(prof) {
    contextValue = prof;
    contextType = 'profession';
    contextTabs.forEach(tab => {
        tab.classList.toggle('context-tab--active', tab.dataset.context === 'profession');
    });
    closeContextDropdown();
    applyContext();
    console.log('Контекст применён: профессия =', contextValue);
}

function applyContext() {
    if (currentTab === 'analytics') loadAnalytics();
    if (currentTab === 'about') loadProfessionGraph();
    if (currentTab === 'aggregator' && typeof applyFiltersAndRender === 'function') {
        applyFiltersAndRender(true);
    }
}

contextTabs.forEach(tab => {
    tab.addEventListener('click', function(e) {
        e.stopPropagation();
        const type = this.dataset.context;

        if (this.classList.contains('context-tab--active') && 
            (contextDropdown.classList.contains('active') || contextDropdownMobile.classList.contains('active'))) {
            closeContextDropdown();
            return;
        }

        if (type === 'all') {
            contextType = 'all';
            contextValue = '';
            contextTabs.forEach(t => t.classList.remove('context-tab--active'));
            this.classList.add('context-tab--active');
            closeContextDropdown();
            applyContext();
            return;
        }

        if (type === 'group') {
            if (window.innerWidth <= 992) {
                showGroupDropdown(contextDropdownMobile);
            } else {
                showGroupDropdown(contextDropdown);
            }
        } else if (type === 'profession') {
            if (window.innerWidth <= 992) {
                showProfessionDropdown(contextDropdownMobile);
            } else {
                showProfessionDropdown(contextDropdown);
            }
        }
    });
});

document.addEventListener('click', function(e) {
    if (!e.target.closest('.context-tabs') && !e.target.closest('.header__context')) {
        closeContextDropdown();
    }
});

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

// ========== ПРАВАЯ ПАНЕЛЬ – ЯКОРЯ ==========
function getAnchorsForTab(tab) {
    const anchors = {
        'about': [
            { label: 'Граф', target: '#about-graph' },
            { label: 'О проекте', target: '.about-tabs' }
        ],
        'analytics': [
            { label: 'Обзор', target: '#stats-overview' },
            { label: 'Распределение', target: '#distribution-pie' },
            { label: 'Зарплата по группам', target: '#median-bar' },
            { label: 'Гистограмма', target: '#histogram' },
            { label: 'Форматы', target: '#work-format' },
            { label: 'Опыт', target: '#experience' },
            { label: 'Топ навыки', target: '#top-skills' },
            { label: 'Влияние навыков', target: '#salary-impact' },
            { label: 'Матрица', target: '#skills-matrix' }
        ],
        'aggregator': []  // на вкладке агрегатора якори не нужны
    };
    return anchors[tab] || [];
}

function renderAnchors(tab) {
    const container = document.querySelector('.anchor-tabs');
    if (!container) return;
    const anchors = getAnchorsForTab(tab);
    container.innerHTML = '';
    anchors.forEach(a => {
        const link = document.createElement('a');
        link.href = a.target;
        link.className = 'anchor-tab';
        link.textContent = a.label;
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(a.target);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        container.appendChild(link);
    });
    const count = anchors.length;
    container.classList.remove('few', 'many');
    if (count <= 4) {
        container.classList.add('few');
    } else {
        container.classList.add('many');
    }
}

// ========== МОБИЛЬНОЕ МЕНЮ ==========
const burgerBtn = document.getElementById('burgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const mobileMenuSections = document.querySelectorAll('.mobile-menu__section');
const mobileMenuAnchors = document.querySelector('.mobile-menu__anchors');

function openMobileMenu() {
    mobileMenu.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateMobileMenu(currentTab);
}

function closeMobileMenu() {
    mobileMenu.classList.remove('active');
    document.body.style.overflow = '';
}

burgerBtn.addEventListener('click', openMobileMenu);
closeMenuBtn.addEventListener('click', closeMobileMenu);
mobileMenu.addEventListener('click', function(e) {
    if (e.target === this || e.target.classList.contains('mobile-menu__overlay')) {
        closeMobileMenu();
    }
});

function updateMobileMenu(tab) {
    mobileMenuSections.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    const anchors = getAnchorsForTab(tab);
    mobileMenuAnchors.innerHTML = '';
    anchors.forEach(a => {
        const btn = document.createElement('button');
        btn.className = 'mobile-menu__anchor';
        btn.textContent = a.label;
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(a.target);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                closeMobileMenu();
            }
        });
        mobileMenuAnchors.appendChild(btn);
    });
}

mobileMenuSections.forEach(btn => {
    btn.addEventListener('click', function() {
        const tab = this.dataset.tab;
        const headerTab = document.querySelector(`.header__tab[data-tab="${tab}"]`);
        if (headerTab) {
            headerTab.click();
        }
        closeMobileMenu();
    });
});

const headerTabs = document.querySelectorAll('.header__tab');
headerTabs.forEach(tab => {
    const observer = new MutationObserver(() => {
        if (tab.classList.contains('header__tab--active')) {
            updateMobileMenu(tab.dataset.tab);
        }
    });
    observer.observe(tab, { attributes: true, attributeFilter: ['class'] });
});

updateMobileMenu('about');

// ========== УПРАВЛЕНИЕ АГРЕГАТОРОМ ==========
let aggregatorLoaded = false;
let aggregatorExpanded = false;

function toggleAggregator(expand, loadData = true) {
    const wrapper = document.getElementById('aggregatorWrapper');
    const btn = document.getElementById('aggregatorToggleBtn');
    const icon = btn.querySelector('.aggregator-btn-icon');
    const text = btn.querySelector('.aggregator-btn-text');

    if (expand === undefined) {
        expand = !aggregatorExpanded;
    }

    if (expand) {
        wrapper.classList.add('expanded');
        icon.textContent = '▼';
        text.textContent = 'Скрыть агрегатор';
        aggregatorExpanded = true;
        if (loadData && !aggregatorLoaded) {
            loadAllVacancies();
            aggregatorLoaded = true;
        }
    } else {
        wrapper.classList.remove('expanded');
        icon.textContent = '▶';
        text.textContent = 'Показать агрегатор';
        aggregatorExpanded = false;
    }
}

document.getElementById('aggregatorToggleBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    toggleAggregator();
});

document.querySelectorAll('.header__tab').forEach(btn => {
    btn.addEventListener('click', function() {
        const tab = this.dataset.tab;
        setTimeout(() => {
            if (tab === 'aggregator') {
                toggleAggregator(true, true);
            } else {
                toggleAggregator(false, false);
            }
        }, 50);
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const activeTab = document.querySelector('.header__tab--active');
    if (activeTab && activeTab.dataset.tab === 'aggregator') {
        setTimeout(() => toggleAggregator(true, true), 100);
    } else {
        toggleAggregator(false, false);
    }
});