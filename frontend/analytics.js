// ========== АНАЛИТИКА ==========
async function loadAnalytics() {
    const url = `/api/analytics/overview?context_type=${contextType}&context_value=${encodeURIComponent(contextValue)}`;
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        renderOverview(data);
        renderCharts(data);
    } catch(e) {
        console.error('Ошибка загрузки аналитики:', e);
    }
    loadTopSkills();
    loadSalaryImpact();
    loadSkillsMatrix();
}

function renderOverview(data) {
    const stats = data.stats;
    const context = data.context_info || {};
    let contextText = '';
    if (context.type === 'all') {
        contextText = 'Весь рынок';
    } else if (context.type === 'group') {
        contextText = `Группа: ${context.value}`;
    } else if (context.type === 'profession') {
        contextText = `Профессия: ${context.value}`;
    }
    document.getElementById('statsPlaceholder').innerHTML = `
        <p><strong>Всего вакансий:</strong> ${stats.total_vacancies} &nbsp;|&nbsp;
        <strong>Групп профессий:</strong> ${stats.total_groups} &nbsp;|&nbsp;
        <strong>Общая медиана зарплаты:</strong> ${data.overall_median ? Math.round(data.overall_median).toLocaleString() + ' ₽' : 'Нет данных'}
        <br><strong>Контекст:</strong> ${contextText}
        </p>
    `;
}

