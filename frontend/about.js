// ========== ГРАФ ПРОФЕССИЙ ==========
let selectedNodeId = null;
let selectedProfLabel = null;
let previousProfession = null;
let manualThreshold = false;
let zoomBehavior = null;
let svgElement = null;
let graphGroup = null;
let simulation = null;
let zoomApplied = false;
let fullscreenHandler = null;
let cachedGraphData = null;           // кеш данных для перерисовки без запроса

async function loadProfessionGraph() {
    let group = '';
    let profession = '';

    if (contextType === 'group' && contextValue) {
        group = contextValue;
        selectedProfLabel = null;
        previousProfession = null;
        manualThreshold = false;
    } else if (contextType === 'profession' && contextValue) {
        profession = contextValue;
        if (profession !== previousProfession && !manualThreshold) {
            previousProfession = profession;
            const optimalThreshold = await findOptimalThreshold(profession);
            document.getElementById('jaccardThreshold').value = optimalThreshold;
            document.getElementById('jaccardValue').textContent = optimalThreshold.toFixed(2);
        } else {
            previousProfession = profession;
        }
        selectedProfLabel = profession;
    } else {
        selectedProfLabel = null;
        previousProfession = null;
        manualThreshold = false;
    }

    const threshold = parseFloat(document.getElementById('jaccardThreshold').value) || 0.1;
    const minVacancies = 1;
    const url = `/api/graph/professions?threshold=${threshold}&min_vacancies=${minVacancies}` +
        (group ? `&group=${encodeURIComponent(group)}` : '') +
        (profession ? `&profession=${encodeURIComponent(profession)}` : '');

    // Формируем ключ кеша
    const cacheKey = `${contextType}:${contextValue}:${threshold}`;
    let data = null;

    // Если есть кеш и ключ совпадает – используем его
    if (cachedGraphData && cachedGraphData.cacheKey === cacheKey) {
        data = cachedGraphData.data;
        console.log('Using cached graph data');
    } else {
        try {
            const resp = await fetch(url);
            data = await resp.json();
            cachedGraphData = { cacheKey, data };
        } catch (e) {
            console.error('Profession graph error', e);
            return;
        }
    }

    if (simulation) {
        simulation.stop();
        simulation = null;
    }
    zoomApplied = false;

    renderD3Graph(data);
    updateGraphContextInfo();
}

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

    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(edges).id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .alphaDecay(0.08)
        .velocityDecay(0.6);

    const link = g.append('g')
        .selectAll('line')
        .data(edges)
        .enter().append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', d => Math.sqrt(d.weight) * 5)
        .style('cursor', 'pointer')
        .style('transition', 'stroke 0.2s, stroke-width 0.2s, filter 0.2s');

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

    const label = g.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .text(d => d.label)
        .attr('font-size', '10px')
        .attr('dx', 12)
        .attr('dy', 4)
        .style('pointer-events', 'none');

    // ---- Всплывающий тултип (создаём один раз в body) ----
    let hoverTooltip = document.getElementById('graph-hover-tooltip');
    if (!hoverTooltip) {
        hoverTooltip = document.createElement('div');
        hoverTooltip.id = 'graph-hover-tooltip';
        document.body.appendChild(hoverTooltip);
    }

    // Кеши навыков для узлов и рёбер
    const nodeSkillsCache = {};
    const edgeSkillsCache = {};

    // ---- Функция позиционирования (fixed) ----
    function updateTooltipPosition(clientX, clientY) {
        const tooltip = hoverTooltip;
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;
        if (tw === 0 || th === 0) return;

        const maxLeftShift = tw / 2;
        const maxTopShift = th / 2;

        let left = clientX + 15;
        let top = clientY + 15;

        if (left + tw > window.innerWidth) {
            let leftCandidate = clientX - tw - 15;
            const cursorLeft = clientX;
            const minLeft = cursorLeft - maxLeftShift;
            if (leftCandidate < minLeft) leftCandidate = minLeft;
            if (leftCandidate < 0) leftCandidate = 0;
            left = leftCandidate;
        }
        if (left < 0) left = 0;

        if (top + th > window.innerHeight) {
            let topCandidate = clientY - th - 15;
            const cursorTop = clientY;
            const minTop = cursorTop - maxTopShift;
            if (topCandidate < minTop) topCandidate = minTop;
            if (topCandidate < 0) topCandidate = 0;
            top = topCandidate;
        }
        if (top < 0) top = 0;

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function showHoverTooltip(content, clientX, clientY) {
        const tooltip = hoverTooltip;
        tooltip.innerHTML = content;
        tooltip.style.display = 'block';
        tooltip.classList.remove('visible');
        tooltip.style.visibility = 'visible';
        updateTooltipPosition(clientX, clientY);
        requestAnimationFrame(() => {
            tooltip.classList.add('visible');
        });
    }

    function hideHoverTooltip() {
        const tooltip = hoverTooltip;
        tooltip.classList.remove('visible');
        setTimeout(() => {
            if (!tooltip.classList.contains('visible')) {
                tooltip.style.display = 'none';
            }
        }, 350);
    }

    // ---- Подсветка ----
    function highlightNode(d) {
        node.filter(n => n.id === d.id)
            .attr('fill', '#FFD700')
            .attr('stroke', '#FFA500')
            .attr('stroke-width', 3)
            .attr('r', 10 + Math.sqrt(d.degree) * 3);
        link.filter(l => l.source.id === d.id || l.target.id === d.id)
            .attr('stroke', '#FFE082')
            .attr('stroke-opacity', 1)
            .attr('stroke-width', l => Math.sqrt(l.weight) * 6)
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
            .attr('stroke-width', d => Math.sqrt(d.weight) * 5)
            .style('filter', 'none');
    }

    // Подсветка выбранной профессии
    if (selectedProf) {
        const targetNode = nodes.find(n => n.label === selectedProf);
        if (targetNode) {
            targetNode.fx = width / 2;
            targetNode.fy = height / 2;
            highlightNode(targetNode);
            selectedNodeId = targetNode.id;
            showStaticTooltip(targetNode);
        }
    }

    function showStaticTooltip(d) {
        fetch(`/api/graph/profession/${encodeURIComponent(d.label)}/skills?limit=1000`)
            .then(resp => resp.json())
            .then(data => {
                const tooltip = document.getElementById('graph-tooltip');
                const skills = data.map(s => s.skill + ' (' + s.count + ')').join(', ');
                tooltip.innerHTML = `<strong>${d.label}</strong> (${d.count} вакансий, ${d.degree} связей)<br>Все навыки: ${skills || 'нет'}`;
            })
            .catch(() => {
                document.getElementById('graph-tooltip').innerHTML = `<strong>${d.label}</strong> (ошибка загрузки навыков)`;
            });
    }

    // ---- Обработчики узлов ----
    node.on('mouseover', function(event, d) {
        const label = d.label;
        let content = `<strong>${label}</strong><br>Вакансий: ${d.count}<br>Связей: ${d.degree}`;
        
        if (!nodeSkillsCache[d.id]) {
            content += '<br>Загрузка навыков…';
            showHoverTooltip(content, event.clientX, event.clientY);
            hoverTooltip.dataset.nodeId = d.id;

            fetch(`/api/graph/profession/${encodeURIComponent(label)}/skills?limit=1000`)
                .then(resp => resp.json())
                .then(skillsData => {
                    const allSkills = skillsData.map(s => s.skill);
                    nodeSkillsCache[d.id] = allSkills;
                    if (hoverTooltip.classList.contains('visible') && hoverTooltip.dataset.nodeId == d.id) {
                        const display = allSkills.slice(0, 10);
                        let skillsStr = display.join(', ');
                        if (allSkills.length > 10) skillsStr += ' …';
                        hoverTooltip.innerHTML = `<strong>${label}</strong><br>Вакансий: ${d.count}<br>Связей: ${d.degree}<br>Навыки: ${skillsStr}`;
                        updateTooltipPosition(event.clientX, event.clientY);
                    }
                })
                .catch(() => {
                    nodeSkillsCache[d.id] = [];
                    if (hoverTooltip.classList.contains('visible') && hoverTooltip.dataset.nodeId == d.id) {
                        hoverTooltip.innerHTML = `<strong>${label}</strong><br>Вакансий: ${d.count}<br>Связей: ${d.degree}<br>Навыки: ошибка загрузки`;
                        updateTooltipPosition(event.clientX, event.clientY);
                    }
                });
        } else {
            const allSkills = nodeSkillsCache[d.id];
            const display = allSkills.slice(0, 10);
            let skillsStr = display.join(', ');
            if (allSkills.length > 10) skillsStr += ' …';
            content += `<br>Навыки: ${skillsStr}`;
            showHoverTooltip(content, event.clientX, event.clientY);
            hoverTooltip.dataset.nodeId = d.id;
        }

        if (selectedNodeId !== d.id) {
            d3.select(this).attr('stroke', '#FFA500').attr('stroke-width', 2);
        }
    })
    .on('mousemove', function(event, d) {
        if (hoverTooltip.classList.contains('visible')) {
            updateTooltipPosition(event.clientX, event.clientY);
        }
    })
    .on('mouseout', function(event, d) {
        hideHoverTooltip();
        if (selectedNodeId !== d.id) {
            d3.select(this).attr('stroke', '#2c3e50').attr('stroke-width', 1);
        }
    });

    // ---- Обработчики рёбер ----
    link.on('mouseover', function(event, d) {
        const source = d.source.label || d.source.id;
        const target = d.target.label || d.target.id;
        const cacheKey = source + '|' + target;

        let content = `<strong>${source}</strong> ↔ <strong>${target}</strong><br>Общие навыки: `;
        if (edgeSkillsCache[cacheKey]) {
            const allSkills = edgeSkillsCache[cacheKey];
            const display = allSkills.slice(0, 10);
            let skillsStr = display.join(', ');
            if (allSkills.length > 10) skillsStr += ' …';
            content += skillsStr || 'нет общих';
            showHoverTooltip(content, event.clientX, event.clientY);
            hoverTooltip.dataset.edgeKey = cacheKey;
        } else {
            content += 'загрузка…';
            showHoverTooltip(content, event.clientX, event.clientY);
            hoverTooltip.dataset.edgeKey = cacheKey;

            fetch(`/api/graph/edge/skills?prof_a=${encodeURIComponent(source)}&prof_b=${encodeURIComponent(target)}`)
                .then(resp => resp.json())
                .then(data => {
                    const allSkills = data.common_skills || [];
                    edgeSkillsCache[cacheKey] = allSkills;
                    if (hoverTooltip.classList.contains('visible') && hoverTooltip.dataset.edgeKey == cacheKey) {
                        const display = allSkills.slice(0, 10);
                        let skillsStr = display.join(', ');
                        if (allSkills.length > 10) skillsStr += ' …';
                        hoverTooltip.innerHTML = `<strong>${source}</strong> ↔ <strong>${target}</strong><br>Общие навыки: ${skillsStr || 'нет общих'}`;
                        updateTooltipPosition(event.clientX, event.clientY);
                    }
                })
                .catch(() => {
                    edgeSkillsCache[cacheKey] = [];
                    if (hoverTooltip.classList.contains('visible') && hoverTooltip.dataset.edgeKey == cacheKey) {
                        hoverTooltip.innerHTML = `<strong>${source}</strong> ↔ <strong>${target}</strong><br>Общие навыки: ошибка загрузки`;
                        updateTooltipPosition(event.clientX, event.clientY);
                    }
                });
        }

        d3.select(this)
            .attr('stroke', '#FFC107')
            .attr('stroke-opacity', 1)
            .attr('stroke-width', Math.sqrt(d.weight) * 7)
            .style('filter', 'drop-shadow(0 0 8px #FFC107)');
        node.filter(n => n.id === d.source.id || n.id === d.target.id)
            .attr('stroke', '#FFA500')
            .attr('stroke-width', 2);
    })
    .on('mousemove', function(event, d) {
        if (hoverTooltip.classList.contains('visible')) {
            updateTooltipPosition(event.clientX, event.clientY);
        }
    })
    .on('mouseout', function(event, d) {
        hideHoverTooltip();
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

    // ---- Клик по узлу ----
    node.on('click', function(event, d) {
        event.stopPropagation();
        if (selectedNodeId === d.id) {
            clearHighlight();
            selectedNodeId = null;
            zoomApplied = false;
            applyAutoZoom(nodes, width, height);
            document.getElementById('graph-tooltip').innerHTML = '';
            return;
        }
        clearHighlight();
        highlightNode(d);
        selectedNodeId = d.id;
        showStaticTooltip(d);
        zoomToNode(d, width, height);
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
                const allSkills = data.common_skills || [];
                tooltip.innerHTML = `<strong>${source}</strong> ↔ <strong>${target}</strong><br>Все общие навыки: ${allSkills.join(', ') || 'нет'}`;
            })
            .catch(() => {
                document.getElementById('graph-tooltip').innerHTML = `<strong>${source}</strong> ↔ <strong>${target}</strong><br>Ошибка загрузки общих навыков`;
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

    // ---- Зум ----
    function zoomToNode(d, w, h) {
        if (!d || !d.x || !d.y) return;
        const scale = 1.8;
        const tx = w / 2 - d.x * scale;
        const ty = h / 2 - d.y * scale;
        const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
        svg.transition().duration(600).ease(d3.easeCubicInOut).call(zoomBehavior.transform, transform);
        window._graphTransform = transform;
    }

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
        svg.transition().duration(600).ease(d3.easeCubicInOut).call(zoomBehavior.transform, transform);
        window._graphTransform = transform;
        zoomApplied = true;
    }

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

    // Кнопки зума
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

    // ---- Полноэкранный режим (перерисовка с кешем) ----
    if (fullscreenHandler) {
        document.removeEventListener('fullscreenchange', fullscreenHandler);
        fullscreenHandler = null;
    }
    fullscreenHandler = function() {
        // Даём браузеру время изменить размеры, затем перерисовываем граф из кеша
        setTimeout(() => {
            loadProfessionGraph();
        }, 50);
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

// ---- Ползунок ----
document.getElementById('jaccardThreshold').addEventListener('input', function() {
    const value = parseFloat(this.value).toFixed(2);
    document.getElementById('jaccardValue').textContent = value;
    manualThreshold = true;
});

// ---- Кнопка обновления ----
document.getElementById('updateGraphBtn').addEventListener('click', loadProfessionGraph);

// ---- Инициализация ----
setTimeout(() => {
    updateGraphContextInfo();
    loadProfessionGraph();
}, 100);