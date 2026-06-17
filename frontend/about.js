// ========== ГРАФ ПРОФЕССИЙ ==========
async function loadProfessionGraph() {
    const threshold = document.getElementById('jaccardThreshold').value || 0.1;
    const minVac = document.getElementById('minVacancies').value || 5;
    const group = document.getElementById('graphGroupFilter').value || '';
    const url = `/api/graph/professions?threshold=${threshold}&min_vacancies=${minVac}&group=${encodeURIComponent(group)}`;
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        renderD3Graph(data);
    } catch(e) { console.error('Profession graph error', e); }
}

function renderD3Graph(data) {
    const container = document.getElementById('profession-graph');
    container.innerHTML = '';
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    d3.select(container).selectAll('*').remove();

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const nodes = data.nodes.map(n => ({ id: n.id, label: n.label, group: n.group, count: n.vacancy_count }));
    const edges = data.edges.map(e => ({ source: e.source, target: e.target, weight: e.weight, common: e.common_skills }));

    const degree = {};
    edges.forEach(e => {
        degree[e.source] = (degree[e.source] || 0) + 1;
        degree[e.target] = (degree[e.target] || 0) + 1;
    });
    nodes.forEach(n => n.degree = degree[n.id] || 0);

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(edges).id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width/2, height/2));

    const link = svg.append('g')
        .selectAll('line')
        .data(edges)
        .enter().append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', d => Math.sqrt(d.weight) * 3);

    const node = svg.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', d => 5 + Math.sqrt(d.degree) * 3)
        .attr('fill', d => {
            const colors = ['#4682B4','#77ABE0','#FFC0D0','#FFED75','#A8D5BA','#B8DAF2','#CBE7F8','#DEEFFB','#EEF7FC','#B0B0B0'];
            let hash = 0;
            for (let i = 0; i < d.group.length; i++) hash = d.group.charCodeAt(i) + ((hash << 5) - hash);
            return colors[Math.abs(hash) % colors.length];
        })
        .attr('stroke', '#2c3e50')
        .attr('stroke-width', 1)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    const label = svg.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .text(d => d.label)
        .attr('font-size', '10px')
        .attr('dx', 12)
        .attr('dy', 4);

    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        label
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    });

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    node.on('click', function(event, d) {
        fetch(`/api/graph/profession/${encodeURIComponent(d.label)}/skills?limit=10`)
            .then(resp => resp.json())
            .then(data => {
                const tooltip = document.getElementById('graph-tooltip');
                tooltip.innerHTML = `<strong>${d.label}</strong> (${d.count} вакансий, ${d.degree} связей)<br>Топ навыки: ${data.map(s => s.skill + ' (' + s.count + ')').join(', ')}`;
            });
    });

    link.on('click', function(event, d) {
        const source = d.source.label || d.source.id;
        const target = d.target.label || d.target.id;
        fetch(`/api/graph/edge/skills?prof_a=${encodeURIComponent(source)}&prof_b=${encodeURIComponent(target)}`)
            .then(resp => resp.json())
            .then(data => {
                const tooltip = document.getElementById('graph-tooltip');
                tooltip.innerHTML = `<strong>${source}</strong> ↔ <strong>${target}</strong><br>Общие навыки: ${data.common_skills.join(', ') || 'нет'}`;
            });
    });
}

document.getElementById('updateGraphBtn').addEventListener('click', loadProfessionGraph);

document.getElementById('fullscreenGraphBtn').addEventListener('click', function() {
    const container = document.getElementById('profession-graph');
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        container.requestFullscreen().catch(err => {});
    }
});

async function loadGraphGroups() {
    try {
        const resp = await fetch('/api/analytics/overview?context_type=all');
        const data = await resp.json();
        const groups = data.median_by_groups.map(d => d.label);
        const sel = document.getElementById('graphGroupFilter');
        sel.innerHTML = '<option value="">Все</option>';
        groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            sel.appendChild(opt);
        });
    } catch(e) {}
}
loadGraphGroups();