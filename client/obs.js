(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const root = $('obs-root');
  const portrait = $('obs-portrait');
  const portraitBox = $('obs-portrait-box');
  const pvBase = $('obs-pv-base');
  const pvExtra = $('obs-pv-extra');
  const peBase = $('obs-pe-base');
  const peExtra = $('obs-pe-extra');
  const pvText = $('obs-pv-text');
  const peText = $('obs-pe-text');
  const params = new URLSearchParams(window.location.search || '');

  const fallbackImage = '/assets/logo.jpg';
  let lastImageSrc = '';
  let imageErrorCount = 0;

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

  function safeImagePath(src) {
    const value = typeof src === 'string' ? src.trim() : '';
    if (!value) return fallbackImage;
    if (/^(data:image\/|https?:\/\/|\/)/i.test(value)) return value;
    return `/${value.replace(/^\.\//, '').replace(/^\/+/, '')}`;
  }

  function setImage(src) {
    if (!portrait) return;
    if (src === '__hide__') { portrait.classList.add('is-hidden'); portrait.removeAttribute('src'); return; }
    const next = safeImagePath(src);
    portrait.classList.remove('is-hidden');
    if (lastImageSrc !== next) {
      imageErrorCount = 0;
      lastImageSrc = next;
    }
    if (portrait.getAttribute('src') !== next) portrait.setAttribute('src', next);
  }

  function shouldHidePortrait(character) {
    const pv = toNumber(character?.pvCurrent, 0);
    return pv < 0;
  }

  function imageStamp(character) {
    return encodeURIComponent(
      character && (
        character.updatedAt ||
        character.updated_at ||
        character.portrait ||
        character.obsIcons?.normal ||
        character.obsIcons?.low ||
        character.obsIcons?.zero ||
        character.obsIcons?.transformation ||
        character.obsPortraitMode ||
        Date.now()
      )
    );
  }

  function setImageFromCharacter(id, character) {
    if (shouldHidePortrait(character)) { setImage('__hide__'); return; }
    if (!id) {
      setImage(character && character.portrait ? character.portrait : fallbackImage);
      return;
    }

    const mode = character?.obsPortraitMode || '';
    const stamp = imageStamp(character);
    setImage(`/api/characters/public/${encodeURIComponent(id)}/portrait?v=100&t=${stamp}&mode=${encodeURIComponent(mode)}&cb=${Date.now()}`);
  }

  function setSegmentedBar(kind, current, max) {
    const base = kind === 'pv' ? pvBase : peBase;
    const extra = kind === 'pv' ? pvExtra : peExtra;
    const text = kind === 'pv' ? pvText : peText;
    const c = Math.max(0, Math.round(toNumber(current, 0)));
    const m = Math.max(1, Math.round(toNumber(max, 1)));

    if (text) text.textContent = `${c} / ${m}`;

    if (!base || !extra) return;

    if (c <= m) {
      const percent = clamp((c / m) * 100, 0, 100);
      base.style.width = `${percent}%`;
      extra.style.left = '100%';
      extra.style.width = '0%';
      return;
    }

    // Quando passa do máximo, a barra representa o total atual:
    // parte normal = máximo, parte adicional = excedente.
    const basePercent = clamp((m / c) * 100, 0, 100);
    const extraPercent = clamp(100 - basePercent, 0, 100);
    base.style.width = `${basePercent}%`;
    extra.style.left = `${basePercent}%`;
    extra.style.width = `${extraPercent}%`;
  }

  function normalize(raw) {
    const character = raw && raw.character ? raw.character : raw;
    const data = character && character.data ? character.data : character;
    if (!data || typeof data !== 'object') return null;

    const obsIcons = data.obsIcons || data.obs_icons || {};
    const pvCurrent =
      data.pvCurrent ??
      data.pvAtual ??
      data.pv_current ??
      data.pv ??
      data.hpCurrent ??
      data.hpAtual ??
      data.hp ??
      0;
    const pvMax =
      data.pvMax ??
      data.pvTotal ??
      data.pv_max ??
      data.hpMax ??
      data.hpTotal ??
      data.hp_max ??
      1;

    let obsPortraitMode = 'normal';
    const pv = toNumber(pvCurrent, 0);
    const max = Math.max(1, toNumber(pvMax, 1));
    const ratio = pv / max;
    if (data.isTransformation || data.obsTransformationActive || data.activeTransformation || data.activeTransformationId) obsPortraitMode = 'transformation';
    else if (pv < 0) obsPortraitMode = 'hidden';
    else if (pv === 0) obsPortraitMode = 'zero';
    else if (ratio < 0.5) obsPortraitMode = 'low';

    return {
      updatedAt: character.updatedAt || character.updated_at || data.updatedAt || data.updated_at || '',
      portrait:
        (obsPortraitMode === 'transformation' && (data.obsTransformPortrait || data.transformationPortrait)) ||
        data.portrait ||
        data.avatar ||
        data.image ||
        data.imageUrl ||
        data.photo ||
        data.foto ||
        '',
      obsPortraitMode,
      obsIcons: {
        normal: obsIcons.normal || data.obsIconNormal || data.iconNormal || '',
        low: obsIcons.low || data.obsIconLow || data.iconLow || data.iconeMachucado || data.damagedPortrait || '',
        zero: obsIcons.zero || data.obsIconZero || data.iconZero || data.iconeMorrendo || data.dyingPortrait || '',
        transformation: data.obsTransformPortrait || data.transformationPortrait || obsIcons.transformation || data.obsIconTransformation || data.iconTransformation || ''
      },
      pvCurrent,
      pvMax,
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
      setSegmentedBar('pv', 0, 1);
      setSegmentedBar('pe', 0, 1);
      return;
    }

    try {
      const payload = await getCharacter(id);
      const character = normalize(payload);
      if (!character) throw new Error('Ficha inválida');

      const nextPayload = JSON.stringify(character);
      if (nextPayload !== lastPayload) {
        setImageFromCharacter(id, character);
        setSegmentedBar('pv', character.pvCurrent, character.pvMax);
        setSegmentedBar('pe', character.peCurrent, character.peMax);
        lastPayload = nextPayload;
      }

      setStatus('ready');
    } catch (error) {
      console.warn('[One Dice OBS] Falha ao carregar ficha:', error);
      setStatus('error');
      setImage(fallbackImage);
      setSegmentedBar('pv', 0, 1);
      setSegmentedBar('pe', 0, 1);
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
        imageErrorCount += 1;
        if (imageErrorCount <= 1) {
          const id = getId();
          if (id) {
            portrait.setAttribute('src', `/api/characters/public/${encodeURIComponent(id)}/portrait?v=99&fallback=1&cb=${Date.now()}`);
            return;
          }
        }
        if (portrait.getAttribute('src') !== fallbackImage) {
          portrait.setAttribute('src', fallbackImage);
        } else {
          portrait.classList.add('is-hidden');
          if (portraitBox) portraitBox.style.background = 'transparent';
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
