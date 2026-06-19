// ================================================================
// ========== АГРЕГАТОР ==========
// ================================================================

async function loadAllVacancies() {
    const loader = document.getElementById('loader');
    if (loader) loader.textContent = 'Загрузка всех вакансий...';
    try {
        const resp = await fetch('/api/vacancies?limit=10000');
        const data = await resp.json();
        allVacancies = data.items;
        // Загружаем профессии через кастомный список
        updateProfessionsList(allVacancies);
        // Загружаем опыт через кастомный список (из вакансий)
        updateExperienceList(allVacancies);
        updateSkillsDatalist(allVacancies);
        updateCompaniesList(allVacancies);
        applyFiltersAndRender();
        if (loader) loader.textContent = 'Прокрутите для загрузки ещё';
    } catch(e) {
        console.error('Ошибка загрузки вакансий:', e);
        if (loader) loader.textContent = 'Ошибка загрузки. Проверьте сервер.';
    }
}

function computeMedianSalary(v) {
    const from = v.salary_from;
    const to = v.salary_to;
    if (from !== null && to !== null) return (from + to) / 2;
    if (from !== null) return from;
    if (to !== null) return to;
    return null;
}

function getRelevanceScore(vac, searchWords, skillItems) {
    let score = 0;
    const title = (vac.title || '').toLowerCase();
    const skills = (vac.key_skills || '').toLowerCase();

    const wordWeight = 3;
    const skillWeight = 2;

    searchWords.forEach(word => {
        if (title.includes(word)) score += wordWeight;
    });
    skillItems.forEach(skill => {
        if (skills.includes(skill)) score += skillWeight;
    });
    return score;
}

// ========== Единая функция фильтрации и сортировки ==========
function filterVacancies() {
    const search = document.getElementById('filterSearch')?.value?.trim().toLowerCase() || '';
    const profession = document.getElementById('filterProfessionInput')?.value?.trim() || '';
    const skillsInput = document.getElementById('filterSkills')?.value?.trim().toLowerCase() || '';
    const company = document.getElementById('filterCompanyInput')?.value?.trim() || '';
    const city = document.getElementById('filterCity')?.value?.trim().toLowerCase() || '';
    const experience = document.getElementById('filterExperienceInput')?.value?.trim() || '';
    const salaryFrom = parseFloat(document.getElementById('filterSalaryFrom')?.value) || 0;
    const salaryTo = parseFloat(document.getElementById('filterSalaryTo')?.value) || Infinity;
    const hasSalary = document.getElementById('filterHasSalary')?.checked || false;
    const internship = document.getElementById('filterInternship')?.checked || false;
    const accredited = document.getElementById('filterAccredited')?.checked || false;
    const sort = selectedSort || 'relevance';

    const searchWords = search ? search.split(/\s+/) : [];
    const skillItems = skillsInput ? skillsInput.split(',').map(s => s.trim()).filter(Boolean) : [];

    console.log('🔍 Поиск (title):', searchWords, 'Навыки:', skillItems);

    let result = allVacancies.filter(v => {
        if (searchWords.length) {
            const title = (v.title || '').toLowerCase();
            const found = searchWords.some(word => title.includes(word));
            if (!found) return false;
        }
        if (profession && v.profession !== profession) return false;
        if (skillItems.length) {
            const keySkills = (v.key_skills || '').toLowerCase();
            const matched = skillItems.some(skill => keySkills.includes(skill));
            if (!matched) return false;
        }
        if (company && v.company !== company) return false;
        if (city) {
            const vCity = (v.city || v.area_name || '').toLowerCase();
            if (!vCity.includes(city)) return false;
        }
        if (experience && v.experience !== experience) return false;
        const med = computeMedianSalary(v);
        if (med !== null) {
            if (med < salaryFrom || med > salaryTo) return false;
        } else {
            if (hasSalary) return false;
        }
        if (hasSalary && med === null) return false;
        if (internship) {
            const isIntern = v.internship === 1 || (v.title && /стажировк|intern/i.test(v.title));
            if (!isIntern) return false;
        }
        if (accredited && v.accredited_it !== 1) return false;

        return true;
    });

    // Сортировка с приоритетом точного совпадения title
    if (searchWords.length) {
        result.sort((a, b) => {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();
            const exactA = searchWords.every(word => titleA.includes(word));
            const exactB = searchWords.every(word => titleB.includes(word));
            if (exactA && !exactB) return -1;
            if (!exactA && exactB) return 1;
            if (sort === 'date') {
                return new Date(b.published_at) - new Date(a.published_at);
            } else if (sort === 'salary') {
                const sa = computeMedianSalary(a) || 0;
                const sb = computeMedianSalary(b) || 0;
                return sb - sa;
            } else if (sort === 'relevance') {
                const scoreA = getRelevanceScore(a, searchWords, skillItems);
                const scoreB = getRelevanceScore(b, searchWords, skillItems);
                return scoreB - scoreA;
            }
            return 0;
        });
    } else {
        if (sort === 'date') {
            result.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
        } else if (sort === 'salary') {
            result.sort((a, b) => {
                const sa = computeMedianSalary(a) || 0;
                const sb = computeMedianSalary(b) || 0;
                return sb - sa;
            });
        } else if (sort === 'relevance') {
            // ничего не делаем
        }
    }

    console.log('✅ Найдено вакансий:', result.length);
    return result;
}

