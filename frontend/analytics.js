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

    const edgeMap = {};
    data.edges.forEach(e => {
        const key = [e.source, e.target].sort().join('|');
        edgeMap[key] = e.weight;
    });

    const skillCount = {};
    data.nodes.forEach(n => skillCount[n.id] = n.count);

    const sortedSkills = Object.keys(skillCount).sort((a,b) => skillCount[b] - skillCount[a]);
    const topSkills = sortedSkills.slice(0, topN);

    if (topSkills.length === 0) {
        container.innerHTML = '<p style="padding:20px;">Нет данных для отображения</p>';
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

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;
    const margin = { top: 80, right: 80, bottom: 80, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const cellSize = Math.min(innerWidth / N, innerHeight / N);

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, maxWeight]);

    const cells = svg.selectAll('rect')
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
        .style('stroke-width', 0.5);

    cells.append('title')
        .text(d => {
            const i = d[0], j = d[1];
            if (i === j) return topSkills[i];
            return `${topSkills[i]} ↔ ${topSkills[j]}: ${matrix[i][j]}`;
        });

    svg.append('g')
        .selectAll('text')
        .data(topSkills)
        .enter()
        .append('text')
        .attr('x', (d, i) => i * cellSize + cellSize/2)
        .attr('y', -10)
        .style('text-anchor', 'end')
        .style('font-size', '10px')
        .style('transform', 'rotate(-45deg)')
        .style('transform-origin', (d, i) => `${i * cellSize + cellSize/2}px 0px`)
        .text(d => d);

    svg.append('g')
        .selectAll('text')
        .data(topSkills)
        .enter()
        .append('text')
        .attr('y', (d, i) => i * cellSize + cellSize/2)
        .attr('x', -10)
        .style('text-anchor', 'end')
        .style('font-size', '10px')
        .text(d => d);

    const legendWidth = 200;
    const legendHeight = 20;
    const legendX = (innerWidth - legendWidth) / 2;
    const legendY = innerHeight + 30;

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
        .style('stroke', '#ccc');

    svg.append('text')
        .attr('x', legendX)
        .attr('y', legendY + legendHeight + 18)
        .style('font-size', '10px')
        .text('0');

    svg.append('text')
        .attr('x', legendX + legendWidth)
        .attr('y', legendY + legendHeight + 18)
        .style('font-size', '10px')
        .style('text-anchor', 'end')
        .text(maxWeight);
}

document.getElementById('updateMatrixBtn').addEventListener('click', loadSkillsMatrix);