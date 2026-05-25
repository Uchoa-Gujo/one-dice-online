(function(){
  const params = new URLSearchParams(location.search);
  const pathParts = location.pathname.split('/').filter(Boolean);
  const characterId = pathParts[pathParts.length - 1];
  const mode = params.get('modo') || params.get('mode') || 'card';
  const accent = params.get('cor') || params.get('color');
  const root = document.getElementById('obs-root');
  if (accent) document.documentElement.style.setProperty('--accent', accent);
  root.className = `obs-root obs-${mode}-mode`;

  const els = {
    card: document.getElementById('obs-card'),
    portrait: document.getElementById('obs-portrait'),
    name: document.getElementById('obs-name'),
    meta: document.getElementById('obs-meta'),
    pvText: document.getElementById('obs-pv-text'),
    peText: document.getElementById('obs-pe-text'),
    pvFill: document.getElementById('obs-pv-fill'),
    peFill: document.getElementById('obs-pe-fill'),
    pvOver: document.getElementById('obs-pv-over'),
    peOver: document.getElementById('obs-pe-over'),
    condition: document.getElementById('obs-condition')
  };

  let last = null;
  function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function pct(cur, max) { return max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0; }
  function overPct(cur, max) { return max > 0 && cur > max ? Math.min(100, ((cur - max) / max) * 100) : 0; }
  function setBar(kind, cur, max) {
    const fill = kind === 'pv' ? els.pvFill : els.peFill;
    const over = kind === 'pv' ? els.pvOver : els.peOver;
    const text = kind === 'pv' ? els.pvText : els.peText;
    fill.style.width = `${pct(Math.min(cur, max), max)}%`;
    over.style.width = `${overPct(cur, max)}%`;
    text.textContent = `${cur}/${max}`;
  }
  function applyCharacter(char) {
    if (!char) return;
    const changed = last && (last.pvCurrent !== char.pvCurrent || last.peCurrent !== char.peCurrent || last.condition !== char.condition);
    els.name.textContent = char.name || 'Personagem';
    els.meta.textContent = [char.race, char.className, char.level ? `Nv. ${char.level}` : ''].filter(Boolean).join(' • ') || 'One Dice';
    els.portrait.src = char.portrait || '/assets/logo.jpg';
    setBar('pv', num(char.pvCurrent), num(char.pvMax, 1));
    setBar('pe', num(char.peCurrent), num(char.peMax, 1));
    els.condition.textContent = char.condition || 'Normal';
    if (changed) {
      els.card.classList.remove('obs-pulse');
      void els.card.offsetWidth;
      els.card.classList.add('obs-pulse');
    }
    last = JSON.parse(JSON.stringify(char));
  }
  async function refresh() {
    try {
      const res = await fetch(`/api/characters/public/${encodeURIComponent(characterId)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Ficha não encontrada');
      const data = await res.json();
      applyCharacter(data.character);
    } catch (err) {
      els.name.textContent = 'Overlay indisponível';
      els.meta.textContent = err.message || 'Erro ao carregar ficha';
    }
  }
  refresh();
  setInterval(refresh, Math.max(600, Number(params.get('intervalo') || 1000)));
})();

/* V75 - marca página como OBS transparente */
try {
  document.documentElement.classList.add('obs-page');
  document.body.classList.add('obs-page');
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
} catch (_) {}
