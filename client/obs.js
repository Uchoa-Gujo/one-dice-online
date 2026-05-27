(function(){
  const params = new URLSearchParams(location.search);
  const pathParts = location.pathname.split('/').filter(Boolean);
  const characterId = pathParts[pathParts.length - 1];
  const root = document.getElementById('obs-root');
  const accent = params.get('cor') || params.get('color');
  const scale = Number(params.get('escala') || params.get('scale'));

  if (accent) document.documentElement.style.setProperty('--pv', accent);
  if (Number.isFinite(scale) && scale > 0) document.documentElement.style.setProperty('--obs-scale', String(scale));

  const els = {
    card: document.getElementById('obs-card'),
    portrait: document.getElementById('obs-portrait'),
    pvText: document.getElementById('obs-pv-text'),
    peText: document.getElementById('obs-pe-text'),
    pvFill: document.getElementById('obs-pv-fill'),
    peFill: document.getElementById('obs-pe-fill'),
    pvOver: document.getElementById('obs-pv-over'),
    peOver: document.getElementById('obs-pe-over')
  };

  let last = null;

  function num(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pct(current, max) {
    if (max <= 0) return 0;
    return clamp((current / max) * 100, 0, 100);
  }

  function overPct(current, max) {
    if (max <= 0 || current <= max) return 0;
    return clamp(((current - max) / max) * 100, 0, 100);
  }

  function formatValue(current, max) {
    return `${current} / ${max}`;
  }

  function setBar(kind, current, max) {
    const fill = kind === 'pv' ? els.pvFill : els.peFill;
    const over = kind === 'pv' ? els.pvOver : els.peOver;
    const text = kind === 'pv' ? els.pvText : els.peText;
    const safeCurrent = num(current);
    const safeMax = Math.max(1, num(max, 1));

    fill.style.width = `${pct(Math.min(safeCurrent, safeMax), safeMax)}%`;
    over.style.width = `${overPct(safeCurrent, safeMax)}%`;
    text.textContent = formatValue(safeCurrent, safeMax);
  }

  function setPortrait(src) {
    const nextSrc = src || '/assets/logo.jpg';
    if (els.portrait.getAttribute('src') !== nextSrc) els.portrait.src = nextSrc;
  }

  function applyCharacter(character) {
    if (!character) return;

    const changed = last && (
      last.pvCurrent !== character.pvCurrent ||
      last.pvMax !== character.pvMax ||
      last.peCurrent !== character.peCurrent ||
      last.peMax !== character.peMax ||
      last.portrait !== character.portrait
    );

    setPortrait(character.portrait);
    setBar('pv', character.pvCurrent, character.pvMax);
    setBar('pe', character.peCurrent, character.peMax);

    if (changed) {
      els.card.classList.remove('obs-pulse');
      void els.card.offsetWidth;
      els.card.classList.add('obs-pulse');
    }

    last = JSON.parse(JSON.stringify(character));
  }

  async function refresh() {
    if (!characterId) return;

    try {
      const response = await fetch(`/api/characters/public/${encodeURIComponent(characterId)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Ficha não encontrada');
      const data = await response.json();
      applyCharacter(data.character);
      root.classList.remove('obs-unavailable');
    } catch (error) {
      root.classList.add('obs-unavailable');
      setBar('pv', 0, 1);
      setBar('pe', 0, 1);
      setPortrait('/assets/logo.jpg');
    }
  }

  try {
    document.documentElement.classList.add('obs-page');
    document.body.classList.add('obs-page');
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  } catch (_) {}

  refresh();
  setInterval(refresh, Math.max(600, Number(params.get('intervalo') || 1000)));
})();
