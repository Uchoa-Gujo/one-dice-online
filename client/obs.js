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
  const conditionBox = $('obs-conditions');
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




  const CONDITION_META = {
    'fascinado': ['Fascinado', 'mental'],
    'fatigado': ['Fatigado', 'fisico'],
    'fraco': ['Fraco', 'fisico'],
    'frustrado': ['Frustrado', 'mental'],
    'imunidade': ['Imunidade', 'azul'],
    'imovel': ['Imóvel', 'controle'],
    'inconsciente': ['Inconsciente', 'cinza'],
    'indefeso': ['Indefeso', 'cinza'],
    'lento': ['Lento', 'controle'],
    'machucado': ['Machucado', 'dano'],
    'morrendo': ['Morrendo', 'dano'],
    'ofuscado': ['Ofuscado', 'controle'],
    'paralisado': ['Paralisado', 'controle'],
    'pasmo': ['Pasmo', 'mental'],
    'petrificado': ['Petrificado', 'cinza'],
    'sangrando': ['Sangrando', 'dano'],
    'surdo': ['Surdo', 'controle'],
    'surpreendido': ['Surpreendido', 'mental'],
    'vulneravel': ['Vulnerável', 'dano'],
    'agarrado': ['Agarrado', 'controle'],
    'cego': ['Cego', 'controle'],
    'confuso': ['Confuso', 'mental'],
    'envenenado': ['Envenenado', 'veneno'],
    'terreno-dificil': ['Terreno Difícil', 'terreno']
  };

  function slugCondition(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function normalizeConditions(data) {
    const out = [];
    const push = (value) => {
      if (!value) return;
      const raw = String(value).trim();
      if (!raw || /^normal$/i.test(raw)) return;
      const slug = CONDITION_META[raw] ? raw : slugCondition(raw);
      const id = CONDITION_META[slug] ? slug : slug;
      if (id && !out.includes(id)) out.push(id);
    };
    if (Array.isArray(data?.conditions)) data.conditions.forEach(push);
    if (Array.isArray(data?.conditionTags)) data.conditionTags.forEach(push);
    if (typeof data?.conditionsText === 'string') data.conditionsText.split(/[,;|\n]+/).forEach(push);
    if (typeof data?.condition === 'string') data.condition.split(/[,;|\n]+/).forEach(push);
    return out;
  }

  function renderConditions(conditions) {
    if (!conditionBox) return;
    const list = Array.isArray(conditions) ? conditions : [];
    if (!list.length) {
      conditionBox.innerHTML = '';
      conditionBox.classList.add('is-empty');
      return;
    }
    conditionBox.classList.remove('is-empty');
    conditionBox.innerHTML = list.map((id) => {
      const meta = CONDITION_META[id] || [String(id || '').replace(/-/g, ' '), 'cinza'];
      return `<span class="od-obs-condition od-obs-condition-${escapeHtml(meta[1])}">${escapeHtml(meta[0])}</span>`;
    }).join('');
  }

  function getActiveTransformationPortrait(data) {
    const forms = Array.isArray(data?.transformations) ? data.transformations : [];
    if (!forms.length) return '';
    const activeId = data.activeTransformationId || '';
    const active = forms.find((form) => String(form.id) === String(activeId)) || forms.find((form) => form.active);
    return active?.portrait || active?.image || active?.photo || active?.avatar || '';
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
    if (data.obsTransformationActive || data.activeTransformation || data.activeTransformationId) obsPortraitMode = 'transformation';
    else if (pv < 0) obsPortraitMode = 'hidden';
    else if (pv === 0) obsPortraitMode = 'zero';
    else if (ratio < 0.5) obsPortraitMode = 'low';

    return {
      updatedAt: character.updatedAt || character.updated_at || data.updatedAt || data.updated_at || '',
      portrait:
        (obsPortraitMode === 'transformation' && (getActiveTransformationPortrait(data) || data.obsTransformPortrait || data.transformationPortrait)) ||
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
        transformation: getActiveTransformationPortrait(data) || data.obsTransformPortrait || data.transformationPortrait || obsIcons.transformation || data.obsIconTransformation || data.iconTransformation || ''
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
        1,
      conditions: normalizeConditions(data)
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
      renderConditions([]);
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
        renderConditions(character.conditions);
        lastPayload = nextPayload;
      }

      setStatus('ready');
    } catch (error) {
      console.warn('[One Dice OBS] Falha ao carregar ficha:', error);
      setStatus('error');
      setImage(fallbackImage);
      setSegmentedBar('pv', 0, 1);
      setSegmentedBar('pe', 0, 1);
      renderConditions([]);
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