// ========== Динамические списки ==========

// ----- КАСТОМНЫЙ ВЫПАДАЮЩИЙ СПИСОК ДЛЯ КОМПАНИЙ -----

function updateCompaniesList(vacancies) {
    const input = document.getElementById('filterCompanyInput');
    if (!input) return;
    companiesData = [...new Set(vacancies.map(v => v.company).filter(Boolean))].sort();
    const currentVal = input.value;
    if (currentVal && !companiesData.includes(currentVal)) {
        input.value = '';
        selectedCompany = '';
    } else if (currentVal) {
        selectedCompany = currentVal;
    }
    updateCompanyDropdown();
}

function updateCompanyDropdown() {
    const input = document.getElementById('filterCompanyInput');
    const dropdown = document.getElementById('company-dropdown');
    if (!input || !dropdown) return;
    if (document.activeElement !== input) {
        dropdown.classList.remove('active');
        return;
    }
    const text = input.value.trim().toLowerCase();
    let filtered = companiesData;
    if (text) {
        filtered = companiesData.filter(c => c.toLowerCase().includes(text));
    }
    dropdown.innerHTML = '';
    if (!filtered.length) {
        dropdown.classList.remove('active');
        return;
    }
    filtered.forEach(company => {
        const item = document.createElement('div');
        item.className = 'company-item';
        item.textContent = company;
        item.addEventListener('mousedown', function(e) {
            e.preventDefault();
            selectCompany(company);
        });
        dropdown.appendChild(item);
    });
    dropdown.classList.add('active');
}

function selectCompany(company) {
    const input = document.getElementById('filterCompanyInput');
    if (!input) return;
    input.value = company;
    selectedCompany = company;
    document.getElementById('company-dropdown').classList.remove('active');
    debouncedFilter();
}

const companyInput = document.getElementById('filterCompanyInput');
if (companyInput) {
    companyInput.addEventListener('focus', function() {
        if (this.value && !companiesData.includes(this.value)) {
            this.value = '';
            selectedCompany = '';
        }
        updateCompanyDropdown();
    });
    companyInput.addEventListener('input', function() {
        if (this.value && !companiesData.includes(this.value)) {
            selectedCompany = '';
        }
        updateCompanyDropdown();
        debouncedFilter();
    });
    companyInput.addEventListener('blur', function() {
        setTimeout(() => {
            document.getElementById('company-dropdown').classList.remove('active');
        }, 150);
    });
}

document.addEventListener('click', function(e) {
    const wrapper = document.querySelector('.company-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        document.getElementById('company-dropdown').classList.remove('active');
    }
});

// ----- КАСТОМНЫЙ ВЫПАДАЮЩИЙ СПИСОК ДЛЯ РОЛЕЙ (PROFESSION) -----