function renderCharts(data) {
    const pieData = data.pie_data;
    if (pieChart) pieChart.destroy();
    const ctxPie = document.getElementById('pieChart').getContext('2d');
    pieChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: pieData.map(d => d.label),
            datasets: [{
                data: pieData.map(d => d.count),
                backgroundColor: ['#4682B4', '#77ABE0', '#FFC0D0', '#FFED75', '#A8D5BA', '#B8DAF2', '#CBE7F8', '#DEEFFB', '#EEF7FC', '#B0B0B0']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' },
                tooltip: { callbacks: { label: ctx => ctx.label + ': ' + ctx.parsed + ' (' + (ctx.parsed / data.pie_data.reduce((a,b) => a + b.count, 0) * 100).toFixed(1) + '%)' } }
            }
        }
    });

    const medData = data.median_by_groups;
    if (medianBarChart) medianBarChart.destroy();
    const ctxMed = document.getElementById('medianBarChart').getContext('2d');
    medianBarChart = new Chart(ctxMed, {
        type: 'bar',
        data: {
            labels: medData.map(d => d.label),
            datasets: [{
                label: 'Медианная зарплата, ₽',
                data: medData.map(d => d.median_salary),
                backgroundColor: '#4682B4'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    const histData = data.histogram;
    if (histogramChart) histogramChart.destroy();
    const ctxHist = document.getElementById('histogramChart').getContext('2d');
    histogramChart = new Chart(ctxHist, {
        type: 'bar',
        data: {
            labels: histData.map(d => (d.bin_start/1000).toFixed(0) + 'k'),
            datasets: [{
                label: 'Количество вакансий',
                data: histData.map(d => d.count),
                backgroundColor: '#77ABE0'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    const dist = data.distributions;
    renderDistribution('workFormatChart', dist.work_format, 'Формат работы');
    renderDistribution('experienceChart', dist.experience, 'Опыт');
}

function renderDistribution(canvasId, data, label) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    let chart = window[canvasId + 'Chart'];
    if (chart) chart.destroy();
    const labels = data.map(d => d.value);
    const counts = data.map(d => d.count);
    const newChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: counts,
                backgroundColor: '#A8D5BA'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
    window[canvasId + 'Chart'] = newChart;
}

// ========== Навыки ==========
async function loadTopSkills() {
    const url = `/api/skills/top?context_type=${contextType}&context_value=${encodeURIComponent(contextValue)}&limit=10`;
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        if (topSkillsChart) topSkillsChart.destroy();
        const ctx = document.getElementById('topSkillsChart').getContext('2d');
        topSkillsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.skill),
                datasets: [{
                    label: 'Частота',
                    data: data.map(d => d.count),
                    backgroundColor: '#4682B4'
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    } catch(e) { console.error('Top skills error', e); }
}

async function loadSalaryImpact() {
    const url = `/api/skills/salary-impact?context_type=${contextType}&context_value=${encodeURIComponent(contextValue)}&top_n=20`;
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        if (salaryImpactChart) salaryImpactChart.destroy();
        const ctx = document.getElementById('salaryImpactChart').getContext('2d');
        const labels = data.map(d => d.skill);
        const diffs = data.map(d => d.diff);
        const colors = diffs.map(d => d >= 0 ? '#A8D5BA' : '#FFC0D0');
        salaryImpactChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Разница медиан (с навыком - без)',
                    data: diffs,
                    backgroundColor: colors
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    } catch(e) { console.error('Salary impact error', e); }
}

// ========== Матрица навыков (D3 heatmap) ==========
async function loadSkillsMatrix() {
    const topN = parseInt(document.getElementById('matrixTopN').value);
    const minCooc = parseInt(document.getElementById('matrixMinCooc').value) || 5;
    const url = `/api/skills/graph?context_type=${contextType}&context_value=${encodeURIComponent(contextValue)}&min_cooccurrence=${minCooc}`;
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        renderMatrix(data, topN);
    } catch(e) {
        console.error('Ошибка загрузки матрицы навыков:', e);
    }
}

function renderMatrix(data, topN) {
    const container = document.getElementById('skills-matrix-container');
    container.innerHTML = '';

    const minCooc = parseInt(document.getElementById('matrixMinCooc').value) || 5;

    // Фильтруем рёбра по minCooc
    const edgeMap = {};
    data.edges.forEach(e => {
        if (e.weight >= minCooc) {
            const key = [e.source, e.target].sort().join('|');
            edgeMap[key] = e.weight;
        }
    });

    const skillCount = {};
    data.nodes.forEach(n => skillCount[n.id] = n.count);

    const sortedSkills = Object.keys(skillCount).sort((a,b) => skillCount[b] - skillCount[a]);
    const topSkills = sortedSkills.slice(0, topN);

    if (topSkills.length === 0) {
        container.innerHTML = '<p style="padding:20px; text-align:center;">Нет данных для отображения</p>';
        return;
    }

    const N = topSkills.length;
    const matrix = [];
    for (let i = 0; i < N; i++) {
        matrix[i] = [];
        for (let j = 0; j < N; j++) {
            if (i === j) {
                matrix[i][j] = 0;
            } else {
                const key = [topSkills[i], topSkills[j]].sort().join('|');
                matrix[i][j] = edgeMap[key] || 0;
            }
        }
    }

    let maxWeight = 0;
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (matrix[i][j] > maxWeight) maxWeight = matrix[i][j];
        }
    }
    if (maxWeight === 0) maxWeight = 1;

    const rect = container.getBoundingClientRect();
    const width = rect.width || 600;
    const height = rect.height || 600;

    // Увеличиваем верхний отступ для вертикальных подписей
    const viewBoxWidth = 1000;
    const viewBoxHeight = 1000;
    const margin = { top: 200, right: 50, bottom: 50, left: 100 };
    const innerWidth = viewBoxWidth - margin.left - margin.right;
    const innerHeight = viewBoxHeight - margin.top - margin.bottom;

    const cellSize = Math.min(innerWidth / N, innerHeight / N);

    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`)
        .style('background', '#FCFAF8');

    const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, maxWeight]);

    const matrixGroup = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Ячейки
    const cells = matrixGroup.selectAll('rect')
        .data(d3.cross(d3.range(N), d3.range(N)))
        .enter()
        .append('rect')
        .attr('x', d => d[1] * cellSize)
        .attr('y', d => d[0] * cellSize)
        .attr('width', cellSize - 1)
        .attr('height', cellSize - 1)
        .style('fill', d => {
            const val = matrix[d[0]][d[1]];
            return val ? colorScale(val) : '#f5f5f5';
        })
        .style('stroke', '#ddd')
        .style('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .style('transition', 'stroke 0.2s, stroke-width 0.2s');

    // === ПОДПИСИ СВЕРХУ – ВЕРТИКАЛЬНЫЕ (поворот -90°) ===
    // Адаптивный размер шрифта: при N=10 -> 1rem, при N=50 -> 0.6rem
    const fontSize = Math.max(0.6, Math.min(1, 1 - (N - 10) * 0.01));
    svg.append('g')
        .selectAll('text')
        .data(topSkills)
        .enter()
        .append('text')
        .attr('x', (d, i) => margin.left + i * cellSize + cellSize / 2)
        .attr('y', margin.top - 10)
        .style('text-anchor', 'start')
        .style('font-size', fontSize + 'rem')
        .style('font-weight', '500')
        .style('fill', '#2C3E50')
        .attr('transform', (d, i) => {
            const x = margin.left + i * cellSize + cellSize / 2;
            const y = margin.top - 10;
            return `rotate(-90, ${x}, ${y})`;
        })
        .text(d => d.length > 15 ? d.slice(0, 12) + '…' : d)
        .append('title')
        .text(d => d);

    // === ПОДПИСИ СЛЕВА ===
    svg.append('g')
        .selectAll('text')
        .data(topSkills)
        .enter()
        .append('text')
        .attr('y', (d, i) => margin.top + i * cellSize + cellSize / 2)
        .attr('x', margin.left - 16)
        .style('text-anchor', 'end')
        .style('font-size', '1rem')
        .style('font-weight', '500')
        .style('fill', '#2C3E50')
        .text(d => d.length > 15 ? d.slice(0, 12) + '…' : d)
        .append('title')
        .text(d => d);

    // === ЛЕГЕНДА (поднята выше, чтобы не перекрывать) ===
    const legendWidth = Math.min(200, innerWidth * 0.5);
    const legendHeight = 18;
    const legendX = (viewBoxWidth - legendWidth) / 2;
    const legendY = 20; // выше подписей

    const defs = svg.append('defs');
    const linearGradient = defs.append('linearGradient')
        .attr('id', 'legendGradient')
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '100%').attr('y2', '0%');
    linearGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f5f5f5');
    linearGradient.append('stop').attr('offset', '100%').attr('stop-color', '#4682B4');

    svg.append('rect')
        .attr('x', legendX)
        .attr('y', legendY)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legendGradient)')
        .style('stroke', '#ccc')
        .style('stroke-width', 0.5);

    svg.append('text')
        .attr('x', legendX)
        .attr('y', legendY + legendHeight + 16)
        .style('font-size', '0.9rem')
        .style('text-anchor', 'start')
        .style('fill', '#7F8C8D')
        .text('0');

    svg.append('text')
        .attr('x', legendX + legendWidth)
        .attr('y', legendY + legendHeight + 16)
        .style('font-size', '0.9rem')
        .style('text-anchor', 'end')
        .style('fill', '#7F8C8D')
        .text(maxWeight);

    svg.append('text')
        .attr('x', legendX + legendWidth / 2)
        .attr('y', legendY - 6)
        .style('font-size', '0.9rem')
        .style('text-anchor', 'middle')
        .style('fill', '#7F8C8D')
        .text('Совместная встречаемость');

    // === ТУЛТИП ===
    let tooltip = document.getElementById('matrix-hover-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'matrix-hover-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            pointer-events: none;
            border-radius: 8px;
            padding: 8px 14px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            font-size: 0.9rem;
            max-width: 300px;
            z-index: 10000;
            border: 1px solid rgba(200,200,200,0.3);
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(4px);
            opacity: 0;
            visibility: hidden;
            transform: scale(0.95);
            transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
            color: #2C3E50;
        `;
        document.body.appendChild(tooltip);
    }

    function showTooltip(html, clientX, clientY) {
        tooltip.innerHTML = html;
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
        tooltip.style.transform = 'scale(1)';
        const tw = tooltip.offsetWidth || 200;
        const th = tooltip.offsetHeight || 50;
        let left = clientX + 15;
        let top = clientY + 15;
        if (left + tw > window.innerWidth) {
            left = clientX - tw - 15;
        }
        if (top + th > window.innerHeight) {
            top = clientY - th - 15;
        }
        if (left < 0) left = 10;
        if (top < 0) top = 10;
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function hideTooltip() {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
        tooltip.style.transform = 'scale(0.95)';
    }

    // Обработчики для ячеек
    cells.on('mouseover', function(event, d) {
        const i = d[0], j = d[1];
        const val = matrix[i][j];
        const skillA = topSkills[i];
        const skillB = topSkills[j];
        let html = `<strong>${skillA}</strong> ↔ <strong>${skillB}</strong>`;
        if (i === j) {
            html = `<strong>${skillA}</strong> (диагональ)`;
        } else {
            html += `<br>Совместная встречаемость: <strong>${val}</strong>`;
        }
        showTooltip(html, event.clientX, event.clientY);
        d3.select(this)
            .style('stroke', '#FFA500')
            .style('stroke-width', 2);
    })
    .on('mousemove', function(event) {
        if (tooltip.style.visibility === 'visible') {
            const tw = tooltip.offsetWidth || 200;
            const th = tooltip.offsetHeight || 50;
            let left = event.clientX + 15;
            let top = event.clientY + 15;
            if (left + tw > window.innerWidth) {
                left = event.clientX - tw - 15;
            }
            if (top + th > window.innerHeight) {
                top = event.clientY - th - 15;
            }
            if (left < 0) left = 10;
            if (top < 0) top = 10;
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        }
    })
    .on('mouseout', function() {
        hideTooltip();
        d3.select(this)
            .style('stroke', '#ddd')
            .style('stroke-width', 0.5);
    });
}

document.getElementById('updateMatrixBtn').addEventListener('click', loadSkillsMatrix);