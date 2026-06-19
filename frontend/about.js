// ========== ГРАФ ПРОФЕССИЙ ==========
let selectedNodeId = null;          // ID узла, выделенного кликом (числовой)
let selectedProfLabel = null;      // Название профессии, выбранной через контекст
let previousProfession = null;     // для отслеживания смены профессии
let manualThreshold = false;       // флаг, что пользователь вручную менял ползунок
let zoomBehavior = null;
let svgElement = null;
let graphGroup = null;
let simulation = null;
let zoomApplied = false;
let fullscreenHandler = null;

async function loadProfessionGraph() {
    let group = '';
    let profession = '';

    if (contextType === 'group' && contextValue) {
        group = contextValue;
        selectedProfLabel = null;
        previousProfession = null;
        manualThreshold = false;   // при выборе группы сбрасываем ручной режим
    } else if (contextType === 'profession' && contextValue) {
        profession = contextValue;
        // Если профессия изменилась И ручной режим НЕ включён – подбираем порог
        if (profession !== previousProfession && !manualThreshold) {
            previousProfession = profession;
            const optimalThreshold = await findOptimalThreshold(profession);
            document.getElementById('jaccardThreshold').value = optimalThreshold;
            document.getElementById('jaccardValue').textContent = optimalThreshold.toFixed(2);
        } else {
            // если профессия та же или ручной режим – просто обновляем previousProfession
            previousProfession = profession;
        }
        selectedProfLabel = profession;
    } else {
        // contextType === 'all'
        selectedProfLabel = null;
        previousProfession = null;
        manualThreshold = false;
    }

    const threshold = parseFloat(document.getElementById('jaccardThreshold').value) || 0.1;
    const minVacancies = 1;
    let url = `/api/graph/professions?threshold=${threshold}&min_vacancies=${minVacancies}`;
    if (group) {
        url += `&group=${encodeURIComponent(group)}`;
    } else if (profession) {
        url += `&profession=${encodeURIComponent(profession)}`;
    }

    if (simulation) {
        simulation.stop();
        simulation = null;
    }
    zoomApplied = false;

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        renderD3Graph(data);
        updateGraphContextInfo();
    } catch (e) {
        console.error('Profession graph error', e);
    }
}

