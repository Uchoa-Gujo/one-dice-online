/* One Dice Online v1.51.0 - cliente refeito sem camadas legadas.
   Objetivo: remover patches antigos sobrepostos que causavam loading infinito,
   flicker e espelhamento entre Defesa/Esquiva. */
(() => {
  'use strict';
  window.ONE_DICE_CLIENT_VERSION = '1.51.0';

  const SESSION_KEY = 'od_online_session_v42';
  const SETTINGS_KEY = 'od_settings';
  const BACKUP_KEY = 'od_sheet_backups_v151';

  const ATTRIBUTE_KEYS = [
    ['forca', 'Força'],
    ['agilidade', 'Agilidade'],
    ['vigor', 'Vigor'],
    ['intelecto', 'Intelecto'],
    ['presenca', 'Presença']
  ];
  const RESISTANCE_KEYS = [
    ['fisica', 'Física'],
    ['mental', 'Mental'],
    ['espiritual', 'Espiritual']
  ];
  const SKILLS = [
    ['Acrobacia', 'agilidade'], ['Adestramento', 'presenca'], ['Artes', 'presenca'],
    ['Atletismo', 'forca'], ['Construção', 'intelecto'], ['Culinária', 'intelecto'],
    ['Crime', 'agilidade'], ['Diplomacia', 'presenca'], ['Enganação', 'presenca'],
    ['Fortitude', 'vigor'], ['Furtividade', 'agilidade'], ['História', 'intelecto'],
    ['Iniciativa', 'agilidade'], ['Intimidação', 'presenca'], ['Intuição', 'presenca'],
    ['Investigação', 'intelecto'], ['Luta', 'forca'], ['Medicina', 'intelecto'],
    ['Misticismo', 'intelecto'], ['Natureza', 'intelecto'], ['Percepção', 'presenca'],
    ['Pilotagem', 'agilidade'], ['Pontaria', 'agilidade'], ['Reflexos', 'agilidade'],
    ['Religião', 'intelecto'], ['Sobrevivência', 'intelecto'], ['Tecnologia', 'intelecto'],
    ['Vontade', 'presenca']
  ];

  const $ = (id) => document.getElementById(id);
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const uid = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const toNumber = (value, fallback = 0) => {
    const n = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  };
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  let currentUser = null;
  let token = '';
  let characters = [];
  let tables = [];
  let currentCharacterId = null;
  let currentTableId = null;
  let tableState = null;
  let accountSheetMode = false;
  let selectedTab = 'resumo';
  let compactSkills = true;
  let inventoryMode = 'simple';
  let saveTimer = null;
  let rendering = false;

  function sessionRaw() {
    return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || '';
  }
  function getSession() {
    try { return JSON.parse(sessionRaw() || 'null'); } catch { return null; }
  }
  function setSession(data) {
    const value = JSON.stringify(data || null);
    const remember = $('remember-login')?.checked !== false;
    if (remember) {
      localStorage.setItem(SESSION_KEY, value);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, value);
      localStorage.removeItem(SESSION_KEY);
    }
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    token = '';
    currentUser = null;
  }

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = { ...(options.headers || {}) };
      if (!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(path, { ...options, headers, signal: controller.signal });
      let data = {};
      try { data = await response.json(); } catch { data = {}; }
      if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function normalizeUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      nick: user.nick || '',
      realName: user.real_name || user.realName || user.name || user.nick || '',
      avatarUrl: user.avatar_url || user.avatarUrl || ''
    };
  }

  function normalizeCharacter(row) {
    const data = row?.data && typeof row.data === 'object' ? structuredCloneSafe(row.data) : {};
    const c = {
      ...defaultCharacter(),
      ...data,
      id: row.id ?? data.id ?? uid('char'),
      ownerId: row.owner_id ?? row.ownerId ?? data.ownerId,
      name: row.name || data.name || 'Ficha',
      createdAt: row.created_at || row.createdAt || data.createdAt || Date.now(),
      updatedAt: row.updated_at || row.updatedAt || data.updatedAt || Date.now()
    };
    c.attributes = { ...defaultAttributes(), ...(c.attributes || {}) };
    c.resistances = { ...defaultResistances(), ...(c.resistances || {}) };
    c.skills = normalizeSkills(c.skills);
    c.attacks = Array.isArray(c.attacks) ? c.attacks : [];
    c.spells = Array.isArray(c.spells) ? c.spells : [];
    c.abilities = Array.isArray(c.abilities) ? c.abilities : [];
    c.transformations = Array.isArray(c.transformations) ? c.transformations : [];
    c.inventoryItems = Array.isArray(c.inventoryItems) ? c.inventoryItems : [];
    c.defense = toNumber(c.defense, 10);
    c.dodge = toNumber(c.dodge, 10);
    return c;
  }

  function toApiCharacter(c) {
    const clean = structuredCloneSafe(c || {});
    delete clean.owner_id; delete clean.ownerId;
    delete clean.created_at; delete clean.updated_at;
    clean.name = clean.name || 'Ficha';
    clean.defense = toNumber(clean.defense, 10);
    clean.dodge = toNumber(clean.dodge, 10);
    return { name: clean.name, data: clean };
  }

  function normalizeTable(row) {
    return {
      id: row.id,
      name: row.name || 'Mesa',
      code: row.invite_code || row.inviteCode || row.code || '',
      ownerId: row.owner_id || row.ownerId,
      role: row.role || 'player',
      characterId: row.character_id || row.characterId || null,
      settings: row.settings || {},
      logoUrl: row.logo_url || row.logoUrl || ''
    };
  }

  function structuredCloneSafe(value) {
    try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value ?? null)); }
  }
  function defaultAttributes() { return Object.fromEntries(ATTRIBUTE_KEYS.map(([key]) => [key, 0])); }
  function defaultResistances() { return Object.fromEntries(RESISTANCE_KEYS.map(([key]) => [key, 0])); }
  function normalizeSkills(skills = {}) {
    const out = {};
    SKILLS.forEach(([name]) => {
      const old = skills[name] || skills[name.toLowerCase()] || {};
      out[name] = { trained: !!old.trained, bonus: toNumber(old.bonus, 0), attr: old.attr || null };
    });
    return out;
  }
  function defaultCharacter() {
    return {
      id: uid('char'), name: 'Novo Personagem', race: '', className: '', origin: '', level: 1,
      profBonus: 0, xp: 0, speed: '', portrait: '', pvCurrent: 0, pvMax: 0, peCurrent: 0,
      peMax: 0, defense: 10, dodge: 10, attributes: defaultAttributes(), resistances: defaultResistances(),
      skills: normalizeSkills(), attacks: [], spells: [], abilities: [], transformations: [], inventoryItems: [],
      money: '', weightMax: 0, casterClass: '', casterIdentity: '', affinityPrimary: '', affinitySecondary: '',
      keyAttribute: '', powerBonus: 0, spellDc: 0, powerLimit: 0
    };
  }
  function currentCharacter() { return characters.find(c => String(c.id) === String(currentCharacterId)) || null; }
  function activeMember() {
    return tableState?.members?.find(m => String(m.user_id || m.userId) === String(currentUser?.id)) || null;
  }

  function showScreen(name) {
    ['auth-screen', 'sessions-screen', 'app-screen', 'overlay-screen'].forEach(id => $(id)?.classList.remove('active'));
    $(name)?.classList.add('active');
  }
  function toast(message, type = 'info') {
    let box = $('od-toast-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'od-toast-box';
      box.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9999;display:grid;gap:8px;max-width:360px';
      document.body.appendChild(box);
    }
    const item = document.createElement('div');
    item.textContent = message;
    item.style.cssText = `padding:10px 12px;border:2px solid ${type === 'error' ? '#d02b2b' : '#333'};background:#111;color:#fff;border-radius:10px;box-shadow:0 8px 20px #0007;font-weight:700`;
    box.appendChild(item);
    setTimeout(() => item.remove(), 3500);
  }

  function applySettings() {
    const settings = getSettings();
    document.body.dataset.accent = settings.accent || 'red';
    document.body.dataset.font = settings.font || 'impact';
    document.body.classList.toggle('dark-sheet', (settings.theme || 'dark') === 'dark');
    $('sessions-accent-select') && ($('sessions-accent-select').value = settings.accent || 'red');
    $('accent-select') && ($('accent-select').value = settings.accent || 'red');
    $('sessions-font-select') && ($('sessions-font-select').value = settings.font || 'impact');
    $('font-select') && ($('font-select').value = settings.font || 'impact');
    $('sessions-theme-toggle') && ($('sessions-theme-toggle').textContent = (settings.theme || 'dark') === 'dark' ? 'Tema Claro' : 'Tema Escuro');
    $('theme-toggle') && ($('theme-toggle').textContent = (settings.theme || 'dark') === 'dark' ? 'Tema Claro' : 'Tema Escuro');
  }
  function getSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
  }
  function setSettings(patch) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: 'dark', accent: 'red', font: 'impact', ...getSettings(), ...patch }));
    applySettings();
  }

  async function refreshAll() {
    const [charData, tableData] = await Promise.all([
      api('/api/characters'),
      api('/api/tables')
    ]);
    characters = (charData.characters || []).map(normalizeCharacter);
    tables = (tableData.tables || []).map(normalizeTable);
  }

  async function boot() {
    bindEvents();
    applySettings();
    hideManualNotes();
    const session = getSession();
    if (!session?.token) {
      showScreen('auth-screen');
      return;
    }
    token = session.token;
    try {
      const data = await api('/api/auth/me');
      currentUser = normalizeUser(data.user);
      setSession({ token, user: currentUser });
      await refreshAll();
      renderSessions();
      showScreen('sessions-screen');
    } catch (error) {
      console.error(error);
      clearSession();
      showScreen('auth-screen');
      toast('Sessão expirada. Entre novamente.', 'error');
    }
  }

  function bindEvents() {
    if (window.__od151Bound) return;
    window.__od151Bound = true;

    qa('[data-auth]').forEach(btn => btn.addEventListener('click', () => switchAuth(btn.dataset.auth)));
    $('login-form')?.addEventListener('submit', onLogin);
    $('register-form')?.addEventListener('submit', onRegister);
    $('sessions-logout')?.addEventListener('click', logout);
    $('logout-btn')?.addEventListener('click', () => { saveCurrentCharacterNow(); currentTableId = null; tableState = null; renderSessions(); showScreen('sessions-screen'); });
    $('back-to-sessions-btn')?.addEventListener('click', () => { saveCurrentCharacterNow(); currentTableId = null; tableState = null; renderSessions(); showScreen('sessions-screen'); });
    $('campaign-character-btn')?.addEventListener('click', () => { const c = currentCharacter(); if (c) openCharacter(c.id, { account: false }); });

    $('sessions-menu-btn')?.addEventListener('click', () => $('sessions-menu-panel')?.classList.toggle('hidden'));
    $('toggle-account-panel-btn')?.addEventListener('click', () => $('account-sheets-panel')?.classList.toggle('hidden'));
    $('create-account-character-btn')?.addEventListener('click', createCharacter);
    $('create-campaign-btn')?.addEventListener('click', createTable);
    $('join-campaign-btn')?.addEventListener('click', joinTableByCode);
    $('open-account-settings-btn')?.addEventListener('click', openAccountSettings);
    $('save-account-settings-btn')?.addEventListener('click', saveAccountSettings);
    $('account-settings-avatar-file')?.addEventListener('change', previewAccountAvatar);
    $('current-user-label')?.addEventListener('click', openAccountSettings);
    q('#main-topbar .brand')?.addEventListener('click', openAccountSettings);

    $('sessions-theme-toggle')?.addEventListener('click', toggleTheme);
    $('theme-toggle')?.addEventListener('click', toggleTheme);
    $('sessions-accent-select')?.addEventListener('change', e => setSettings({ accent: e.target.value }));
    $('accent-select')?.addEventListener('change', e => setSettings({ accent: e.target.value }));
    $('sessions-font-select')?.addEventListener('change', e => setSettings({ font: e.target.value }));
    $('font-select')?.addEventListener('change', e => setSettings({ font: e.target.value }));

    document.addEventListener('click', onDocumentClick);
    document.addEventListener('input', onDocumentInput);
    document.addEventListener('change', onDocumentChange);
    $('portrait-button')?.addEventListener('click', changePortrait);
    $('roll-dice')?.addEventListener('click', rollDice);
    $('chat-form')?.addEventListener('submit', sendChat);
    $('toggle-history-btn')?.addEventListener('click', () => $('session-history-box')?.classList.toggle('hidden'));
    $('compact-skills-toggle')?.addEventListener('click', () => { compactSkills = !compactSkills; renderSkills(currentCharacter()); });
    $('block-inventory-toggle')?.addEventListener('click', () => { inventoryMode = inventoryMode === 'simple' ? 'block' : 'simple'; renderInventory(currentCharacter()); });
    $('add-simple-inventory-item')?.addEventListener('click', () => { mutateCurrent(c => c.inventoryItems.push({ id: uid('item'), name: 'Novo item', qty: 1, weight: 0, description: '' })); renderInventory(currentCharacter()); scheduleSave(); });
    $('add-attack')?.addEventListener('click', () => { mutateCurrent(c => c.attacks.push({ id: uid('atk'), name: '', bonus: 0, damage: '', crit: '', desc: '' })); renderAttacks(currentCharacter()); scheduleSave(); });
    $('add-spell')?.addEventListener('click', () => { mutateCurrent(c => c.spells.push({ id: uid('spl'), name: '', circle: '', exec: '', range: '', cost: '', components: '', description: '', upgrades: '' })); renderSpells(currentCharacter()); scheduleSave(); });
    $('add-ability')?.addEventListener('click', () => { mutateCurrent(c => c.abilities.push({ id: uid('abl'), name: '', costAmount: 0, costResource: 'PE', bonus: '', action: 'Padrão', description: '' })); renderAbilities(currentCharacter()); scheduleSave(); });
    $('create-transformation-btn')?.addEventListener('click', () => { mutateCurrent(c => c.transformations.push({ id: uid('form'), name: 'Nova transformação', description: '', portrait: '' })); renderTransformations(currentCharacter()); scheduleSave(); });

    window.addEventListener('beforeunload', () => { try { saveCurrentCharacterNow(false); } catch {} });
  }

  function switchAuth(tab) {
    qa('.auth-tabs .tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.auth === tab));
    qa('.auth-form').forEach(form => form.classList.toggle('active', form.id.startsWith(tab)));
  }
  async function onLogin(event) {
    event.preventDefault();
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ nick: $('login-nick')?.value, password: $('login-password')?.value }) });
      token = data.token;
      currentUser = normalizeUser(data.user);
      setSession({ token, user: currentUser });
      await refreshAll();
      renderSessions();
      showScreen('sessions-screen');
    } catch (error) { toast(error.message, 'error'); }
  }
  async function onRegister(event) {
    event.preventDefault();
    const password = $('register-password')?.value || '';
    const confirm = $('register-password-confirm')?.value || '';
    if (password !== confirm) return toast('As senhas não conferem.', 'error');
    try {
      const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ nick: $('register-nick')?.value, realName: $('register-real-name')?.value, password }) });
      token = data.token;
      currentUser = normalizeUser(data.user);
      setSession({ token, user: currentUser });
      await refreshAll();
      renderSessions();
      showScreen('sessions-screen');
    } catch (error) { toast(error.message, 'error'); }
  }
  function logout() { clearSession(); characters = []; tables = []; currentCharacterId = null; currentTableId = null; showScreen('auth-screen'); }

  function renderSessions() {
    if (!currentUser) return;
    $('current-user-label') && ($('current-user-label').textContent = currentUser.realName || currentUser.nick || 'Conta');
    renderAccountCharacters();
    renderCampaigns();
  }
  function renderAccountCharacters() {
    const list = $('account-character-list');
    if (!list) return;
    list.innerHTML = '';
    if (!characters.length) {
      list.innerHTML = '<div class="campaign-empty">Você ainda não tem fichas.</div>';
      return;
    }
    characters.forEach(c => {
      const card = document.createElement('article');
      card.className = 'campaign-card account-character-card';
      card.innerHTML = `
        <div class="campaign-main">
          <div class="campaign-character-preview"><img src="${esc(c.portrait || 'assets/logo.jpg')}" alt=""><span>${esc(c.name)}</span></div>
          <div><small>Nível ${esc(c.level || 1)} · ${esc(c.className || c.class || '')}</small></div>
        </div>
        <div class="campaign-actions">
          <button class="primary-btn" data-open-character="${esc(c.id)}" type="button">Abrir</button>
          <button class="ghost-btn" data-duplicate-character="${esc(c.id)}" type="button">Duplicar</button>
          <button class="danger-btn small" data-delete-character="${esc(c.id)}" type="button">Excluir</button>
        </div>`;
      list.appendChild(card);
    });
  }
  function renderCampaigns() {
    const list = $('campaign-list');
    if (!list) return;
    list.innerHTML = '';
    if (!tables.length) {
      list.innerHTML = '<div class="campaign-empty">Você ainda não criou ou entrou em nenhuma mesa.</div>';
      return;
    }
    tables.forEach(t => {
      const c = characters.find(ch => String(ch.id) === String(t.characterId));
      const owner = String(t.ownerId) === String(currentUser.id);
      const card = document.createElement('article');
      card.className = 'campaign-card';
      card.innerHTML = `
        <div class="campaign-main">
          <div><strong>${esc(t.name)}</strong><span>Código: <b>${esc(t.code)}</b></span><small>Papel: ${esc(t.role)}</small></div>
          <div class="campaign-character-preview"><img src="${esc(c?.portrait || 'assets/logo.jpg')}" alt=""><span>${esc(c?.name || 'Sem ficha escolhida')}</span></div>
        </div>
        <div class="campaign-actions">
          <button class="primary-btn" data-enter-table="${esc(t.id)}" type="button">Entrar</button>
          <button class="ghost-btn" data-choose-table-character="${esc(t.id)}" type="button">Escolher Ficha</button>
          ${owner ? `<button class="ghost-btn" data-copy-code="${esc(t.code)}" type="button">Copiar Código</button><button class="danger-btn small" data-delete-table="${esc(t.id)}" type="button">Excluir Mesa</button>` : `<button class="danger-btn small" data-leave-table="${esc(t.id)}" type="button">Sair da Mesa</button>`}
        </div>`;
      list.appendChild(card);
    });
  }

  async function createCharacter() {
    try {
      const c = defaultCharacter();
      const data = await api('/api/characters', { method: 'POST', body: JSON.stringify(toApiCharacter(c)) });
      characters.push(normalizeCharacter(data.character));
      renderAccountCharacters();
      openCharacter(data.character.id, { account: true });
    } catch (error) { toast(error.message, 'error'); }
  }
  async function duplicateCharacter(id) {
    const source = characters.find(c => String(c.id) === String(id));
    if (!source) return;
    try {
      const copy = structuredCloneSafe(source);
      copy.id = uid('char'); copy.name = `${source.name || 'Ficha'} Cópia`; copy.createdAt = Date.now(); copy.updatedAt = Date.now();
      const data = await api('/api/characters', { method: 'POST', body: JSON.stringify(toApiCharacter(copy)) });
      characters.push(normalizeCharacter(data.character));
      renderAccountCharacters();
      toast('Ficha duplicada.');
    } catch (error) { toast(error.message, 'error'); }
  }
  async function deleteCharacter(id) {
    if (!confirm('Excluir esta ficha?')) return;
    try {
      await api(`/api/characters/${encodeURIComponent(id)}`, { method: 'DELETE' });
      characters = characters.filter(c => String(c.id) !== String(id));
      if (String(currentCharacterId) === String(id)) currentCharacterId = null;
      await refreshAll();
      renderSessions();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function createTable() {
    const name = $('new-campaign-name')?.value?.trim();
    if (!name) return toast('Informe o nome da mesa.', 'error');
    try {
      const data = await api('/api/tables', { method: 'POST', body: JSON.stringify({ name }) });
      tables.push(normalizeTable({ ...data.table, role: 'master' }));
      $('new-campaign-name').value = '';
      await refreshAll();
      renderCampaigns();
    } catch (error) { toast(error.message, 'error'); }
  }
  async function joinTableByCode() {
    const code = $('join-campaign-code')?.value?.trim().toUpperCase();
    if (!code) return toast('Informe o código da mesa.', 'error');
    try {
      await api('/api/tables/join', { method: 'POST', body: JSON.stringify({ code }) });
      $('join-campaign-code').value = '';
      await refreshAll();
      renderCampaigns();
    } catch (error) { toast(error.message, 'error'); }
  }
  async function chooseTableCharacter(tableId) {
    const modal = $('choose-character-modal');
    const list = $('choose-character-list');
    if (!modal || !list) return;
    list.innerHTML = '';
    if (!characters.length) list.innerHTML = '<p>Crie uma ficha primeiro.</p>';
    characters.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ghost-btn choose-character-entry';
      btn.innerHTML = `<img src="${esc(c.portrait || 'assets/logo.jpg')}" alt=""><span>${esc(c.name)}</span>`;
      btn.addEventListener('click', async () => {
        try {
          await api(`/api/tables/${encodeURIComponent(tableId)}/member`, { method: 'PUT', body: JSON.stringify({ characterId: c.id }) });
          modal.close();
          await refreshAll();
          renderCampaigns();
        } catch (error) { toast(error.message, 'error'); }
      });
      list.appendChild(btn);
    });
    $('create-character-for-campaign').onclick = async () => { await createCharacter(); modal.close(); };
    modal.showModal();
  }
  async function enterTable(tableId) {
    try {
      saveCurrentCharacterNow();
      currentTableId = tableId;
      accountSheetMode = false;
      const data = await api(`/api/tables/${encodeURIComponent(tableId)}/state`);
      tableState = data;
      const myMember = data.members?.find(m => String(m.user_id || m.userId) === String(currentUser.id));
      const myCharId = myMember?.character_id || myMember?.characterId || tables.find(t => String(t.id) === String(tableId))?.characterId || null;
      if (myCharId) {
        let char = characters.find(c => String(c.id) === String(myCharId));
        if (myMember?.character_data) {
          char = normalizeCharacter({ id: myCharId, owner_id: currentUser.id, name: myMember.character_name, data: myMember.character_data });
          const idx = characters.findIndex(c => String(c.id) === String(myCharId));
          if (idx >= 0) characters[idx] = char; else characters.push(char);
        }
        currentCharacterId = myCharId;
      }
      renderTable();
      if (currentCharacterId) renderCharacter(currentCharacter()); else renderBlankSheet('Escolha uma ficha para esta mesa');
      showScreen('app-screen');
      loadMessages();
    } catch (error) {
      currentTableId = null; tableState = null;
      toast(error.message, 'error');
      renderSessions(); showScreen('sessions-screen');
    }
  }
  async function leaveTable(id) {
    if (!confirm('Sair desta mesa?')) return;
    try { await api(`/api/tables/${encodeURIComponent(id)}/leave`, { method: 'DELETE' }); await refreshAll(); renderCampaigns(); } catch (error) { toast(error.message, 'error'); }
  }
  async function deleteTable(id) {
    if (!confirm('Excluir esta mesa? As fichas serão desvinculadas da mesa.')) return;
    try { await api(`/api/tables/${encodeURIComponent(id)}`, { method: 'DELETE' }); await refreshAll(); renderCampaigns(); } catch (error) { toast(error.message, 'error'); }
  }

  function openCharacter(id, { account = true } = {}) {
    saveCurrentCharacterNow();
    currentCharacterId = id;
    if (account) { currentTableId = null; tableState = null; accountSheetMode = true; }
    renderCharacter(currentCharacter());
    renderTable();
    showScreen('app-screen');
  }

  function renderTable() {
    const table = tables.find(t => String(t.id) === String(currentTableId));
    $('sidebar-title') && ($('sidebar-title').textContent = table ? table.name : 'Ficha');
    $('campaign-info') && ($('campaign-info').innerHTML = table ? `<strong>${esc(table.name)}</strong><br><small>Código: ${esc(table.code)}</small>` : '<small>Ficha fora de mesa.</small>');
    $('campaign-mini-card')?.classList.toggle('hidden', !table);
    if ($('campaign-mini-card')) $('campaign-mini-card').innerHTML = table ? `<strong>${esc(table.name)}</strong><small>${esc(table.code)}</small>` : '';
    renderCharacterList();
    const master = table && ['master', 'master_player'].includes(String(table.role));
    $('master-dashboard')?.classList.toggle('hidden', !master || accountSheetMode);
    $('player-dashboard')?.classList.toggle('hidden', master || accountSheetMode || !table);
    renderDashboards();
  }
  function renderCharacterList() {
    const list = $('character-list');
    if (!list) return;
    list.innerHTML = '';
    if (!tableState?.members?.length) {
      list.innerHTML = '<div class="sidebar-empty">Nenhuma ficha vinculada a esta mesa ainda.</div>';
      return;
    }
    tableState.members.forEach(m => {
      const data = m.character_data || {};
      const name = m.character_name || data.name || m.real_name || m.nick || 'Jogador';
      const portrait = data.portrait || m.avatar_url || 'assets/logo.jpg';
      const row = document.createElement('button');
      row.className = 'character-side-card';
      row.type = 'button';
      row.innerHTML = `<img src="${esc(portrait)}" alt=""><span>${esc(name)}</span><small>${esc(m.role || '')}</small>`;
      if (String(m.user_id) === String(currentUser?.id) && m.character_id) row.addEventListener('click', () => openCharacter(m.character_id, { account: false }));
      list.appendChild(row);
    });
  }
  function renderDashboards() {
    const publicGrid = $('public-party-grid');
    const masterGrid = $('master-characters-grid');
    [publicGrid, masterGrid].forEach(grid => { if (grid) grid.innerHTML = ''; });
    (tableState?.members || []).forEach(m => {
      const d = m.character_data || {};
      const html = `<article class="party-card"><img src="${esc(d.portrait || m.avatar_url || 'assets/logo.jpg')}" alt=""><strong>${esc(m.character_name || d.name || m.real_name || m.nick || 'Jogador')}</strong><small>PV ${esc(d.pvCurrent ?? 0)}/${esc(d.pvMax ?? 0)} · PE ${esc(d.peCurrent ?? 0)}/${esc(d.peMax ?? 0)}</small></article>`;
      if (publicGrid) publicGrid.insertAdjacentHTML('beforeend', html);
      if (masterGrid) masterGrid.insertAdjacentHTML('beforeend', html);
    });
  }

  function renderBlankSheet(message) {
    const c = defaultCharacter(); c.name = message || '';
    renderCharacter(c, { readonly: true });
  }
  function renderCharacter(c, opts = {}) {
    rendering = true;
    hideManualNotes();
    try {
      if (!c) { renderBlankSheet('Nenhuma ficha aberta'); return; }
      setValue('char-name', c.name);
      setValue('char-race', c.race);
      setValue('char-class', c.className || c.class || '');
      setValue('char-origin', c.origin);
      setValue('char-level', c.level);
      setValue('prof-bonus', c.profBonus ?? c.proficiencyBonus ?? 0);
      setValue('char-xp', c.xp);
      setValue('char-speed', c.speed);
      setValue('pv-current', c.pvCurrent); setValue('pv-max', c.pvMax);
      setValue('pe-current', c.peCurrent); setValue('pe-max', c.peMax);
      setValue('defense', c.defense); setValue('dodge', c.dodge);
      setValue('money', c.money); setValue('weight-max', c.weightMax);
      setValue('caster-class', c.casterClass); setValue('caster-identity', c.casterIdentity);
      setValue('affinity-primary', c.affinityPrimary); setValue('affinity-secondary', c.affinitySecondary);
      setValue('key-attribute', c.keyAttribute); setValue('power-bonus', c.powerBonus);
      setValue('spell-dc', c.spellDc); setValue('power-limit', c.powerLimit);
      const img = $('char-portrait-preview'); if (img) img.src = c.portrait || 'assets/logo.jpg';
      updateBars(c);
      renderAttributes(c); renderSkills(c); renderAttacks(c); renderInventory(c); renderSpells(c); renderAbilities(c); renderTransformations(c);
      selectTab(selectedTab);
      qa('#app-screen input,#app-screen textarea,#app-screen select').forEach(el => { el.disabled = !!opts.readonly; });
      ['defense', 'dodge'].forEach(id => { const el = $(id); if (el) { el.disabled = !!opts.readonly; el.removeAttribute('readonly'); } });
    } finally { rendering = false; }
  }
  function setValue(id, value) { const el = $(id); if (el && document.activeElement !== el) el.value = value ?? ''; }
  function hideManualNotes() {
    ['defense-effective-note', 'dodge-formula-note'].forEach(id => { const el = $(id); if (el) { el.textContent = ''; el.style.display = 'none'; } });
  }
  function updateBars(c) {
    const pv = Math.max(0, Math.min(100, c.pvMax ? (toNumber(c.pvCurrent) / toNumber(c.pvMax, 1)) * 100 : 0));
    const pe = Math.max(0, Math.min(100, c.peMax ? (toNumber(c.peCurrent) / toNumber(c.peMax, 1)) * 100 : 0));
    $('pv-bar') && ($('pv-bar').style.width = `${pv}%`);
    $('pe-bar') && ($('pe-bar').style.width = `${pe}%`);
  }
  function renderAttributes(c) {
    const grid = $('attributes-grid'); if (!grid) return;
    grid.innerHTML = ATTRIBUTE_KEYS.map(([key, label]) => `<label class="attribute-card">${esc(label)}<input data-attr="${key}" type="number" value="${esc(c.attributes?.[key] ?? 0)}"></label>`).join('');
    const res = $('resistances-grid'); if (res) res.innerHTML = RESISTANCE_KEYS.map(([key, label]) => `<label class="attribute-card">${esc(label)}<input data-resistance="${key}" type="number" value="${esc(c.resistances?.[key] ?? 0)}"></label>`).join('');
  }
  function renderSkills(c) {
    const table = $('skills-table'); if (!table || !c) return;
    const prof = toNumber(c.profBonus, 0);
    let rows = SKILLS.map(([name, attr]) => {
      const s = c.skills?.[name] || { trained: false, bonus: 0 };
      if (compactSkills && !s.trained) return '';
      const attrKey = s.attr || attr;
      const attrValue = toNumber(c.attributes?.[attrKey], 0);
      const total = attrValue + toNumber(s.bonus, 0) + (s.trained ? prof : 0);
      return `<tr><td>${esc(name)}<small>${esc(attrKey)}</small></td><td><input data-skill-trained="${esc(name)}" type="checkbox" ${s.trained ? 'checked' : ''}></td><td><input data-skill-bonus="${esc(name)}" type="number" value="${esc(s.bonus || 0)}"></td><td><strong>${total >= 0 ? '+' : ''}${total}</strong></td></tr>`;
    }).join('');
    if (!rows) rows = '<tr><td colspan="4">Nenhuma perícia treinada. Clique em Mostrar Todas.</td></tr>';
    table.innerHTML = `<thead><tr><th>Perícia</th><th>Treino</th><th>Bônus</th><th>Total</th></tr></thead><tbody>${rows}</tbody>`;
    $('skills-wrap')?.classList.toggle('compact', compactSkills);
    $('compact-skills-toggle') && ($('compact-skills-toggle').textContent = compactSkills ? 'Mostrar Todas' : 'Modo Compacto');
  }
  function renderAttacks(c) {
    const list = $('attacks-list'); if (!list || !c) return;
    list.innerHTML = c.attacks.map((a, i) => `<article class="mini-card attack-card" data-index="${i}"><input data-attack-field="name" placeholder="Nome do ataque" value="${esc(a.name)}"><input data-attack-field="bonus" type="number" placeholder="Bônus" value="${esc(a.bonus ?? 0)}"><input data-attack-field="damage" placeholder="Dano" value="${esc(a.damage)}"><input data-attack-field="crit" placeholder="Crítico" value="${esc(a.crit)}"><textarea data-attack-field="desc" placeholder="Descrição">${esc(a.desc)}</textarea><button class="roll-attack primary-btn small" type="button" data-roll-attack="${i}">Rolar ataque</button><button class="remove-card danger-btn small" type="button" data-remove-attack="${i}">Remover</button></article>`).join('');
  }
  function renderInventory(c) {
    const simple = $('simple-inventory-panel'), block = $('block-inventory-panel');
    simple?.classList.toggle('active', inventoryMode === 'simple');
    block?.classList.toggle('active', inventoryMode === 'block');
    $('block-inventory-toggle') && ($('block-inventory-toggle').textContent = inventoryMode === 'simple' ? 'Modo Block Inventory' : 'Modo Texto');
    const total = (c?.inventoryItems || []).reduce((sum, item) => sum + toNumber(item.weight, 0) * toNumber(item.qty, 1), 0);
    setValue('weight-current', total);
    const max = toNumber(c?.weightMax, 0);
    $('weight-status') && ($('weight-status').textContent = !max || total <= max ? 'Peso dentro do limite.' : `Sobrepeso: ${total}/${max}`);
    const list = $('simple-inventory-list'); if (!list || !c) return;
    list.innerHTML = (c.inventoryItems || []).map((it, i) => `<article class="mini-card inventory-text-card" data-index="${i}"><input data-item-field="name" placeholder="Item" value="${esc(it.name)}"><input data-item-field="qty" type="number" min="1" value="${esc(it.qty ?? 1)}"><input data-item-field="weight" type="number" step="0.1" value="${esc(it.weight ?? 0)}"><textarea data-item-field="description" placeholder="Descrição">${esc(it.description)}</textarea><button class="danger-btn small" data-remove-item="${i}" type="button">Remover</button></article>`).join('');
  }
  function renderSpells(c) {
    const list = $('spells-list'); if (!list || !c) return;
    list.innerHTML = c.spells.map((s, i) => `<article class="mini-card spell-card spell-card-layout" data-index="${i}"><input class="spell-name-full" data-spell-field="name" placeholder="Nome da magia" value="${esc(s.name)}"><div class="spell-fields-grid"><label>Círculo<input data-spell-field="circle" value="${esc(s.circle)}"></label><label>Execução<input data-spell-field="exec" value="${esc(s.exec)}"></label><label>Alcance<input data-spell-field="range" value="${esc(s.range)}"></label><label>Custo<input data-spell-field="cost" value="${esc(s.cost)}"></label><label>Componentes<input data-spell-field="components" value="${esc(s.components)}"></label></div><label>Descrição<textarea data-spell-field="description">${esc(s.description)}</textarea></label><label>Aprimoramentos<textarea data-spell-field="upgrades">${esc(s.upgrades)}</textarea></label><button class="remove-card danger-btn small" data-remove-spell="${i}" type="button">Remover</button></article>`).join('');
  }
  function renderAbilities(c) {
    const list = $('abilities-list'); if (!list || !c) return;
    list.innerHTML = c.abilities.map((a, i) => `<article class="mini-card ability-card ability-card-layout" data-index="${i}"><input class="ability-name-full" data-ability-field="name" placeholder="Nome da habilidade" value="${esc(a.name)}"><div class="ability-fields-grid"><label>Custo<input data-ability-field="costAmount" type="number" value="${esc(a.costAmount ?? 0)}"></label><label>Tipo<select data-ability-field="costResource"><option ${a.costResource === 'PE' ? 'selected' : ''}>PE</option><option ${a.costResource === 'PV' ? 'selected' : ''}>PV</option></select></label><label>Bônus<input data-ability-field="bonus" value="${esc(a.bonus)}"></label><label>Ação<input data-ability-field="action" value="${esc(a.action || 'Padrão')}"></label></div><label>Descrição<textarea data-ability-field="description">${esc(a.description)}</textarea></label><button class="danger-btn small" data-remove-ability="${i}" type="button">Remover</button></article>`).join('');
  }
  function renderTransformations(c) {
    const list = $('transformations-list'); if (!list || !c) return;
    list.innerHTML = c.transformations.map((f, i) => `<article class="mini-card transformation-card" data-index="${i}"><input data-form-field="name" placeholder="Nome" value="${esc(f.name)}"><input data-form-field="portrait" placeholder="Imagem/retrato" value="${esc(f.portrait)}"><textarea data-form-field="description" placeholder="Descrição">${esc(f.description)}</textarea><button class="danger-btn small" data-remove-form="${i}" type="button">Remover</button></article>`).join('');
  }
  function selectTab(tab) {
    selectedTab = tab || 'resumo';
    qa('.sheet-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === selectedTab));
    qa('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${selectedTab}`));
  }

  function mutateCurrent(fn) {
    const c = currentCharacter(); if (!c) return null;
    fn(c); c.updatedAt = Date.now(); return c;
  }
  function onDocumentInput(event) {
    if (rendering) return;
    const t = event.target;
    if (!t?.closest('#app-screen')) return;
    const c = currentCharacter(); if (!c) return;
    const simpleMap = {
      'char-name': ['name', 'text'], 'char-race': ['race', 'text'], 'char-class': ['className', 'text'], 'char-origin': ['origin', 'text'],
      'char-level': ['level', 'num'], 'prof-bonus': ['profBonus', 'num'], 'char-xp': ['xp', 'num'], 'char-speed': ['speed', 'text'],
      'pv-current': ['pvCurrent', 'num'], 'pv-max': ['pvMax', 'num'], 'pe-current': ['peCurrent', 'num'], 'pe-max': ['peMax', 'num'],
      'defense': ['defense', 'num'], 'dodge': ['dodge', 'num'], 'money': ['money', 'text'], 'weight-max': ['weightMax', 'num'],
      'caster-class': ['casterClass', 'text'], 'caster-identity': ['casterIdentity', 'text'], 'affinity-primary': ['affinityPrimary', 'text'],
      'affinity-secondary': ['affinitySecondary', 'text'], 'key-attribute': ['keyAttribute', 'text'], 'power-bonus': ['powerBonus', 'num'],
      'spell-dc': ['spellDc', 'num'], 'power-limit': ['powerLimit', 'num']
    };
    if (simpleMap[t.id]) {
      const [key, type] = simpleMap[t.id];
      c[key] = type === 'num' ? toNumber(t.value, 0) : t.value;
      if (t.id === 'char-name') renderCharacterList();
      if (['pv-current', 'pv-max', 'pe-current', 'pe-max'].includes(t.id)) updateBars(c);
      if (t.id === 'weight-max') renderInventory(c);
      scheduleSave(); return;
    }
    if (t.dataset.attr) { c.attributes[t.dataset.attr] = toNumber(t.value); renderSkills(c); scheduleSave(); return; }
    if (t.dataset.resistance) { c.resistances[t.dataset.resistance] = toNumber(t.value); scheduleSave(); return; }
    if (t.dataset.skillBonus) { c.skills[t.dataset.skillBonus].bonus = toNumber(t.value); renderSkills(c); scheduleSave(); return; }
    updateNestedFromInput(t, c);
  }
  function onDocumentChange(event) {
    const t = event.target; const c = currentCharacter(); if (!c) return;
    if (t.dataset.skillTrained) { c.skills[t.dataset.skillTrained].trained = t.checked; renderSkills(c); scheduleSave(); }
  }
  function updateNestedFromInput(t, c) {
    const maps = [
      ['attack', 'attacks'], ['item', 'inventoryItems'], ['spell', 'spells'], ['ability', 'abilities'], ['form', 'transformations']
    ];
    for (const [prefix, arrayName] of maps) {
      const field = t.dataset[`${prefix}Field`];
      if (!field) continue;
      const card = t.closest('[data-index]'); const idx = Number(card?.dataset.index);
      if (!Number.isInteger(idx) || !c[arrayName]?.[idx]) return;
      c[arrayName][idx][field] = t.type === 'number' ? toNumber(t.value) : t.value;
      if (arrayName === 'inventoryItems') renderInventory(c);
      scheduleSave(); return;
    }
  }
  function onDocumentClick(event) {
    const t = event.target;
    const tab = t.closest('.sheet-tab'); if (tab) { selectTab(tab.dataset.tab); return; }
    const open = t.closest('[data-open-character]'); if (open) return openCharacter(open.dataset.openCharacter, { account: true });
    const dup = t.closest('[data-duplicate-character]'); if (dup) return duplicateCharacter(dup.dataset.duplicateCharacter);
    const del = t.closest('[data-delete-character]'); if (del) return deleteCharacter(del.dataset.deleteCharacter);
    const enter = t.closest('[data-enter-table]'); if (enter) return enterTable(enter.dataset.enterTable);
    const choose = t.closest('[data-choose-table-character]'); if (choose) return chooseTableCharacter(choose.dataset.chooseTableCharacter);
    const leave = t.closest('[data-leave-table]'); if (leave) return leaveTable(leave.dataset.leaveTable);
    const delTable = t.closest('[data-delete-table]'); if (delTable) return deleteTable(delTable.dataset.deleteTable);
    const copy = t.closest('[data-copy-code]'); if (copy) { navigator.clipboard?.writeText(copy.dataset.copyCode); toast('Código copiado.'); return; }
    const removeMap = [
      ['removeAttack', 'attacks', renderAttacks], ['removeItem', 'inventoryItems', renderInventory], ['removeSpell', 'spells', renderSpells], ['removeAbility', 'abilities', renderAbilities], ['removeForm', 'transformations', renderTransformations]
    ];
    for (const [dataKey, arr, render] of removeMap) {
      if (t.dataset[dataKey] != null) {
        mutateCurrent(c => c[arr].splice(Number(t.dataset[dataKey]), 1)); render(currentCharacter()); scheduleSave(); return;
      }
    }
    if (t.dataset.rollAttack != null) rollAttack(Number(t.dataset.rollAttack));
    const min = t.closest('[data-toggle-chat]'); if (min) { $(min.dataset.toggleChat)?.classList.toggle('collapsed'); }
  }

  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveCurrentCharacterNow(), 700); }
  async function saveCurrentCharacterNow(showErrors = true) {
    clearTimeout(saveTimer);
    const c = currentCharacter(); if (!c || !token || String(c.id).startsWith('char_')) return;
    createBackup(c);
    try {
      const data = await api(`/api/characters/${encodeURIComponent(c.id)}`, { method: 'PUT', body: JSON.stringify(toApiCharacter(c)) });
      const saved = normalizeCharacter(data.character);
      const idx = characters.findIndex(x => String(x.id) === String(saved.id));
      if (idx >= 0) characters[idx] = { ...characters[idx], ...saved };
      if (currentTableId) await refreshTableStateSoft();
    } catch (error) { if (showErrors) toast(`Erro ao salvar: ${error.message}`, 'error'); }
  }
  function createBackup(c) {
    try {
      const store = JSON.parse(localStorage.getItem(BACKUP_KEY) || '{}');
      const id = String(c.id);
      const list = Array.isArray(store[id]) ? store[id] : [];
      const signature = JSON.stringify({ ...c, updatedAt: undefined });
      if (list[0]?.signature !== signature) list.unshift({ at: Date.now(), signature, character: structuredCloneSafe(c) });
      store[id] = list.slice(0, 5);
      localStorage.setItem(BACKUP_KEY, JSON.stringify(store));
    } catch {}
  }
  async function refreshTableStateSoft() {
    if (!currentTableId) return;
    try { tableState = await api(`/api/tables/${encodeURIComponent(currentTableId)}/state`); renderCharacterList(); renderDashboards(); } catch {}
  }

  async function changePortrait() {
    const url = prompt('Cole o link da imagem do retrato ou deixe vazio para remover:', currentCharacter()?.portrait || '');
    if (url == null) return;
    mutateCurrent(c => c.portrait = url.trim());
    renderCharacter(currentCharacter()); scheduleSave();
  }
  function rollDice() {
    const sides = toNumber($('dice-type')?.value, 20); const qty = Math.max(1, toNumber($('dice-qty')?.value, 1)); const mod = toNumber($('dice-mod')?.value, 0);
    const rolls = Array.from({ length: qty }, () => 1 + Math.floor(Math.random() * sides));
    const total = rolls.reduce((a, b) => a + b, 0) + mod;
    const text = `${qty}d${sides}${mod ? (mod > 0 ? '+' : '') + mod : ''}: [${rolls.join(', ')}] = ${total}`;
    $('last-roll') && ($('last-roll').textContent = text);
    addRollMessage(text);
  }
  function rollAttack(index) {
    const c = currentCharacter(); const a = c?.attacks?.[index]; if (!a) return;
    const roll = 1 + Math.floor(Math.random() * 20); const total = roll + toNumber(a.bonus, 0);
    const text = `${a.name || 'Ataque'}: d20(${roll}) + ${toNumber(a.bonus, 0)} = ${total}${a.damage ? ` | Dano: ${a.damage}` : ''}`;
    $('last-roll') && ($('last-roll').textContent = text); addRollMessage(text);
  }
  function addRollMessage(text) {
    const box = $('roll-chat-log'); if (box) { box.insertAdjacentHTML('beforeend', `<div class="chat-message"><strong>Rolagem</strong><span>${esc(text)}</span></div>`); box.scrollTop = box.scrollHeight; }
    if (currentTableId) api(`/api/tables/${encodeURIComponent(currentTableId)}/messages`, { method: 'POST', body: JSON.stringify({ channel: 'rolls', message: text, characterId: currentCharacterId }) }).catch(() => {});
  }
  async function loadMessages() {
    if (!currentTableId) { $('chat-log') && ($('chat-log').innerHTML = ''); $('roll-chat-log') && ($('roll-chat-log').innerHTML = ''); return; }
    try {
      const data = await api(`/api/tables/${encodeURIComponent(currentTableId)}/messages`);
      renderMessages(data.messages || []);
    } catch {}
  }
  function renderMessages(messages) {
    const conv = $('chat-log'), rolls = $('roll-chat-log'); if (conv) conv.innerHTML = ''; if (rolls) rolls.innerHTML = '';
    messages.forEach(m => {
      const html = `<div class="chat-message"><strong>${esc(m.character_name || m.real_name || m.nick || 'Sistema')}</strong><span>${esc(m.message)}</span></div>`;
      (m.channel === 'rolls' ? rolls : conv)?.insertAdjacentHTML('beforeend', html);
    });
    if (conv) conv.scrollTop = conv.scrollHeight; if (rolls) rolls.scrollTop = rolls.scrollHeight;
  }
  async function sendChat(event) {
    event.preventDefault();
    const input = $('chat-input'); const message = input?.value?.trim(); if (!message || !currentTableId) return;
    input.value = '';
    try { await api(`/api/tables/${encodeURIComponent(currentTableId)}/messages`, { method: 'POST', body: JSON.stringify({ channel: 'conversation', message, characterId: currentCharacterId }) }); await loadMessages(); } catch (error) { toast(error.message, 'error'); }
  }

  function openAccountSettings() {
    if (!currentUser) return;
    setValue('account-settings-real-name', currentUser.realName);
    setValue('account-settings-nick', currentUser.nick);
    setValue('account-settings-password', ''); setValue('account-settings-password-confirm', '');
    const img = $('account-settings-avatar-preview'); if (img) img.src = currentUser.avatarUrl || 'assets/logo.jpg';
    $('account-settings-modal')?.showModal();
  }
  function previewAccountAvatar() {
    const file = $('account-settings-avatar-file')?.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { $('account-settings-avatar-preview').src = String(reader.result || ''); }; reader.readAsDataURL(file);
  }
  async function saveAccountSettings() {
    const password = $('account-settings-password')?.value || ''; const confirm = $('account-settings-password-confirm')?.value || '';
    if (password && password !== confirm) return toast('As senhas não conferem.', 'error');
    try {
      const data = await api('/api/auth/me', { method: 'PUT', body: JSON.stringify({ nick: $('account-settings-nick')?.value, realName: $('account-settings-real-name')?.value, password, avatarUrl: $('account-settings-avatar-preview')?.src || '' }) });
      currentUser = normalizeUser(data.user); setSession({ token, user: currentUser }); renderSessions(); $('account-settings-modal')?.close();
    } catch (error) { toast(error.message, 'error'); }
  }
  function toggleTheme() { const cur = getSettings().theme || 'dark'; setSettings({ theme: cur === 'dark' ? 'light' : 'dark' }); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