// ДИНАМИЧЕСКОЕ ОБНОВЛЕНИЕ СПИСКА ПРОФЕССИЙ
function updateProfessionsList(filtered) {
    const input = document.getElementById('filterProfessionInput');
    if (!input) return;

    const profSet = new Set();
    filtered.forEach(v => {
        if (v.profession) profSet.add(v.profession);
    });
    professionsData = [...profSet].sort();

    const currentVal = input.value;
    if (currentVal && !professionsData.includes(currentVal)) {
        input.value = '';
        selectedProfession = '';
    } else if (currentVal) {
        selectedProfession = currentVal;
    }
    updateProfessionDropdown();
}

function updateProfessionDropdown() {
    const input = document.getElementById('filterProfessionInput');
    const dropdown = document.getElementById('profession-dropdown');
    if (!input || !dropdown) return;
    if (document.activeElement !== input) {
        dropdown.classList.remove('active');
        return;
    }
    const text = input.value.trim().toLowerCase();
    let filtered = professionsData;
    if (text) {
        filtered = professionsData.filter(p => p.toLowerCase().includes(text));
    }
    dropdown.innerHTML = '';
    if (!filtered.length) {
        dropdown.classList.remove('active');
        return;
    }
    filtered.forEach(profession => {
        const item = document.createElement('div');
        item.className = 'profession-item';
        item.textContent = profession;
        item.addEventListener('mousedown', function(e) {
            e.preventDefault();
            selectProfession(profession);
        });
        dropdown.appendChild(item);
    });
    dropdown.classList.add('active');
}

function selectProfession(profession) {
    const input = document.getElementById('filterProfessionInput');
    if (!input) return;
    input.value = profession;
    selectedProfession = profession;
    document.getElementById('profession-dropdown').classList.remove('active');
    debouncedFilter();
}

const professionInput = document.getElementById('filterProfessionInput');
if (professionInput) {
    professionInput.addEventListener('focus', function() {
        if (this.value && !professionsData.includes(this.value)) {
            this.value = '';
            selectedProfession = '';
        }
        updateProfessionDropdown();
    });
    professionInput.addEventListener('input', function() {
        if (this.value && !professionsData.includes(this.value)) {
            selectedProfession = '';
        }
        updateProfessionDropdown();
        debouncedFilter();
    });
    professionInput.addEventListener('blur', function() {
        setTimeout(() => {
            document.getElementById('profession-dropdown').classList.remove('active');
        }, 150);
    });
}

// ----- КАСТОМНЫЙ ВЫПАДАЮЩИЙ СПИСОК ДЛЯ ОПЫТА -----

function updateExperienceList(vacancies) {
    const expSet = new Set();
    vacancies.forEach(v => {
        if (v.experience) expSet.add(v.experience);
    });
    experienceData = [...expSet].sort();
    const input = document.getElementById('filterExperienceInput');
    if (input) {
        if (input.value && !experienceData.includes(input.value)) {
            input.value = '';
            selectedExperience = '';
        } else if (input.value) {
            selectedExperience = input.value;
        }
        updateExperienceDropdown();
    }
}

function updateExperienceDropdown() {
    const input = document.getElementById('filterExperienceInput');
    const dropdown = document.getElementById('experience-dropdown');
    if (!input || !dropdown) return;
    if (document.activeElement !== input) {
        dropdown.classList.remove('active');
        return;
    }
    const text = input.value.trim().toLowerCase();
    let filtered = experienceData;
    if (text) {
        filtered = experienceData.filter(e => e.toLowerCase().includes(text));
    }
    dropdown.innerHTML = '';
    if (!filtered.length) {
        dropdown.classList.remove('active');
        return;
    }
    filtered.forEach(exp => {
        const item = document.createElement('div');
        item.className = 'experience-item';
        item.textContent = exp;
        item.addEventListener('mousedown', function(e) {
            e.preventDefault();
            selectExperience(exp);
        });
        dropdown.appendChild(item);
    });
    dropdown.classList.add('active');
}

