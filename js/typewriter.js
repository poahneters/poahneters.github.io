function typewriter(el, lines, { speed = 45, pause = 1800, loop = false } = {}) {
  let lineIndex = 0;
  let charIndex = 0;
  let deleting = false;

  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  el.appendChild(cursor);

  function tick() {
    const line = lines[lineIndex];

    if (!deleting) {
      el.textContent = line.slice(0, charIndex + 1);
      el.appendChild(cursor);
      charIndex++;

      if (charIndex === line.length) {
        if (!loop && lineIndex === lines.length - 1) return;
        setTimeout(() => { deleting = true; tick(); }, pause);
        return;
      }
    } else {
      el.textContent = line.slice(0, charIndex - 1);
      el.appendChild(cursor);
      charIndex--;

      if (charIndex === 0) {
        deleting = false;
        lineIndex = (lineIndex + 1) % lines.length;
        setTimeout(tick, 400);
        return;
      }
    }

    setTimeout(tick, deleting ? speed / 2 : speed);
  }

  tick();
}
