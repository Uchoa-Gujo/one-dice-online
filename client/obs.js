(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const root = $('obs-root');
  const portrait = $('obs-portrait');
  const portraitBox = $('obs-portrait-box');
  const pvFill = $('obs-pv-fill');
  const peFill = $('obs-pe-fill');
  const pvText = $('obs-pv-text');
  const peText = $('obs-pe-text');
  const params = new URLSearchParams(window.location.search || '');

  const fallbackImage = '/assets/logo.jpg';

  function setStatus(status) {
    if (root) root.dataset.status = status;
  }

  function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function calcPercent(current, max) {
    const c = Math.max(0, toNumber(current, 0));
    const m = Math.max(1, toNumber(max, 1));
    return clamp((c / m) * 100, 0, 100);
  }

  function safeImagePath(src) {
    const value = typeof src === 'string' ? src.trim() : '';
    if (!value) return fallbackImage;
    if (/^(data:image\/|https?:\/\/|\/)/i.test(value)) return value;
    return `/${value.replace(/^\.\//, '').replace(/^\/+/, '')}`;
  }

  function setImage(src) {
    if (!portrait) return;
    const next = safeImagePath(src);
    portrait.classList.remove('is-hidden');
    if (portrait.getAttribute('src') !== next) portrait.setAttribute('src', next);
  }

  function setImageFromCharacter(id, character) {
    if (!id) {
      setImage(character && character.portrait ? character.portrait : fallbackImage);
      return;
    }

    // Usar uma rota própria evita falha no OBS quando a imagem da ficha é dataURL grande,
    // URL relativa, ou quando o Browser Source não aceita o mesmo src usado no navegador.
    const stamp = encodeURIComponent(character && character.updatedAt ? character.updatedAt : Date.now());
    setImage(`/api/characters/public/${encodeURIComponent(id)}/portrait?v=95&t=${stamp}`);
  }

  function setBar(kind, current, max) {
    const fill = kind === 'pv' ? pvFill : peFill;
    const text = kind === 'pv' ? pvText : peText;
    const c = Math.max(0, Math.round(toNumber(current, 0)));
    const m = Math.max(1, Math.round(toNumber(max, 1)));

    if (fill) fill.style.width = `${calcPercent(c, m)}%`;
    if (text) text.textContent = `${c} / ${m}`;
  }

  function normalize(raw) {
    const character = raw && raw.character ? raw.character : raw;
    const data = character && character.data ? character.data : character;
    if (!data || typeof data !== 'object') return null;

    return {
      updatedAt: character.updatedAt || character.updated_at || data.updatedAt || data.updated_at || '',
      portrait:
        data.portrait ||
        data.avatar ||
        data.image ||
        data.imageUrl ||
        data.photo ||
        data.foto ||
        '',
      pvCurrent:
        data.pvCurrent ??
        data.pvAtual ??
        data.pv_current ??
        data.pv ??
        data.hpCurrent ??
        data.hpAtual ??
        data.hp ??
        0,
      pvMax:
        data.pvMax ??
        data.pvTotal ??
        data.pv_max ??
        data.hpMax ??
        data.hpTotal ??
        data.hp_max ??
        1,
      peCurrent:
        data.peCurrent ??
        data.peAtual ??
        data.pe_current ??
        data.pe ??
        data.energyCurrent ??
        0,
      peMax:
        data.peMax ??
        data.peTotal ??
        data.pe_max ??
        data.energyMax ??
        1
    };
  }

  function getId() {
    const queryId =
      params.get('character') ||
      params.get('characterId') ||
      params.get('id') ||
      params.get('ficha');

    if (queryId && queryId.trim()) return queryId.trim();

    const parts = window.location.pathname
      .split('/')
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));

    const personagemIndex = parts.indexOf('personagem');
    if (personagemIndex >= 0 && parts[personagemIndex + 1]) return parts[personagemIndex + 1];

    const obsIndex = parts.indexOf('obs');
    if (obsIndex >= 0 && parts[obsIndex + 1]) return parts[obsIndex + 1];

    return '';
  }

  async function getCharacter(id) {
    const response = await fetch(`/api/characters/public/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  let lastPayload = '';

  async function refresh() {
    const id = getId();

    if (!id) {
      setStatus('idle');
      setImage(fallbackImage);
      setBar('pv', 0, 1);
      setBar('pe', 0, 1);
      return;
    }

    try {
      const payload = await getCharacter(id);
      const character = normalize(payload);
      if (!character) throw new Error('Ficha inválida');

      const nextPayload = JSON.stringify(character);
      if (nextPayload !== lastPayload) {
        setImageFromCharacter(id, character);
        setBar('pv', character.pvCurrent, character.pvMax);
        setBar('pe', character.peCurrent, character.peMax);
        lastPayload = nextPayload;
      }

      setStatus('ready');
    } catch (error) {
      console.warn('[One Dice OBS] Falha ao carregar ficha:', error);
      setStatus('error');
      setImage(fallbackImage);
      setBar('pv', 0, 1);
      setBar('pe', 0, 1);
    }
  }

  function boot() {
    try {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      document.documentElement.classList.add('one-dice-obs-page');
      document.body.classList.add('one-dice-obs-page');
    } catch (_) {}

    if (portrait) {
      portrait.addEventListener('error', () => {
        if (portrait.getAttribute('src') !== fallbackImage) {
          portrait.setAttribute('src', fallbackImage);
        } else {
          portrait.classList.add('is-hidden');
          if (portraitBox) portraitBox.style.background = 'rgba(10, 10, 10, 0.96)';
        }
      });
    }

    const scale = toNumber(params.get('scale') || params.get('escala'), NaN);
    if (Number.isFinite(scale) && scale > 0) {
      document.documentElement.style.setProperty('--od-scale', String(clamp(scale, 0.3, 2.5)));
    }

    refresh();
    const interval = clamp(toNumber(params.get('intervalo') || params.get('interval') || 1200, 1200), 700, 10000);
    window.setInterval(refresh, interval);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