function selectExperience(exp) {
    const input = document.getElementById('filterExperienceInput');
    if (!input) return;
    input.value = exp;
    selectedExperience = exp;
    document.getElementById('experience-dropdown').classList.remove('active');
    debouncedFilter();
}

const experienceInput = document.getElementById('filterExperienceInput');
if (experienceInput) {
    experienceInput.addEventListener('focus', function() {
        if (this.value && !experienceData.includes(this.value)) {
            this.value = '';
            selectedExperience = '';
        }
        updateExperienceDropdown();
    });
    experienceInput.addEventListener('input', function() {
        if (this.value && !experienceData.includes(this.value)) {
            selectedExperience = '';
        }
        updateExperienceDropdown();
        debouncedFilter();
    });
    experienceInput.addEventListener('blur', function() {
        setTimeout(() => {
            document.getElementById('experience-dropdown').classList.remove('active');
        }, 150);
    });
}

// ----- КАСТОМНЫЙ ВЫПАДАЮЩИЙ СПИСОК ДЛЯ СОРТИРОВКИ -----


function updateSortDropdown() {
    const input = document.getElementById('filterSortInput');
    const dropdown = document.getElementById('sort-dropdown');
    if (!input || !dropdown) return;
    // Если поле не в фокусе, скрываем dropdown
    if (document.activeElement !== input) {
        dropdown.classList.remove('active');
        return;
    }
    // Показываем все варианты сортировки
    const filtered = sortOptions; // показываем все
    dropdown.innerHTML = '';
    if (!filtered.length) {
        dropdown.classList.remove('active');
        return;
    }
    filtered.forEach(option => {
        const item = document.createElement('div');
        item.className = 'sort-item';
        item.textContent = option.label;
        item.addEventListener('mousedown', function(e) {
            e.preventDefault();
            selectSort(option.value, option.label);
        });
        dropdown.appendChild(item);
    });
    dropdown.classList.add('active');
}
function selectSort(value, label) {
    const input = document.getElementById('filterSortInput');
    if (!input) return;
    input.value = label;
    selectedSort = value;
    document.getElementById('sort-dropdown').classList.remove('active');
    debouncedFilter();
}

const sortInput = document.getElementById('filterSortInput');
if (sortInput) {
    sortInput.addEventListener('focus', function() {
        const current = sortOptions.find(s => s.value === selectedSort);
        if (current) {
            this.value = current.label;
        }
        updateSortDropdown();
    });
    sortInput.addEventListener('input', function() {
        updateSortDropdown();
        debouncedFilter();
    });
    sortInput.addEventListener('blur', function() {
        setTimeout(() => {
            document.getElementById('sort-dropdown').classList.remove('active');
        }, 150);
    });
}

// ----- Обновление списков навыков (datalist и кастомный dropdown) -----
function updateSkillsDatalist(vacancies) {
    const datalist = document.getElementById('skills-datalist');
    if (!datalist) return;
    const skillsSet = new Set();
    vacancies.forEach(v => {
        if (v.key_skills) {
            v.key_skills.split(',').forEach(s => skillsSet.add(s.trim()));
        }
    });
    datalist.innerHTML = '';
    [...skillsSet].sort().forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        datalist.appendChild(opt);
    });
}

