/* Molecule-style force graph using D3 v7 */

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

  // Defs: glow filter
  const defs = svg.append('defs');
  const filter = defs.append('filter').attr('id', 'glow');
  filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
  const merge = filter.append('feMerge');
  merge.append('feMergeNode').attr('in', 'coloredBlur');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  const g = svg.append('g');

  // Zoom
  svg.call(d3.zoom().scaleExtent([0.4, 2.5]).on('zoom', e => g.attr('transform', e.transform)));

  // Build node map
  const nodeMap = {};
  data.nodes.forEach(n => nodeMap[n.id] = n);

  // Size scale
  const sizeScale = d3.scaleLinear().domain([1, 3]).range([42, 68]);

  // Simulation
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.connections)
      .id(d => d.id)
      .distance(d => {
        const s = nodeMap[d.source.id || d.source];
        const t = nodeMap[d.target.id || d.target];
        return 80 + (sizeScale(s.size) + sizeScale(t.size));
      })
      .strength(0.4))
    .force('charge', d3.forceManyBody().strength(d => -sizeScale(d.size) * 12))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(d => sizeScale(d.size) + 12))
    .alphaDecay(0.02);

  // Links
  const link = g.append('g')
    .selectAll('line')
    .data(data.connections)
    .join('line')
    .attr('stroke', '#c8c4b8')
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.6);

  // Node groups
  const node = g.append('g')
    .selectAll('g')
    .data(data.nodes)
    .join('g')
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', dragstart)
      .on('drag', dragged)
      .on('end', dragend));

  // Circles
  node.append('circle')
    .attr('r', d => sizeScale(d.size))
    .attr('fill', d => d.color)
    .attr('fill-opacity', 0.85)
    .attr('stroke', d => d.color)
    .attr('stroke-width', 2)
    .attr('filter', d => d.size >= 3 ? 'url(#glow)' : null);

  // Labels — wrapped to fit inside circle
  node.each(function(d) {
    const r = sizeScale(d.size);
    const fontSize = Math.max(9, r * 0.38);
    const maxWidth = r * 1.6;
    const words = d.label.split(' ');
    const textEl = d3.select(this).append('text')
      .attr('text-anchor', 'middle')
      .attr('fill', '#f7f5f0')
      .attr('font-size', fontSize + 'px')
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-weight', '600')
      .attr('pointer-events', 'none');

    // Build lines that fit within maxWidth
    const lines = [];
    let current = '';
    words.forEach(word => {
      const test = current ? current + ' ' + word : word;
      // Rough char-width estimate: fontSize * 0.55 per char
      if (test.length * fontSize * 0.55 > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);

    const lineHeight = fontSize * 1.25;
    const totalHeight = lines.length * lineHeight;
    lines.forEach((line, i) => {
      textEl.append('tspan')
        .attr('x', 0)
        .attr('y', -totalHeight / 2 + lineHeight * 0.5 + i * lineHeight)
        .attr('dy', '0.35em')
        .text(line);
    });
  });

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

  node.on('mouseenter', function(event, d) {
      d3.select(this).select('circle')
        .transition().duration(150)
        .attr('r', sizeScale(d.size) * 1.2)
        .attr('fill-opacity', 1);

      tooltip
        .style('opacity', 1)
        .html(`<strong>${d.label}</strong><br>${d.description}`);
    })
    .on('mousemove', function(event) {
      tooltip
        .style('left', (event.clientX + 14) + 'px')
        .style('top', (event.clientY - 10) + 'px');
    })
    .on('mouseleave', function(event, d) {
      d3.select(this).select('circle')
        .transition().duration(150)
        .attr('r', sizeScale(d.size))
        .attr('fill-opacity', 0.85);
      tooltip.style('opacity', 0);
    });

  // Gentle bob animation
  let t = 0;
  function bob() {
    t += 0.008;
    node.each(function(d, i) {
      const offset = Math.sin(t + i * 0.7) * 1.5;
      d3.select(this).attr('transform', `translate(${d.x},${d.y + offset})`);
    });
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    requestAnimationFrame(bob);
  }

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  simulation.on('end', bob);

  // Drag
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