// Автоподбор порога, чтобы узлов было 2..15
async function findOptimalThreshold(profession) {
    let threshold = 0.1;
    const maxAttempts = 20;
    const step = 0.02;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const url = `/api/graph/professions?threshold=${threshold}&min_vacancies=1&profession=${encodeURIComponent(profession)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        const nodeCount = data.nodes.length;
        if (nodeCount <= 15 && nodeCount >= 2) return threshold;
        if (nodeCount > 15) threshold = Math.min(threshold + step, 0.5);
        else if (nodeCount < 2 && threshold > 0) threshold = Math.max(threshold - step, 0);
        else return threshold;
    }
    return threshold;
}

function renderD3Graph(data) {
    const container = document.getElementById('profession-graph');
    container.innerHTML = '';
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', '#FCFAF8')
        .style('border-radius', '12px')
        .style('overflow', 'visible');

    const g = svg.append('g').attr('class', 'graph-group');
    svgElement = svg;
    graphGroup = g;

    const nodes = data.nodes.map(n => ({ id: n.id, label: n.label, group: n.group, count: n.vacancy_count }));
    const edges = data.edges.map(e => ({ source: e.source, target: e.target, weight: e.weight, common: e.common_skills }));

    const degree = {};
    edges.forEach(e => {
        degree[e.source] = (degree[e.source] || 0) + 1;
        degree[e.target] = (degree[e.target] || 0) + 1;
    });
    nodes.forEach(n => n.degree = degree[n.id] || 0);

    const selectedProf = selectedProfLabel;

    // ---- УСКОРЕННАЯ СИМУЛЯЦИЯ (быстрее затухает) ----
    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(edges).id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .alphaDecay(0.08)      // быстрое затухание → зум сработает раньше
        .velocityDecay(0.6);   // повышенное трение

    // ---- Рёбра (УВЕЛИЧЕННАЯ ТОЛЩИНА) ----
    const link = g.append('g')
        .selectAll('line')
        .data(edges)
        .enter().append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', d => Math.sqrt(d.weight) * 5)   // было *3, теперь *5 – жирнее
        .style('cursor', 'pointer')
        .style('transition', 'stroke 0.2s, stroke-width 0.2s, filter 0.2s');

    // ---- Узлы ----
    const node = g.append('g')
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
        .style('cursor', 'pointer')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    // ---- Подписи ----
    const label = g.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .text(d => d.label)
        .attr('font-size', '10px')
        .attr('dx', 12)
        .attr('dy', 4)
        .style('pointer-events', 'none');

    // ---- Функции подсветки (связи – бледно-жёлтые) ----
    function highlightNode(d) {
        node.filter(n => n.id === d.id)
            .attr('fill', '#FFD700')
            .attr('stroke', '#FFA500')
            .attr('stroke-width', 3)
            .attr('r', 10 + Math.sqrt(d.degree) * 3);
        link.filter(l => l.source.id === d.id || l.target.id === d.id)
            .attr('stroke', '#FFE082')
            .attr('stroke-opacity', 1)
            .attr('stroke-width', l => Math.sqrt(l.weight) * 6)   // жирнее при выделении
            .style('filter', 'drop-shadow(0 0 4px #FFE082)');
    }

    function clearHighlight() {
        node.attr('fill', d => {
            const colors = ['#4682B4','#77ABE0','#FFC0D0','#FFED75','#A8D5BA','#B8DAF2','#CBE7F8','#DEEFFB','#EEF7FC','#B0B0B0'];
            let hash = 0;
            for (let i = 0; i < d.group.length; i++) hash = d.group.charCodeAt(i) + ((hash << 5) - hash);
            return colors[Math.abs(hash) % colors.length];
        })
        .attr('stroke', '#2c3e50')
        .attr('stroke-width', 1)
        .attr('r', d => 5 + Math.sqrt(d.degree) * 3);
        link.attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', d => Math.sqrt(d.weight) * 5)   // возвращаем увеличенную толщину
            .style('filter', 'none');
    }

    // ---- Подсветка из контекста ----
    if (selectedProf) {
        const targetNode = nodes.find(n => n.label === selectedProf);
        if (targetNode) {
            targetNode.fx = width / 2;
            targetNode.fy = height / 2;
            highlightNode(targetNode);
            selectedNodeId = targetNode.id;
            showTooltip(targetNode);
        }
    }

    // ---- Клик по узлу ----
    node.on('click', function(event, d) {
        event.stopPropagation();
        if (selectedNodeId === d.id) {
            clearHighlight();
            selectedNodeId = null;
            zoomApplied = false;
            applyAutoZoom(nodes, width, height);
            return;
        }
        clearHighlight();
        highlightNode(d);
        selectedNodeId = d.id;
        showTooltip(d);
        zoomToNode(d, width, height);
    });

    // ---- Наведение на узел ----
    node.on('mouseover', function(event, d) {
        if (selectedNodeId !== d.id) {
            d3.select(this)
                .attr('stroke', '#FFA500')
                .attr('stroke-width', 2);
        }
    }).on('mouseout', function(event, d) {
        if (selectedNodeId !== d.id) {
            d3.select(this)
                .attr('stroke', '#2c3e50')
                .attr('stroke-width', 1);
        }
    });

    // ---- Наведение на ребро (подсветка ярко-жёлтым) ----
    link.on('mouseover', function(event, d) {
        d3.select(this)
            .attr('stroke', '#FFC107')
            .attr('stroke-opacity', 1)
            .attr('stroke-width', Math.sqrt(d.weight) * 7)   // ещё жирнее при наведении
            .style('filter', 'drop-shadow(0 0 8px #FFC107)');
        node.filter(n => n.id === d.source.id || n.id === d.target.id)
            .attr('stroke', '#FFA500')
            .attr('stroke-width', 2);
    }).on('mouseout', function(event, d) {
        const isConnectedToSelected = (d.source.id === selectedNodeId || d.target.id === selectedNodeId);
        if (selectedNodeId !== null && isConnectedToSelected) {
            d3.select(this)
                .attr('stroke', '#FFE082')
                .attr('stroke-opacity', 1)
                .attr('stroke-width', Math.sqrt(d.weight) * 6)
                .style('filter', 'drop-shadow(0 0 4px #FFE082)');
        } else {
            d3.select(this)
                .attr('stroke', '#999')
                .attr('stroke-opacity', 0.6)
                .attr('stroke-width', Math.sqrt(d.weight) * 5)
                .style('filter', 'none');
        }
        node.filter(n => n.id === d.source.id || n.id === d.target.id)
            .attr('stroke', (n) => n.id === selectedNodeId ? '#FFA500' : '#2c3e50')
            .attr('stroke-width', (n) => n.id === selectedNodeId ? 3 : 1);
    });

    // ---- Клик по ребру ----
    link.on('click', function(event, d) {
        event.stopPropagation();
        const source = d.source.label || d.source.id;
        const target = d.target.label || d.target.id;
        fetch(`/api/graph/edge/skills?prof_a=${encodeURIComponent(source)}&prof_b=${encodeURIComponent(target)}`)
            .then(resp => resp.json())
            .then(data => {
                const tooltip = document.getElementById('graph-tooltip');
                tooltip.innerHTML = `<strong>${source}</strong> ↔ <strong>${target}</strong><br>Общие навыки: ${data.common_skills.join(', ') || 'нет'}`;
            });
    });

    // ---- Drag ----
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
        if (selectedProf && d.label !== selectedProf) {
            d.fx = null;
            d.fy = null;
        }
    }

    // ---- Симуляция ----
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

    // ---- Зум к узлу ----
    function zoomToNode(d, w, h) {
        if (!d || !d.x || !d.y) return;
        const scale = 1.8;
        const tx = w / 2 - d.x * scale;
        const ty = h / 2 - d.y * scale;
        const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
        svg.transition()
            .duration(600)
            .ease(d3.easeCubicInOut)
            .call(zoomBehavior.transform, transform);
        window._graphTransform = transform;
    }

    // ---- Автоцентрирование (один раз) ----
    function applyAutoZoom(nodes, w, h) {
        if (zoomApplied) return;
        let centerNode = null;
        if (selectedProf) {
            centerNode = nodes.find(n => n.label === selectedProf);
        }
        if (!centerNode) {
            centerNode = nodes.reduce((a, b) => (a.degree > b.degree) ? a : b);
        }
        if (!centerNode) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            if (n.x !== undefined && n.y !== undefined) {
                if (n.x < minX) minX = n.x;
                if (n.x > maxX) maxX = n.x;
                if (n.y < minY) minY = n.y;
                if (n.y > maxY) maxY = n.y;
            }
        });
        if (!isFinite(minX)) return;

        const graphWidth = maxX - minX || 1;
        const graphHeight = maxY - minY || 1;
        const targetWidth = w * 5 / 8;
        const targetHeight = h * 5 / 8;
        const scaleX = targetWidth / graphWidth;
        const scaleY = targetHeight / graphHeight;
        let scale = Math.min(scaleX, scaleY, 2);
        scale = Math.max(scale, 0.3);

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const tx = w / 2 - cx * scale;
        const ty = h / 2 - cy * scale;

        const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
        svg.transition()
            .duration(600)
            .ease(d3.easeCubicInOut)
            .call(zoomBehavior.transform, transform);
        window._graphTransform = transform;
        zoomApplied = true;
    }

    // ---- Зум-поведение ----
    zoomBehavior = d3.zoom()
        .scaleExtent([0.2, 5])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
            window._graphTransform = event.transform;
        });

    svg.call(zoomBehavior)
        .on('wheel.zoom', null)
        .on('dblclick.zoom', null);

    if (window._graphTransform) {
        svg.call(zoomBehavior.transform, window._graphTransform);
    }

    // ---- Кнопки зума ----
    document.getElementById('zoomInBtn').onclick = () => {
        const current = d3.zoomTransform(svg.node());
        const newScale = Math.min(current.k * 1.3, 5);
        const newTransform = d3.zoomIdentity.translate(current.x, current.y).scale(newScale);
        svg.transition().duration(300).call(zoomBehavior.transform, newTransform);
    };
    document.getElementById('zoomOutBtn').onclick = () => {
        const current = d3.zoomTransform(svg.node());
        const newScale = Math.max(current.k * 0.7, 0.2);
        const newTransform = d3.zoomIdentity.translate(current.x, current.y).scale(newScale);
        svg.transition().duration(300).call(zoomBehavior.transform, newTransform);
    };
    document.getElementById('zoomResetBtn').onclick = () => {
        zoomApplied = false;
        applyAutoZoom(nodes, width, height);
    };

    // ---- Полноэкранный режим ----
    if (fullscreenHandler) {
        document.removeEventListener('fullscreenchange', fullscreenHandler);
        fullscreenHandler = null;
    }
    fullscreenHandler = function() {
        setTimeout(() => {
            loadProfessionGraph();
        }, 100);
        document.removeEventListener('fullscreenchange', fullscreenHandler);
        fullscreenHandler = null;
    };
    document.addEventListener('fullscreenchange', fullscreenHandler);

    document.getElementById('fullscreenGraphBtn').onclick = function() {
        const container = document.getElementById('profession-graph');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen().catch(err => {});
        }
    };

    // ---- Тултип ----
    function showTooltip(d) {
        fetch(`/api/graph/profession/${encodeURIComponent(d.label)}/skills?limit=10`)
            .then(resp => resp.json())
            .then(data => {
                const tooltip = document.getElementById('graph-tooltip');
                tooltip.innerHTML = `<strong>${d.label}</strong> (${d.count} вакансий, ${d.degree} связей)<br>Топ навыки: ${data.map(s => s.skill + ' (' + s.count + ')').join(', ')}`;
            });
    }

    // ---- Автоцентрирование по завершении симуляции ----
    simulation.on('end', () => {
        if (!zoomApplied) {
            applyAutoZoom(nodes, width, height);
        }
    });
}

// ---- Обновление контекстной информации ----
function updateGraphContextInfo() {
    const info = document.getElementById('graph-context-info');
    if (!info) return;
    let text = '';
    if (contextType === 'all') {
        text = '🌐 Весь рынок';
    } else if (contextType === 'group' && contextValue) {
        text = `📁 Группа: ${contextValue}`;
    } else if (contextType === 'profession' && contextValue) {
        text = `💼 Профессия: ${contextValue}`;
    }
    info.textContent = text;
}

// ---- Ползунок (ручное изменение) ----
document.getElementById('jaccardThreshold').addEventListener('input', function() {
    const value = parseFloat(this.value).toFixed(2);
    document.getElementById('jaccardValue').textContent = value;
    manualThreshold = true;   // включаем ручной режим – автоподбор больше не перезапишет
});

// ---- Кнопка обновления ----
document.getElementById('updateGraphBtn').addEventListener('click', loadProfessionGraph);

// ---- Инициализация ----
setTimeout(() => {
    updateGraphContextInfo();
    loadProfessionGraph();
}, 100);