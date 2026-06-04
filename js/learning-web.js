/* Molecule-style force graph using D3 v7 — click to expand children */

async function initLearningWeb(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const data = await fetch('data/learning.json').then(r => r.json());

  const W = container.clientWidth;
  const H = Math.max(560, window.innerHeight * 0.7);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H)
    .style('background', 'transparent');

  // Glow filter
  const defs = svg.append('defs');
  const filter = defs.append('filter').attr('id', 'glow');
  filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
  const merge = filter.append('feMerge');
  merge.append('feMergeNode').attr('in', 'coloredBlur');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  const g = svg.append('g');

  svg.call(d3.zoom().scaleExtent([0.4, 2.5]).on('zoom', e => g.attr('transform', e.transform)));

  const nodeMap = {};
  data.nodes.forEach(n => { nodeMap[n.id] = n; n._expanded = false; });

  // Build parent→children and child→parent maps
  const childrenOf = {};   // id → [child ids]
  const parentOf = {};     // id → parent id
  data.nodes.forEach(n => {
    childrenOf[n.id] = n.children || [];
    n.children.forEach(cid => { parentOf[cid] = n.id; });
  });

  // All IDs that are someone's child
  const allChildIds = new Set(Object.values(childrenOf).flat());

  // Initially visible = root nodes only (not a child of anyone)
  const visibleIds = new Set(data.nodes.filter(n => !allChildIds.has(n.id)).map(n => n.id));

  const sizeScale = d3.scaleLinear().domain([1, 3]).range([52, 80]);

  // Simulation over ALL nodes (hidden ones get pushed aside gently)
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.connections)
      .id(d => d.id)
      .distance(d => {
        const s = nodeMap[d.source.id || d.source];
        const t = nodeMap[d.target.id || d.target];
        return 90 + (sizeScale(s.size) + sizeScale(t.size));
      })
      .strength(0.35))
    .force('charge', d3.forceManyBody().strength(d => -sizeScale(d.size) * 14))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(d => sizeScale(d.size) + 14))
    .alphaDecay(0.02);

  // Links layer
  const linkG = g.append('g');
  // Nodes layer
  const nodeG = g.append('g');

  // Tooltip
  const tooltip = d3.select('body').append('div')
    .style('position', 'fixed')
    .style('background', '#1a1a18')
    .style('color', '#f7f5f0')
    .style('padding', '0.6rem 0.9rem')
    .style('border-radius', '4px')
    .style('font-size', '0.82rem')
    .style('font-family', 'system-ui, sans-serif')
    .style('max-width', '220px')
    .style('line-height', '1.5')
    .style('pointer-events', 'none')
    .style('opacity', 0)
    .style('z-index', 200)
    .style('box-shadow', '0 4px 16px rgba(0,0,0,0.3)');

  let linkSel, nodeSel;

  function isLinkVisible(d) {
    const sid = d.source.id || d.source;
    const tid = d.target.id || d.target;
    return visibleIds.has(sid) && visibleIds.has(tid);
  }

  function collapseChildren(id) {
    // Recursively hide children and their children
    (childrenOf[id] || []).forEach(cid => {
      visibleIds.delete(cid);
      nodeMap[cid]._expanded = false;
      collapseChildren(cid);
    });
  }

  function render() {
    // ── Links ──
    linkSel = linkG.selectAll('line').data(data.connections, d => d.source.id + '-' + d.target.id);
    linkSel.exit().remove();
    linkSel = linkG.selectAll('line').data(data.connections);
    linkSel.each(function(d) {
      d3.select(this).style('display', isLinkVisible(d) ? null : 'none');
    });
    linkG.selectAll('line')
      .join('line')
      .attr('stroke', '#c8c4b8')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .each(function(d) {
        d3.select(this).style('display', isLinkVisible(d) ? null : 'none');
      });

    // ── Nodes ──
    nodeSel = nodeG.selectAll('g.node-item')
      .data(data.nodes, d => d.id);

    const entered = nodeSel.enter()
      .append('g')
      .attr('class', 'node-item')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragstart)
        .on('drag', dragged)
        .on('end', dragend));

    // Circle
    entered.append('circle')
      .attr('r', d => sizeScale(d.size))
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.85)
      .attr('stroke', d => d.color)
      .attr('stroke-width', 2)
      .attr('filter', d => d.size >= 3 ? 'url(#glow)' : null);

    // Labels
    entered.each(function(d) {
      const r = sizeScale(d.size);
      const fontSize = Math.max(8, r * 0.24);
      const maxCharsPerLine = Math.floor((r * 1.7) / (fontSize * 0.58));
      const words = d.label.split(' ');
      const lines = [];
      let current = '';
      words.forEach(word => {
        const test = current ? current + ' ' + word : word;
        if (test.length > maxCharsPerLine && current) { lines.push(current); current = word; }
        else current = test;
      });
      if (current) lines.push(current);

      const lineHeight = fontSize * 1.3;
      const textEl = d3.select(this).append('text')
        .attr('text-anchor', 'middle')
        .attr('fill', '#f7f5f0')
        .attr('font-size', fontSize + 'px')
        .attr('font-family', 'system-ui, sans-serif')
        .attr('font-weight', '600')
        .attr('pointer-events', 'none');

      lines.forEach((line, i) => {
        textEl.append('tspan')
          .attr('x', 0)
          .attr('y', (i - (lines.length - 1) / 2) * lineHeight)
          .attr('dy', '0.35em')
          .text(line);
      });
    });

    // "+" indicator for expandable nodes
    entered.each(function(d) {
      if ((childrenOf[d.id] || []).length > 0) {
        const r = sizeScale(d.size);
        d3.select(this).append('text')
          .attr('class', 'expand-indicator')
          .attr('x', r * 0.68)
          .attr('y', -r * 0.68)
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(255,255,255,0.7)')
          .attr('font-size', Math.max(10, r * 0.28) + 'px')
          .attr('pointer-events', 'none')
          .text('+');
      }
    });

    nodeSel = nodeG.selectAll('g.node-item');

    // Show/hide by visibility
    nodeSel.each(function(d) {
      const vis = visibleIds.has(d.id);
      d3.select(this).style('display', vis ? null : 'none');
    });

    // Update "+" vs "−" indicator
    nodeSel.each(function(d) {
      if ((childrenOf[d.id] || []).length > 0) {
        d3.select(this).select('.expand-indicator').text(d._expanded ? '−' : '+');
      }
    });

    // Events
    nodeSel
      .on('click', function(event, d) {
        event.stopPropagation();
        tooltip.style('opacity', 0);
        const kids = childrenOf[d.id] || [];
        if (kids.length === 0) return;

        if (d._expanded) {
          d._expanded = false;
          collapseChildren(d.id);
        } else {
          d._expanded = true;
          kids.forEach(cid => visibleIds.add(cid));
        }
        render();
        simulation.alpha(0.3).restart();
      })
      .on('mouseenter', function(event, d) {
        if (!visibleIds.has(d.id)) return;
        d3.select(this).select('circle')
          .transition().duration(150)
          .attr('r', sizeScale(d.size) * 1.15)
          .attr('fill-opacity', 1);
        tooltip.style('opacity', 1)
          .html(`<strong>${d.label}</strong><br>${d.description}${(childrenOf[d.id]||[]).length ? '<br><em style="opacity:0.6;font-size:0.75rem">click to ' + (d._expanded ? 'collapse' : 'expand') + '</em>' : ''}`);
      })
      .on('mousemove', function(event) {
        tooltip.style('left', (event.clientX + 14) + 'px').style('top', (event.clientY - 10) + 'px');
      })
      .on('mouseleave', function(event, d) {
        d3.select(this).select('circle')
          .transition().duration(150)
          .attr('r', sizeScale(d.size))
          .attr('fill-opacity', 0.85);
        tooltip.style('opacity', 0);
      });
  }

  render();

  // Bob animation
  let t = 0;
  let bobRunning = false;
  function bob() {
    t += 0.008;
    nodeG.selectAll('g.node-item').each(function(d, i) {
      if (!visibleIds.has(d.id)) return;
      const offset = Math.sin(t + i * 0.7) * 1.5;
      d3.select(this).attr('transform', `translate(${d.x},${d.y + offset})`);
    });
    linkG.selectAll('line').each(function(d) {
      if (!isLinkVisible(d)) return;
      d3.select(this)
        .attr('x1', d.source.x).attr('y1', d.source.y)
        .attr('x2', d.target.x).attr('y2', d.target.y);
    });
    requestAnimationFrame(bob);
  }

  simulation.on('tick', () => {
    linkG.selectAll('line')
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    nodeG.selectAll('g.node-item')
      .attr('transform', d => `translate(${d.x},${d.y})`);
  });

  simulation.on('end', () => { if (!bobRunning) { bobRunning = true; bob(); } });

  function dragstart(event, d) {
    if (!event.active) simulation.alphaTarget(0.2).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
  function dragend(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
  }
}