function showSkillsDropdown(filteredSkills) {
    const dropdown = document.getElementById('skills-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';
    if (!filteredSkills.length) {
        dropdown.classList.remove('active');
        return;
    }
    filteredSkills.forEach(skill => {
        const item = document.createElement('div');
        item.className = 'skill-item';
        item.textContent = skill;
        item.addEventListener('mousedown', function(e) {
            e.preventDefault();
            addSkillToInput(skill);
        });
        dropdown.appendChild(item);
    });
    dropdown.classList.add('active');
}

function addSkillToInput(skill) {
    const input = document.getElementById('filterSkills');
    if (!input) return;
    let current = input.value.trim();
    if (current && !current.endsWith(',')) {
        current += ', ';
    }
    const existing = current.split(',').map(s => s.trim()).filter(Boolean);
    if (existing.includes(skill)) return;
    current += skill;
    input.value = current;
    updateSkillsDropdown();
    debouncedFilter();
}

function updateSkillsDropdown() {
    const input = document.getElementById('filterSkills');
    const search = document.getElementById('filterSearch')?.value?.trim().toLowerCase() || '';
    if (!input) return;
    const text = input.value.trim().toLowerCase();
    const parts = text.split(',').map(s => s.trim());
    const lastPart = parts[parts.length - 1] || '';
    const dropdown = document.getElementById('skills-dropdown');
    if (!dropdown) return;
    if (document.activeElement !== input) {
        dropdown.classList.remove('active');
        return;
    }
    let contextVacancies = allVacancies;
    if (search) {
        const searchWords = search.split(/\s+/);
        contextVacancies = allVacancies.filter(v => {
            const title = (v.title || '').toLowerCase();
            return searchWords.some(word => title.includes(word));
        });
    }
    const skillsSet = new Set();
    contextVacancies.forEach(v => {
        if (v.key_skills) {
            v.key_skills.split(',').forEach(s => skillsSet.add(s.trim()));
        }
    });
    let filtered = [...skillsSet];
    if (lastPart) {
        filtered = filtered.filter(s => s.toLowerCase().includes(lastPart));
    }
    const added = parts.slice(0, -1).filter(Boolean);
    filtered = filtered.filter(s => !added.includes(s));
    filtered.sort();
    showSkillsDropdown(filtered);
}

const skillsInput = document.getElementById('filterSkills');
if (skillsInput) {
    skillsInput.addEventListener('focus', function() {
        updateSkillsDropdown();
    });
    skillsInput.addEventListener('input', function() {
        updateSkillsDropdown();
        if (this.value.endsWith(',')) {
            if (allVacancies.length) {
                updateSkillsDatalist(allVacancies);
            }
        }
        debouncedFilter();
    });
    skillsInput.addEventListener('blur', function() {
        setTimeout(() => {
            document.getElementById('skills-dropdown').classList.remove('active');
        }, 150);
    });
}

document.addEventListener('click', function(e) {
    const wrapper = document.querySelector('.skills-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        document.getElementById('skills-dropdown').classList.remove('active');
    }
});

// ========== Обновление динамических списков при применении фильтров ==========

function updateDynamicLists(filtered) {
    updateCompaniesList(filtered);
    updateSkillsDatalist(filtered);
    updateExperienceList(filtered);
    updateProfessionsList(filtered);
    if (document.activeElement === document.getElementById('filterSkills')) {
        updateSkillsDropdown();
    }
}

function applyFiltersAndRender(resetOffset = true) {
    if (resetOffset) {
        currentOffset = 0;
        hasMore = true;
    }
    filteredVacancies = filterVacancies();
    updateDynamicLists(filteredVacancies);
    totalVacancies = filteredVacancies.length;
    renderVacancies(resetOffset);
}

function renderVacancies(resetOffset = true) {
    const list = document.getElementById('vacancyList');
    if (!list) return;
    if (resetOffset) {
        list.innerHTML = '';
        currentOffset = 0;
    }
    const end = Math.min(currentOffset + LIMIT, filteredVacancies.length);
    const slice = filteredVacancies.slice(currentOffset, end);
    slice.forEach(v => {
        const card = document.createElement('div');
        card.className = 'vacancy-card';
        const salary = computeMedianSalary(v);
        const salaryStr = salary ? Math.round(salary).toLocaleString() + ' ₽' : 'з/п не указана';
        const skillsHtml = v.key_skills ? v.key_skills.split(',').map(s => `<span>${s.trim()}</span>`).join('') : '';
        const isIntern = v.internship === 1 || (v.title && /стажировк|intern/i.test(v.title));
        const internshipBadge = isIntern ? '<span class="internship-badge">Стажировка</span>' : '';
        const city = v.area_name || v.city || '';
        let dateStr = '';
        if (v.published_at) {
            const d = new Date(v.published_at);
            dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        card.innerHTML = `
            <h4><a href="${v.alternate_url || '#'}" target="_blank" style="color: #2C3E50; text-decoration: none; border-bottom: 1px dotted #ccc;">${v.title || 'Без названия'}</a></h4>
            <div class="meta">
                <span class="highlight company-name">${v.company || ''}</span>
                <span class="highlight">${city}</span>
                <span class="highlight">${v.experience || ''}</span>
                ${v.work_format ? `<span class="highlight">${v.work_format}</span>` : ''}
                ${internshipBadge}
                <span class="date">${dateStr}</span>
            </div>
            <div class="meta" style="font-weight:400;color:#2C3E50; margin-top: -0.2rem;">
                Зарплата: <span class="highlight" style="background:#FFED75; border-color:#E8DCD4;">${salaryStr}</span>
            </div>
            <div class="skills">${skillsHtml}</div>
            <div class="desc" id="desc-${v.hh_id}">${v.description || ''}</div>
            <button class="desc-toggle" data-id="${v.hh_id}">Показать полностью</button>
        `;
        list.appendChild(card);
    });

    currentOffset = end;
    hasMore = currentOffset < filteredVacancies.length;
    const loader = document.getElementById('loader');
    if (loader) {
        loader.textContent = hasMore ? 'Прокрутите для загрузки ещё' : 'Все вакансии загружены';
    }
}

// ========== Обработчики событий для фильтров ==========
function debouncedFilter() {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => applyFiltersAndRender(true), 300);
}

const newAutoFields = [
    'filterSearch',
    'filterProfessionInput',
    'filterSkills',
    'filterCompanyInput',
    'filterCity',
    'filterExperienceInput',
    'filterSortInput'
];

newAutoFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', debouncedFilter);
        el.addEventListener('change', debouncedFilter);
    }
});

document.getElementById('filterHasSalary')?.addEventListener('change', function() {
    const salaryRange = document.getElementById('salaryRange');
    if (this.checked) {
        if (salaryRange) {
            salaryRange.classList.add('show');
            salaryRange.style.display = 'flex';
        }
    } else {
        if (salaryRange) {
            salaryRange.classList.remove('show');
            salaryRange.style.display = 'none';
        }
        document.getElementById('filterSalaryFrom').value = '';
        document.getElementById('filterSalaryTo').value = '';
    }
    debouncedFilter();
});

document.getElementById('filterInternship')?.addEventListener('change', debouncedFilter);
document.getElementById('filterAccredited')?.addEventListener('change', debouncedFilter);

document.getElementById('applyFilters')?.addEventListener('click', () => applyFiltersAndRender(true));

document.getElementById('resetFilters')?.addEventListener('click', function() {
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterProfessionInput').value = '';
    document.getElementById('filterSkills').value = '';
    document.getElementById('filterCompanyInput').value = '';
    document.getElementById('filterCity').value = '';
    document.getElementById('filterExperienceInput').value = '';
    document.getElementById('filterSalaryFrom').value = '';
    document.getElementById('filterSalaryTo').value = '';
    document.getElementById('filterHasSalary').checked = false;
    document.getElementById('filterInternship').checked = false;
    document.getElementById('filterAccredited').checked = false;
    document.getElementById('filterSortInput').value = 'По релевантности';
    selectedSort = 'relevance';
    selectedProfession = '';
    selectedExperience = '';
    selectedCompany = '';
    const salaryRange = document.getElementById('salaryRange');
    if (salaryRange) {
        salaryRange.classList.remove('show');
        salaryRange.style.display = 'none';
    }
    applyFiltersAndRender(true);
});

// Intersection Observer
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading && hasMore) {
        isLoading = true;
        renderVacancies(false);
        isLoading = false;
    }
}, { threshold: 0.1 });
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    if (loader) observer.observe(loader);
});

// Делегирование для кнопок "Показать полностью"
document.getElementById('vacancyList')?.addEventListener('click', function(e) {
    if (e.target.classList.contains('desc-toggle')) {
        const id = e.target.dataset.id;
        const desc = document.getElementById('desc-' + id);
        if (desc) {
            desc.classList.toggle('expanded');
            e.target.textContent = desc.classList.contains('expanded') ? 'Скрыть' : 'Показать полностью';
        }
    }
});