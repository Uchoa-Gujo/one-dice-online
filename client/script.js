/* =========================
   V139 - Guardas globais antes das camadas antigas
   - Polyfills para evitar quebra em navegadores/embeds sem CSS.escape ou structuredClone.
   - Versão do cliente atualizada para diagnóstico.
========================= */
(function od139EarlyGuards(){
  'use strict';
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';
  if (!window.CSS) window.CSS = {};
  if (typeof window.CSS.escape !== 'function') {
    window.CSS.escape = function(value) {
      return String(value == null ? '' : value).replace(/[^a-zA-Z0-9_-]/g, function(ch) {
        const hex = ch.codePointAt(0).toString(16).toUpperCase();
        return '\\' + hex + ' ';
      });
    };
  }
  if (typeof window.structuredClone !== 'function') {
    window.structuredClone = function(value) { return JSON.parse(JSON.stringify(value)); };
  }
})();


/* =========================
   V134 - Captura limpa do botão de retrato
   Este bloco fica antes dos listeners antigos para impedir que modais legados abram.
========================= */
(function od134EarlyPortraitCapture(){
  'use strict';
  function isPortraitTarget(target){
    return !!(target && target.closest && target.closest('#portrait-button,#od99-portrait-button,#od100-portrait-button,#od101-portrait-button,#od102-portrait-button,#od104-portrait-button,#od130-portrait-button,#od131-portrait-button,#od132-portrait-button,#od133-portrait-button,#od134-portrait-button,.portrait-button,.portrait-wrap,#char-portrait-preview'));
  }
  document.addEventListener('click', function(event){
    if (!isPortraitTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const open = () => {
      if (typeof window.od134OpenPhotoModal === 'function') window.od134OpenPhotoModal();
      else setTimeout(open, 25);
    };
    open();
  }, true);
})();

const STORAGE = {
  users: "od_users",
  session: "od_session",
  characters: "od_characters",
  chat: "od_chat",
  settings: "od_settings",
  campaigns: "od_campaigns",
  campaignMembers: "od_campaign_members",
  activeCampaign: "od_active_campaign"
};

const ATTRIBUTE_KEYS = [
  ["forca", "Força"],
  ["agilidade", "Agilidade"],
  ["vigor", "Vigor"],
  ["intelecto", "Intelecto"],
  ["presenca", "Presença"]
];

const SKILLS = [
  ["Acrobacia", "agilidade"], ["Adestramento", "presenca"], ["Artes", "presenca"],
  ["Atletismo", "forca"], ["Construção", "intelecto"], ["Culinária", "intelecto"],
  ["Crime", "agilidade"], ["Diplomacia", "presenca"], ["Enganação", "presenca"],
  ["Fortitude", "vigor"], ["Furtividade", "agilidade"], ["História", "intelecto"],
  ["Iniciativa", "agilidade"], ["Intimidação", "presenca"], ["Intuição", "presenca"],
  ["Investigação", "intelecto"], ["Luta", "forca"], ["Medicina", "intelecto"],
  ["Misticismo", "intelecto"], ["Navegação", "intelecto"], ["Percepção", "presenca"],
  ["Pilotagem", "agilidade"], ["Pontaria", "agilidade"], ["Reflexo", "agilidade"],
  ["Sobrevivência", "intelecto"], ["Tecnologia", "intelecto"], ["Ofício", "intelecto"],
  ["Poder", "presenca"], ["Imunidade", "vigor"], ["Vontade", "presenca"]
];

const RESISTANCES = ["Impacto", "Cortante", "Perfurante", "Elemental", "Psíquico", "Químico", "Balístico", "Poder"];

let currentUser = null;
let currentCharacterId = null;
let saveTimer = null;
let currentCampaignId = null;
let pendingChooseCampaignId = null;
let accountSheetMode = false;

function get(key, fallback) { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
function set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getSessionValue() {
  const raw = sessionStorage.getItem(STORAGE.session) || localStorage.getItem(STORAGE.session) || "null";
  try { return JSON.parse(raw); } catch (_) { return null; }
}
function setSessionValue(userId) {
  const remember = document.getElementById("remember-login")?.checked !== false;
  const value = JSON.stringify(userId);
  if (remember) {
    localStorage.setItem(STORAGE.session, value);
    sessionStorage.removeItem(STORAGE.session);
  } else {
    sessionStorage.setItem(STORAGE.session, value);
    localStorage.removeItem(STORAGE.session);
  }
}
function clearSessionValue() {
  localStorage.removeItem(STORAGE.session);
  sessionStorage.removeItem(STORAGE.session);
  localStorage.removeItem(STORAGE.activeCampaign);
}
function uid(prefix = "id") { return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`; }
function normalizeNick(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, ""); }
function validSixDigitPassword(value) { return /^\d{6}$/.test(String(value || "")); }
function userDisplayName(user) { return user?.realName || user?.name || user?.nick || "Usuário"; }

function seed() {
  let users = get(STORAGE.users, []);
  users = users.map(u => {
    const nick = normalizeNick(u.nick || (u.email ? String(u.email).split("@")[0] : u.name));
    return {
      ...u,
      nick,
      realName: u.realName || u.name || u.nick || "Usuário",
      name: u.realName || u.name || u.nick || "Usuário",
      password: nick === "mestre" ? "123456" : u.password
    };
  });
  if (!users.some(u => u.nick === "mestre")) {
    users.push({ id: uid("user"), nick: "mestre", realName: "Mestre Demo", name: "Mestre Demo", password: "123456" });
  }
  set(STORAGE.users, users);
  if (get(STORAGE.characters, []).length === 0) {
    const owner = users.find(u => u.nick === "mestre")?.id || "demo";
    set(STORAGE.characters, [createCharacter(owner, "Aventureiro de Teste")]);
  }
}

function createCharacter(ownerId, name = "Novo Personagem") {
  const skills = {};
  SKILLS.forEach(([skill]) => skills[skill] = { trained: false, bonus: 0, disadvantage: false });
  const resistances = {};
  RESISTANCES.forEach(r => resistances[r] = 0);
  return {
    id: uid("char"), ownerId, name, race: "Humano", className: "Guerreiro", origin: "Camponês",
    level: 1, xp: 0, speed: "9 m", portrait: "", profBonus: 2,
    pvCurrent: 20, pvMax: 20, peCurrent: 6, peMax: 6,
    defense: 10, dodge: 10,
    attrs: { forca: 10, agilidade: 10, vigor: 10, intelecto: 10, presenca: 10 },
    skills, resistances,
    money: "0", weightCurrent: 0, weightMax: 10,
    equipmentNotes: "", abilitiesNotes: "", inventoryItems: [],
    abilities: [], abilityDescriptionsHidden: false,
    blockInventoryMode: false,
    blockInventory: [],
    equipmentProficiencies: {
      weapons: { simple: false, tacticalMelee: false, tacticalRanged: false, heavy: false },
      protections: { light: false, medium: false, heavy: false, shield: false }
    },
    attacks: [],
    caster: { className: "", identity: "", primary: "", secondary: "", key: "", bonus: 0, dc: 10, limit: 0 },
    spells: []
  };
}

function attrMod(value) {
  return Math.floor((Number(value) - 10) / 2);
}
function formatMod(n) { return n >= 0 ? `+${n}` : `${n}`; }
function isOverweight(char = currentChar()) {
  if (!char) return false;
  const current = Number(String(char.weightCurrent ?? 0).replace(",", ".")) || 0;
  const max = Number(String(char.weightMax ?? 0).replace(",", ".")) || 0;
  return max > 0 && current >= max + 1;
}
function agilityOverweightPenalty(char, attrKey) {
  return isOverweight(char) && attrKey === "agilidade" ? -5 : 0;
}
function effectiveDefense(char = currentChar()) {
  return Number(char?.defense || 0) + (isOverweight(char) ? -5 : 0);
}
function calculatedDodge(char = currentChar()) {
  if (!char) return 0;
  return effectiveDefense(char) + skillTotal(char, "Reflexo", "agilidade");
}
function syncDodgeField(char = currentChar()) {
  const field = byId("dodge");
  if (field && char) field.value = calculatedDodge(char);
}
function skillTotal(char, skillName, attrKey) {
  const skill = char.skills?.[skillName] || { trained: false, bonus: 0 };
  return attrMod(char.attrs?.[attrKey] ?? 1)
    + Number(skill.bonus || 0)
    + (skill.trained ? Number(char.profBonus || 0) : 0)
    + agilityOverweightPenalty(char, attrKey);
}
function applySettings() {
  const st = get(STORAGE.settings, { theme: "light", accent: "black", skillsCompact: true, font: "impact" });
  document.body.dataset.accent = st.accent || "black";
  document.body.dataset.font = st.font || "impact";
  document.body.classList.toggle("dark-sheet", st.theme === "dark");
  const themeBtn = byId("theme-toggle");
  const accent = byId("accent-select");
  const font = byId("font-select");
  if (themeBtn) themeBtn.textContent = st.theme === "dark" ? "Tema Claro" : "Tema Escuro";
  if (accent) accent.value = st.accent || "black";
  if (font) font.value = st.font || "impact";
  const wrap = byId("skills-wrap");
  if (wrap) wrap.classList.toggle("compact", !!st.skillsCompact);
  const skillsToggle = byId("compact-skills-toggle");
  if (skillsToggle) skillsToggle.textContent = st.skillsCompact ? "Mostrar Todas" : "Mostrar Treinadas";
  syncBlockInventoryFrame(st);
}

function syncBlockInventoryFrame(settings = get(STORAGE.settings, { theme: "light", accent: "black", skillsCompact: true, font: "impact" })) {
  const frame = byId("block-inventory-frame");
  if (!frame) return;
  try {
    frame.contentWindow?.postMessage({ type: "od-settings", settings }, "*");
    const doc = frame.contentDocument;
    if (doc?.body) {
      doc.body.dataset.accent = settings.accent || "black";
      doc.body.dataset.font = settings.font || "impact";
      doc.body.classList.toggle("dark-sheet", settings.theme === "dark");
    }
  } catch (_) {}
}
function updateSettings(mutator) {
  const st = get(STORAGE.settings, { theme: "light", accent: "black", skillsCompact: true, font: "impact" });
  mutator(st); set(STORAGE.settings, st); applySettings();
}
function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }
function roll(qty, sides, mod = 0) {
  const results = Array.from({ length: qty }, () => rollDie(sides));
  return { results, total: results.reduce((a, b) => a + b, 0) + Number(mod || 0) };
}

/* Função legada removida na limpeza v1.42: showAuth. A versão ativa fica nas camadas finais. */
/* Função legada removida na limpeza v1.42: showApp. A versão ativa fica nas camadas finais. */

/* Função legada removida na limpeza v1.42: login. A versão ativa fica nas camadas finais. */


function setupTopbarMenu() {
  const topbar = document.getElementById("main-topbar");
  const toggle = document.getElementById("topbar-menu-toggle");
  if (!topbar || !toggle || toggle.dataset.ready === "1") return;

  const syncLabel = () => {
    const closed = topbar.classList.contains("collapsed");
    toggle.textContent = closed ? "☰" : "×";
    toggle.title = closed ? "Abrir menu" : "Fechar menu";
    toggle.setAttribute("aria-expanded", String(!closed));
  };

  toggle.dataset.ready = "1";
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    topbar.classList.toggle("collapsed");
    syncLabel();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      topbar.classList.add("collapsed");
      syncLabel();
    }
  });

  document.addEventListener("click", (event) => {
    if (!topbar.contains(event.target)) {
      topbar.classList.add("collapsed");
      syncLabel();
    }
  });

  syncLabel();
}

/* Função legada removida na limpeza v1.42: initApp. A versão ativa fica nas camadas finais. */

/* Função legada removida na limpeza v1.42: renderCharacterList. A versão ativa fica nas camadas finais. */

function legacyInventoryFromNotes(notes = "") {
  if (!String(notes || "").trim()) return [];
  return String(notes).split("\n").filter(Boolean).map(line => ({ id: uid("inv"), name: line.trim(), weight: 0, desc: "" }));
}

function formatNumberBr(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(".", ",");
}

function normalizeWeight(value) {
  const number = Number(String(value ?? 0.5).replace(",", "."));
  if (!Number.isFinite(number) || number < 0.5) return 0.5;
  if (number < 1) return 0.5;
  return Math.round(number);
}

function stepWeight(value, direction) {
  const current = normalizeWeight(value);
  if (direction > 0) return current < 1 ? 1 : current + 1;
  return current <= 1 ? 0.5 : current - 1;
}

function updateInventoryWeightTotal() {
  const items = readSimpleInventoryFromDOM();
  const total = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const field = byId("weight-current");
  if (field) field.value = Number.isInteger(total) ? String(total) : total.toFixed(1).replace(".", ",");
  const char = currentChar();
  if (char) {
    updateDerivedStatsDisplay({
      ...char,
      weightCurrent: total,
      weightMax: Number(byId("weight-max")?.value || char.weightMax || 0),
      defense: Number(byId("defense")?.value || char.defense || 0)
    });
  }
  return total;
}

function renderSimpleInventory(char) {
  const list = byId("simple-inventory-list");
  if (!list) return;
  const items = Array.isArray(char.inventoryItems) ? char.inventoryItems : [];
  list.classList.toggle("compact", !!char.simpleInventoryCompact);
  const toggle = byId("simple-inventory-compact-toggle");
  if (toggle) toggle.textContent = char.simpleInventoryCompact ? "Versão Completa" : "Reduzir Cards";
  list.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "simple-inventory-empty";
    empty.textContent = "Nenhum item adicionado.";
    list.appendChild(empty);
    updateInventoryWeightTotal();
    return;
  }
  items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "simple-inventory-card";
    card.dataset.inventoryIndex = String(index);
    card.dataset.itemId = item.id || uid("inv");
    card.innerHTML = `
      <div class="simple-inventory-name-row">
        <input class="simple-inventory-name" data-inv-field="name" value="${escapeHtml(item.name || "Item")}" placeholder="Nome do item" />
      </div>
      <div class="simple-inventory-card-top">
        <label class="simple-inventory-stepper simple-inventory-weight">Peso
          <div class="stepper-control">
            <button class="stepper-btn" data-step-field="weight" data-step-dir="-1" type="button">−</button>
            <input data-inv-field="weight" type="text" value="${formatNumberBr(normalizeWeight(item.weight || 0.5))}" readonly />
            <button class="stepper-btn" data-step-field="weight" data-step-dir="1" type="button">+</button>
          </div>
        </label>
        <label class="simple-inventory-stepper simple-inventory-uses">Usos
          <div class="stepper-control">
            <button class="stepper-btn" data-step-field="uses" data-step-dir="-1" type="button">−</button>
            <input data-inv-field="uses" type="number" min="0" step="1" value="${Number(item.uses || 0)}" placeholder="0" />
            <button class="stepper-btn" data-step-field="uses" data-step-dir="1" type="button">+</button>
          </div>
        </label>
        <button class="mini-danger-btn" data-remove-simple-item="${index}" type="button">×</button>
      </div>
      <textarea class="simple-inventory-desc" data-inv-field="desc" rows="3" placeholder="Descrição">${escapeHtml(item.desc || "")}</textarea>
    `;
    list.appendChild(card);
  });
  updateInventoryWeightTotal();
}

function readSimpleInventoryFromDOM() {
  const list = byId("simple-inventory-list");
  if (!list) return [];
  return [...list.querySelectorAll(".simple-inventory-card")].map(card => ({
    id: card.dataset.itemId || uid("inv"),
    name: card.querySelector('[data-inv-field="name"]')?.value?.trim() || "Item",
    weight: normalizeWeight(card.querySelector('[data-inv-field="weight"]')?.value || 0.5),
    uses: Math.max(0, Number(card.querySelector('[data-inv-field="uses"]')?.value || 0)),
    desc: card.querySelector('[data-inv-field="desc"]')?.value?.trim() || ""
  }));
}

function addSimpleInventoryItem() {
  saveCurrentCharacter();
  updateChar(char => {
    char.inventoryItems = Array.isArray(char.inventoryItems) ? char.inventoryItems : [];
    char.inventoryItems.push({ id: uid("inv"), name: "Novo item", weight: 0.5, uses: 0, desc: "" });
  });
  renderSimpleInventory(currentChar());
  saveCurrentCharacter();
}

/* Função legada removida na limpeza v1.42: escapeHtml. A versão ativa fica nas camadas finais. */

function currentChar() { return get(STORAGE.characters, []).find(c => c.id === currentCharacterId); }
/* Função legada removida na limpeza v1.42: updateChar. A versão ativa fica nas camadas finais. */

function loadCharacter(id) {
  const char = get(STORAGE.characters, []).find(c => c.id === id);
  if (!char) return;
  currentCharacterId = id;
  byId("char-name").value = char.name;
  byId("char-race").value = char.race;
  byId("char-class").value = char.className;
  byId("char-origin").value = char.origin;
  byId("char-level").value = char.level;
  byId("prof-bonus").value = char.profBonus ?? 2;
  byId("char-xp").value = char.xp;
  byId("char-speed").value = char.speed;
  byId("portrait-url").value = char.portrait;
  renderPortrait(char);
  byId("pv-current").value = char.pvCurrent;
  byId("pv-max").value = char.pvMax;
  byId("pe-current").value = char.peCurrent;
  byId("pe-max").value = char.peMax;
  byId("defense").value = char.defense;
  byId("dodge").value = Number.isFinite(Number(char.dodge)) ? Number(char.dodge) : 10;
  byId("money").value = char.money;
  byId("weight-current").value = char.weightCurrent;
  byId("weight-max").value = char.weightMax;
  char.inventoryItems = Array.isArray(char.inventoryItems) ? char.inventoryItems : legacyInventoryFromNotes(char.equipmentNotes);
  renderSimpleInventory(char);
  applyInventoryMode(char);
  renderBlockInventory(char);
  renderAttributes(char);
  renderResistances(char);
  renderSkills(char);
  renderAttacks(char);
  renderCaster(char);
  renderSpells(char);
  renderAbilities(char);
  updateBars(char);
  updateOverlay(char);
  updateDerivedStatsDisplay(char);
}

function byId(id) { return document.getElementById(id); }
function renderPortrait(char) { byId("char-portrait-preview").src = char.portrait || "assets/logo.jpg"; }
function updateBars(char) {
  byId("pv-bar").style.width = `${Math.max(0, Math.min(100, (char.pvCurrent / Math.max(1, char.pvMax)) * 100))}%`;
  byId("pe-bar").style.width = `${Math.max(0, Math.min(100, (char.peCurrent / Math.max(1, char.peMax)) * 100))}%`;
}
function updateOverlay(char) {
  byId("overlay-portrait").src = char.portrait || "assets/logo.jpg";
  byId("overlay-name").textContent = char.name;
  byId("overlay-pv").style.width = `${Math.max(0, Math.min(100, (char.pvCurrent / Math.max(1, char.pvMax)) * 100))}%`;
  byId("overlay-pe").style.width = `${Math.max(0, Math.min(100, (char.peCurrent / Math.max(1, char.peMax)) * 100))}%`;
  byId("overlay-pv-text").textContent = `${char.pvCurrent}/${char.pvMax}`;
  byId("overlay-pe-text").textContent = `${char.peCurrent}/${char.peMax}`;
}

function updateDerivedStatsDisplay(char = currentChar()) {
  if (!char) return;
  const overweight = isOverweight(char);
  document.body.classList.toggle("is-overweight", overweight);

  const defenseNote = byId("defense-effective-note");
  if (defenseNote) {
    defenseNote.textContent = overweight
      ? `Efetiva: ${effectiveDefense(char)} · Sobrepeso -5`
      : `Efetiva: ${Number(char.defense || 0)}`;
    defenseNote.classList.toggle("danger", overweight);
  }

  syncDodgeField(char);
  const dodgeNote = byId("dodge-formula-note");
  if (dodgeNote) {
    const reflex = skillTotal(char, "Reflexo", "agilidade");
    dodgeNote.textContent = `Defesa ${effectiveDefense(char)} + Reflexo ${formatMod(reflex)}`;
    dodgeNote.classList.toggle("danger", overweight);
  }

  const weightStatus = byId("weight-status");
  if (weightStatus) {
    const current = Number(char.weightCurrent || 0);
    const max = Number(char.weightMax || 0);
    weightStatus.textContent = overweight
      ? `Sobrepeso: Defesa -5 e perícias de Agilidade -5. Peso ${formatNumberBr(current)} / ${formatNumberBr(max)}.`
      : `Peso dentro do limite. Peso ${formatNumberBr(current)} / ${formatNumberBr(max)}.`;
    weightStatus.classList.toggle("danger", overweight);
  }
}

function renderAttributes(char) {
  const grid = byId("attributes-grid");
  grid.innerHTML = "";
  ATTRIBUTE_KEYS.forEach(([key, label]) => {
    const valor = Number(char.attrs?.[key] ?? 1);
    const card = document.createElement("div");
    card.className = "attr-card-v2";
    card.innerHTML = `
      <div>
        <div class="attr-name">${label}</div>
        <div class="attr-mod">${formatMod(attrMod(valor))}</div>
        <div class="attr-help">valor ${valor} • fórmula D&D</div>
      </div>
      <input data-attr="${key}" type="number" value="${valor}" min="1">
      <button class="primary-btn small roll-attr" data-roll-attr="${key}">Rolar ${label}</button>`;
    grid.appendChild(card);
  });
}
function renderResistances(char) {
  const grid = byId("resistances-grid");
  grid.innerHTML = "";
  RESISTANCES.forEach(name => {
    const el = document.createElement("label");
    el.className = "res-card";
    el.innerHTML = `${name}<input data-resistance="${name}" type="number" value="${char.resistances?.[name] ?? 0}">`;
    grid.appendChild(el);
  });
}
function renderSkills(char) {
  const table = byId("skills-table");
  const settings = get(STORAGE.settings, { theme: "light", accent: "black", skillsCompact: true, font: "impact" });
  const onlyTrained = !!settings.skillsCompact;
  table.innerHTML = `<thead><tr>
    <th>Treinado</th>
    <th>Perícia</th>
    <th class="col-attr">Atributo</th>
    <th class="col-mod">Mod</th>
    <th class="col-bonus">Bônus</th>
    <th>Total</th>
    <th class="col-roll">Rolar</th>
  </tr></thead><tbody></tbody>`;
  const tbody = table.querySelector("tbody");
  const rows = SKILLS.filter(([skillName]) => {
    if (!onlyTrained) return true;
    return !!char.skills?.[skillName]?.trained;
  });

  if (onlyTrained && rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="empty-trained-skills">Nenhuma perícia treinada marcada.</td>`;
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(([skillName, attrKey]) => {
    char.skills = char.skills || {};
    const skill = char.skills[skillName] || { trained: false, bonus: 0 };
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input data-skill-trained="${skillName}" type="checkbox" ${skill.trained ? "checked" : ""}></td>
      <td>${skillName}</td>
      <td class="col-attr">${attrKey.slice(0,3).toUpperCase()}</td>
      <td class="col-mod">${formatMod(attrMod(char.attrs?.[attrKey] ?? 1))}${agilityOverweightPenalty(char, attrKey) ? ' <small class="skill-penalty">-5 sobrepeso</small>' : ''}</td>
      <td class="col-bonus"><input data-skill-bonus="${skillName}" type="number" value="${skill.bonus || 0}"></td>
      <td class="skill-total ${agilityOverweightPenalty(char, attrKey) ? 'penalized' : ''}">${formatMod(skillTotal(char, skillName, attrKey))}</td>
      <td class="col-roll"><button class="primary-btn small roll-skill" data-skill="${skillName}" data-skill-attr="${attrKey}">D20</button></td>`;
    tbody.appendChild(tr);
  });

  table.querySelectorAll("[data-skill-trained]").forEach(input => {
    input.addEventListener("change", () => {
      const name = input.dataset.skillTrained;
      updateChar(saved => {
        saved.skills = saved.skills || {};
        saved.skills[name] = saved.skills[name] || { trained: false, bonus: 0, disadvantage: false };
        saved.skills[name].trained = input.checked;
      });
      const updated = currentChar();
      if (updated) { renderSkills(updated); updateDerivedStatsDisplay(updated); }
    });
  });

  table.querySelectorAll("[data-skill-bonus]").forEach(input => {
    input.addEventListener("change", () => {
      const name = input.dataset.skillBonus;
      updateChar(saved => {
        saved.skills = saved.skills || {};
        saved.skills[name] = saved.skills[name] || { trained: false, bonus: 0, disadvantage: false };
        saved.skills[name].bonus = Number(input.value || 0);
      });
      const updated = currentChar();
      if (updated) { renderSkills(updated); updateDerivedStatsDisplay(updated); }
    });
  });
}
function renderAttacks(char) {
  const list = byId("attacks-list");
  list.innerHTML = "";
  (char.attacks || []).forEach((atk, index) => addAttackCard(atk, index));
}
function addAttackCard(atk = { name: "", bonus: 0, damage: "1d8", crit: "2d8", desc: "" }, index = null) {
  const node = byId("attack-template").content.cloneNode(true);
  const card = node.querySelector(".attack-card");
  card.dataset.index = index ?? byId("attacks-list").children.length;
  card.querySelector(".attack-name").value = atk.name || "";
  card.querySelector(".attack-bonus").value = atk.bonus || 0;
  card.querySelector(".attack-damage").value = atk.damage || "";
  card.querySelector(".attack-crit").value = atk.crit || "";
  card.querySelector(".attack-desc").value = atk.desc || "";
  byId("attacks-list").appendChild(node);
}
function renderCaster(char) {
  const c = char.caster || {};
  byId("caster-class").value = c.className || "";
  byId("caster-identity").value = c.identity || "";
  byId("affinity-primary").value = c.primary || "";
  byId("affinity-secondary").value = c.secondary || "";
  byId("key-attribute").value = c.key || "";
  byId("power-bonus").value = c.bonus || 0;
  byId("spell-dc").value = c.dc || 10;
  byId("power-limit").value = c.limit || 0;
}
function renderSpells(char) {
  const list = byId("spells-list");
  list.innerHTML = "";
  (char.spells || []).forEach((spell, index) => addSpellCard(spell, index));
}
function addSpellCard(spell = {}, index = null) {
  const node = byId("spell-template").content.cloneNode(true);
  const card = node.querySelector(".spell-card");
  card.dataset.index = index ?? byId("spells-list").children.length;
  card.querySelector(".spell-name").value = spell.name || "";
  card.querySelector(".spell-circle").value = spell.circle || "";
  card.querySelector(".spell-exec").value = spell.exec || "";
  card.querySelector(".spell-range").value = spell.range || "";
  card.querySelector(".spell-cost").value = spell.cost || spell.pe || "";
  card.querySelector(".spell-components").value = spell.components || "";
  card.querySelector(".spell-description").value = spell.description || spell.effect || "";
  card.querySelector(".spell-upgrades").value = spell.upgrades || "";
  byId("spells-list").appendChild(node);
}


function parseAbilityCostAmount(value) {
  const raw = String(value ?? "").replace(",", ".");
  const match = raw.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}
function parseAbilityCostResource(value, fallback = "PE") {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("PV")) return "PV";
  if (raw.includes("PE")) return "PE";
  return fallback || "PE";
}
function normalizeAbilityCost(ability = {}) {
  const legacyCost = ability.cost ?? "";
  return {
    amount: Number(ability.costAmount ?? ability.costValue ?? parseAbilityCostAmount(legacyCost) ?? 0) || 0,
    resource: parseAbilityCostResource(ability.costResource ?? ability.resource ?? legacyCost, "PE")
  };
}
function clampResourceValue(value, min = 0) {
  return Math.max(min, Math.floor(Number(value) || 0));
}

function renderAbilities(char) {
  const list = byId("abilities-list");
  if (!list) return;
  list.innerHTML = "";
  const legacyText = String(char.abilitiesNotes || "").trim();
  if ((!Array.isArray(char.abilities) || !char.abilities.length) && legacyText) {
    char.abilities = legacyText.split(/\n{2,}|\n/).filter(Boolean).map(text => ({
      name: text.slice(0, 48), costAmount: 0, costResource: "PE", bonus: "", action: "Padrão", description: text
    }));
  }
  (char.abilities || []).forEach((ability, index) => addAbilityCard(ability, index));
  list.classList.toggle("hide-descriptions", !!char.abilityDescriptionsHidden);
  const btn = byId("toggle-ability-desc");
  if (btn) btn.textContent = char.abilityDescriptionsHidden ? "Mostrar descrições" : "Ocultar descrições";
}

function addAbilityCard(ability = {}, index = null) {
  const template = byId("ability-template");
  const list = byId("abilities-list");
  if (!template || !list) return;
  const node = template.content.cloneNode(true);
  const card = node.querySelector(".ability-card");
  card.dataset.index = index ?? list.children.length;
  const cost = normalizeAbilityCost(ability);
  card.querySelector(".ability-name").value = ability.name || "";
  card.querySelector(".ability-cost-amount").value = cost.amount;
  card.querySelector(".ability-cost-resource").value = cost.resource;
  card.querySelector(".ability-bonus").value = ability.bonus || "";
  card.querySelector(".ability-action").value = ability.action || "Padrão";
  card.querySelector(".ability-description").value = ability.description || ability.desc || "";
  list.appendChild(node);
}


let selectedBlockItemId = null;

function gridClampItem(item) {
  item.w = Math.max(1, Math.min(8, Number(item.w || 1)));
  item.h = Math.max(1, Math.min(6, Number(item.h || 1)));
  item.x = Math.max(1, Math.min(9 - item.w, Number(item.x || 1)));
  item.y = Math.max(1, Math.min(7 - item.h, Number(item.y || 1)));
  return item;
}

function getBlockItems(char = currentChar()) {
  if (!char) return [];
  if (!Array.isArray(char.blockInventory)) char.blockInventory = [];
  return char.blockInventory;
}

function findFreeBlockPosition(items, w, h) {
  const occupied = new Set();
  items.forEach(raw => {
    const item = gridClampItem({ ...raw });
    for (let yy = item.y; yy < item.y + item.h; yy++) {
      for (let xx = item.x; xx < item.x + item.w; xx++) occupied.add(`${xx},${yy}`);
    }
  });
  for (let y = 1; y <= 7 - h; y++) {
    for (let x = 1; x <= 9 - w; x++) {
      let free = true;
      for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) if (occupied.has(`${xx},${yy}`)) free = false;
      }
      if (free) return { x, y };
    }
  }
  return { x: 1, y: 1 };
}

function applyInventoryMode(char = currentChar()) {
  const blockMode = !!char?.blockInventoryMode;
  byId("simple-inventory-panel")?.classList.toggle("active", !blockMode);
  byId("block-inventory-panel")?.classList.toggle("active", blockMode);
  byId("tab-equipamentos")?.classList.toggle("block-inventory-active", blockMode);
  document.body.classList.toggle("block-inventory-active", blockMode);
  const btn = byId("block-inventory-toggle");
  if (btn) btn.textContent = blockMode ? "Modo Texto" : "Modo Block Inventory";
}

function renderBlockInventory(char = currentChar()) {
  const grid = byId("block-grid");
  if (!grid || !char) return;
  const items = getBlockItems(char).map(item => gridClampItem(item));
  grid.innerHTML = `<div class="block-cell-guide"></div>`;
  items.forEach(item => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `block-item ${item.color || "green"} ${item.id === selectedBlockItemId ? "selected" : ""}`;
    el.dataset.blockItem = item.id;
    el.style.setProperty("--x", item.x);
    el.style.setProperty("--y", item.y);
    el.style.setProperty("--w", item.w);
    el.style.setProperty("--h", item.h);
    el.textContent = item.name || "Item";
    grid.appendChild(el);
  });
  syncBlockEditor(char);
}

function syncBlockEditor(char = currentChar()) {
  const fields = byId("block-editor-fields");
  const empty = byId("block-editor-empty");
  const item = getBlockItems(char).find(i => i.id === selectedBlockItemId);
  fields?.classList.toggle("active", !!item);
  empty?.classList.toggle("hidden-field", !!item);
  if (!item) return;
  byId("edit-block-name").value = item.name || "";
  byId("edit-block-x").value = item.x || 1;
  byId("edit-block-y").value = item.y || 1;
  byId("edit-block-width").value = item.w || 1;
  byId("edit-block-height").value = item.h || 1;
}

function updateBlockInventory(mutator) {
  if (!currentCharacterId) return;
  updateChar(char => {
    char.blockInventory = Array.isArray(char.blockInventory) ? char.blockInventory : [];
    mutator(char.blockInventory, char);
  });
  renderBlockInventory(currentChar());
  renderCharacterList();
}

function saveCurrentCharacter() {
  if (!currentCharacterId) return;
  updateChar(char => {
    char.name = byId("char-name").value;
    char.race = byId("char-race").value;
    char.className = byId("char-class").value;
    char.origin = byId("char-origin").value;
    char.level = Number(byId("char-level").value || 1);
    char.profBonus = Number(byId("prof-bonus").value || 0);
    char.xp = Number(byId("char-xp").value || 0);
    char.speed = byId("char-speed").value;
    char.portrait = byId("portrait-url").value;
    char.pvCurrent = Number(byId("pv-current").value || 0);
    char.pvMax = Number(byId("pv-max").value || 1);
    char.peCurrent = Number(byId("pe-current").value || 0);
    char.peMax = Number(byId("pe-max").value || 1);
    char.defense = Number(byId("defense").value || 0);
    char.money = byId("money").value;
    char.inventoryItems = readSimpleInventoryFromDOM();
    char.weightCurrent = char.inventoryItems.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
    char.weightMax = Number(byId("weight-max").value || 0);
    char.equipmentNotes = char.inventoryItems.map(item => `${item.name || "Item"} | Peso: ${item.weight || 0} | Usos: ${item.uses || 0} | ${item.desc || ""}`).join("\n");
    char.abilitiesNotes = char.abilitiesNotes || "";
    char.blockInventoryMode = byId("block-inventory-panel")?.classList.contains("active") || false;
    char.attrs = char.attrs || {};
    char.resistances = char.resistances || {};
    document.querySelectorAll("input[data-attr]").forEach(i => char.attrs[i.dataset.attr] = Number(i.value || 1));
    document.querySelectorAll("[data-resistance]").forEach(i => char.resistances[i.dataset.resistance] = Number(i.value || 0));
    SKILLS.forEach(([skillName]) => {
      char.skills[skillName] = {
        trained: document.querySelector(`[data-skill-trained="${skillName}"]`)?.checked || false,
        bonus: Number(document.querySelector(`[data-skill-bonus="${skillName}"]`)?.value || 0),
        disadvantage: false
      };
    });
    char.dodge = calculatedDodge(char);
    syncDodgeField(char);
    char.attacks = [...document.querySelectorAll(".attack-card")].map(card => ({
      name: card.querySelector(".attack-name").value,
      bonus: Number(card.querySelector(".attack-bonus").value || 0),
      damage: card.querySelector(".attack-damage").value,
      crit: card.querySelector(".attack-crit").value,
      desc: card.querySelector(".attack-desc").value
    }));
    char.caster = {
      className: byId("caster-class").value, identity: byId("caster-identity").value,
      primary: byId("affinity-primary").value, secondary: byId("affinity-secondary").value,
      key: byId("key-attribute").value, bonus: Number(byId("power-bonus").value || 0),
      dc: Number(byId("spell-dc").value || 10), limit: Number(byId("power-limit").value || 0)
    };
    char.spells = [...document.querySelectorAll(".spell-card")].map(card => ({
      name: card.querySelector(".spell-name").value,
      circle: card.querySelector(".spell-circle").value,
      exec: card.querySelector(".spell-exec").value,
      range: card.querySelector(".spell-range").value,
      cost: card.querySelector(".spell-cost").value,
      components: card.querySelector(".spell-components").value,
      description: card.querySelector(".spell-description").value,
      upgrades: card.querySelector(".spell-upgrades").value
    }));
    char.abilities = [...document.querySelectorAll(".ability-card")].map(card => {
      const costAmount = Number(card.querySelector(".ability-cost-amount")?.value || 0);
      const costResource = card.querySelector(".ability-cost-resource")?.value || "PE";
      return {
        name: card.querySelector(".ability-name").value,
        costAmount,
        costResource,
        cost: costAmount > 0 ? `${costAmount} ${costResource}` : "",
        bonus: card.querySelector(".ability-bonus")?.value || "",
        action: card.querySelector(".ability-action").value,
        description: card.querySelector(".ability-description").value
      };
    });
    char.abilitiesNotes = char.abilities.map(item => `${item.name || "Habilidade"} | Custo: ${item.cost || "0 " + (item.costResource || "PE")} | Bônus: ${item.bonus || "-"} | Ação: ${item.action || "Padrão"} | ${item.description || ""}`).join("\n");
  });
  const char = currentChar();
  renderPortrait(char); updateBars(char); updateOverlay(char); updateDerivedStatsDisplay(char); renderCharacterList();
}
function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveCurrentCharacter, 250); }


function readAbilitiesFromDOM() {
  return [...document.querySelectorAll(".ability-card")].map(card => {
    const costAmount = Number(card.querySelector(".ability-cost-amount")?.value || 0);
    const costResource = card.querySelector(".ability-cost-resource")?.value || "PE";
    return {
      name: card.querySelector(".ability-name")?.value || "Habilidade",
      costAmount,
      costResource,
      cost: costAmount > 0 ? `${costAmount} ${costResource}` : "",
      bonus: card.querySelector(".ability-bonus")?.value || "",
      action: card.querySelector(".ability-action")?.value || "Padrão",
      description: card.querySelector(".ability-description")?.value || ""
    };
  });
}
function useAbilityCard(card) {
  const char = currentChar();
  if (!char || !card) return;
  const index = [...document.querySelectorAll(".ability-card")].indexOf(card);
  const ability = readAbilitiesFromDOM()[index] || {};
  const amount = clampResourceValue(ability.costAmount || 0, 0);
  const resource = ability.costResource === "PV" ? "PV" : "PE";
  if (amount <= 0) {
    addChat(`Usou ${ability.name || "Habilidade"} sem custo.`, "roll");
    return;
  }

  updateChar(saved => {
    const currentValue = resource === "PV" ? Number(saved.pvCurrent || 0) : Number(saved.peCurrent || 0);
    const nextValue = Math.max(0, currentValue - amount);
    if (resource === "PV") saved.pvCurrent = nextValue;
    else saved.peCurrent = nextValue;
    saved.abilities = readAbilitiesFromDOM();
    saved.abilitiesNotes = saved.abilities.map(item => `${item.name || "Habilidade"} | Custo: ${item.cost || "0 " + (item.costResource || "PE")} | Bônus: ${item.bonus || "-"} | Ação: ${item.action || "Padrão"} | ${item.description || ""}`).join("\n");
    addChat(`Usou ${ability.name || "Habilidade"}: -${amount} ${resource}.`, "roll");
  });

  const updated = currentChar();
  byId("pv-current").value = updated.pvCurrent;
  byId("pe-current").value = updated.peCurrent;
  updateBars(updated);
  updateOverlay(updated);
  renderCharacterList();
}

/* Função legada removida na limpeza v1.42: addChat. A versão ativa fica nas camadas finais. */
/* Função legada removida na limpeza v1.42: renderChat. A versão ativa fica nas camadas finais. */
function escapeHtml(str) { return String(str).replace(/[&<>"]/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s])); }
function doRoll(label, qty, sides, mod = 0) {
  const r = roll(qty, sides, mod);
  const text = `${label}: ${qty}D${sides}${Number(mod) ? formatMod(Number(mod)) : ""} → [${r.results.join(", ")}] = ${r.total}`;
  byId("last-roll").textContent = text;
  byId("last-roll").classList.remove("shake"); void byId("last-roll").offsetWidth; byId("last-roll").classList.add("shake");
  addChat(text, "roll");
}

function parseDamage(expr) {
  const match = String(expr).toLowerCase().replace(/\s/g, "").match(/(\d*)d(\d+)([+-]\d+)?/);
  if (!match) return null;
  return { qty: Number(match[1] || 1), sides: Number(match[2]), mod: Number(match[3] || 0) };
}

function events() {
  applySettings();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
    btn.classList.add("active");
    byId(`${btn.dataset.auth}-form`)?.classList.add("active");
  });
  byId("login-form").onsubmit = e => { e.preventDefault(); login(byId("login-nick").value, byId("login-password").value); };
  byId("register-form").onsubmit = e => {
    e.preventDefault();
    const users = get(STORAGE.users, []);
    const nick = normalizeNick(byId("register-nick").value);
    const realName = byId("register-real-name").value.trim();
    const password = byId("register-password").value.trim();
    const passwordConfirm = byId("register-password-confirm").value.trim();
    if (!nick) return alert("Digite um nick/login.");
    if (!realName) return alert("Digite seu nome real.");
    if (!validSixDigitPassword(password)) return alert("A senha precisa ter exatamente 6 dígitos numéricos.");
    if (password !== passwordConfirm) return alert("As senhas não conferem.");
    if (users.some(u => normalizeNick(u.nick || u.email || u.name) === nick)) return alert("Esse nick/login já existe.");
    const user = { id: uid("user"), nick, realName, name: realName, password };
    users.push(user);
    set(STORAGE.users, users);
    currentUser = user;
    setSessionValue(user.id);
    showSessions();
  };
  const logoutBtn = byId("logout-btn");
  if (logoutBtn) logoutBtn.onclick = () => { saveCurrentCharacter(); showSessions(); };
  const themeBtn = byId("theme-toggle");
  if (themeBtn) themeBtn.onclick = () => updateSettings(st => st.theme = st.theme === "dark" ? "light" : "dark");
  const accentSelect = byId("accent-select");
  if (accentSelect) accentSelect.onchange = e => updateSettings(st => st.accent = e.target.value);
  const fontSelect = byId("font-select");
  if (fontSelect) fontSelect.onchange = e => updateSettings(st => st.font = e.target.value);
  const compactSkillsToggle = byId("compact-skills-toggle");
  if (compactSkillsToggle) compactSkillsToggle.onclick = () => {
    updateSettings(st => st.skillsCompact = !st.skillsCompact);
    const char = currentChar();
    if (char) renderSkills(char);
  };
  const portraitButton = byId("portrait-button");
  if (portraitButton) portraitButton.onclick = null;
  const savePortraitUrlBtn = byId("save-portrait-url");
  if (savePortraitUrlBtn) savePortraitUrlBtn.onclick = () => {
    byId("portrait-url").value = byId("portrait-modal-url").value.trim();
    saveCurrentCharacter();
    byId("portrait-modal").close();
  };
  setupTopbarMenu();
  const newCharacterBtn = byId("new-character-btn");
  if (newCharacterBtn) newCharacterBtn.onclick = () => { saveCurrentCharacter(); const chars = get(STORAGE.characters, []); const char = createCharacter(currentUser.id); chars.push(char); set(STORAGE.characters, chars); currentCharacterId = char.id; initApp(); };
  const overlayBtn = byId("overlay-btn");
  if (overlayBtn) overlayBtn.onclick = () => { saveCurrentCharacter(); document.getElementById("app-screen")?.classList.remove("active"); document.getElementById("overlay-screen")?.classList.add("active"); updateOverlay(currentChar()); };
  const closeOverlayBtn = byId("close-overlay");
  if (closeOverlayBtn) closeOverlayBtn.onclick = showApp;
  document.addEventListener("input", e => { if (document.getElementById("app-screen")?.classList.contains("active")) queueSave(); });
  document.addEventListener("change", e => {
    if (!document.getElementById("app-screen")?.classList.contains("active")) return;
    saveCurrentCharacter();
    const char = currentChar();
    if (char) { renderAttributes(char); renderSkills(char); updateBars(char); updateOverlay(char); updateDerivedStatsDisplay(char); applySettings(); }
  });
  document.querySelectorAll(".sheet-tab").forEach(btn => btn.onclick = () => {
    document.querySelectorAll(".sheet-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active"); byId(`tab-${btn.dataset.tab}`)?.classList.add("active");
  });
  const addAttackBtn = byId("add-attack");
  if (addAttackBtn) addAttackBtn.onclick = () => { addAttackCard(); queueSave(); };
  const addSpellBtn = byId("add-spell");
  if (addSpellBtn) addSpellBtn.onclick = () => { addSpellCard(); queueSave(); };
  if (byId("add-ability")) byId("add-ability").onclick = () => { addAbilityCard(); queueSave(); };
  if (byId("toggle-ability-desc")) byId("toggle-ability-desc").onclick = () => {
    saveCurrentCharacter();
    updateChar(char => { char.abilityDescriptionsHidden = !char.abilityDescriptionsHidden; });
    renderAbilities(currentChar());
  };
  byId("add-simple-inventory-item")?.addEventListener("click", addSimpleInventoryItem);
  byId("simple-inventory-compact-toggle")?.addEventListener("click", () => {
    saveCurrentCharacter();
    updateChar(char => char.simpleInventoryCompact = !char.simpleInventoryCompact);
    renderSimpleInventory(currentChar());
  });
  byId("simple-inventory-list")?.addEventListener("input", () => { updateInventoryWeightTotal(); queueSave(); });
  byId("simple-inventory-list")?.addEventListener("change", () => { updateInventoryWeightTotal(); saveCurrentCharacter(); });
  byId("simple-inventory-list")?.addEventListener("click", (event) => {
    const stepBtn = event.target.closest("[data-step-field]");
    if (stepBtn) {
      const card = stepBtn.closest(".simple-inventory-card");
      const field = stepBtn.dataset.stepField;
      const dir = Number(stepBtn.dataset.stepDir || 0);
      const input = card?.querySelector(`[data-inv-field="${field}"]`);
      if (input && field === "weight") {
        input.value = formatNumberBr(stepWeight(input.value, dir));
      }
      if (input && field === "uses") {
        input.value = Math.max(0, Number(input.value || 0) + dir);
      }
      updateInventoryWeightTotal();
      saveCurrentCharacter();
      renderSkills(currentChar());
      return;
    }

    const btn = event.target.closest("[data-remove-simple-item]");
    if (!btn) return;
    const index = Number(btn.dataset.removeSimpleItem);
    saveCurrentCharacter();
    updateChar(char => {
      char.inventoryItems = Array.isArray(char.inventoryItems) ? char.inventoryItems : [];
      char.inventoryItems.splice(index, 1);
    });
    renderSimpleInventory(currentChar());
    saveCurrentCharacter();
  });
  const blockInventoryToggle = byId("block-inventory-toggle");
  if (blockInventoryToggle) blockInventoryToggle.onclick = () => {
    saveCurrentCharacter();
    updateChar(char => char.blockInventoryMode = !char.blockInventoryMode);
    applyInventoryMode(currentChar());
    renderBlockInventory(currentChar());
  };
  const addBlockItemBtn = byId("add-block-item");
  if (addBlockItemBtn) addBlockItemBtn.onclick = () => {
    const name = byId("block-item-name").value.trim() || "Novo Item";
    const w = Math.max(1, Math.min(6, Number(byId("block-item-width").value || 1)));
    const h = Math.max(1, Math.min(6, Number(byId("block-item-height").value || 1)));
    const color = byId("block-item-color").value || "green";
    updateBlockInventory(items => {
      const pos = findFreeBlockPosition(items, w, h);
      const item = gridClampItem({ id: uid("block"), name, w, h, x: pos.x, y: pos.y, color });
      items.push(item);
      selectedBlockItemId = item.id;
    });
    byId("block-item-name").value = "";
  };
  const clearBlockItemsBtn = byId("clear-block-items");
  if (clearBlockItemsBtn) clearBlockItemsBtn.onclick = () => {
    if (!confirm("Limpar todos os blocos do inventário?")) return;
    selectedBlockItemId = null;
    updateBlockInventory(items => items.splice(0, items.length));
  };
  const saveBlockEditBtn = byId("save-block-edit");
  if (saveBlockEditBtn) saveBlockEditBtn.onclick = () => {
    updateBlockInventory(items => {
      const item = items.find(i => i.id === selectedBlockItemId);
      if (!item) return;
      item.name = byId("edit-block-name").value.trim() || "Item";
      item.x = Number(byId("edit-block-x").value || 1);
      item.y = Number(byId("edit-block-y").value || 1);
      item.w = Number(byId("edit-block-width").value || 1);
      item.h = Number(byId("edit-block-height").value || 1);
      gridClampItem(item);
    });
  };
  const deleteBlockItemBtn = byId("delete-block-item");
  if (deleteBlockItemBtn) deleteBlockItemBtn.onclick = () => {
    updateBlockInventory(items => {
      const index = items.findIndex(i => i.id === selectedBlockItemId);
      if (index >= 0) items.splice(index, 1);
      selectedBlockItemId = null;
    });
  };
  document.addEventListener("click", e => {
    if (e.target.dataset.blockItem) {
      selectedBlockItemId = e.target.dataset.blockItem;
      renderBlockInventory(currentChar());
      return;
    }
    if (e.target.dataset.deleteChar) {
      const id = e.target.dataset.deleteChar;
      const chars = get(STORAGE.characters, []);
      const char = chars.find(c => c.id === id);
      if (chars.length <= 1) return alert("Você precisa manter pelo menos uma ficha na mesa.");
      if (!confirm(`Apagar a ficha ${char?.name || "selecionada"}?`)) return;
      const next = chars.filter(c => c.id !== id);
      set(STORAGE.characters, next);
      if (currentCharacterId === id) currentCharacterId = next[0]?.id;
      loadCharacter(currentCharacterId); renderCharacterList();
      return;
    }
    const abilityStepBtn = e.target.closest(".ability-cost-minus, .ability-cost-plus");
    if (abilityStepBtn) {
      const card = abilityStepBtn.closest(".ability-card");
      const input = card?.querySelector(".ability-cost-amount");
      const dir = abilityStepBtn.classList.contains("ability-cost-plus") ? 1 : -1;
      if (input) input.value = clampResourceValue(Number(input.value || 0) + dir, 0);
      queueSave();
      return;
    }
    if (e.target.classList.contains("use-ability")) {
      saveCurrentCharacter();
      useAbilityCard(e.target.closest(".ability-card"));
      return;
    }
    if (e.target.classList.contains("remove-card")) { e.target.closest(".mini-card").remove(); queueSave(); }
    if (e.target.classList.contains("roll-attr")) { saveCurrentCharacter(); const char = currentChar(); const key = e.target.dataset.rollAttr; doRoll(`Teste de ${key}`, 1, 20, attrMod(char.attrs[key])); }
    if (e.target.classList.contains("roll-skill")) { saveCurrentCharacter(); const char = currentChar(); const skill = e.target.dataset.skill; const attr = e.target.dataset.skillAttr; doRoll(`Teste de ${skill}`, 1, 20, skillTotal(char, skill, attr)); }
    if (e.target.classList.contains("roll-attack")) {
      const card = e.target.closest(".attack-card");
      doRoll(`Ataque: ${card.querySelector(".attack-name").value || "Ataque"}`, 1, 20, Number(card.querySelector(".attack-bonus").value || 0));
      const dmg = parseDamage(card.querySelector(".attack-damage").value);
      if (dmg) setTimeout(() => doRoll(`Dano`, dmg.qty, dmg.sides, dmg.mod), 250);
      const critExpr = card.querySelector(".attack-crit")?.value;
      if (critExpr) addChat(`Crítico de ${card.querySelector(".attack-name").value || "Ataque"}: ${critExpr}`, "roll");
    }
  });
  const rollDiceBtn = byId("roll-dice");
  if (rollDiceBtn) rollDiceBtn.onclick = () => doRoll("Rolagem livre", Number(byId("dice-qty")?.value || 1), Number(byId("dice-type")?.value || 20), Number(byId("dice-mod")?.value || 0));
  const chatForm = byId("chat-form");
  if (chatForm) chatForm.onsubmit = e => { e.preventDefault(); const input = byId("chat-input"); if (!input?.value.trim()) return; addChat(input.value.trim()); input.value = ""; };
}

/* =========================
   SESSÕES / CAMPANHAS
========================= */

function generateInviteCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const existing = new Set(get(STORAGE.campaigns, []).map(c => c.code));
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  } while (existing.has(code));
  return code;
}

function getCampaigns() { return get(STORAGE.campaigns, []); }
function setCampaigns(campaigns) { set(STORAGE.campaigns, campaigns); }
function getMembers() { return get(STORAGE.campaignMembers, []); }
function setMembers(members) { set(STORAGE.campaignMembers, members); }
function activeCampaign() { return getCampaigns().find(c => c.id === currentCampaignId) || null; }
function currentMembership() { return getMembers().find(m => m.campaignId === currentCampaignId && m.userId === currentUser?.id) || null; }
function isCampaignMaster() { return ["mestre", "mestre_jogador"].includes(currentMembership()?.role); }
function isCampaignPlayer() { return ["jogador", "mestre_jogador"].includes(currentMembership()?.role); }
function canEditCharacter(char) { return !!char && (isCampaignMaster() || char.ownerId === currentUser?.id); }
function canOpenCharacter(char) { return !!char && (isCampaignMaster() || char.ownerId === currentUser?.id); }
function campaignChatKey() { return currentCampaignId ? `${STORAGE.chat}_${currentCampaignId}` : STORAGE.chat; }

function showSessions() {
  document.getElementById("auth-screen").classList.remove("active");
  document.getElementById("sessions-screen")?.classList.add("active");
  document.getElementById("app-screen").classList.remove("active");
  document.getElementById("overlay-screen").classList.remove("active");
  currentCampaignId = null;
  accountSheetMode = false;
  localStorage.removeItem(STORAGE.activeCampaign);
  renderAccountCharacterMenu();
  renderCampaignMenu();
}

function showApp() {
  document.getElementById("auth-screen").classList.remove("active");
  document.getElementById("sessions-screen")?.classList.remove("active");
  document.getElementById("app-screen").classList.add("active");
  document.getElementById("overlay-screen").classList.remove("active");
}

function showAuth() {
  document.getElementById("auth-screen").classList.add("active");
  document.getElementById("sessions-screen")?.classList.remove("active");
  document.getElementById("app-screen").classList.remove("active");
  document.getElementById("overlay-screen").classList.remove("active");
}

function login(nick, password) {
  const cleanNick = normalizeNick(nick);
  const user = get(STORAGE.users, []).find(u => normalizeNick(u.nick || u.email || u.name) === cleanNick && String(u.password) === String(password));
  if (!user) return alert("Nick ou senha inválidos.");
  currentUser = user;
  setSessionValue(user.id);
  showSessions();
}


function userCharacters() {
  return get(STORAGE.characters, []).filter(c => c.ownerId === currentUser?.id);
}

function renderAccountCharacterMenu() {
  const list = byId("account-character-list");
  if (!list || !currentUser) return;
  const chars = userCharacters();
  list.innerHTML = "";
  if (!chars.length) {
    const empty = document.createElement("div");
    empty.className = "account-character-empty";
    empty.textContent = "Você ainda não tem fichas. Crie uma ficha aqui antes de entrar em uma mesa.";
    list.appendChild(empty);
    return;
  }
  chars.forEach(char => {
    const card = document.createElement("div");
    card.className = "account-character-card";
    card.innerHTML = `
      <img src="${escapeHtml(char.portrait || "assets/logo.jpg")}" alt="" />
      <div>
        <strong>${escapeHtml(char.name)}</strong>
        <span>${escapeHtml(char.race)} • ${escapeHtml(char.className)} • Nv. ${char.level}</span>
        <div class="account-character-actions">
          <button class="primary-btn" data-edit-account-character="${char.id}" type="button">Editar</button>
          <button class="ghost-btn" data-copy-account-character="${char.id}" type="button">Duplicar</button>
          <button class="danger-btn" data-delete-account-character="${char.id}" type="button">Apagar</button>
        </div>
      </div>`;
    list.appendChild(card);
  });
}

function createAccountCharacter(openAfterCreate = true) {
  const chars = get(STORAGE.characters, []);
  const char = createCharacter(currentUser.id, "Novo Personagem");
  chars.push(char);
  set(STORAGE.characters, chars);
  currentCharacterId = char.id;
  renderAccountCharacterMenu();
  if (openAfterCreate) initAccountCharacterEditor(char.id);
}

function duplicateAccountCharacter(id) {
  const chars = get(STORAGE.characters, []);
  const original = chars.find(c => c.id === id && c.ownerId === currentUser?.id);
  if (!original) return;
  const copy = structuredClone(original);
  copy.id = uid("char");
  copy.name = `${original.name} Cópia`;
  copy.ownerId = currentUser.id;
  chars.push(copy);
  set(STORAGE.characters, chars);
  renderAccountCharacterMenu();
}

function deleteAccountCharacter(id) {
  const chars = get(STORAGE.characters, []);
  const char = chars.find(c => c.id === id && c.ownerId === currentUser?.id);
  if (!char) return;
  const used = getMembers().some(m => m.characterId === id);
  const msg = used
    ? `A ficha "${char.name}" está vinculada a uma mesa. Apagar mesmo assim?`
    : `Apagar a ficha "${char.name}"?`;
  if (!confirm(msg)) return;
  set(STORAGE.characters, chars.filter(c => c.id !== id));
  const members = getMembers().map(m => m.characterId === id ? { ...m, characterId: null } : m);
  setMembers(members);
  if (currentCharacterId === id) currentCharacterId = null;
  renderAccountCharacterMenu();
}

function initAccountCharacterEditor(charId = null) {
  accountSheetMode = true;
  currentCampaignId = null;
  localStorage.removeItem(STORAGE.activeCampaign);
  showApp();
  const chars = userCharacters();
  currentCharacterId = charId || currentCharacterId || chars[0]?.id;
  document.getElementById("current-user-label").textContent = `${userDisplayName(currentUser)} • Minhas Fichas`;
  const info = byId("campaign-info");
  if (info) info.innerHTML = ``;
  renderCampaignMiniCard();
  const title = byId("sidebar-title");
  if (title) title.textContent = "Minhas Fichas";
  const campaignCharBtn = byId("campaign-character-btn");
  if (campaignCharBtn) campaignCharBtn.textContent = "Vincular em Mesa";
  renderAccountCharacterSidebar();
  if (currentCharacterId) loadCharacter(currentCharacterId);
  else showNoAccountCharacterSelected();
  renderChat();
}

function showNoAccountCharacterSelected() {
  const name = byId("char-name");
  if (name) name.value = "Crie uma ficha no menu inicial";
  const list = byId("character-list");
  if (list) list.innerHTML = `<div class="campaign-empty">Nenhuma ficha criada na sua conta.</div>`;
}

function renderAccountCharacterSidebar() {
  const list = byId("character-list");
  if (!list) return;
  const chars = userCharacters();
  list.innerHTML = "";
  if (!chars.length) {
    list.innerHTML = `<div class="campaign-empty">Nenhuma ficha criada.</div>`;
    return;
  }
  chars.forEach(char => {
    const el = document.createElement("div");
    el.className = `character-pill session-character ${char.id === currentCharacterId ? "active" : ""}`;
    el.innerHTML = `<img src="${escapeHtml(char.portrait || "assets/logo.jpg")}" alt="" /><strong>${escapeHtml(char.name)}</strong><span>${escapeHtml(char.race)} • ${escapeHtml(char.className)} • Nv. ${char.level}</span><small>Sua ficha</small>`;
    el.onclick = () => { saveCurrentCharacter(); currentCharacterId = char.id; loadCharacter(char.id); renderAccountCharacterSidebar(); renderAccountCharacterMenu(); };
    list.appendChild(el);
  });
}

function renderCampaignMenu() {
  const list = byId("campaign-list");
  if (!list || !currentUser) return;
  const createBox = byId("create-campaign-box");
  createBox?.classList.remove("locked");
  const createBtn = byId("create-campaign-btn");
  if (createBtn) createBtn.disabled = false;

  const campaigns = getCampaigns();
  const members = getMembers().filter(m => m.userId === currentUser.id);
  const chars = get(STORAGE.characters, []);
  list.innerHTML = "";

  if (!members.length) {
    const empty = document.createElement("div");
    empty.className = "campaign-empty";
    empty.textContent = "Você ainda não criou ou entrou em nenhuma mesa. Crie uma mesa ou use o código de convite do mestre.";
    list.appendChild(empty);
    return;
  }

  members.forEach(member => {
    const campaign = campaigns.find(c => c.id === member.campaignId);
    if (!campaign) return;
    const char = chars.find(c => c.id === member.characterId);
    const card = document.createElement("div");
    card.className = "campaign-card";
    card.innerHTML = `
      <div class="campaign-main">
        <div>
          <strong>${escapeHtml(campaign.name)}</strong>
          <span>Código: <b>${escapeHtml(campaign.code)}</b></span>
          <small>Papel: ${member.role === "mestre_jogador" ? "Mestre + Jogador" : member.role}</small>
        </div>
        <div class="campaign-character-preview">
          <img src="${escapeHtml(char?.portrait || "assets/logo.jpg")}" alt="" />
          <span>${char ? escapeHtml(char.name) : "Sem ficha escolhida"}</span>
        </div>
      </div>
      <div class="campaign-actions">
        <button class="primary-btn" data-enter-campaign="${campaign.id}" type="button">Entrar</button>
        <button class="ghost-btn" data-choose-campaign-char="${campaign.id}" type="button">Escolher Ficha</button>
        ${campaign.ownerId === currentUser.id ? `<button class="ghost-btn" data-copy-code="${campaign.code}" type="button">Copiar Código</button><button class="danger-btn small" data-delete-campaign="${campaign.id}" type="button">Excluir Mesa</button>` : `<button class="danger-btn small" data-leave-campaign="${campaign.id}" type="button">Sair da Mesa</button>`}
      </div>`;
    list.appendChild(card);
  });
}

function createCampaign() {
  const name = byId("new-campaign-name")?.value?.trim() || "Nova Mesa";
  const campaigns = getCampaigns();
  const campaign = { id: uid("camp"), name, code: generateInviteCode(), ownerId: currentUser.id, createdAt: Date.now() };
  campaigns.push(campaign);
  setCampaigns(campaigns);
  const members = getMembers();
  members.push({ id: uid("member"), campaignId: campaign.id, userId: currentUser.id, role: "mestre", characterId: null });
  setMembers(members);
  byId("new-campaign-name").value = "";
  renderCampaignMenu();
  alert(`Mesa criada! Código de convite: ${campaign.code}`);
}

function joinCampaignByCode() {
  const code = (byId("join-campaign-code")?.value || "").trim().toUpperCase();
  if (code.length !== 5) return alert("Digite um código de 5 letras.");
  const campaign = getCampaigns().find(c => c.code === code);
  if (!campaign) return alert("Mesa não encontrada.");
  const members = getMembers();
  let member = members.find(m => m.campaignId === campaign.id && m.userId === currentUser.id);
  if (!member) {
    member = { id: uid("member"), campaignId: campaign.id, userId: currentUser.id, role: "jogador", characterId: null };
    members.push(member);
    setMembers(members);
  }
  byId("join-campaign-code").value = "";
  renderCampaignMenu();
  openChooseCharacterModal(campaign.id);
}

function openChooseCharacterModal(campaignId = currentCampaignId) {
  pendingChooseCampaignId = campaignId;
  const list = byId("choose-character-list");
  if (!list) return;
  const chars = get(STORAGE.characters, []).filter(c => c.ownerId === currentUser.id);
  list.innerHTML = "";
  if (!chars.length) {
    const empty = document.createElement("div");
    empty.className = "campaign-empty";
    empty.textContent = "Você ainda não tem fichas. Crie uma nova para usar nesta mesa.";
    list.appendChild(empty);
  }
  chars.forEach(char => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choose-character-card";
    btn.dataset.selectCharacterForCampaign = char.id;
    btn.innerHTML = `<img src="${escapeHtml(char.portrait || "assets/logo.jpg")}" alt="" /><strong>${escapeHtml(char.name)}</strong><span>${escapeHtml(char.race)} • ${escapeHtml(char.className)} • Nv. ${char.level}</span>`;
    list.appendChild(btn);
  });
  byId("choose-character-modal")?.showModal();
}

function attachCharacterToCampaign(campaignId, characterId) {
  const members = getMembers();
  let member = members.find(m => m.campaignId === campaignId && m.userId === currentUser.id);
  if (!member) {
    member = { id: uid("member"), campaignId, userId: currentUser.id, role: "jogador", characterId };
    members.push(member);
  }
  member.characterId = characterId;
  if (member.role === "mestre") member.role = "mestre_jogador";
  setMembers(members);
  byId("choose-character-modal")?.close();
  renderCampaignMenu();
  if (currentCampaignId === campaignId) initApp(campaignId);
}

function createCharacterForCampaign() {
  const chars = get(STORAGE.characters, []);
  const char = createCharacter(currentUser.id, "Novo Personagem");
  chars.push(char);
  set(STORAGE.characters, chars);
  attachCharacterToCampaign(pendingChooseCampaignId, char.id);
}

function enterCampaign(campaignId) {
  const member = getMembers().find(m => m.campaignId === campaignId && m.userId === currentUser.id);
  if (!member) return alert("Você não faz parte desta mesa.");
  currentCampaignId = campaignId;
  set(STORAGE.activeCampaign, campaignId);
  initApp(campaignId);
}

function initApp(campaignId = currentCampaignId) {
  accountSheetMode = false;
  currentCampaignId = campaignId || get(STORAGE.activeCampaign, null);
  if (!currentCampaignId) return showSessions();
  showApp();
  const campaign = activeCampaign();
  const member = currentMembership();
  document.getElementById("current-user-label").textContent = `${userDisplayName(currentUser)} • ${member?.role || "jogador"}`;
  const info = byId("campaign-info");
  if (info) info.innerHTML = ``;
  renderCampaignMiniCard();
  const title = byId("sidebar-title");
  if (title) title.textContent = campaign?.name || "Mesa";
  const campaignCharBtn = byId("campaign-character-btn");
  if (campaignCharBtn) campaignCharBtn.textContent = member?.characterId ? "Trocar Minha Ficha" : "Escolher Minha Ficha";

  renderCharacterList();
  const chars = charactersInCurrentCampaign();
  const myCharId = member?.characterId;
  const firstEditable = isCampaignMaster() ? chars[0]?.id : myCharId;
  currentCharacterId = chars.some(c => c.id === currentCharacterId && canOpenCharacter(c)) ? currentCharacterId : firstEditable;
  if (currentCharacterId) loadCharacter(currentCharacterId);
  else showNoCharacterSelected();
  renderChat();
}

function charactersInCurrentCampaign() {
  const members = getMembers().filter(m => m.campaignId === currentCampaignId && m.characterId);
  const ids = new Set(members.map(m => m.characterId));
  return get(STORAGE.characters, []).filter(c => ids.has(c.id));
}

function showNoCharacterSelected() {
  const name = byId("char-name");
  if (name) name.value = "Escolha uma ficha para esta mesa";
  byId("character-list").innerHTML = `<div class="campaign-empty">Nenhuma ficha vinculada a esta mesa ainda.</div>`;
}

function renderCharacterList() {
  const list = document.getElementById("character-list");
  if (!list) return;
  const chars = charactersInCurrentCampaign();
  const members = getMembers().filter(m => m.campaignId === currentCampaignId);
  const users = get(STORAGE.users, []);
  list.innerHTML = "";
  if (!chars.length) {
    list.innerHTML = `<div class="campaign-empty">Nenhum personagem escolhido nesta mesa.</div>`;
    return;
  }
  chars.forEach(char => {
    const member = members.find(m => m.characterId === char.id);
    const user = users.find(u => u.id === member?.userId);
    const editable = canOpenCharacter(char);
    const el = document.createElement("div");
    el.className = `character-pill session-character ${char.id === currentCharacterId ? "active" : ""} ${editable ? "" : "readonly"}`;
    el.innerHTML = `<img src="${escapeHtml(char.portrait || "assets/logo.jpg")}" alt="" /><strong>${escapeHtml(char.name)}</strong><span>${escapeHtml(char.race)} • ${escapeHtml(char.className)} • Nv. ${char.level}</span><small>${escapeHtml(userDisplayName(user))}</small>`;
    if (editable) {
      el.onclick = () => { saveCurrentCharacter(); currentCharacterId = char.id; loadCharacter(char.id); renderCharacterList(); };
    }
    list.appendChild(el);
  });
}

const baseSaveCurrentCharacter = saveCurrentCharacter;

function updateChar(mutator) {
  const char = currentChar();
  if (!canEditCharacter(char)) return;
  const chars = get(STORAGE.characters, []);
  const index = chars.findIndex(c => c.id === currentCharacterId);
  if (index < 0) return;
  mutator(chars[index]);
  set(STORAGE.characters, chars);
}

saveCurrentCharacter = function() {
  const char = currentChar();
  if (!currentCharacterId || !canEditCharacter(char)) return;
  const disabled = document.body.classList.contains("readonly-character");
  if (disabled) return;
  baseSaveCurrentCharacter();
  if (accountSheetMode) {
    renderAccountCharacterSidebar();
    renderAccountCharacterMenu();
  }
};

function addChat(text, type = "msg") {
  const key = campaignChatKey();
  const chat = get(key, []);
  chat.push({ id: uid("msg"), user: currentUser?.name || "Sistema", text, type, at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) });
  set(key, chat.slice(-120));
  renderChat();
}
function renderChat() {
  const log = byId("chat-log"); if (!log) return;
  log.innerHTML = "";
  get(campaignChatKey(), []).forEach(msg => {
    const div = document.createElement("div");
    div.className = `chat-msg ${msg.type === "roll" ? "roll" : ""}`;
    div.innerHTML = `<small>${msg.user} • ${msg.at}</small>${escapeHtml(msg.text)}`;
    log.appendChild(div);
  });
  log.scrollTop = log.scrollHeight;
}

const baseLoadCharacter = loadCharacter;
loadCharacter = function(id) {
  const char = get(STORAGE.characters, []).find(c => c.id === id);
  if (!char || !canOpenCharacter(char)) return;
  baseLoadCharacter(id);
  document.body.classList.toggle("readonly-character", !canEditCharacter(char));
};

function setupCampaignEvents() {
  byId("sessions-logout")?.addEventListener("click", () => { clearSessionValue(); currentUser = null; showAuth(); });
  byId("create-campaign-btn")?.addEventListener("click", createCampaign);
  byId("join-campaign-btn")?.addEventListener("click", joinCampaignByCode);
  byId("join-campaign-code")?.addEventListener("input", e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5));
  byId("back-to-sessions-btn")?.addEventListener("click", () => { saveCurrentCharacter(); showSessions(); });
  byId("campaign-character-btn")?.addEventListener("click", () => {
    if (accountSheetMode) return showSessions();
    openChooseCharacterModal(currentCampaignId);
  });
  byId("create-account-character-btn")?.addEventListener("click", () => createAccountCharacter(true));
  if (byId("new-character-btn")) byId("new-character-btn").onclick = () => {
    saveCurrentCharacter();
    const chars = get(STORAGE.characters, []);
    const char = createCharacter(currentUser.id);
    chars.push(char);
    set(STORAGE.characters, chars);
    currentCharacterId = char.id;
    if (currentCampaignId && !accountSheetMode) {
      attachCharacterToCampaign(currentCampaignId, char.id);
      initApp(currentCampaignId);
    } else {
      initAccountCharacterEditor(char.id);
    }
  };
  byId("create-character-for-campaign")?.addEventListener("click", createCharacterForCampaign);

  document.addEventListener("click", event => {
    const enter = event.target.closest("[data-enter-campaign]");
    if (enter) return enterCampaign(enter.dataset.enterCampaign);
    const choose = event.target.closest("[data-choose-campaign-char]");
    if (choose) return openChooseCharacterModal(choose.dataset.chooseCampaignChar);
    const select = event.target.closest("[data-select-character-for-campaign]");
    if (select) return attachCharacterToCampaign(pendingChooseCampaignId, select.dataset.selectCharacterForCampaign);
    const copy = event.target.closest("[data-copy-code]");
    if (copy) { navigator.clipboard?.writeText(copy.dataset.copyCode); alert(`Código: ${copy.dataset.copyCode}`); }
    const deleteCamp = event.target.closest("[data-delete-campaign]");
    if (deleteCamp) return deleteCampaign(deleteCamp.dataset.deleteCampaign);
    const leaveCamp = event.target.closest("[data-leave-campaign]");
    if (leaveCamp) return leaveCampaign(leaveCamp.dataset.leaveCampaign);
    const editAccountChar = event.target.closest("[data-edit-account-character]");
    if (editAccountChar) return initAccountCharacterEditor(editAccountChar.dataset.editAccountCharacter);
    const copyAccountChar = event.target.closest("[data-copy-account-character]");
    if (copyAccountChar) return duplicateAccountCharacter(copyAccountChar.dataset.copyAccountCharacter);
    const deleteAccountChar = event.target.closest("[data-delete-account-character]");
    if (deleteAccountChar) return deleteAccountCharacter(deleteAccountChar.dataset.deleteAccountCharacter);
  });
}

function ensureDemoCampaign() {
  const users = get(STORAGE.users, []);
  const demo = users.find(u => normalizeNick(u.nick || u.email || u.name) === "mestre");
  if (!demo) return;
  const campaigns = getCampaigns();
  if (campaigns.length) return;
  const campaign = { id: uid("camp"), name: "Mesa de Teste", code: "TESTE", ownerId: demo.id, createdAt: Date.now() };
  setCampaigns([campaign]);
  const char = get(STORAGE.characters, []).find(c => c.ownerId === demo.id);
  setMembers([{ id: uid("member"), campaignId: campaign.id, userId: demo.id, role: "mestre_jogador", characterId: char?.id || null }]);
}

seed(); ensureDemoCampaign(); events(); setupCampaignEvents(); applySettings();
const sessionId = getSessionValue();
if (sessionId) {
  currentUser = get(STORAGE.users, []).find(u => u.id === sessionId);
  if (currentUser) {
    const active = get(STORAGE.activeCampaign, null);
    if (active && getMembers().some(m => m.campaignId === active && m.userId === currentUser.id)) enterCampaign(active);
    else showSessions();
  } else showAuth();
} else showAuth();

// V34 - login por nick/nome real/senha de 6 dígitos; papel definido por mesa.

/* =========================
   V35 - Painel de Mesa, visão pública, chats separados, iniciativa e backup
========================= */
function v35RollChatKey() { return currentCampaignId ? `${STORAGE.chat}_${currentCampaignId}_rolls` : `${STORAGE.chat}_rolls`; }
function v35InitiativeKey() { return currentCampaignId ? `od_initiative_${currentCampaignId}` : "od_initiative"; }
function getInitiativeState() { return get(v35InitiativeKey(), { active: false, round: 1, entries: [] }); }
function setInitiativeState(state) { set(v35InitiativeKey(), state); }
function v35MemberForChar(charId) { return getMembers().find(m => m.campaignId === currentCampaignId && m.characterId === charId); }
function v35UserById(userId) { return get(STORAGE.users, []).find(u => u.id === userId); }
function v35CharCondition(char) { return char?.conditionsText || char?.condition || "Normal"; }
function v35ResourceText(current, max) { return `${Number(current || 0)}/${Number(max || 0)}`; }
function v35IsMaster() { return typeof isCampaignMaster === "function" && isCampaignMaster(); }
function v35IsMyChar(char) { return !!char && v35MemberForChar(char.id)?.userId === currentUser?.id; }

const odV34AddChat = addChat;
addChat = function(text, type = "msg") {
  const key = type === "roll" ? v35RollChatKey() : campaignChatKey();
  const chat = get(key, []);
  chat.push({
    id: uid(type === "roll" ? "roll" : "msg"),
    user: userDisplayName(currentUser),
    text,
    type,
    at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  });
  set(key, chat.slice(-140));
  renderChat();
};

renderChat = function() {
  const msgLog = byId("chat-log");
  const rollLog = byId("roll-chat-log");
  if (msgLog) {
    msgLog.innerHTML = "";
    get(campaignChatKey(), []).forEach(msg => {
      const div = document.createElement("div");
      div.className = "chat-msg";
      div.innerHTML = `<small>${escapeHtml(msg.user)} • ${escapeHtml(msg.at)}</small>${escapeHtml(msg.text)}`;
      msgLog.appendChild(div);
    });
    msgLog.scrollTop = msgLog.scrollHeight;
  }
  if (rollLog) {
    rollLog.innerHTML = "";
    get(v35RollChatKey(), []).forEach(msg => {
      const div = document.createElement("div");
      div.className = "chat-msg roll";
      div.innerHTML = `<small>${escapeHtml(msg.user)} • ${escapeHtml(msg.at)}</small>${escapeHtml(msg.text)}`;
      rollLog.appendChild(div);
    });
    rollLog.scrollTop = rollLog.scrollHeight;
  }
};

function v35RecordInitiativeFromRoll(total) {
  const state = getInitiativeState();
  if (!state.active) return;
  const member = currentMembership();
  const char = get(STORAGE.characters, []).find(c => c.id === member?.characterId);
  if (!char) return;
  const existing = state.entries.find(e => e.characterId === char.id);
  if (existing) {
    existing.value = Number(total || 0);
    existing.name = char.name;
    existing.playerName = userDisplayName(currentUser);
  } else {
    state.entries.push({
      id: uid("init"),
      characterId: char.id,
      userId: currentUser.id,
      name: char.name,
      playerName: userDisplayName(currentUser),
      value: Number(total || 0),
      manual: false
    });
  }
  state.entries.sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  setInitiativeState(state);
  renderInitiativePanel();
};

const odV34DoRoll = doRoll;
doRoll = function(label, qty, sides, mod = 0) {
  const r = roll(qty, sides, mod);
  const text = `${label}: ${qty}D${sides}${Number(mod) ? formatMod(Number(mod)) : ""} → [${r.results.join(", ")}] = ${r.total}`;
  const last = byId("last-roll");
  if (last) {
    last.textContent = text;
    last.classList.remove("shake"); void last.offsetWidth; last.classList.add("shake");
  }
  addChat(text, "roll");
  if (String(label).toLowerCase().includes("iniciativa")) v35RecordInitiativeFromRoll(r.total);
  return r;
};

function renderMasterDashboard() {
  const panel = byId("master-dashboard");
  const grid = byId("master-characters-grid");
  if (!panel || !grid) return;
  const master = v35IsMaster();
  panel.classList.toggle("hidden", !master);
  document.body.classList.toggle("master-dashboard-mode", master);
  if (!master) return;

  const chars = charactersInCurrentCampaign();
  const users = get(STORAGE.users, []);
  const members = getMembers().filter(m => m.campaignId === currentCampaignId);
  grid.innerHTML = "";
  if (!chars.length) {
    grid.innerHTML = `<div class="campaign-empty">Nenhum jogador vinculou ficha nesta mesa ainda.</div>`;
  }
  chars.forEach(char => {
    const member = members.find(m => m.characterId === char.id);
    const user = users.find(u => u.id === member?.userId);
    const card = document.createElement("article");
    card.className = "master-character-card";
    card.innerHTML = `
      <div class="master-card-top">
        <img src="${escapeHtml(char.portrait || "assets/logo.jpg")}" alt="" />
        <div>
          <small>Jogador: ${escapeHtml(userDisplayName(user))}</small>
          <strong>${escapeHtml(char.name || "Personagem")}</strong>
          <span>${escapeHtml(char.race || "Raça")} • ${escapeHtml(char.className || "Classe")} • Nv. ${escapeHtml(char.level || 1)}</span>
        </div>
      </div>
      <div class="master-quick-grid">
        <div class="quick-vital">
          <label>PV</label>
          <div class="quick-vital-row">
            <button type="button" data-quick-resource="pv" data-quick-delta="-5" data-char-id="${char.id}">−</button>
            <input data-quick-input="pv" data-char-id="${char.id}" value="${escapeHtml(char.pvCurrent ?? 0)}" type="number" />
            <button type="button" data-quick-resource="pv" data-quick-delta="5" data-char-id="${char.id}">+</button>
          </div>
          <small>Total: ${escapeHtml(char.pvMax ?? 0)}</small>
        </div>
        <div class="quick-vital">
          <label>PE</label>
          <div class="quick-vital-row">
            <button type="button" data-quick-resource="pe" data-quick-delta="-1" data-char-id="${char.id}">−</button>
            <input data-quick-input="pe" data-char-id="${char.id}" value="${escapeHtml(char.peCurrent ?? 0)}" type="number" />
            <button type="button" data-quick-resource="pe" data-quick-delta="1" data-char-id="${char.id}">+</button>
          </div>
          <small>Total: ${escapeHtml(char.peMax ?? 0)}</small>
        </div>
      </div>
      <div class="master-condition-box">
        <label>Condição</label>
        <input class="master-condition-input" data-condition-input="${char.id}" value="${escapeHtml(v35CharCondition(char) === "Normal" ? "" : v35CharCondition(char))}" placeholder="Normal, Sangrando, Caído..." />
      </div>
      <div class="master-card-actions">
        <button class="primary-btn small" type="button" data-open-master-char="${char.id}">Abrir Ficha</button>
        <button class="ghost-btn small" type="button" data-quick-resource="pv" data-quick-delta="-1" data-char-id="${char.id}">-1 PV</button>
        <button class="ghost-btn small" type="button" data-quick-resource="pv" data-quick-delta="1" data-char-id="${char.id}">+1 PV</button>
      </div>`;
    grid.appendChild(card);
  });
  renderInitiativePanel();
}

function renderPlayerDashboard() {
  const panel = byId("player-dashboard");
  const grid = byId("public-party-grid");
  if (!panel || !grid) return;
  const show = !v35IsMaster() && !!currentCampaignId;
  panel.classList.toggle("hidden", !show);
  if (!show) return;
  grid.innerHTML = "";
  charactersInCurrentCampaign().forEach(char => {
    const mine = v35IsMyChar(char);
    const card = document.createElement("article");
    card.className = `public-character-card ${mine ? "is-mine" : ""}`;
    card.innerHTML = `
      <div class="public-card-top">
        <img src="${escapeHtml(char.portrait || "assets/logo.jpg")}" alt="" />
        <div>
          <strong>${escapeHtml(char.name || "Personagem")}</strong>
          <span>${escapeHtml(char.race || "Raça")} • ${escapeHtml(char.className || "Classe")} • Nv. ${escapeHtml(char.level || 1)}</span>
          <small>${mine ? "Sua ficha" : "Aliado"}</small>
        </div>
      </div>
      <div class="public-vitals-grid">
        <div class="public-vital"><label>PV</label><strong>${escapeHtml(v35ResourceText(char.pvCurrent, char.pvMax))}</strong></div>
        <div class="public-vital"><label>PE</label><strong>${escapeHtml(v35ResourceText(char.peCurrent, char.peMax))}</strong></div>
      </div>
      <span class="condition-chip">${escapeHtml(v35CharCondition(char))}</span>`;
    grid.appendChild(card);
  });
}

function renderTableExperience() {
  renderMasterDashboard();
  renderPlayerDashboard();
  renderCharacterList();
}

function v35UpdateCharacter(charId, mutator, logText = "") {
  const chars = get(STORAGE.characters, []);
  const index = chars.findIndex(c => c.id === charId);
  if (index < 0) return;
  mutator(chars[index]);
  set(STORAGE.characters, chars);
  if (currentCharacterId === charId) loadCharacter(charId);
  if (logText) addChat(logText, "roll");
  renderTableExperience();
}

function renderInitiativePanel() {
  const panel = byId("initiative-panel");
  const list = byId("initiative-list");
  const btn = byId("combat-toggle-btn");
  if (!panel || !list || !btn || !v35IsMaster()) return;
  const state = getInitiativeState();
  panel.classList.toggle("hidden", !state.active);
  btn.textContent = state.active ? "Encerrar Combate" : "Iniciar Combate";
  list.innerHTML = "";
  if (!state.active) return;
  const entries = [...(state.entries || [])].sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  if (!entries.length) {
    list.innerHTML = `<div class="campaign-empty">Combate iniciado. Aguarde rolagens de Iniciativa ou adicione manualmente.</div>`;
    return;
  }
  entries.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "initiative-row";
    row.innerHTML = `
      <div class="initiative-rank">#${index + 1}</div>
      <div class="initiative-name"><strong>${escapeHtml(entry.name || "Combatente")}</strong><small>${escapeHtml(entry.playerName || (entry.manual ? "Manual" : ""))}</small></div>
      <input type="number" value="${escapeHtml(entry.value || 0)}" data-init-value="${entry.id}" />
      <div class="initiative-actions"><button class="danger-btn small" type="button" data-remove-init="${entry.id}">Remover</button></div>`;
    list.appendChild(row);
  });
}

function v35ToggleCombat() {
  const state = getInitiativeState();
  state.active = !state.active;
  if (!state.active) state.entries = [];
  if (state.active && !state.round) state.round = 1;
  setInitiativeState(state);
  addChat(state.active ? "Combate iniciado." : "Combate encerrado.", "roll");
  renderInitiativePanel();
}

function v35AddManualInitiative() {
  const state = getInitiativeState();
  state.active = true;
  const name = prompt("Nome do combatente:", "Inimigo") || "Combatente";
  const value = Number(prompt("Valor de iniciativa:", "10") || 0);
  state.entries.push({ id: uid("init"), name, playerName: "Manual", value, manual: true });
  state.entries.sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  setInitiativeState(state);
  renderInitiativePanel();
}

const odV34InitApp = initApp;
initApp = function(campaignId = currentCampaignId) {
  document.body.classList.remove("master-sheet-open");
  odV34InitApp(campaignId);
  renderTableExperience();
};

const odV34ShowSessions = showSessions;
showSessions = function() {
  document.body.classList.remove("master-dashboard-mode", "master-sheet-open");
  odV34ShowSessions();
  v35InjectAccountTools();
};

const odV34RenderCampaignMenu = renderCampaignMenu;
renderCampaignMenu = function() {
  odV34RenderCampaignMenu();
  v35InjectAccountTools();
};

const odV34RenderCharacterList = renderCharacterList;
renderCharacterList = function() {
  const list = document.getElementById("character-list");
  if (!list) return;
  const chars = charactersInCurrentCampaign();
  const members = getMembers().filter(m => m.campaignId === currentCampaignId);
  const users = get(STORAGE.users, []);
  list.innerHTML = "";
  if (!chars.length) {
    list.innerHTML = `<div class="campaign-empty">Nenhum personagem escolhido nesta mesa.</div>`;
    return;
  }
  chars.forEach(char => {
    const member = members.find(m => m.characterId === char.id);
    const user = users.find(u => u.id === member?.userId);
    const editable = canOpenCharacter(char);
    const el = document.createElement("div");
    el.className = `character-pill session-character ${char.id === currentCharacterId ? "active" : ""} ${editable ? "" : "readonly"}`;
    el.innerHTML = `<img src="${escapeHtml(char.portrait || "assets/logo.jpg")}" alt="" /><strong>${escapeHtml(char.name)}</strong><span>PV ${escapeHtml(v35ResourceText(char.pvCurrent, char.pvMax))} • PE ${escapeHtml(v35ResourceText(char.peCurrent, char.peMax))}</span><small>${escapeHtml(userDisplayName(user))} • ${escapeHtml(v35CharCondition(char))}</small>`;
    if (editable) {
      el.onclick = () => {
        saveCurrentCharacter();
        currentCharacterId = char.id;
        loadCharacter(char.id);
        if (v35IsMaster()) document.body.classList.add("master-sheet-open");
        renderTableExperience();
      };
    }
    list.appendChild(el);
  });
};

const odV34SaveCurrentCharacter = saveCurrentCharacter;
saveCurrentCharacter = function() {
  odV34SaveCurrentCharacter();
  renderMasterDashboard();
  renderPlayerDashboard();
};

function v35InjectAccountTools() {
  // V81: painel legado de importação/exportação local removido.
  // Mantido como no-op porque versões anteriores ainda chamam esta função.
}

document.addEventListener("click", event => {
  const open = event.target.closest("[data-open-master-char]");
  if (open) {
    saveCurrentCharacter();
    currentCharacterId = open.dataset.openMasterChar;
    loadCharacter(currentCharacterId);
    document.body.classList.add("master-sheet-open");
    renderTableExperience();
    document.querySelector(".sheet-area")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const quick = event.target.closest("[data-quick-resource]");
  if (quick) {
    const id = quick.dataset.charId;
    const resource = quick.dataset.quickResource;
    const delta = Number(quick.dataset.quickDelta || 0);
    v35UpdateCharacter(id, char => {
      if (resource === "pv") char.pvCurrent = Math.max(0, Number(char.pvCurrent || 0) + delta);
      if (resource === "pe") char.peCurrent = Math.max(0, Number(char.peCurrent || 0) + delta);
    }, `${resource.toUpperCase()} de personagem alterado em ${formatMod(delta)}.`);
    return;
  }
  const removeInit = event.target.closest("[data-remove-init]");
  if (removeInit) {
    const state = getInitiativeState();
    state.entries = (state.entries || []).filter(e => e.id !== removeInit.dataset.removeInit);
    setInitiativeState(state);
    renderInitiativePanel();
    return;
  }
  if (event.target.closest("#combat-toggle-btn")) return v35ToggleCombat();
  if (event.target.closest("#add-manual-initiative")) return v35AddManualInitiative();
  if (event.target.closest("#master-close-sheet")) {
    saveCurrentCharacter();
    document.body.classList.remove("master-sheet-open");
    renderTableExperience();
    return;
  }
});

document.addEventListener("change", event => {
  const quickInput = event.target.closest("[data-quick-input]");
  if (quickInput) {
    const id = quickInput.dataset.charId;
    const type = quickInput.dataset.quickInput;
    const value = Number(quickInput.value || 0);
    v35UpdateCharacter(id, char => {
      if (type === "pv") char.pvCurrent = Math.max(0, value);
      if (type === "pe") char.peCurrent = Math.max(0, value);
    });
    return;
  }
  const condition = event.target.closest("[data-condition-input]");
  if (condition) {
    const id = condition.dataset.conditionInput;
    const value = condition.value.trim();
    v35UpdateCharacter(id, char => { char.conditionsText = value || "Normal"; });
    return;
  }
  const initValue = event.target.closest("[data-init-value]");
  if (initValue) {
    const state = getInitiativeState();
    const entry = state.entries.find(e => e.id === initValue.dataset.initValue);
    if (entry) entry.value = Number(initValue.value || 0);
    state.entries.sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
    setInitiativeState(state);
    renderInitiativePanel();
  }
});

// Reforço final de tela após carregar a v35.
setTimeout(() => {
  v35InjectAccountTools();
  if (currentCampaignId) renderTableExperience();
  renderChat();
}, 50);

// V35 - painel do mestre, visão pública, chats separados, iniciativa, exportar/importar fichas e acabamento visual.




/* =========================
   V40 - Ajustes de mesa, menu e remoção de imagens de equipamentos/magias
========================= */
function renderCampaignMiniCard() {
  const box = byId("campaign-mini-card");
  if (!box) return;
  const campaign = activeCampaign?.();
  const member = currentMembership?.();
  if (!campaign || accountSheetMode) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  const role = member?.role === "mestre_jogador" ? "Mestre + Jogador" : (member?.role || "Jogador");
  box.classList.remove("hidden");
  box.innerHTML = `<strong>${escapeHtml(campaign.name)}</strong><span>Código: <b>${escapeHtml(campaign.code)}</b></span><small>${escapeHtml(role)}</small>`;
}

function deleteCampaign(campaignId) {
  const campaigns = getCampaigns();
  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) return;
  if (campaign.ownerId !== currentUser.id) return alert("Apenas o criador da mesa pode excluir esta mesa.");
  if (!confirm(`Excluir a mesa "${campaign.name}"? Essa ação remove a mesa, vínculos, chat, loja, drop e iniciativa local.`)) return;
  setCampaigns(campaigns.filter(c => c.id !== campaignId));
  setMembers(getMembers().filter(m => m.campaignId !== campaignId));
  try {
    localStorage.removeItem(`od_chat_${campaignId}`);
    localStorage.removeItem(`od_chat_roll_${campaignId}`);
    localStorage.removeItem(`od_initiative_${campaignId}`);
    localStorage.removeItem(`od_combat_${campaignId}`);
    localStorage.removeItem(`od_shop_${campaignId}`);
    localStorage.removeItem(`od_drops_${campaignId}`);
  } catch (err) {}
  if (currentCampaignId === campaignId) {
    currentCampaignId = null;
    localStorage.removeItem(STORAGE.activeCampaign);
  }
  renderCampaignMenu();
}

function leaveCampaign(campaignId) {
  const member = getMembers().find(m => m.campaignId === campaignId && m.userId === currentUser.id);
  const campaign = getCampaigns().find(c => c.id === campaignId);
  if (!member || !campaign) return;
  if (campaign.ownerId === currentUser.id) return deleteCampaign(campaignId);
  if (!confirm(`Sair da mesa "${campaign.name}"?`)) return;
  setMembers(getMembers().filter(m => m.id !== member.id));
  if (currentCampaignId === campaignId) {
    currentCampaignId = null;
    localStorage.removeItem(STORAGE.activeCampaign);
  }
  renderCampaignMenu();
}

/* =========================
   V39 - Loja, drops, transferências e transformações
========================= */
function v39NumberMoney(value) {
  return Number(String(value ?? "0").replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
}
function v39FormatMoney(value) {
  const n = v39NumberMoney(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
}
function v39ShopKey() { return `od_shop_${currentCampaignId || "local"}`; }
function v39DropsKey() { return `od_drops_${currentCampaignId || "local"}`; }
function v39CloneItem(item = {}) {
  return {
    id: uid("inv"),
    name: item.name || "Item",
    weight: normalizeWeight(item.weight || 0.5),
    uses: Math.max(0, Number(item.uses || 0)),
    desc: item.desc || item.description || "",
    imageUrl: item.imageUrl || item.image || ""
  };
}
function v39CampaignCharacters() { return typeof charactersInCurrentCampaign === "function" ? charactersInCurrentCampaign() : []; }
function v39CampaignUsersByCharacter() {
  const users = get(STORAGE.users, []);
  const members = getMembers().filter(m => m.campaignId === currentCampaignId);
  const map = new Map();
  members.forEach(m => map.set(m.characterId, users.find(u => u.id === m.userId)));
  return map;
}
function v39AddItemToCharacter(charId, item) {
  const chars = get(STORAGE.characters, []);
  const c = chars.find(ch => ch.id === charId);
  if (!c) return false;
  c.inventoryItems = Array.isArray(c.inventoryItems) ? c.inventoryItems : [];
  c.inventoryItems.push(v39CloneItem(item));
  c.weightCurrent = c.inventoryItems.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);
  set(STORAGE.characters, chars);
  return true;
}
function v39RemoveItemFromCharacter(charId, itemId) {
  const chars = get(STORAGE.characters, []);
  const c = chars.find(ch => ch.id === charId);
  if (!c || !Array.isArray(c.inventoryItems)) return null;
  const idx = c.inventoryItems.findIndex(i => i.id === itemId);
  if (idx < 0) return null;
  const [item] = c.inventoryItems.splice(idx, 1);
  c.weightCurrent = c.inventoryItems.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);
  set(STORAGE.characters, chars);
  return item;
}

// Inventário em texto com imagem e transferência
renderSimpleInventory = function(char) {
  const list = byId("simple-inventory-list");
  if (!list) return;
  const items = Array.isArray(char.inventoryItems) ? char.inventoryItems : [];
  list.classList.toggle("compact", !!char.simpleInventoryCompact);
  const toggle = byId("simple-inventory-compact-toggle");
  if (toggle) toggle.textContent = char.simpleInventoryCompact ? "Versão Completa" : "Reduzir Cards";
  list.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "simple-inventory-empty";
    empty.textContent = "Nenhum item adicionado.";
    list.appendChild(empty);
    updateInventoryWeightTotal();
    return;
  }
  items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "simple-inventory-card v39-item-card";
    card.dataset.inventoryIndex = String(index);
    card.dataset.itemId = item.id || uid("inv");
    card.innerHTML = `
      <div class="simple-inventory-name-row">
        <input class="simple-inventory-name" data-inv-field="name" value="${escapeHtml(item.name || "Item")}" placeholder="Nome do item" />
      </div>
      <div class="simple-inventory-card-top">
        <label class="simple-inventory-stepper simple-inventory-weight">Peso
          <div class="stepper-control">
            <button class="stepper-btn" data-step-field="weight" data-step-dir="-1" type="button">−</button>
            <input data-inv-field="weight" type="text" value="${formatNumberBr(normalizeWeight(item.weight || 0.5))}" readonly />
            <button class="stepper-btn" data-step-field="weight" data-step-dir="1" type="button">+</button>
          </div>
        </label>
        <label class="simple-inventory-stepper simple-inventory-uses">Usos
          <div class="stepper-control">
            <button class="stepper-btn" data-step-field="uses" data-step-dir="-1" type="button">−</button>
            <input data-inv-field="uses" type="number" min="0" step="1" value="${Number(item.uses || 0)}" placeholder="0" />
            <button class="stepper-btn" data-step-field="uses" data-step-dir="1" type="button">+</button>
          </div>
        </label>
        <button class="mini-danger-btn" data-remove-simple-item="${index}" type="button">×</button>
      </div>
      <textarea class="simple-inventory-desc" data-inv-field="desc" rows="3" placeholder="Descrição">${escapeHtml(item.desc || "")}</textarea>
      <div class="item-card-actions">
        <button class="ghost-btn small" data-transfer-simple-item="${card.dataset.itemId}" type="button">Transferir</button>
        <button class="ghost-btn small" data-drop-simple-item="${card.dataset.itemId}" type="button">Enviar para Drop</button>
      </div>
    `;
    list.appendChild(card);
  });
  updateInventoryWeightTotal();
};
readSimpleInventoryFromDOM = function() {
  const list = byId("simple-inventory-list");
  if (!list) return [];
  return [...list.querySelectorAll(".simple-inventory-card")].map(card => ({
    id: card.dataset.itemId || uid("inv"),
    name: card.querySelector('[data-inv-field="name"]')?.value?.trim() || "Item",
    weight: normalizeWeight(card.querySelector('[data-inv-field="weight"]')?.value || 0.5),
    uses: Math.max(0, Number(card.querySelector('[data-inv-field="uses"]')?.value || 0)),
    desc: card.querySelector('[data-inv-field="desc"]')?.value?.trim() || ""
  }));
};

// Magias com imagem opcional
renderSpells = function(char) {
  const list = byId("spells-list");
  if (!list) return;
  list.innerHTML = "";
  (char.spells || []).forEach((spell, index) => addSpellCard(spell, index));
};
addSpellCard = function(spell = {}, index = null) {
  const node = byId("spell-template").content.cloneNode(true);
  const card = node.querySelector(".spell-card");
  card.dataset.index = index ?? byId("spells-list").children.length;
  card.querySelector(".spell-name").value = spell.name || "";
  card.querySelector(".spell-circle").value = spell.circle || "";
  card.querySelector(".spell-exec").value = spell.exec || "";
  card.querySelector(".spell-range").value = spell.range || "";
  card.querySelector(".spell-cost").value = spell.cost || spell.pe || "";
  card.querySelector(".spell-components").value = spell.components || "";
  card.querySelector(".spell-description").value = spell.description || spell.effect || "";
  card.querySelector(".spell-upgrades").value = spell.upgrades || "";
  byId("spells-list").appendChild(node);
};

function v39ReadSpellsFromDOM() {
  return [...document.querySelectorAll(".spell-card")].map(card => ({
    name: card.querySelector(".spell-name")?.value || "",
    circle: card.querySelector(".spell-circle")?.value || "",
    exec: card.querySelector(".spell-exec")?.value || "",
    range: card.querySelector(".spell-range")?.value || "",
    cost: card.querySelector(".spell-cost")?.value || "",
    components: card.querySelector(".spell-components")?.value || "",
    description: card.querySelector(".spell-description")?.value || "",
    upgrades: card.querySelector(".spell-upgrades")?.value || ""
  }));
}

// Transformações como fichas alternativas reais
function v39BaseCharId(char = currentChar()) { return char?.baseCharacterId || char?.id; }
function v39TransformationsOf(baseId) {
  return get(STORAGE.characters, []).filter(c => c.isTransformation && c.baseCharacterId === baseId);
}
function v39CloneCharacterForTransformation(base, name) {
  const clone = JSON.parse(JSON.stringify(base));
  clone.id = uid("char");
  clone.name = name || `${base.name || "Personagem"} — Transformação`;
  clone.isTransformation = true;
  clone.baseCharacterId = v39BaseCharId(base);
  clone.activeTransformation = false;
  clone.createdFrom = base.id;
  return clone;
}
function renderTransformations(char = currentChar()) {
  const list = byId("transformations-list");
  const banner = byId("active-form-banner");
  if (!list) return;
  const baseId = v39BaseCharId(char);
  const base = get(STORAGE.characters, []).find(c => c.id === baseId);
  const forms = v39TransformationsOf(baseId);
  list.innerHTML = "";
  if (banner) {
    banner.classList.toggle("hidden", !char?.isTransformation);
    banner.innerHTML = char?.isTransformation ? `<strong>Forma ativa:</strong> ${escapeHtml(char.name)} <button class="ghost-btn small" data-open-base-form="${escapeHtml(baseId)}" type="button">Voltar para Forma Base</button>` : "";
  }
  if (!forms.length) {
    list.innerHTML = `<div class="simple-inventory-empty">Nenhuma transformação criada. Clique em + Transformação para criar uma segunda ficha editável.</div>`;
    return;
  }
  forms.forEach(form => {
    const card = document.createElement("article");
    card.className = `mini-card transformation-card ${form.id === char?.id ? "active" : ""}`;
    card.innerHTML = `
      <div class="transformation-card-top">
        <img src="${escapeHtml(form.portrait || base?.portrait || "assets/logo.jpg")}" alt="" />
        <div><strong>${escapeHtml(form.name)}</strong><small>Ficha própria • não altera a base</small></div>
      </div>
      <div class="transformation-actions">
        <button class="primary-btn small" data-open-transformation="${form.id}" type="button">Abrir / Ativar</button>
        <button class="ghost-btn small" data-duplicate-transformation="${form.id}" type="button">Duplicar</button>
        <button class="danger-btn small" data-delete-transformation="${form.id}" type="button">Apagar</button>
      </div>`;
    list.appendChild(card);
  });
}
function v39CreateTransformation() {
  saveCurrentCharacter();
  const base = currentChar();
  if (!base) return;
  const baseId = v39BaseCharId(base);
  const originalBase = get(STORAGE.characters, []).find(c => c.id === baseId) || base;
  const name = prompt("Nome da transformação:", `${originalBase.name || "Personagem"} — Transformação`) || `${originalBase.name || "Personagem"} — Transformação`;
  const chars = get(STORAGE.characters, []);
  const form = v39CloneCharacterForTransformation(originalBase, name);
  chars.push(form);
  set(STORAGE.characters, chars);
  currentCharacterId = form.id;
  loadCharacter(form.id);
  addChat(`${originalBase.name || "Personagem"} criou a transformação ${name}.`, "roll");
  document.querySelector('[data-tab="transformacoes"]')?.click();
}

// Loja e drops do mestre
function v39RenderCommercePanel() {
  if (!v35IsMaster() || !currentCampaignId) return;
  const dash = byId("master-dashboard");
  if (!dash) return;
  let panel = byId("commerce-panel");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "commerce-panel";
    panel.className = "commerce-panel";
    dash.appendChild(panel);
  }
  const shop = get(v39ShopKey(), []);
  const drops = get(v39DropsKey(), []);
  const chars = v39CampaignCharacters();
  const options = chars.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || "Personagem")}</option>`).join("");
  panel.innerHTML = `
    <div class="section-title-row"><div><h3>Loja e Drops da Mesa</h3><p class="helper-text">Crie itens, venda para jogadores com desconto automático de dinheiro ou envie recompensas.</p></div></div>
    <div class="commerce-grid">
      <div class="commerce-create mini-card">
        <h4>Novo item da loja/drop</h4>
        <input id="shop-item-name" placeholder="Nome do item" />
        <input id="shop-item-price" type="number" min="0" step="1" placeholder="Preço" />
        <input id="shop-item-weight" type="number" min="0.5" step="0.5" value="0.5" placeholder="Peso" />
        <input id="shop-item-uses" type="number" min="0" step="1" value="0" placeholder="Usos" />
        <textarea id="shop-item-desc" placeholder="Descrição"></textarea>
        <div class="commerce-actions"><button id="add-shop-item" class="primary-btn small" type="button">Adicionar à Loja</button><button id="add-drop-item" class="ghost-btn small" type="button">Adicionar ao Drop</button></div>
      </div>
      <div class="commerce-list mini-card"><h4>Itens da Loja</h4><div id="shop-items-list"></div></div>
      <div class="commerce-list mini-card"><h4>Drop da Mesa</h4><div id="drop-items-list"></div></div>
    </div>`;
  const shopList = byId("shop-items-list");
  const dropList = byId("drop-items-list");
  shopList.innerHTML = shop.length ? "" : `<div class="campaign-empty">Nenhum item na loja.</div>`;
  shop.forEach(item => {
    const row = document.createElement("div");
    row.className = "commerce-item-row";
    row.innerHTML = `<div><strong>${escapeHtml(item.name)}</strong><small>Preço ${escapeHtml(v39FormatMoney(item.price))} • Peso ${escapeHtml(item.weight)} • Usos ${escapeHtml(item.uses || 0)}</small></div><select data-shop-buyer="${item.id}"><option value="">Comprador...</option>${options}</select><button class="primary-btn small" data-sell-shop-item="${item.id}" type="button">Vender</button><button class="ghost-btn small" data-send-shop-item="${item.id}" type="button">Enviar</button><button class="danger-btn small" data-remove-shop-item="${item.id}" type="button">×</button>`;
    shopList.appendChild(row);
  });
  dropList.innerHTML = drops.length ? "" : `<div class="campaign-empty">Nenhum item no drop.</div>`;
  drops.forEach(item => {
    const row = document.createElement("div");
    row.className = "commerce-item-row";
    row.innerHTML = `<div><strong>${escapeHtml(item.name)}</strong><small>Peso ${escapeHtml(item.weight)} • Usos ${escapeHtml(item.uses || 0)}</small></div><select data-drop-receiver="${item.id}"><option value="">Recebedor...</option>${options}</select><button class="primary-btn small" data-give-drop-item="${item.id}" type="button">Entregar</button><button class="danger-btn small" data-remove-drop-item="${item.id}" type="button">×</button>`;
    dropList.appendChild(row);
  });
}
function v39ReadCommerceForm() {
  return {
    id: uid("shop"),
    name: byId("shop-item-name")?.value?.trim() || "Novo Item",
    price: v39NumberMoney(byId("shop-item-price")?.value || 0),
    weight: normalizeWeight(byId("shop-item-weight")?.value || 0.5),
    uses: Math.max(0, Number(byId("shop-item-uses")?.value || 0)),
    desc: byId("shop-item-desc")?.value?.trim() || ""
  };
}
function v39ClearCommerceForm() {
  ["shop-item-name","shop-item-price","shop-item-desc"].forEach(id => { if (byId(id)) byId(id).value = ""; });
  if (byId("shop-item-weight")) byId("shop-item-weight").value = "0.5";
  if (byId("shop-item-uses")) byId("shop-item-uses").value = "0";
}

// Wrappers finais
const odV39LoadCharacterBase = loadCharacter;
loadCharacter = function(id) {
  odV39LoadCharacterBase(id);
  renderTransformations(currentChar());
};
const odV39SaveBase = saveCurrentCharacter;
saveCurrentCharacter = function() {
  odV39SaveBase();
  const char = currentChar();
  if (!char) return;
  updateChar(saved => {
    saved.spells = v39ReadSpellsFromDOM();
    saved.inventoryItems = readSimpleInventoryFromDOM();
    saved.weightCurrent = saved.inventoryItems.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  });
};
const odV39RenderMasterDashboardBase = renderMasterDashboard;
renderMasterDashboard = function() {
  odV39RenderMasterDashboardBase();
  v39RenderCommercePanel();
};
const odV39RenderTableExperienceBase = renderTableExperience;
renderTableExperience = function() {
  odV39RenderTableExperienceBase();
  v39RenderCommercePanel();
  renderTransformations(currentChar());
};

// Eventos V39
document.addEventListener("click", event => {
  if (event.target.closest("#create-transformation-btn")) return v39CreateTransformation();
  const openForm = event.target.closest("[data-open-transformation]");
  if (openForm) {
    saveCurrentCharacter(); currentCharacterId = openForm.dataset.openTransformation; loadCharacter(currentCharacterId); renderTableExperience(); document.querySelector('[data-tab="transformacoes"]')?.click(); return;
  }
  const openBase = event.target.closest("[data-open-base-form]");
  if (openBase) {
    saveCurrentCharacter(); currentCharacterId = openBase.dataset.openBaseForm; loadCharacter(currentCharacterId); renderTableExperience(); document.querySelector('[data-tab="transformacoes"]')?.click(); return;
  }
  const dupForm = event.target.closest("[data-duplicate-transformation]");
  if (dupForm) {
    saveCurrentCharacter();
    const chars = get(STORAGE.characters, []); const source = chars.find(c => c.id === dupForm.dataset.duplicateTransformation); if (!source) return;
    const copy = JSON.parse(JSON.stringify(source)); copy.id = uid("char"); copy.name = `${source.name} (cópia)`; chars.push(copy); set(STORAGE.characters, chars); renderTransformations(currentChar()); return;
  }
  const delForm = event.target.closest("[data-delete-transformation]");
  if (delForm) {
    if (!confirm("Apagar esta transformação?")) return;
    const id = delForm.dataset.deleteTransformation; const chars = get(STORAGE.characters, []); const deletingCurrent = currentCharacterId === id; const baseId = chars.find(c => c.id === id)?.baseCharacterId;
    set(STORAGE.characters, chars.filter(c => c.id !== id)); if (deletingCurrent && baseId) { currentCharacterId = baseId; loadCharacter(baseId); } renderTransformations(currentChar()); return;
  }
  const transfer = event.target.closest("[data-transfer-simple-item]");
  if (transfer) {
    saveCurrentCharacter();
    const from = currentChar(); if (!from) return;
    const targets = v39CampaignCharacters().filter(c => c.id !== from.id);
    if (!targets.length) return alert("Não há outro personagem na mesa para receber este item.");
    const menu = targets.map((c,i)=>`${i+1}. ${c.name}`).join("\n");
    const choice = Number(prompt(`Transferir para quem?\n${menu}`, "1")) - 1;
    const target = targets[choice]; if (!target) return;
    const item = v39RemoveItemFromCharacter(from.id, transfer.dataset.transferSimpleItem); if (!item) return alert("Item não encontrado.");
    v39AddItemToCharacter(target.id, item);
    addChat(`${from.name} transferiu ${item.name} para ${target.name}.`, "roll");
    loadCharacter(from.id); renderTableExperience(); return;
  }
  const dropBtn = event.target.closest("[data-drop-simple-item]");
  if (dropBtn) {
    if (!currentCampaignId) return alert("O drop funciona dentro de uma mesa.");
    saveCurrentCharacter(); const from = currentChar(); const item = v39RemoveItemFromCharacter(from.id, dropBtn.dataset.dropSimpleItem); if (!item) return;
    const drops = get(v39DropsKey(), []); drops.push({ ...v39CloneItem(item), id: uid("drop") }); set(v39DropsKey(), drops);
    addChat(`${from.name} colocou ${item.name} no drop da mesa.`, "roll"); loadCharacter(from.id); renderTableExperience(); return;
  }
  if (event.target.closest("#add-shop-item")) { const shop = get(v39ShopKey(), []); shop.push(v39ReadCommerceForm()); set(v39ShopKey(), shop); v39ClearCommerceForm(); v39RenderCommercePanel(); return; }
  if (event.target.closest("#add-drop-item")) { const drops = get(v39DropsKey(), []); drops.push({ ...v39ReadCommerceForm(), id: uid("drop") }); set(v39DropsKey(), drops); v39ClearCommerceForm(); v39RenderCommercePanel(); return; }
  const removeShop = event.target.closest("[data-remove-shop-item]");
  if (removeShop) { set(v39ShopKey(), get(v39ShopKey(), []).filter(i => i.id !== removeShop.dataset.removeShopItem)); v39RenderCommercePanel(); return; }
  const removeDrop = event.target.closest("[data-remove-drop-item]");
  if (removeDrop) { set(v39DropsKey(), get(v39DropsKey(), []).filter(i => i.id !== removeDrop.dataset.removeDropItem)); v39RenderCommercePanel(); return; }
  const sell = event.target.closest("[data-sell-shop-item]");
  if (sell) {
    const shop = get(v39ShopKey(), []); const item = shop.find(i => i.id === sell.dataset.sellShopItem); if (!item) return;
    const buyerId = document.querySelector(`[data-shop-buyer="${CSS.escape(item.id)}"]`)?.value; if (!buyerId) return alert("Escolha o comprador.");
    const chars = get(STORAGE.characters, []); const buyer = chars.find(c => c.id === buyerId); if (!buyer) return;
    const money = v39NumberMoney(buyer.money); if (money < v39NumberMoney(item.price)) return alert(`${buyer.name} não tem dinheiro suficiente.`);
    buyer.money = v39FormatMoney(money - v39NumberMoney(item.price)); buyer.inventoryItems = Array.isArray(buyer.inventoryItems) ? buyer.inventoryItems : []; buyer.inventoryItems.push(v39CloneItem(item)); buyer.weightCurrent = buyer.inventoryItems.reduce((s,it)=>s+(Number(it.weight)||0),0); set(STORAGE.characters, chars);
    addChat(`${buyer.name} comprou ${item.name} por ${v39FormatMoney(item.price)}.`, "roll"); if (currentCharacterId === buyer.id) loadCharacter(buyer.id); renderTableExperience(); return;
  }
  const send = event.target.closest("[data-send-shop-item]");
  if (send) {
    const shop = get(v39ShopKey(), []); const item = shop.find(i => i.id === send.dataset.sendShopItem); if (!item) return;
    const receiverId = document.querySelector(`[data-shop-buyer="${CSS.escape(item.id)}"]`)?.value; if (!receiverId) return alert("Escolha quem vai receber.");
    v39AddItemToCharacter(receiverId, item); const receiver = get(STORAGE.characters, []).find(c => c.id === receiverId); addChat(`Mestre enviou ${item.name} para ${receiver?.name || "personagem"}.`, "roll"); if (currentCharacterId === receiverId) loadCharacter(receiverId); renderTableExperience(); return;
  }
  const give = event.target.closest("[data-give-drop-item]");
  if (give) {
    const drops = get(v39DropsKey(), []); const item = drops.find(i => i.id === give.dataset.giveDropItem); if (!item) return;
    const receiverId = document.querySelector(`[data-drop-receiver="${CSS.escape(item.id)}"]`)?.value; if (!receiverId) return alert("Escolha quem vai receber.");
    v39AddItemToCharacter(receiverId, item); set(v39DropsKey(), drops.filter(i => i.id !== item.id)); const receiver = get(STORAGE.characters, []).find(c => c.id === receiverId); addChat(`${receiver?.name || "Personagem"} recebeu ${item.name} do drop.`, "roll"); if (currentCharacterId === receiverId) loadCharacter(receiverId); renderTableExperience(); return;
  }
});

setTimeout(() => { renderTransformations(currentChar()); v39RenderCommercePanel(); }, 100);

/* =========================
   V42 - Online real: login, fichas e mesas via servidor
========================= */
const OD42_SESSION_KEY = "od_online_session_v42";
let od42SaveTimer = null;
let od42Booted = false;

function od42SessionRaw() {
  return sessionStorage.getItem(OD42_SESSION_KEY) || localStorage.getItem(OD42_SESSION_KEY) || null;
}
function od42GetSession() {
  try { return JSON.parse(od42SessionRaw() || "null"); } catch (_) { return null; }
}
function od42SetSession(payload) {
  const remember = document.getElementById("remember-login")?.checked !== false;
  const value = JSON.stringify(payload || null);
  if (remember) {
    localStorage.setItem(OD42_SESSION_KEY, value);
    sessionStorage.removeItem(OD42_SESSION_KEY);
  } else {
    sessionStorage.setItem(OD42_SESSION_KEY, value);
    localStorage.removeItem(OD42_SESSION_KEY);
  }
}
function od42ClearSession() {
  localStorage.removeItem(OD42_SESSION_KEY);
  sessionStorage.removeItem(OD42_SESSION_KEY);
  clearSessionValue();
}
function od42Token() { return od42GetSession()?.token || ""; }
function od42Headers(extra = {}) {
  const headers = { ...extra };
  if (od42Token()) headers.Authorization = `Bearer ${od42Token()}`;
  return headers;
}
async function od42Api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: od42Headers({ "Content-Type": "application/json", ...(options.headers || {}) })
  });
  let data = null;
  try { data = await response.json(); } catch (_) { data = {}; }
  if (!response.ok) throw new Error(data?.error || `Erro HTTP ${response.status}`);
  return data;
}
function od42User(apiUser) {
  if (!apiUser) return null;
  return {
    id: apiUser.id,
    nick: apiUser.nick,
    realName: apiUser.real_name || apiUser.realName || apiUser.name || apiUser.nick,
    name: apiUser.real_name || apiUser.realName || apiUser.name || apiUser.nick
  };
}
function od42RoleFromApi(role) {
  if (role === "master") return "mestre";
  if (role === "player") return "jogador";
  if (role === "master_player") return "mestre_jogador";
  return role || "jogador";
}
function od42RoleToApi(role) {
  if (role === "mestre") return "master";
  if (role === "jogador") return "player";
  if (role === "mestre_jogador") return "master_player";
  return role;
}
function od42CharacterFromRow(row) {
  const data = row?.data || row?.character_data || {};
  const char = { ...createCharacter(row?.owner_id || row?.user_id || currentUser?.id, row?.name || row?.character_name || data.name || "Ficha"), ...data };
  char.id = row?.id || row?.character_id || data.id;
  char.ownerId = row?.owner_id || row?.user_id || data.ownerId || currentUser?.id;
  char.name = row?.name || row?.character_name || data.name || char.name;
  char.skills = char.skills || createCharacter(char.ownerId, char.name).skills;
  char.resistances = char.resistances || createCharacter(char.ownerId, char.name).resistances;
  char.inventoryItems = Array.isArray(char.inventoryItems) ? char.inventoryItems : [];
  char.spells = Array.isArray(char.spells) ? char.spells : [];
  char.abilities = Array.isArray(char.abilities) ? char.abilities : [];
  char.attacks = Array.isArray(char.attacks) ? char.attacks : [];
  return char;
}
function od42TableFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.invite_code || row.code,
    ownerId: row.owner_id || row.ownerId,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
    settings: row.settings || {}
  };
}
function od42MemberFromRow(row) {
  return {
    id: row.id,
    campaignId: row.table_id || row.campaignId || row.id,
    userId: row.user_id || row.userId,
    role: od42RoleFromApi(row.role),
    characterId: row.character_id || row.characterId || null
  };
}
function od42MergeById(storageKey, items) {
  const current = get(storageKey, []);
  const byId = new Map(current.map(item => [item.id, item]));
  items.filter(Boolean).forEach(item => byId.set(item.id, { ...(byId.get(item.id) || {}), ...item }));
  set(storageKey, [...byId.values()]);
}
async function od42RefreshOwnCharacters() {
  const data = await od42Api('/api/characters');
  const owned = (data.characters || []).map(od42CharacterFromRow).filter(c => c.id);
  const others = get(STORAGE.characters, []).filter(c => c.ownerId !== currentUser?.id);
  set(STORAGE.characters, [...others, ...owned]);
  return owned;
}
async function od42RefreshTables() {
  const data = await od42Api('/api/tables');
  const tables = (data.tables || []).map(od42TableFromRow).filter(t => t.id);
  const members = (data.tables || []).map(row => ({
    id: `${row.id}_${currentUser.id}`,
    campaignId: row.id,
    userId: currentUser.id,
    role: od42RoleFromApi(row.role),
    characterId: row.character_id || null
  }));
  setCampaigns(tables);
  setMembers(members);
  od42MergeById(STORAGE.users, [currentUser]);
  return { tables, members };
}
async function od42LoadTableState(tableId) {
  const data = await od42Api(`/api/tables/${tableId}/state`);
  const table = od42TableFromRow(data.table);
  const members = (data.members || []).map(od42MemberFromRow);
  const users = (data.members || []).map(row => od42User({ id: row.user_id, nick: row.nick, real_name: row.real_name, avatar_url: row.avatar_url })).filter(Boolean);
  const chars = (data.members || [])
    .filter(row => row.character_id && row.character_data)
    .map(row => od42CharacterFromRow({ id: row.character_id, owner_id: row.user_id, name: row.character_name, data: row.character_data }));

  const tables = getCampaigns().filter(c => c.id !== table.id);
  setCampaigns([table, ...tables]);
  const allMembers = getMembers().filter(m => m.campaignId !== table.id);
  setMembers([...allMembers, ...members]);
  od42MergeById(STORAGE.users, users);
  od42MergeById(STORAGE.characters, chars);
  return { table, members, users, chars };
}
async function od42Login(nick, password) {
  const data = await od42Api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ nick: normalizeNick(nick), password: String(password || '').trim() })
  });
  currentUser = od42User(data.user);
  od42SetSession({ token: data.token, user: currentUser });
  setSessionValue(currentUser.id);
  od42MergeById(STORAGE.users, [currentUser]);
  await od42RefreshOwnCharacters();
  await od42RefreshTables();
  showSessions();
}
async function od42Register() {
  const nick = normalizeNick(byId("register-nick")?.value);
  const realName = byId("register-real-name")?.value?.trim();
  const password = byId("register-password")?.value?.trim();
  const passwordConfirm = byId("register-password-confirm")?.value?.trim();
  if (!nick) return alert("Digite um nick/login.");
  if (!realName) return alert("Digite seu nome real.");
  if (!validSixDigitPassword(password)) return alert("A senha precisa ter exatamente 6 dígitos numéricos.");
  if (password !== passwordConfirm) return alert("As senhas não conferem.");
  const data = await od42Api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ nick, realName, password })
  });
  currentUser = od42User(data.user);
  od42SetSession({ token: data.token, user: currentUser });
  setSessionValue(currentUser.id);
  od42MergeById(STORAGE.users, [currentUser]);
  await od42RefreshOwnCharacters();
  await od42RefreshTables();
  showSessions();
}
async function od42CreateCharacter(name = "Novo Personagem") {
  const base = createCharacter(currentUser.id, name);
  const data = await od42Api('/api/characters', {
    method: 'POST',
    body: JSON.stringify({ name: base.name, data: base })
  });
  const char = od42CharacterFromRow(data.character);
  od42MergeById(STORAGE.characters, [char]);
  return char;
}
function od42ScheduleCharacterSave(char) {
  if (!char || char.ownerId !== currentUser?.id) return;
  clearTimeout(od42SaveTimer);
  od42SaveTimer = setTimeout(async () => {
    try {
      await od42Api(`/api/characters/${char.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: char.name || 'Ficha', data: char })
      });
    } catch (error) {
      console.warn('Falha ao salvar ficha online:', error);
    }
  }, 450);
}

// overrides principais
login = function(nick, password) {
  od42Login(nick, password).catch(error => alert(error.message || 'Erro ao entrar.'));
};

const od42OriginalSaveCurrentCharacter = saveCurrentCharacter;
saveCurrentCharacter = function() {
  od42OriginalSaveCurrentCharacter();
  const char = currentChar();
  od42ScheduleCharacterSave(char);
};

createAccountCharacter = function(openAfterCreate = true) {
  od42CreateCharacter("Novo Personagem").then(char => {
    currentCharacterId = char.id;
    renderAccountCharacterMenu();
    if (openAfterCreate) initAccountCharacterEditor(char.id);
  }).catch(error => alert(error.message || 'Erro ao criar ficha.'));
};

duplicateAccountCharacter = function(id) {
  const original = get(STORAGE.characters, []).find(c => c.id === id && c.ownerId === currentUser?.id);
  if (!original) return;
  const copy = structuredClone(original);
  copy.id = undefined;
  copy.name = `${original.name} Cópia`;
  copy.ownerId = currentUser.id;
  od42Api('/api/characters', { method: 'POST', body: JSON.stringify({ name: copy.name, data: copy }) })
    .then(data => {
      od42MergeById(STORAGE.characters, [od42CharacterFromRow(data.character)]);
      renderAccountCharacterMenu();
    })
    .catch(error => alert(error.message || 'Erro ao duplicar ficha.'));
};

deleteAccountCharacter = function(id) {
  const char = get(STORAGE.characters, []).find(c => c.id === id && c.ownerId === currentUser?.id);
  if (!char) return;
  if (!confirm(`Apagar a ficha "${char.name}"?`)) return;
  od42Api(`/api/characters/${id}`, { method: 'DELETE' })
    .then(async () => {
      set(STORAGE.characters, get(STORAGE.characters, []).filter(c => c.id !== id));
      setMembers(getMembers().map(m => m.characterId === id ? { ...m, characterId: null } : m));
      if (currentCharacterId === id) currentCharacterId = null;
      await od42RefreshTables();
      renderAccountCharacterMenu();
      renderCampaignMenu();
    })
    .catch(error => alert(error.message || 'Erro ao apagar ficha.'));
};

createCampaign = async function() {
  try {
    const name = byId("new-campaign-name")?.value?.trim() || "Nova Mesa";
    const data = await od42Api('/api/tables', { method: 'POST', body: JSON.stringify({ name }) });
    const table = od42TableFromRow(data.table);
    byId("new-campaign-name").value = "";
    await od42RefreshTables();
    renderCampaignMenu();
    alert(`Mesa criada! Código de convite: ${table.code}`);
  } catch (error) {
    alert(error.message || 'Erro ao criar mesa.');
  }
};

joinCampaignByCode = async function() {
  try {
    const code = (byId("join-campaign-code")?.value || "").trim().toUpperCase();
    if (code.length !== 5) return alert("Digite um código de 5 letras.");
    const data = await od42Api('/api/tables/join', { method: 'POST', body: JSON.stringify({ code }) });
    const table = od42TableFromRow(data.table);
    byId("join-campaign-code").value = "";
    await od42RefreshTables();
    await od42LoadTableState(table.id);
    renderCampaignMenu();
    openChooseCharacterModal(table.id);
  } catch (error) {
    alert(error.message || 'Erro ao entrar na mesa.');
  }
};

attachCharacterToCampaign = async function(campaignId, characterId) {
  try {
    await od42Api(`/api/tables/${campaignId}/member`, { method: 'PUT', body: JSON.stringify({ characterId }) });
    await od42RefreshTables();
    await od42LoadTableState(campaignId);
    byId("choose-character-modal")?.close();
    renderCampaignMenu();
    if (currentCampaignId === campaignId) initApp(campaignId);
  } catch (error) {
    alert(error.message || 'Erro ao vincular ficha.');
  }
};

createCharacterForCampaign = async function() {
  try {
    const char = await od42CreateCharacter("Novo Personagem");
    await attachCharacterToCampaign(pendingChooseCampaignId, char.id);
  } catch (error) {
    alert(error.message || 'Erro ao criar ficha.');
  }
};

enterCampaign = async function(campaignId) {
  try {
    await od42RefreshOwnCharacters();
    await od42RefreshTables();
    await od42LoadTableState(campaignId);
    const member = getMembers().find(m => m.campaignId === campaignId && m.userId === currentUser.id);
    if (!member) return alert("Você não faz parte desta mesa.");
    currentCampaignId = campaignId;
    set(STORAGE.activeCampaign, campaignId);
    initApp(campaignId);
  } catch (error) {
    alert(error.message || 'Erro ao abrir mesa.');
  }
};

deleteCampaign = async function(campaignId) {
  const campaign = getCampaigns().find(c => c.id === campaignId);
  if (!campaign) return;
  if (campaign.ownerId !== currentUser.id) return alert("Apenas o criador da mesa pode excluir esta mesa.");
  if (!confirm(`Excluir a mesa "${campaign.name}"?`)) return;
  try {
    await od42Api(`/api/tables/${campaignId}`, { method: 'DELETE' });
    await od42RefreshTables();
    if (currentCampaignId === campaignId) currentCampaignId = null;
    renderCampaignMenu();
  } catch (error) {
    alert(error.message || 'Erro ao excluir mesa.');
  }
};

leaveCampaign = async function(campaignId) {
  const campaign = getCampaigns().find(c => c.id === campaignId);
  if (!campaign) return;
  if (campaign.ownerId === currentUser.id) return deleteCampaign(campaignId);
  if (!confirm(`Sair da mesa "${campaign.name}"?`)) return;
  try {
    await od42Api(`/api/tables/${campaignId}/leave`, { method: 'DELETE' });
    await od42RefreshTables();
    if (currentCampaignId === campaignId) currentCampaignId = null;
    renderCampaignMenu();
  } catch (error) {
    alert(error.message || 'Erro ao sair da mesa.');
  }
};

function od42WireForms() {
  const loginForm = byId("login-form");
  if (loginForm) loginForm.onsubmit = e => { e.preventDefault(); login(byId("login-nick").value, byId("login-password").value); };
  const registerForm = byId("register-form");
  if (registerForm) registerForm.onsubmit = e => { e.preventDefault(); od42Register().catch(error => alert(error.message || 'Erro ao criar conta.')); };
  const sessionsLogout = byId("sessions-logout");
  if (sessionsLogout) sessionsLogout.onclick = () => { od42ClearSession(); currentUser = null; showAuth(); };
  const createBtn = byId("create-campaign-btn");
  if (createBtn) createBtn.onclick = event => { event.preventDefault(); createCampaign(); };
  const joinBtn = byId("join-campaign-btn");
  if (joinBtn) joinBtn.onclick = event => { event.preventDefault(); joinCampaignByCode(); };
}

async function od42Boot() {
  if (od42Booted) return;
  od42Booted = true;
  od42WireForms();
  const session = od42GetSession();
  if (!session?.token) return;
  try {
    const data = await od42Api('/api/auth/me');
    currentUser = od42User(data.user);
    od42SetSession({ token: session.token, user: currentUser });
    setSessionValue(currentUser.id);
    od42MergeById(STORAGE.users, [currentUser]);
    await od42RefreshOwnCharacters();
    await od42RefreshTables();
    const active = get(STORAGE.activeCampaign, null);
    if (active && getMembers().some(m => m.campaignId === active && m.userId === currentUser.id)) {
      await enterCampaign(active);
    } else {
      showSessions();
    }
  } catch (error) {
    console.warn('Sessão online inválida:', error);
    od42ClearSession();
    showAuth();
  }
}

setTimeout(() => {
  od42WireForms();
  od42Boot();
}, 50);

/* =========================
   V43 - Correção de eventos duplicados do modo online
   Impede que os handlers antigos/localStorage disparem junto com os handlers online.
========================= */
(function od43OnlineEventGuard(){
  if (window.__od43OnlineEventGuardInstalled) return;
  window.__od43OnlineEventGuardInstalled = true;

  async function safeRun(fn) {
    try { await fn(); }
    catch (error) { alert(error?.message || 'Erro na ação online.'); }
  }

  document.addEventListener('click', function(event) {
    const target = event.target;

    const createCampaignBtn = target.closest?.('#create-campaign-btn');
    if (createCampaignBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return safeRun(() => createCampaign());
    }

    const joinCampaignBtn = target.closest?.('#join-campaign-btn');
    if (joinCampaignBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return safeRun(() => joinCampaignByCode());
    }

    const enterCampaignBtn = target.closest?.('[data-enter-campaign]');
    if (enterCampaignBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return safeRun(() => enterCampaign(enterCampaignBtn.dataset.enterCampaign));
    }

    const chooseCampaignBtn = target.closest?.('[data-choose-campaign-char]');
    if (chooseCampaignBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return openChooseCharacterModal(chooseCampaignBtn.dataset.chooseCampaignChar);
    }

    const selectCharacterBtn = target.closest?.('[data-select-character-for-campaign]');
    if (selectCharacterBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return safeRun(() => attachCharacterToCampaign(pendingChooseCampaignId, selectCharacterBtn.dataset.selectCharacterForCampaign));
    }

    const deleteCampaignBtn = target.closest?.('[data-delete-campaign]');
    if (deleteCampaignBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return safeRun(() => deleteCampaign(deleteCampaignBtn.dataset.deleteCampaign));
    }

    const leaveCampaignBtn = target.closest?.('[data-leave-campaign]');
    if (leaveCampaignBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return safeRun(() => leaveCampaign(leaveCampaignBtn.dataset.leaveCampaign));
    }
  }, true);

  document.addEventListener('submit', function(event) {
    const loginForm = event.target.closest?.('#login-form');
    if (loginForm) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return safeRun(() => login(byId('login-nick').value, byId('login-password').value));
    }

    const registerForm = event.target.closest?.('#register-form');
    if (registerForm) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return safeRun(() => od42Register());
    }
  }, true);
})();

/* =========================
   V44 - Tempo real: Socket.IO, chats globais da mesa, PV/PE/condições e iniciativa sincronizados
========================= */
let od44Socket = null;
let od44ApplyingInitiative = false;
let od44PersistInitiativeTimer = null;

function od44OnlineReady() {
  return !!(typeof od42Token === 'function' && od42Token() && window.io);
}

function od44ApiMessageToLocal(row) {
  const users = get(STORAGE.users, []);
  const user = users.find(u => u.id === row.user_id || u.id === row.userId);
  const channel = row.channel || 'conversation';
  return {
    id: row.id || uid(channel === 'rolls' ? 'roll' : 'msg'),
    user: userDisplayName(user) || row.nick || row.real_name || 'Sistema',
    text: row.message || row.text || '',
    type: channel === 'rolls' ? 'roll' : 'msg',
    at: row.created_at ? new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : (row.at || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
  };
}

function od44StoreMessage(row) {
  if (!row) return;
  const local = od44ApiMessageToLocal(row);
  const key = (row.channel === 'rolls' || local.type === 'roll') ? v35RollChatKey() : campaignChatKey();
  const messages = get(key, []);
  if (messages.some(m => m.id === local.id)) return;
  messages.push(local);
  set(key, messages.slice(-200));
  renderChat();
}

async function od44LoadMessages(tableId = currentCampaignId) {
  if (!tableId || !od42Token()) return;
  try {
    const data = await od42Api(`/api/tables/${tableId}/messages`);
    const conversation = [];
    const rolls = [];
    (data.messages || []).forEach(row => {
      const local = od44ApiMessageToLocal(row);
      if (row.channel === 'rolls') rolls.push(local);
      else conversation.push(local);
    });
    set(`${STORAGE.chat}_${tableId}`, conversation.slice(-200));
    set(`${STORAGE.chat}_${tableId}_rolls`, rolls.slice(-200));
    renderChat();
  } catch (error) {
    console.warn('Falha ao carregar mensagens da mesa:', error);
  }
}

function od44EnsureSocket() {
  if (!od44OnlineReady()) return null;
  if (od44Socket && od44Socket.connected) return od44Socket;
  if (od44Socket) {
    try { od44Socket.disconnect(); } catch (_) {}
  }
  od44Socket = io({ auth: { token: od42Token() }, transports: ['websocket', 'polling'] });

  od44Socket.on('connect', () => {
    if (currentCampaignId) od44Socket.emit('table:join', { tableId: currentCampaignId });
  });

  od44Socket.on('message:created', payload => {
    if (!payload?.message) return;
    if (String(payload.tableId) !== String(currentCampaignId)) return;
    od44StoreMessage(payload.message);
  });

  od44Socket.on('character:updated', payload => {
    if (payload?.tableId && String(payload.tableId) !== String(currentCampaignId)) return;
    const char = od42CharacterFromRow(payload.character);
    if (!char?.id) return;
    od42MergeById(STORAGE.characters, [char]);
    if (currentCharacterId === char.id) loadCharacter(char.id);
    renderTableExperience();
  });

  od44Socket.on('character:deleted', payload => {
    if (payload?.tableId && String(payload.tableId) !== String(currentCampaignId)) return;
    if (!payload?.characterId) return;
    set(STORAGE.characters, get(STORAGE.characters, []).filter(c => c.id !== payload.characterId));
    renderTableExperience();
  });

  async function reloadTableLive() {
    if (!currentCampaignId) return;
    try {
      await od42LoadTableState(currentCampaignId);
      await od44LoadMessages(currentCampaignId);
      await od44LoadInitiative(currentCampaignId);
      renderTableExperience();
      renderCampaignMenu();
    } catch (error) {
      console.warn('Falha ao atualizar estado da mesa:', error);
    }
  }

  od44Socket.on('member:updated', reloadTableLive);
  od44Socket.on('table:updated', reloadTableLive);
  od44Socket.on('table:deleted', payload => {
    if (String(payload?.tableId) === String(currentCampaignId)) {
      currentCampaignId = null;
      showSessions();
      alert('Esta mesa foi excluída pelo mestre.');
    }
  });

  od44Socket.on('initiative:updated', payload => {
    if (payload?.tableId && String(payload.tableId) !== String(currentCampaignId)) return;
    od44ApplyingInitiative = true;
    try {
      set(v35InitiativeKey(), payload.initiative || { active: false, round: 1, entries: [] });
      renderInitiativePanel();
    } finally {
      od44ApplyingInitiative = false;
    }
  });

  od44Socket.on('connect_error', error => console.warn('Socket.IO:', error?.message || error));
  return od44Socket;
}

async function od44JoinTable(tableId = currentCampaignId) {
  if (!tableId) return;
  od44EnsureSocket();
  if (od44Socket?.connected) od44Socket.emit('table:join', { tableId });
  await od44LoadMessages(tableId);
  await od44LoadInitiative(tableId);
}

async function od44LoadInitiative(tableId = currentCampaignId) {
  if (!tableId || !od42Token()) return;
  try {
    const data = await od42Api(`/api/tables/${tableId}/initiative`);
    od44ApplyingInitiative = true;
    set(v35InitiativeKey(), data.initiative || { active: false, round: 1, entries: [] });
    renderInitiativePanel();
  } catch (error) {
    console.warn('Falha ao carregar iniciativa:', error);
  } finally {
    od44ApplyingInitiative = false;
  }
}

async function od44PersistInitiativeNow(state = get(v35InitiativeKey(), { active: false, round: 1, entries: [] })) {
  if (!currentCampaignId || !od42Token() || od44ApplyingInitiative) return;
  try {
    await od42Api(`/api/tables/${currentCampaignId}/initiative`, {
      method: 'PUT',
      body: JSON.stringify({ initiative: state })
    });
  } catch (error) {
    console.warn('Falha ao salvar iniciativa online:', error);
  }
}

const od44OriginalAddChat = addChat;
addChat = function(text, type = 'msg') {
  const message = String(text || '').trim();
  if (!message) return;
  if (currentCampaignId && od42Token()) {
    const channel = type === 'roll' ? 'rolls' : 'conversation';
    od42Api(`/api/tables/${currentCampaignId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ channel, message, characterId: currentMembership()?.characterId || null })
    }).catch(error => {
      console.warn('Falha ao enviar mensagem online:', error);
      od44OriginalAddChat(message, type);
    });
    return;
  }
  od44OriginalAddChat(message, type);
};

const od44OriginalSetInitiativeState = setInitiativeState;
setInitiativeState = function(state) {
  od44OriginalSetInitiativeState(state);
  renderInitiativePanel();
  if (currentCampaignId && od42Token() && !od44ApplyingInitiative) {
    clearTimeout(od44PersistInitiativeTimer);
    od44PersistInitiativeTimer = setTimeout(() => od44PersistInitiativeNow(state), 120);
  }
};

async function od44SaveCharacterOnline(char) {
  if (!char?.id || !od42Token()) return;
  if (char.ownerId === currentUser?.id) {
    await od42Api(`/api/characters/${char.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: char.name || 'Ficha', data: char })
    });
    return;
  }
  if (currentCampaignId && v35IsMaster()) {
    await od42Api(`/api/tables/${currentCampaignId}/characters/${char.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: char.name || 'Ficha', data: char })
    });
  }
}

const od44OriginalV35UpdateCharacter = v35UpdateCharacter;
v35UpdateCharacter = function(charId, mutator, logText = '') {
  const chars = get(STORAGE.characters, []);
  const index = chars.findIndex(c => c.id === charId);
  if (index < 0) return;
  mutator(chars[index]);
  const updated = chars[index];
  set(STORAGE.characters, chars);
  if (currentCharacterId === charId) loadCharacter(charId);
  renderTableExperience();
  od44SaveCharacterOnline(updated).catch(error => console.warn('Falha ao salvar alteração rápida:', error));
  if (logText) addChat(logText, 'roll');
};

const od44OriginalSaveCurrentCharacter = saveCurrentCharacter;
saveCurrentCharacter = function() {
  od44OriginalSaveCurrentCharacter();
  const char = currentChar();
  if (char?.id) od44SaveCharacterOnline(char).catch(error => console.warn('Falha ao salvar ficha online:', error));
};

const od44OriginalEnterCampaign = enterCampaign;
enterCampaign = async function(campaignId) {
  await od44OriginalEnterCampaign(campaignId);
  await od44JoinTable(campaignId);
  renderTableExperience();
};

const od44OriginalOd42Login = od42Login;
od42Login = async function(nick, password) {
  await od44OriginalOd42Login(nick, password);
  od44EnsureSocket();
};

const od44OriginalOd42Register = od42Register;
od42Register = async function() {
  await od44OriginalOd42Register();
  od44EnsureSocket();
};

const od44OriginalOd42Boot = od42Boot;
od42Boot = async function() {
  await od44OriginalOd42Boot();
  od44EnsureSocket();
  if (currentCampaignId) await od44JoinTable(currentCampaignId);
};

setTimeout(() => {
  od44EnsureSocket();
  if (currentCampaignId) od44JoinTable(currentCampaignId);
}, 300);

/* =========================
   V45 - ajustes de interface solicitados
========================= */
// Remove o painel antigo de backup/importação/exportação e impede reinjeção.
try {
  const oldTools = document.getElementById('account-tools-panel');
  if (oldTools) oldTools.remove();
} catch (_) {}
v35InjectAccountTools = function() {
  const oldTools = document.getElementById('account-tools-panel');
  if (oldTools) oldTools.remove();
};

function od45SyncMasterDockButton() {
  const btn = document.getElementById('master-dashboard-dock-btn');
  if (!btn) return;
  const shouldShow = document.body.classList.contains('master-dashboard-mode') && document.body.classList.contains('master-sheet-open');
  btn.classList.toggle('hidden', !shouldShow);
}

const od45PreviousRenderTableExperience = renderTableExperience;
renderTableExperience = function() {
  od45PreviousRenderTableExperience();
  od45SyncMasterDockButton();
};

// Reforça o card da mesa abaixo do botão dos três traços.
const od45PreviousRenderCampaignMiniCard = renderCampaignMiniCard;
renderCampaignMiniCard = function() {
  od45PreviousRenderCampaignMiniCard();
  const box = document.getElementById('campaign-mini-card');
  if (box && !box.classList.contains('hidden')) {
    box.setAttribute('aria-label', 'Informações da mesa atual');
  }
};

// Eventos de minimizar chats e voltar ao painel do mestre pelo ícone.
document.addEventListener('click', event => {
  const dock = event.target.closest('#master-dashboard-dock-btn');
  if (dock) {
    event.preventDefault();
    saveCurrentCharacter();
    document.body.classList.remove('master-sheet-open');
    renderTableExperience();
    document.getElementById('master-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const chatToggle = event.target.closest('[data-toggle-chat]');
  if (chatToggle) {
    event.preventDefault();
    const id = chatToggle.getAttribute('data-toggle-chat');
    const box = document.getElementById(id);
    if (!box) return;
    box.classList.toggle('chat-collapsed');
    chatToggle.textContent = box.classList.contains('chat-collapsed') ? '+' : '—';
  }
});

setTimeout(() => {
  v35InjectAccountTools();
  od45SyncMasterDockButton();
}, 100);


/* =========================
   V46 - Sidebar de jogadores minimizável
========================= */
function od46SyncSidebarDockButton() {
  const dock = document.getElementById('sidebar-dock-btn');
  const toggle = document.getElementById('sidebar-toggle-btn');
  if (!dock) return;
  const mobile = window.innerWidth <= 860;
  const collapsed = document.body.classList.contains('sidebar-collapsed');
  dock.classList.toggle('hidden', mobile || !collapsed);
  if (toggle) toggle.textContent = collapsed ? '+' : '—';
}

function od46SetSidebarCollapsed(nextState) {
  if (window.innerWidth <= 860) {
    document.body.classList.remove('sidebar-collapsed');
    od46SyncSidebarDockButton();
    return;
  }
  document.body.classList.toggle('sidebar-collapsed', !!nextState);
  od46SyncSidebarDockButton();
}

document.addEventListener('click', event => {
  const sidebarToggle = event.target.closest('#sidebar-toggle-btn');
  if (sidebarToggle) {
    event.preventDefault();
    od46SetSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
    return;
  }

  const sidebarDock = event.target.closest('#sidebar-dock-btn');
  if (sidebarDock) {
    event.preventDefault();
    od46SetSidebarCollapsed(false);
    document.getElementById('players-sidebar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
});

window.addEventListener('resize', od46SyncSidebarDockButton);
setTimeout(od46SyncSidebarDockButton, 120);


/* =========================
   V50 - UX de sessões, conta, chat com avatar e ajustes pedidos
========================= */
(function od50Patch(){
  let od50PendingNoSheetCampaignId = null;
  let od50PendingAvatarDataUrl = '';

  function od50DefaultAvatar() {
    return (currentUser && (currentUser.avatar || currentUser.avatarUrl)) || 'assets/logo.jpg';
  }

  function od50MergeCurrentUser(nextUser) {
    if (!nextUser) return;
    currentUser = { ...(currentUser || {}), ...nextUser };
    const users = get(STORAGE.users, []).map(user => user.id === currentUser.id ? { ...user, ...currentUser } : user);
    if (!users.some(user => user.id === currentUser.id)) users.push(currentUser);
    set(STORAGE.users, users);
    if (typeof od42SetSession === 'function' && od42Token && od42Token()) {
      const payload = od42GetSession() || {};
      od42SetSession({ ...payload, user: currentUser });
    }
    renderCampaignMenu();
    renderAccountCharacterMenu();
    renderChat();
    const label = document.getElementById('current-user-label');
    if (label && (document.getElementById('sessions-screen')?.classList.contains('active') || document.getElementById('app-screen')?.classList.contains('active'))) {
      label.textContent = label.textContent.includes('•') ? `${userDisplayName(currentUser)} • ${label.textContent.split('•').slice(1).join('•').trim()}` : userDisplayName(currentUser);
    }
  }

  function od50CloseSessionsMenu() {
    document.getElementById('sessions-menu-panel')?.classList.add('hidden');
    const btn = document.getElementById('sessions-menu-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function od50ToggleAccountPanel(force = null) {
    const panel = document.getElementById('account-sheets-panel');
    if (!panel) return;
    const nextOpen = force === null ? panel.classList.contains('hidden') : !!force;
    panel.classList.toggle('hidden', !nextOpen);
    panel.classList.toggle('collapsed-account-panel', !nextOpen);
    const toggle = document.getElementById('toggle-account-panel-btn');
    if (toggle) toggle.textContent = nextOpen ? 'Ocultar Minhas Fichas' : 'Minhas Fichas';
  }

  function od50OpenAccountSettings() {
    if (!currentUser) return;
    document.getElementById('account-settings-real-name').value = currentUser.realName || currentUser.name || '';
    document.getElementById('account-settings-nick').value = currentUser.nick || '';
    document.getElementById('account-settings-password').value = '';
    document.getElementById('account-settings-password-confirm').value = '';
    document.getElementById('account-settings-avatar-file').value = '';
    od50PendingAvatarDataUrl = currentUser.avatar || currentUser.avatarUrl || '';
    const preview = document.getElementById('account-settings-avatar-preview');
    if (preview) preview.src = od50PendingAvatarDataUrl || 'assets/logo.jpg';
    document.getElementById('account-settings-modal')?.showModal();
    od50CloseSessionsMenu();
  }

  async function od50SaveAccountSettings() {
    if (!currentUser) return;
    const realName = document.getElementById('account-settings-real-name')?.value?.trim();
    const nick = normalizeNick(document.getElementById('account-settings-nick')?.value);
    const password = document.getElementById('account-settings-password')?.value?.trim() || '';
    const confirmPassword = document.getElementById('account-settings-password-confirm')?.value?.trim() || '';
    if (!realName) return alert('Digite o nome da conta.');
    if (!nick) return alert('Digite o login da conta.');
    if (password || confirmPassword) {
      if (!validSixDigitPassword(password)) return alert('A nova senha precisa ter exatamente 6 dígitos.');
      if (password !== confirmPassword) return alert('As senhas não conferem.');
    }
    const avatar = od50PendingAvatarDataUrl || currentUser.avatar || currentUser.avatarUrl || '';

    if (typeof od42Token === 'function' && od42Token()) {
      try {
        const data = await od42Api('/api/auth/me', {
          method: 'PUT',
          body: JSON.stringify({ nick, realName, password: password || undefined, avatarUrl: avatar || '' })
        });
        const user = od42User(data.user);
        od50MergeCurrentUser(user);
      } catch (error) {
        return alert(error.message || 'Erro ao salvar a conta.');
      }
    } else {
      const users = get(STORAGE.users, []);
      if (users.some(user => user.id !== currentUser.id && normalizeNick(user.nick || user.name) === nick)) return alert('Esse login já está em uso.');
      const updated = { ...currentUser, realName, name: realName, nick, avatar, avatarUrl: avatar };
      if (password) updated.password = password;
      od50MergeCurrentUser(updated);
    }

    document.getElementById('account-settings-modal')?.close();
  }

  function od50OpenNoSheetPrompt(campaignId) {
    od50PendingNoSheetCampaignId = campaignId;
    document.getElementById('create-first-sheet-modal')?.showModal();
  }

  function od50ShouldPromptNoSheet(campaignId = pendingChooseCampaignId || currentCampaignId) {
    const chars = userCharacters();
    if (chars.length) return false;
    od50OpenNoSheetPrompt(campaignId);
    return true;
  }

  function od50AttachFirstCharacterToCampaign(campaignId, charId) {
    if (!campaignId || !charId) return;
    return attachCharacterToCampaign(campaignId, charId);
  }

  const od50OriginalShowSessions = showSessions;
  showSessions = function() {
    od50OriginalShowSessions();
    od50CloseSessionsMenu();
    od50ToggleAccountPanel(false);
  };

  const od50OriginalRenderCampaignMenu = renderCampaignMenu;
  renderCampaignMenu = function() {
    od50OriginalRenderCampaignMenu();
    const cards = document.querySelectorAll('#campaign-list .campaign-card');
    cards.forEach(card => {
      const leaveBtn = card.querySelector('[data-leave-campaign]');
      if (leaveBtn) leaveBtn.textContent = 'Sair da Mesa';
    });
  };

  const od50OriginalOpenChooseCharacterModal = openChooseCharacterModal;
  openChooseCharacterModal = function(campaignId = currentCampaignId) {
    pendingChooseCampaignId = campaignId;
    if (od50ShouldPromptNoSheet(campaignId)) return;
    od50OriginalOpenChooseCharacterModal(campaignId);
  };

  const od50OriginalEnterCampaign = enterCampaign;
  enterCampaign = async function(campaignId) {
    const member = getMembers().find(m => m.campaignId === campaignId && m.userId === currentUser?.id);
    if (member && !member.characterId && !userCharacters().length) {
      od50OpenNoSheetPrompt(campaignId);
      return;
    }
    return od50OriginalEnterCampaign(campaignId);
  };

  createCharacterForCampaign = async function() {
    try {
      const chars = userCharacters();
      if (!chars.length && pendingChooseCampaignId) {
        const char = (typeof od42Token === 'function' && od42Token()) ? await od42CreateCharacter('Novo Personagem') : createCharacter(currentUser.id, 'Novo Personagem');
        if (!(typeof od42Token === 'function' && od42Token())) {
          const all = get(STORAGE.characters, []); all.push(char); set(STORAGE.characters, all);
        }
        od50PendingNoSheetCampaignId = pendingChooseCampaignId;
        return od50AttachFirstCharacterToCampaign(pendingChooseCampaignId, char.id);
      }
      if (typeof od42Token === 'function' && od42Token()) {
        const char = await od42CreateCharacter('Novo Personagem');
        await attachCharacterToCampaign(pendingChooseCampaignId, char.id);
        return;
      }
      const list = get(STORAGE.characters, []);
      const char = createCharacter(currentUser.id, 'Novo Personagem');
      list.push(char);
      set(STORAGE.characters, list);
      attachCharacterToCampaign(pendingChooseCampaignId, char.id);
    } catch (error) {
      alert(error.message || 'Erro ao criar ficha.');
    }
  };

  createCampaign = async function() {
    if (typeof od42Token === 'function' && od42Token()) {
      try {
        const name = document.getElementById('new-campaign-name')?.value?.trim() || 'Nova Mesa';
        await od42Api('/api/tables', { method: 'POST', body: JSON.stringify({ name }) });
        document.getElementById('new-campaign-name').value = '';
        await od42RefreshTables();
        renderCampaignMenu();
      } catch (error) {
        alert(error.message || 'Erro ao criar mesa.');
      }
      return;
    }
    const name = document.getElementById('new-campaign-name')?.value?.trim() || 'Nova Mesa';
    const campaigns = getCampaigns();
    const campaign = { id: uid('camp'), name, code: generateInviteCode(), ownerId: currentUser.id, createdAt: Date.now() };
    campaigns.push(campaign);
    setCampaigns(campaigns);
    const members = getMembers();
    members.push({ id: uid('member'), campaignId: campaign.id, userId: currentUser.id, role: 'mestre', characterId: null });
    setMembers(members);
    document.getElementById('new-campaign-name').value = '';
    renderCampaignMenu();
  };

  deleteAccountCharacter = function(id) {
    const chars = get(STORAGE.characters, []);
    const char = chars.find(c => c.id === id && c.ownerId === currentUser?.id);
    if (!char) return;
    if (!confirm(`Tem certeza que quer excluir a ficha "${char.name}"?`)) return;
    set(STORAGE.characters, chars.filter(c => c.id !== id));
    const members = getMembers().map(m => m.characterId === id ? { ...m, characterId: null } : m);
    setMembers(members);
    if (currentCharacterId === id) currentCharacterId = null;
    renderAccountCharacterMenu();
  };

  deleteCampaign = function(campaignId) {
    const campaigns = getCampaigns();
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;
    if (campaign.ownerId !== currentUser.id) return alert('Apenas o criador da mesa pode excluir esta mesa.');
    if (!confirm(`Tem certeza que quer excluir a mesa "${campaign.name}"?`)) return;
    if (typeof od42Token === 'function' && od42Token()) {
      return od42Api(`/api/tables/${campaignId}`, { method: 'DELETE' })
        .then(async () => { await od42RefreshTables(); if (currentCampaignId === campaignId) currentCampaignId = null; renderCampaignMenu(); })
        .catch(error => alert(error.message || 'Erro ao excluir mesa.'));
    }
    setCampaigns(campaigns.filter(c => c.id !== campaignId));
    setMembers(getMembers().filter(m => m.campaignId !== campaignId));
    try {
      localStorage.removeItem(`od_chat_${campaignId}`);
      localStorage.removeItem(`od_chat_roll_${campaignId}`);
      localStorage.removeItem(`od_initiative_${campaignId}`);
      localStorage.removeItem(`od_combat_${campaignId}`);
      localStorage.removeItem(`od_shop_${campaignId}`);
      localStorage.removeItem(`od_drops_${campaignId}`);
    } catch (err) {}
    if (currentCampaignId === campaignId) {
      currentCampaignId = null;
      localStorage.removeItem(STORAGE.activeCampaign);
    }
    renderCampaignMenu();
  };

  leaveCampaign = function(campaignId) {
    const campaign = getCampaigns().find(c => c.id === campaignId);
    if (!campaign) return;
    if (campaign.ownerId === currentUser.id) return deleteCampaign(campaignId);
    if (!confirm(`Tem certeza que quer sair da mesa "${campaign.name}"?`)) return;
    if (typeof od42Token === 'function' && od42Token()) {
      return od42Api(`/api/tables/${campaignId}/leave`, { method: 'DELETE' })
        .then(async () => { await od42RefreshTables(); if (currentCampaignId === campaignId) currentCampaignId = null; renderCampaignMenu(); })
        .catch(error => alert(error.message || 'Erro ao sair da mesa.'));
    }
    const members = getMembers().filter(m => !(m.campaignId === campaignId && m.userId === currentUser.id));
    setMembers(members);
    if (currentCampaignId === campaignId) currentCampaignId = null;
    renderCampaignMenu();
  };

  const od50OriginalOd42User = od42User;
  od42User = function(apiUser) {
    const user = od50OriginalOd42User(apiUser);
    if (!user) return null;
    user.avatar = apiUser.avatar_url || apiUser.avatarUrl || apiUser.avatar || user.avatar || '';
    user.avatarUrl = user.avatar;
    return user;
  };

  const od50OriginalApiMessageToLocal = od44ApiMessageToLocal;
  od44ApiMessageToLocal = function(row) {
    const local = od50OriginalApiMessageToLocal(row);
    local.userId = row.user_id || row.userId || local.userId || null;
    return local;
  };

  const od50OriginalAddChat = addChat;
  addChat = function(text, type = 'msg') {
    const key = type === 'roll' ? v35RollChatKey() : campaignChatKey();
    const chat = get(key, []);
    chat.push({
      id: uid(type === 'roll' ? 'roll' : 'msg'),
      user: userDisplayName(currentUser),
      userId: currentUser?.id || null,
      text,
      type,
      at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    set(key, chat.slice(-140));
    renderChat();
  };

  renderChat = function() {
    const renderList = (targetId, messages) => {
      const log = document.getElementById(targetId);
      if (!log) return;
      log.innerHTML = '';
      messages.forEach(msg => {
        const user = get(STORAGE.users, []).find(entry => entry.id === msg.userId) || null;
        const div = document.createElement('div');
        div.className = `chat-msg ${msg.type === 'roll' ? 'roll' : ''}`;
        div.innerHTML = `
          <img class="chat-msg-avatar" src="${escapeHtml((user && (user.avatar || user.avatarUrl)) || 'assets/logo.jpg')}" alt="" />
          <div class="chat-msg-main">
            <small>${escapeHtml(msg.user)} • ${escapeHtml(msg.at)}</small>
            <div class="chat-msg-text">${escapeHtml(msg.text)}</div>
          </div>`;
        log.appendChild(div);
      });
      log.scrollTop = log.scrollHeight;
    };
    renderList('chat-log', get(campaignChatKey(), []));
    renderList('roll-chat-log', get(v35RollChatKey(), []));
  };

  document.addEventListener('click', async event => {
    const menuBtn = event.target.closest('#sessions-menu-btn');
    if (menuBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const panel = document.getElementById('sessions-menu-panel');
      const willOpen = panel?.classList.contains('hidden');
      panel?.classList.toggle('hidden');
      menuBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      return;
    }
    if (!event.target.closest('#sessions-menu-panel')) od50CloseSessionsMenu();

    const togglePanel = event.target.closest('#toggle-account-panel-btn');
    if (togglePanel) {
      event.preventDefault();
      event.stopImmediatePropagation();
      od50ToggleAccountPanel();
      return;
    }

    const accountSettingsBtn = event.target.closest('#open-account-settings-btn');
    if (accountSettingsBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      od50OpenAccountSettings();
      return;
    }

    const saveSettingsBtn = event.target.closest('#save-account-settings-btn');
    if (saveSettingsBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await od50SaveAccountSettings();
      return;
    }

    const logoutBtn = event.target.closest('#sessions-logout');
    if (logoutBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!confirm('Tem certeza que quer sair da conta?')) return;
      if (typeof od42ClearSession === 'function' && od42Token && od42Token()) od42ClearSession();
      clearSessionValue();
      currentUser = null;
      od50CloseSessionsMenu();
      showAuth();
      return;
    }

    const createFirst = event.target.closest('#confirm-create-first-sheet');
    if (createFirst) {
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingChooseCampaignId = od50PendingNoSheetCampaignId;
      document.getElementById('create-first-sheet-modal')?.close();
      await createCharacterForCampaign();
      return;
    }
  }, true);

  document.getElementById('cancel-create-first-sheet')?.addEventListener('click', () => {
    od50PendingNoSheetCampaignId = null;
  });

  document.getElementById('account-settings-avatar-file')?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      od50PendingAvatarDataUrl = String(reader.result || '');
      const preview = document.getElementById('account-settings-avatar-preview');
      if (preview) preview.src = od50PendingAvatarDataUrl || 'assets/logo.jpg';
    };
    reader.readAsDataURL(file);
  });

  const od50OriginalWireForms = od42WireForms;
  od42WireForms = function() {
    od50OriginalWireForms();
    const sessionsLogout = document.getElementById('sessions-logout');
    if (sessionsLogout) sessionsLogout.onclick = null;
  };

  setTimeout(() => {
    od50ToggleAccountPanel(false);
    renderChat();
  }, 60);
})();


/* =========================
   V51 - painel mestre, histórico curto e navegação mobile
========================= */
(function od51Patch(){
  function od51HistoryKey() { return currentCampaignId ? `od_session_history_${currentCampaignId}` : 'od_session_history'; }
  function od51History(text, kind = 'info') {
    if (!text || !currentCampaignId) return;
    const list = get(od51HistoryKey(), []);
    list.push({ id: uid('hist'), text: String(text), kind, at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
    set(od51HistoryKey(), list.slice(-25));
    od51RenderHistory();
  }
  function od51RenderHistory() {
    const box = document.getElementById('session-history-list');
    if (!box) return;
    const list = get(od51HistoryKey(), []).slice(-8).reverse();
    if (!currentCampaignId) { box.innerHTML = '<div class="campaign-empty">Entre em uma mesa para ver o histórico.</div>'; return; }
    if (!list.length) { box.innerHTML = '<div class="campaign-empty">Sem eventos recentes.</div>'; return; }
    box.innerHTML = list.map(item => `<div class="session-history-item"><small>${escapeHtml(item.at)}</small>${escapeHtml(item.text)}</div>`).join('');
  }
  window.od51History = od51History;

  const od51AddChatBase = addChat;
  addChat = function(text, type = 'msg') {
    od51AddChatBase(text, type);
    if (type === 'roll') od51History(text, 'roll');
  };

  renderMasterDashboard = function() {
    const panel = byId('master-dashboard');
    const grid = byId('master-characters-grid');
    if (!panel || !grid) return;
    const master = v35IsMaster();
    panel.classList.toggle('hidden', !master);
    document.body.classList.toggle('master-dashboard-mode', master);
    if (!master) return;

    const chars = charactersInCurrentCampaign();
    const users = get(STORAGE.users, []);
    const members = getMembers().filter(m => m.campaignId === currentCampaignId);
    grid.innerHTML = '';
    if (!chars.length) grid.innerHTML = `<div class="campaign-empty">Nenhum jogador vinculou ficha nesta mesa ainda.</div>`;

    chars.forEach(char => {
      const member = members.find(m => m.characterId === char.id);
      const user = users.find(u => u.id === member?.userId);
      const card = document.createElement('article');
      card.className = 'master-character-card v51-master-card';
      card.innerHTML = `
        <div class="master-card-top">
          <img src="${escapeHtml(char.portrait || 'assets/favicon.png')}" alt="" />
          <div>
            <small>Jogador: ${escapeHtml(userDisplayName(user))}</small>
            <strong>${escapeHtml(char.name || 'Personagem')}</strong>
            <span>${escapeHtml(char.race || 'Raça')} • ${escapeHtml(char.className || 'Classe')} • Nv. ${escapeHtml(char.level || 1)}</span>
          </div>
          <span class="v51-online-chip">Na mesa</span>
        </div>
        <div class="master-quick-grid v51-quick-grid">
          <div class="quick-vital">
            <label>PV</label>
            <div class="quick-vital-row">
              <button type="button" data-quick-resource="pv" data-quick-delta="-5" data-char-id="${char.id}">−5</button>
              <input data-quick-input="pv" data-char-id="${char.id}" value="${escapeHtml(char.pvCurrent ?? 0)}" type="number" />
              <button type="button" data-quick-resource="pv" data-quick-delta="5" data-char-id="${char.id}">+5</button>
            </div>
            <small>Máx: ${escapeHtml(char.pvMax ?? 0)}</small>
          </div>
          <div class="quick-vital">
            <label>PE</label>
            <div class="quick-vital-row">
              <button type="button" data-quick-resource="pe" data-quick-delta="-1" data-char-id="${char.id}">−1</button>
              <input data-quick-input="pe" data-char-id="${char.id}" value="${escapeHtml(char.peCurrent ?? 0)}" type="number" />
              <button type="button" data-quick-resource="pe" data-quick-delta="1" data-char-id="${char.id}">+1</button>
            </div>
            <small>Máx: ${escapeHtml(char.peMax ?? 0)}</small>
          </div>
        </div>
        <div class="master-condition-box">
          <label>Condição</label>
          <input class="master-condition-input" data-condition-input="${char.id}" value="${escapeHtml(v35CharCondition(char) === 'Normal' ? '' : v35CharCondition(char))}" placeholder="Normal, Caído, Ferido..." />
        </div>
        <div class="master-card-actions">
          <button class="primary-btn small" type="button" data-open-master-char="${char.id}">Abrir Ficha</button>
          <button class="ghost-btn small" type="button" data-quick-resource="pv" data-quick-delta="-1" data-char-id="${char.id}">-1 PV</button>
          <button class="ghost-btn small" type="button" data-quick-resource="pv" data-quick-delta="1" data-char-id="${char.id}">+1 PV</button>
          <button class="ghost-btn small" type="button" data-condition-preset="Normal" data-char-id="${char.id}">Normal</button>
        </div>`;
      grid.appendChild(card);
    });
    renderInitiativePanel();
    od51RenderHistory();
  };

  const od51TableExperienceBase = renderTableExperience;
  renderTableExperience = function() {
    od51TableExperienceBase();
    od51RenderHistory();
  };

  document.addEventListener('click', event => {
    const mobileTab = event.target.closest('[data-mobile-tab]');
    if (mobileTab) {
      event.preventDefault();
      document.querySelector(`[data-tab="${mobileTab.dataset.mobileTab}"]`)?.click();
      document.querySelector('.sheet-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const mobileJump = event.target.closest('[data-mobile-jump]');
    if (mobileJump) {
      event.preventDefault();
      document.querySelector(mobileJump.dataset.mobileJump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const preset = event.target.closest('[data-condition-preset]');
    if (preset) {
      event.preventDefault();
      const charId = preset.dataset.charId;
      v35UpdateCharacter(charId, char => {
        char.condition = preset.dataset.conditionPreset || 'Normal';
        char.conditionsText = char.condition;
      }, `${preset.dataset.conditionPreset || 'Normal'} aplicado em personagem.`);
    }
  });

  const od51QuickBase = v35UpdateCharacter;
  v35UpdateCharacter = function(charId, mutator, logText = '') {
    od51QuickBase(charId, mutator, logText);
    if (logText) od51History(logText, 'resource');
  };

  setTimeout(od51RenderHistory, 150);
})();


/* =========================
   V52 - ajustes finais: menu, sons, rolagens, perícias e remover ficha da mesa
========================= */
(function od52Patch(){
  const DICE_SYMBOLS = { 4: '△4', 6: '□6', 8: '◇8', 10: '◆10', 12: '⬟12', 20: '⬢20', 100: '⬡100' };
  let audioCtx = null;

  function od52DiceSymbol(sides) { return DICE_SYMBOLS[Number(sides)] || `◇${Number(sides) || ''}`; }
  function od52DiceText(qty, sides, mod = 0) {
    return `${Number(qty || 1)}${od52DiceSymbol(sides)}${Number(mod) ? formatMod(Number(mod)) : ''}`;
  }
  function od52DiceHtml(qty, sides, mod = 0) {
    return `${Number(qty || 1)}<span class="dice-symbol">${escapeHtml(od52DiceSymbol(sides))}</span>${Number(mod) ? formatMod(Number(mod)) : ''}`;
  }
  function od52PlaySound(kind = 'click') {
    const st = get(STORAGE.settings, { sound: true });
    if (st.sound === false) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = kind === 'roll' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(kind === 'roll' ? 170 : 520, now);
      if (kind === 'roll') osc.frequency.exponentialRampToValueAtTime(95, now + 0.11);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === 'roll' ? 0.045 : 0.025, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'roll' ? 0.16 : 0.055));
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now); osc.stop(now + (kind === 'roll' ? 0.17 : 0.06));
    } catch (_) {}
  }

  const od52ApplySettingsBase = applySettings;
  applySettings = function() {
    od52ApplySettingsBase();
    const st = get(STORAGE.settings, { theme: 'light', accent: 'black', skillsCompact: true, font: 'impact', sound: true });
    const sTheme = document.getElementById('sessions-theme-toggle');
    const sAccent = document.getElementById('sessions-accent-select');
    const sFont = document.getElementById('sessions-font-select');
    if (sTheme) sTheme.textContent = st.theme === 'dark' ? 'Tema Claro' : 'Tema Escuro';
    if (sAccent) sAccent.value = st.accent || 'black';
    if (sFont) sFont.value = st.font || 'impact';
  };

  function od52ApplyDiceLabels() {
    document.querySelectorAll('#dice-type option').forEach(opt => {
      opt.textContent = od52DiceSymbol(opt.value);
    });
    document.querySelectorAll('.roll-skill').forEach(btn => { btn.textContent = od52DiceSymbol(20); });
  }

  const od52RenderSkillsBase = renderSkills;
  renderSkills = function(char) {
    od52RenderSkillsBase(char);
    od52ApplyDiceLabels();
  };

  doRoll = function(label, qty, sides, mod = 0) {
    od52PlaySound('roll');
    const r = roll(qty, sides, mod);
    const notation = od52DiceText(qty, sides, mod);
    const resultList = r.results.join(', ');
    const text = `${label}: ${notation} → [${resultList}] = ${r.total}`;
    const last = byId('last-roll');
    if (last) {
      last.innerHTML = `
        <div class="roll-result-card">
          <div class="roll-result-title">${escapeHtml(label)}</div>
          <div class="roll-result-main">
            <span>${od52DiceHtml(qty, sides, mod)}</span>
            <strong class="roll-result-total">${escapeHtml(r.total)}</strong>
          </div>
          <div class="roll-result-detail">Resultado dos dados: [${escapeHtml(resultList)}]${Number(mod) ? ` • Modificador: ${formatMod(Number(mod))}` : ''}</div>
        </div>`;
      last.classList.remove('shake'); void last.offsetWidth; last.classList.add('shake');
    }
    addChat(text, 'roll');
    if (String(label).toLowerCase().includes('iniciativa')) v35RecordInitiativeFromRoll(r.total);
    return r;
  };

  const od52RenderCampaignMenuBase = renderCampaignMenu;
  renderCampaignMenu = function() {
    od52RenderCampaignMenuBase();
    document.querySelectorAll('#campaign-list .campaign-card').forEach(card => {
      const enter = card.querySelector('[data-enter-campaign]');
      if (!enter) return;
      const campaignId = enter.dataset.enterCampaign;
      const member = getMembers().find(m => m.campaignId === campaignId && m.userId === currentUser?.id);
      const actions = card.querySelector('.campaign-actions');
      if (actions && member?.characterId && !actions.querySelector('[data-remove-character-from-table]')) {
        const btn = document.createElement('button');
        btn.className = 'ghost-btn small';
        btn.type = 'button';
        btn.dataset.removeCharacterFromTable = campaignId;
        btn.textContent = 'Remover Ficha da Mesa';
        actions.insertBefore(btn, actions.children[1] || null);
      }
    });
  };

  async function od52RemoveCharacterFromTable(campaignId) {
    if (!campaignId) return;
    if (!confirm('Tem certeza que quer remover sua ficha desta mesa?')) return;
    try {
      if (typeof od42Token === 'function' && od42Token()) {
        await od42Api(`/api/tables/${campaignId}/member`, { method: 'PUT', body: JSON.stringify({ characterId: null }) });
        await od42RefreshTables();
        await od42LoadTableState(campaignId).catch(() => {});
      } else {
        const members = getMembers().map(m => m.campaignId === campaignId && m.userId === currentUser?.id ? { ...m, characterId: null, role: m.role === 'mestre_jogador' ? 'mestre' : m.role } : m);
        setMembers(members);
      }
      if (currentCampaignId === campaignId) renderTableExperience();
      renderCampaignMenu();
    } catch (error) {
      alert(error.message || 'Erro ao remover ficha da mesa.');
    }
  }

  document.addEventListener('click', event => {
    const sessionTheme = event.target.closest('#sessions-theme-toggle');
    if (sessionTheme) {
      event.preventDefault();
      updateSettings(st => st.theme = st.theme === 'dark' ? 'light' : 'dark');
      return;
    }
    const historyBtn = event.target.closest('#toggle-history-btn');
    if (historyBtn) {
      event.preventDefault();
      document.getElementById('session-history-box')?.classList.toggle('hidden');
      if (typeof od51RenderHistory === 'function') od51RenderHistory();
      return;
    }
    const removeChar = event.target.closest('[data-remove-character-from-table]');
    if (removeChar) {
      event.preventDefault();
      event.stopImmediatePropagation();
      od52RemoveCharacterFromTable(removeChar.dataset.removeCharacterFromTable);
      return;
    }
  }, true);

  document.addEventListener('change', event => {
    const sAccent = event.target.closest('#sessions-accent-select');
    if (sAccent) { updateSettings(st => st.accent = sAccent.value); return; }
    const sFont = event.target.closest('#sessions-font-select');
    if (sFont) { updateSettings(st => st.font = sFont.value); return; }
  }, true);

  document.addEventListener('pointerdown', event => {
    if (event.target.closest('button, .sheet-tab, select')) od52PlaySound('click');
  }, true);

  setTimeout(() => {
    const panel = document.getElementById('account-sheets-panel');
    if (panel) { panel.classList.add('hidden', 'collapsed-account-panel'); }
    od52ApplyDiceLabels();
    applySettings();
  }, 120);
})();


/* =========================
   V62 - limpeza estrutural de menus, fichas e resumos
   Base limpa: remove conflito do antigo V53 e centraliza esta área em um único patch.
========================= */
(function od62CleanPatch(){
  const SHEET_ICON = 'assets/sheet-icon.png';
  const DICE_ICON_CLASS = { 4: 'd4', 6: 'd6', 8: 'd8', 10: 'd10', 12: 'd12', 20: 'd20', 100: 'd100' };
  let rollAudio = null;
  let audioCtx = null;

  function safeText(value, fallback = '') { return String(value ?? fallback).trim(); }
  function cleanBool(key, fallback = false) { return localStorage.getItem(key) === null ? fallback : localStorage.getItem(key) === '1'; }
  function setCleanBool(key, value) { localStorage.setItem(key, value ? '1' : '0'); }

  function diceIconHtml(sides = 20, label = false) {
    const n = Number(sides || 20);
    const cls = DICE_ICON_CLASS[n] || 'd20';
    return `<span class="dice-visual-inline"><span class="dice-icon ${cls}" aria-hidden="true"></span>${label ? `<span>D${escapeHtml(n)}</span>` : ''}</span>`;
  }

  function ensureSessionSheetButton() {
    const btn = document.getElementById('toggle-account-panel-btn');
    if (!btn) return;
    btn.classList.add('od62-floating-btn', 'od62-sheet-btn');
    btn.innerHTML = `<img src="${SHEET_ICON}" alt="" />`;
    btn.title = 'Abrir ou fechar Minhas Fichas';
    btn.setAttribute('aria-label', 'Abrir ou fechar Minhas Fichas');
  }

  function ensureSessionMenuButton() {
    const btn = document.getElementById('sessions-menu-btn');
    if (!btn) return;
    btn.classList.add('od62-floating-btn', 'od62-menu-btn');
    btn.innerHTML = '<span aria-hidden="true">☰</span>';
  }

  function ensureAccountPanelClose() {
    const panel = document.getElementById('account-sheets-panel');
    const head = panel?.querySelector('.account-sheets-head');
    if (!panel || !head || head.querySelector('.od62-account-close')) return;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'od62-account-close';
    close.textContent = '—';
    close.title = 'Minimizar Minhas Fichas';
    close.setAttribute('aria-label', 'Minimizar Minhas Fichas');
    close.addEventListener('click', event => {
      event.preventDefault();
      panel.classList.add('hidden', 'collapsed-account-panel');
      updateSheetButtonsState();
    });
    head.appendChild(close);
  }

  function updateSheetButtonsState() {
    const open = !document.getElementById('account-sheets-panel')?.classList.contains('hidden');
    document.getElementById('toggle-account-panel-btn')?.classList.toggle('is-open', open);
    const sidebarOpen = !document.body.classList.contains('sidebar-collapsed');
    document.getElementById('sidebar-dock-btn')?.classList.toggle('is-open', sidebarOpen);
  }

  function cleanSessionsUI() {
    ensureSessionMenuButton();
    ensureSessionSheetButton();
    ensureAccountPanelClose();
    updateSheetButtonsState();
  }

  function ensureAppSheetButton() {
    const dock = document.getElementById('sidebar-dock-btn');
    if (!dock) return;
    dock.classList.add('od62-floating-btn', 'od62-app-sheet-btn');
    dock.innerHTML = `<img src="${SHEET_ICON}" alt="" />`;
    dock.title = document.body.classList.contains('sidebar-collapsed') ? 'Abrir Minhas Fichas' : 'Minimizar Minhas Fichas';
    dock.setAttribute('aria-label', dock.title);
  }

  function cleanTopbarUI() {
    const btn = document.getElementById('topbar-menu-toggle');
    if (btn) {
      btn.classList.add('od62-floating-btn', 'od62-app-menu-btn');
      btn.innerHTML = '<span aria-hidden="true">☰</span>';
    }
    ensureAppSheetButton();
    const title = document.getElementById('sidebar-title');
    if (title) title.textContent = 'Minhas Fichas';
    const sidebarToggle = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggle) {
      sidebarToggle.textContent = '—';
      sidebarToggle.title = 'Minimizar Minhas Fichas';
      sidebarToggle.setAttribute('aria-label', 'Minimizar Minhas Fichas');
    }
    updateSheetButtonsState();
  }

  // Substitui o comportamento antigo do dock lateral com controle simples.
  document.addEventListener('click', event => {
    const sessionSheet = event.target.closest('#toggle-account-panel-btn');
    if (sessionSheet) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const panel = document.getElementById('account-sheets-panel');
      if (panel) {
        const willOpen = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !willOpen);
        panel.classList.toggle('collapsed-account-panel', !willOpen);
        if (willOpen) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      updateSheetButtonsState();
      return;
    }

    const dock = event.target.closest('#sidebar-dock-btn');
    if (dock) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const nextCollapsed = !document.body.classList.contains('sidebar-collapsed');
      if (typeof od46SetSidebarCollapsed === 'function') od46SetSidebarCollapsed(nextCollapsed);
      else document.body.classList.toggle('sidebar-collapsed', nextCollapsed);
      cleanTopbarUI();
      if (!nextCollapsed) document.getElementById('players-sidebar')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const sidebarMin = event.target.closest('#sidebar-toggle-btn');
    if (sidebarMin) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (typeof od46SetSidebarCollapsed === 'function') od46SetSidebarCollapsed(true);
      else document.body.classList.add('sidebar-collapsed');
      cleanTopbarUI();
      return;
    }
  }, true);

  // --------- Resumo de magias / habilidades ---------
  function ensureSummaryButton(tabId, listId, label) {
    const tab = document.getElementById(tabId);
    const list = document.getElementById(listId);
    if (!tab || !list) return null;
    const row = tab.querySelector('.section-title-row') || tab;
    let btn = tab.querySelector(`[data-od62-summary-toggle="${listId}"]`);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ghost-btn small od62-summary-toggle';
      btn.dataset.od62SummaryToggle = listId;
      btn.textContent = 'Resumo';
      row.appendChild(btn);
    }
    let summary = tab.querySelector(`[data-od62-summary-list="${listId}"]`);
    if (!summary) {
      summary = document.createElement('div');
      summary.className = 'od62-summary-grid hidden';
      summary.dataset.od62SummaryList = listId;
      list.insertAdjacentElement('afterend', summary);
    }
    return { tab, list, btn, summary, label };
  }

  function spellFromCard(card) {
    return {
      name: safeText(card.querySelector('.spell-name')?.value, 'Magia'),
      circle: safeText(card.querySelector('.spell-circle')?.value, '-'),
      exec: safeText(card.querySelector('.spell-exec')?.value, '-'),
      range: safeText(card.querySelector('.spell-range')?.value, '-'),
      cost: safeText(card.querySelector('.spell-cost')?.value, '-'),
      components: safeText(card.querySelector('.spell-components')?.value, '-'),
      description: safeText(card.querySelector('.spell-description')?.value, 'Sem descrição.'),
      upgrades: safeText(card.querySelector('.spell-upgrades')?.value, 'Sem aprimoramentos.')
    };
  }

  function abilityFromCard(card) {
    const amount = safeText(card.querySelector('.ability-cost-amount')?.value, '0');
    const resource = safeText(card.querySelector('.ability-cost-resource')?.value, 'PE');
    return {
      name: safeText(card.querySelector('.ability-name')?.value, 'Habilidade'),
      cost: amount && amount !== '0' ? `${amount} ${resource}` : '0',
      bonus: safeText(card.querySelector('.ability-bonus')?.value, '-'),
      action: safeText(card.querySelector('.ability-action')?.value, 'Padrão'),
      description: safeText(card.querySelector('.ability-description')?.value, 'Sem descrição.')
    };
  }

  function chip(label, value) { return `<span class="od62-chip"><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</span>`; }

  function rebuildSpellsSummary() {
    const pack = ensureSummaryButton('tab-magias', 'spells-list', 'Magias');
    if (!pack) return;
    const cards = [...pack.list.querySelectorAll('.spell-card')];
    pack.summary.innerHTML = cards.length ? cards.map(card => {
      const s = spellFromCard(card);
      return `<article class="od62-summary-card od62-spell-summary"><h4>${escapeHtml(s.name)}</h4><div class="od62-chip-row">${chip('Círculo', s.circle)}${chip('Ação', s.exec)}${chip('Alcance', s.range)}${chip('Custo', s.cost)}${chip('Comp.', s.components)}</div><p>${escapeHtml(s.description)}</p><div class="od62-upgrades"><strong>Aprimoramentos</strong><span>${escapeHtml(s.upgrades)}</span></div></article>`;
    }).join('') : '<div class="campaign-empty">Nenhuma magia adicionada.</div>';
  }

  function rebuildAbilitiesSummary() {
    const pack = ensureSummaryButton('tab-habilidades', 'abilities-list', 'Habilidades');
    if (!pack) return;
    const cards = [...pack.list.querySelectorAll('.ability-card')];
    pack.summary.innerHTML = cards.length ? cards.map(card => {
      const a = abilityFromCard(card);
      return `<article class="od62-summary-card od62-ability-summary"><h4>${escapeHtml(a.name)}</h4><div class="od62-chip-row">${chip('Custo', a.cost)}${chip('Ação', a.action)}${chip('Bônus', a.bonus)}</div><p>${escapeHtml(a.description)}</p></article>`;
    }).join('') : '<div class="campaign-empty">Nenhuma habilidade adicionada.</div>';
  }

  function setSummaryMode(listId, enabled, shouldSave = false) {
    const pack = ensureSummaryButton(listId === 'spells-list' ? 'tab-magias' : 'tab-habilidades', listId, '');
    if (!pack) return;
    if (shouldSave && typeof saveCurrentCharacter === 'function') saveCurrentCharacter();
    if (listId === 'spells-list') rebuildSpellsSummary();
    if (listId === 'abilities-list') rebuildAbilitiesSummary();
    pack.list.classList.toggle('hidden', enabled);
    pack.summary.classList.toggle('hidden', !enabled);
    pack.btn.textContent = enabled ? 'Editar' : 'Resumo';
    pack.tab.classList.toggle('od62-summary-mode', enabled);
    setCleanBool(`od62_${listId}_summary`, enabled);
  }

  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-od62-summary-toggle]');
    if (!toggle) return;
    event.preventDefault();
    const listId = toggle.dataset.od62SummaryToggle;
    const current = cleanBool(`od62_${listId}_summary`, false);
    setSummaryMode(listId, !current, true);
  }, true);

  const baseRenderSpells = renderSpells;
  renderSpells = function(char) {
    baseRenderSpells(char);
    rebuildSpellsSummary();
    setSummaryMode('spells-list', cleanBool('od62_spells-list_summary', false));
  };

  const baseRenderAbilities = renderAbilities;
  renderAbilities = function(char) {
    baseRenderAbilities(char);
    rebuildAbilitiesSummary();
    setSummaryMode('abilities-list', cleanBool('od62_abilities-list_summary', false));
  };

  document.addEventListener('input', event => {
    if (event.target.closest('.spell-card')) rebuildSpellsSummary();
    if (event.target.closest('.ability-card')) rebuildAbilitiesSummary();
  }, true);

  // --------- Inventário reduzido visual ---------
  function injectInventorySummaries() {
    document.querySelectorAll('.simple-inventory-card').forEach(card => {
      let summary = card.querySelector('.od62-item-summary');
      if (!summary) {
        summary = document.createElement('div');
        summary.className = 'od62-item-summary';
        card.appendChild(summary);
      }
      const name = safeText(card.querySelector('[data-inv-field="name"]')?.value, 'Item');
      const weight = safeText(card.querySelector('[data-inv-field="weight"]')?.value, '0');
      const uses = safeText(card.querySelector('[data-inv-field="uses"]')?.value, '0');
      const desc = safeText(card.querySelector('[data-inv-field="desc"]')?.value, 'Sem descrição.');
      summary.innerHTML = `<h4>${escapeHtml(name)}</h4><div class="od62-chip-row">${chip('Peso', weight)}${chip('Usos', uses)}</div><p>${escapeHtml(desc)}</p>`;
    });
  }

  const baseRenderSimpleInventory = renderSimpleInventory;
  renderSimpleInventory = function(char) {
    baseRenderSimpleInventory(char);
    injectInventorySummaries();
  };
  document.addEventListener('input', event => { if (event.target.closest('.simple-inventory-card')) injectInventorySummaries(); }, true);
  document.addEventListener('change', event => { if (event.target.closest('.simple-inventory-card')) injectInventorySummaries(); }, true);

  // --------- Dados visuais, sem sobrescrever estrutura demais ---------
  function setupDiceVisuals() {
    const select = document.getElementById('dice-type');
    if (!select) return;
    select.querySelectorAll('option').forEach(opt => { opt.textContent = `D${opt.value}`; });
    document.querySelectorAll('.roll-skill').forEach(btn => { btn.innerHTML = `${diceIconHtml(20, false)} <span>D20</span>`; });
  }
  const baseRenderSkills = renderSkills;
  renderSkills = function(char) { baseRenderSkills(char); setupDiceVisuals(); };

  function initCleanUI() {
    cleanSessionsUI();
    cleanTopbarUI();
    ensureSummaryButton('tab-magias', 'spells-list', 'Magias');
    ensureSummaryButton('tab-habilidades', 'abilities-list', 'Habilidades');
    rebuildSpellsSummary();
    rebuildAbilitiesSummary();
    injectInventorySummaries();
    setupDiceVisuals();
  }

  const baseShowSessions = showSessions;
  showSessions = function() { baseShowSessions(); setTimeout(initCleanUI, 0); };
  const baseShowApp = showApp;
  showApp = function() { baseShowApp(); setTimeout(initCleanUI, 0); };
  const baseApplySettings = applySettings;
  applySettings = function() { baseApplySettings(); setTimeout(initCleanUI, 0); };

  setTimeout(initCleanUI, 100);
  setTimeout(initCleanUI, 500);
})();


/* =========================
   V66 - trava de inventário online contra autosave antigo
========================= */
let od66InventoryMutationActive = false;
function od66ClearSaveTimers() {
  try { if (typeof saveTimer !== 'undefined') clearTimeout(saveTimer); } catch (_) {}
  try { if (typeof od42SaveTimer !== 'undefined') clearTimeout(od42SaveTimer); } catch (_) {}
}
function od66InventoryMutationLock(active = true) {
  od66InventoryMutationActive = !!active;
  od66ClearSaveTimers();
  if (!active) return;
  window.clearTimeout(window.__od66InventoryUnlockTimer);
  window.__od66InventoryUnlockTimer = window.setTimeout(() => { od66InventoryMutationActive = false; }, 2500);
}
function od66InventoryMutationUnlockSoon() {
  od66ClearSaveTimers();
  window.clearTimeout(window.__od66InventoryUnlockTimer);
  window.__od66InventoryUnlockTimer = window.setTimeout(() => { od66InventoryMutationActive = false; }, 900);
}

/* =========================
   V63 - estabilidade multiplayer, chat online e transferência entre jogadores
========================= */
(function od63MultiplayerStability(){
  let od63MessagePollTimer = null;
  let od63RenderTimer = null;
  let od63LastTableStateLoad = 0;
  let od63SavingCharacter = false;

  function od63HasOnlineTable() {
    return !!(currentCampaignId && typeof od42Token === 'function' && od42Token());
  }

  function od63ActiveMember() {
    try { return currentMembership ? currentMembership() : null; } catch (_) { return null; }
  }

  function od63ActiveCharacter() {
    const member = od63ActiveMember();
    const id = member?.characterId || currentCharacterId;
    return get(STORAGE.characters, []).find(c => c.id === id) || null;
  }

  function od63ChatIdentity() {
    const char = od63ActiveCharacter();
    return {
      characterId: char?.id || null,
      name: char?.name || userDisplayName(currentUser),
      avatar: char?.portrait || currentUser?.avatar || currentUser?.avatarUrl || 'assets/logo.jpg'
    };
  }

  function od63MessageToLocal(row = {}) {
    const users = get(STORAGE.users, []);
    const user = users.find(u => u.id === row.user_id || u.id === row.userId) || null;
    const channel = row.channel || 'conversation';
    const charData = row.character_data || row.characterData || {};
    const charName = row.character_name || row.characterName || row.payload?.characterName || '';
    const charAvatar = charData?.portrait || row.payload?.characterAvatar || '';
    return {
      id: row.id || row.clientId || uid(channel === 'rolls' ? 'roll' : 'msg'),
      userId: row.user_id || row.userId || null,
      characterId: row.character_id || row.characterId || null,
      user: charName || row.real_name || row.nick || userDisplayName(user) || 'Sistema',
      avatar: charAvatar || row.avatar_url || user?.avatar || user?.avatarUrl || 'assets/logo.jpg',
      text: row.message || row.text || '',
      type: channel === 'rolls' ? 'roll' : 'msg',
      at: row.created_at ? new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : (row.at || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    };
  }

  if (typeof od44ApiMessageToLocal === 'function') {
    od44ApiMessageToLocal = od63MessageToLocal;
  }

  function od63StoreMessage(row) {
    if (!row) return;
    const local = od63MessageToLocal(row);
    const key = (row.channel === 'rolls' || local.type === 'roll') ? v35RollChatKey() : campaignChatKey();
    const messages = get(key, []);
    if (messages.some(m => String(m.id) === String(local.id))) return;
    messages.push(local);
    set(key, messages.slice(-220));
    renderChat();
  }

  if (typeof od44StoreMessage === 'function') {
    od44StoreMessage = od63StoreMessage;
  }

  renderChat = function() {
    const renderList = (targetId, messages) => {
      const log = document.getElementById(targetId);
      if (!log) return;
      log.innerHTML = '';
      messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `chat-msg ${msg.type === 'roll' ? 'roll' : ''}`;
        div.innerHTML = `
          <img class="chat-msg-avatar" src="${escapeHtml(msg.avatar || 'assets/logo.jpg')}" alt="" />
          <div class="chat-msg-main">
            <small>${escapeHtml(msg.user || 'Sistema')} • ${escapeHtml(msg.at || '')}</small>
            <div class="chat-msg-text">${escapeHtml(msg.text || '')}</div>
          </div>`;
        log.appendChild(div);
      });
      log.scrollTop = log.scrollHeight;
    };
    renderList('chat-log', get(campaignChatKey(), []));
    renderList('roll-chat-log', get(v35RollChatKey(), []));
  };

  async function od63LoadMessages(tableId = currentCampaignId) {
    if (!tableId || !od42Token()) return;
    try {
      const data = await od42Api(`/api/tables/${tableId}/messages`);
      const conversation = [];
      const rolls = [];
      (data.messages || []).forEach(row => {
        const local = od63MessageToLocal(row);
        if (row.channel === 'rolls') rolls.push(local);
        else conversation.push(local);
      });
      set(`${STORAGE.chat}_${tableId}`, conversation.slice(-220));
      set(`${STORAGE.chat}_${tableId}_rolls`, rolls.slice(-220));
      renderChat();
    } catch (error) {
      console.warn('Falha ao sincronizar chat:', error);
    }
  }

  if (typeof od44LoadMessages === 'function') {
    od44LoadMessages = od63LoadMessages;
  }

  addChat = function(text, type = 'msg') {
    const message = String(text || '').trim();
    if (!message) return;

    if (od63HasOnlineTable()) {
      const channel = type === 'roll' ? 'rolls' : 'conversation';
      const ident = od63ChatIdentity();
      od42Api(`/api/tables/${currentCampaignId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          channel,
          message,
          characterId: ident.characterId,
          payload: { characterName: ident.name, characterAvatar: ident.avatar }
        })
      }).then(data => {
        if (data?.message) od63StoreMessage(data.message);
      }).catch(error => {
        console.warn('Falha ao enviar chat online; salvando local:', error);
        const key = type === 'roll' ? v35RollChatKey() : campaignChatKey();
        const chat = get(key, []);
        chat.push({ id: uid(type === 'roll' ? 'roll' : 'msg'), user: ident.name, avatar: ident.avatar, userId: currentUser?.id || null, text: message, type, at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
        set(key, chat.slice(-140));
        renderChat();
      });
      return;
    }

    const ident = od63ChatIdentity();
    const key = type === 'roll' ? v35RollChatKey() : campaignChatKey();
    const chat = get(key, []);
    chat.push({ id: uid(type === 'roll' ? 'roll' : 'msg'), user: ident.name, avatar: ident.avatar, userId: currentUser?.id || null, text: message, type, at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
    set(key, chat.slice(-140));
    renderChat();
  };

  function od63StartChatPolling() {
    clearInterval(od63MessagePollTimer);
    if (!od63HasOnlineTable()) return;
    od63MessagePollTimer = setInterval(() => {
      if (document.hidden || !od63HasOnlineTable()) return;
      od63LoadMessages(currentCampaignId);
    }, 3500);
  }

  async function od63SoftReloadTableState(force = false) {
    if (!od63HasOnlineTable()) return;
    const now = Date.now();
    if (!force && now - od63LastTableStateLoad < 1800) return;
    od63LastTableStateLoad = now;
    try {
      await od42LoadTableState(currentCampaignId);
      await od63LoadMessages(currentCampaignId);
    } catch (error) {
      console.warn('Falha ao atualizar mesa:', error);
    }
  }

  if (typeof od44EnsureSocket === 'function') {
    const originalEnsureSocket = od44EnsureSocket;
    od44EnsureSocket = function() {
      const socket = originalEnsureSocket();
      if (!socket || socket.__od63Patched) return socket;
      socket.__od63Patched = true;
      socket.off('message:created');
      socket.on('message:created', payload => {
        if (!payload?.message) return;
        if (String(payload.tableId) !== String(currentCampaignId)) return;
        od63StoreMessage(payload.message);
      });
      socket.off('member:updated');
      socket.off('table:updated');
      socket.on('member:updated', () => od63SoftReloadTableState(true).then(() => { renderTableExperience(); renderCampaignMenu(); }));
      socket.on('table:updated', () => od63SoftReloadTableState(true).then(() => { renderTableExperience(); renderCampaignMenu(); }));
      socket.on('inventory:updated', () => od63SoftReloadTableState(true).then(() => { renderTableExperience(); if (currentCharacterId) loadCharacter(currentCharacterId); }));
      return socket;
    };
  }

  async function od63TransferItemOnline(itemId) {
    if (!od63HasOnlineTable()) return false;
    od66InventoryMutationLock(true);
    const from = currentChar();
    if (!from) return false;
    const targets = v39CampaignCharacters().filter(c => c.id !== from.id);
    if (!targets.length) { alert('Não há outro personagem nesta mesa para receber.'); return true; }
    const list = targets.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
    const choice = Number(prompt(`Transferir para quem?\n${list}`) || 0) - 1;
    const target = targets[choice];
    if (!target) return true;

    try {
      const data = await od42Api(`/api/tables/${currentCampaignId}/transfer-item`, {
        method: 'POST',
        body: JSON.stringify({ fromCharacterId: from.id, toCharacterId: target.id, itemId })
      });
      if (data?.from) od42MergeById(STORAGE.characters, [od42CharacterFromRow(data.from)]);
      if (data?.to) od42MergeById(STORAGE.characters, [od42CharacterFromRow(data.to)]);
      // Segurança contra autosave antigo: remove localmente também antes de qualquer re-render.
      od42MergeById(STORAGE.characters, get(STORAGE.characters, []).map(c => {
        if (String(c.id) !== String(from.id)) return c;
        const inventoryItems = (Array.isArray(c.inventoryItems) ? c.inventoryItems : []).filter(item => String(item.id) !== String(itemId));
        return { ...c, inventoryItems, weightCurrent: inventoryItems.reduce((sum, item) => sum + (Number(item.weight) || 0), 0) };
      }));
      clearTimeout(saveTimer);
      addChat(`${from.name} transferiu ${data?.item?.name || 'um item'} para ${target.name}.`, 'roll');
      await od63SoftReloadTableState(true);
      if (currentCharacterId === from.id || currentCharacterId === target.id) loadCharacter(currentCharacterId);
      renderTableExperience();
      od66InventoryMutationUnlockSoon();
    } catch (error) {
      od66InventoryMutationUnlockSoon();
      alert(error.message || 'Erro ao transferir item.');
    }
    return true;
  }

  document.addEventListener('click', event => {
    const transfer = event.target.closest('[data-transfer-simple-item]');
    if (transfer && od63HasOnlineTable()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      od63TransferItemOnline(transfer.dataset.transferSimpleItem);
      return;
    }
  }, true);

  const originalEnterCampaignV63 = enterCampaign;
  enterCampaign = async function(campaignId) {
    await originalEnterCampaignV63(campaignId);
    if (typeof od44EnsureSocket === 'function') od44EnsureSocket();
    if (typeof od44JoinTable === 'function') await od44JoinTable(campaignId);
    await od63LoadMessages(campaignId);
    od63StartChatPolling();
  };

  const originalInitAppV63 = initApp;
  initApp = function(campaignId = currentCampaignId) {
    originalInitAppV63(campaignId);
    if (currentCampaignId) {
      if (typeof od44EnsureSocket === 'function') od44EnsureSocket();
      if (typeof od44JoinTable === 'function') od44JoinTable(currentCampaignId).catch(() => {});
      od63LoadMessages(currentCampaignId);
      od63StartChatPolling();
    }
  };

  const originalSaveCurrentCharacterV63 = saveCurrentCharacter;
  saveCurrentCharacter = function() {
    if (od63SavingCharacter) return;
    od63SavingCharacter = true;
    try {
      originalSaveCurrentCharacterV63();
    } finally {
      setTimeout(() => { od63SavingCharacter = false; }, 120);
    }
  };

  const originalRenderTableExperienceV63 = renderTableExperience;
  renderTableExperience = function() {
    clearTimeout(od63RenderTimer);
    od63RenderTimer = setTimeout(() => {
      originalRenderTableExperienceV63();
      renderChat();
    }, 30);
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && od63HasOnlineTable()) {
      od63SoftReloadTableState(true);
      od63StartChatPolling();
    }
  });

  setTimeout(() => {
    if (currentCampaignId) {
      od63SoftReloadTableState(true);
      od63StartChatPolling();
    }
  }, 500);
})();

/* =========================
   V64 - estabilidade sem piscar, inventário online e drop visível
========================= */
(function od64StableMesa(){
  const CHAT_RENDER_STATE = { conversation: '', rolls: '' };
  const collapsedKey = () => currentCampaignId ? `od64_collapsed_${currentCampaignId}` : 'od64_collapsed';
  let chatPollBusy = false;
  let tableStateBusy = false;
  let dropsCache = [];
  let dropsBusy = false;

  function stableString(value) {
    try { return JSON.stringify(value || []); } catch (_) { return String(Date.now()); }
  }

  function sameMessages(a, b) {
    const ax = (a || []).map(m => `${m.id}:${m.text}:${m.at}`).join('|');
    const bx = (b || []).map(m => `${m.id}:${m.text}:${m.at}`).join('|');
    return ax === bx;
  }

  function saveCollapsedState(id, collapsed) {
    const state = get(collapsedKey(), {});
    state[id] = !!collapsed;
    set(collapsedKey(), state);
  }

  function restoreCollapsedState() {
    const state = get(collapsedKey(), {});
    Object.entries(state).forEach(([id, collapsed]) => {
      const box = document.getElementById(id);
      const btn = document.querySelector(`[data-toggle-chat="${CSS.escape(id)}"]`);
      if (!box) return;
      box.classList.toggle('chat-collapsed', !!collapsed);
      if (btn) btn.textContent = collapsed ? '+' : '—';
    });
  }

  const oldRenderChat = renderChat;
  renderChat = function(force = false) {
    const renderList = (targetId, messages, stateKey) => {
      const log = document.getElementById(targetId);
      if (!log) return;
      const signature = stableString(messages.map(m => [m.id, m.user, m.text, m.at, m.avatar, m.type]));
      if (!force && CHAT_RENDER_STATE[stateKey] === signature) return;
      const wasNearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
      CHAT_RENDER_STATE[stateKey] = signature;
      log.innerHTML = '';
      messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `chat-msg ${msg.type === 'roll' ? 'roll' : ''}`;
        div.innerHTML = `
          <img class="chat-msg-avatar" src="${escapeHtml(msg.avatar || 'assets/logo.jpg')}" alt="" />
          <div class="chat-msg-main">
            <small>${escapeHtml(msg.user || 'Sistema')} • ${escapeHtml(msg.at || '')}</small>
            <div class="chat-msg-text">${escapeHtml(msg.text || '')}</div>
          </div>`;
        log.appendChild(div);
      });
      if (wasNearBottom) log.scrollTop = log.scrollHeight;
    };
    renderList('chat-log', get(campaignChatKey(), []), 'conversation');
    renderList('roll-chat-log', get(v35RollChatKey(), []), 'rolls');
    restoreCollapsedState();
  };

  function messageToLocal64(row = {}) {
    if (typeof od44ApiMessageToLocal === 'function') return od44ApiMessageToLocal(row);
    return row;
  }

  async function loadMessagesNoFlicker(tableId = currentCampaignId) {
    if (!tableId || !od42Token || !od42Token() || chatPollBusy) return;
    chatPollBusy = true;
    try {
      const data = await od42Api(`/api/tables/${tableId}/messages`);
      const conversation = [];
      const rolls = [];
      (data.messages || []).forEach(row => {
        const local = messageToLocal64(row);
        if (row.channel === 'rolls' || local.type === 'roll') rolls.push(local);
        else conversation.push(local);
      });
      const convKey = `${STORAGE.chat}_${tableId}`;
      const rollKey = `${STORAGE.chat}_${tableId}_rolls`;
      const oldConv = get(convKey, []);
      const oldRolls = get(rollKey, []);
      let changed = false;
      if (!sameMessages(oldConv, conversation)) { set(convKey, conversation.slice(-220)); changed = true; }
      if (!sameMessages(oldRolls, rolls)) { set(rollKey, rolls.slice(-220)); changed = true; }
      if (changed) renderChat();
    } catch (error) {
      console.warn('Falha ao carregar chat sem piscar:', error);
    } finally {
      chatPollBusy = false;
    }
  }

  od44LoadMessages = loadMessagesNoFlicker;
  if (typeof od63LoadMessages !== 'undefined') od63LoadMessages = loadMessagesNoFlicker;

  async function saveCharNow(char = currentChar()) {
    if (!char?.id || !od42Token || !od42Token()) return;
    try {
      if (typeof od44SaveCharacterOnline === 'function') await od44SaveCharacterOnline(char);
      else await od42Api(`/api/characters/${char.id}`, { method: 'PUT', body: JSON.stringify({ name: char.name || 'Ficha', data: char }) });
    } catch (error) {
      console.warn('Falha ao salvar ficha agora:', error);
    }
  }

  function recalcItemWeight(char) {
    char.inventoryItems = Array.isArray(char.inventoryItems) ? char.inventoryItems : [];
    char.weightCurrent = char.inventoryItems.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  }

  function mutateCurrentInventory(mutator, options = {}) {
    const char = currentChar();
    if (!char) return null;
    updateChar(saved => {
      saved.inventoryItems = Array.isArray(saved.inventoryItems) ? saved.inventoryItems : [];
      mutator(saved);
      recalcItemWeight(saved);
    });
    const updated = currentChar();
    renderSimpleInventory(updated);
    if (!options.noSave) saveCharNow(updated);
    return updated;
  }

  document.addEventListener('click', event => {
    const chatToggle = event.target.closest('[data-toggle-chat]');
    if (chatToggle) {
      setTimeout(() => {
        const id = chatToggle.getAttribute('data-toggle-chat');
        const box = document.getElementById(id);
        if (box) saveCollapsedState(id, box.classList.contains('chat-collapsed'));
      }, 0);
      return;
    }

    if (!currentCampaignId) return;

    const removeBtn = event.target.closest('[data-remove-simple-item]');
    if (removeBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const index = Number(removeBtn.dataset.removeSimpleItem);
      mutateCurrentInventory(char => { char.inventoryItems.splice(index, 1); });
      return;
    }

    const addBtn = event.target.closest('#add-simple-inventory-item');
    if (addBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      mutateCurrentInventory(char => {
        char.inventoryItems.push({ id: uid('inv'), name: 'Novo item', weight: 0.5, uses: 0, desc: '' });
      });
      return;
    }

    const compactBtn = event.target.closest('#simple-inventory-compact-toggle');
    if (compactBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      mutateCurrentInventory(char => { char.simpleInventoryCompact = !char.simpleInventoryCompact; });
      return;
    }
  }, true);

  document.addEventListener('change', event => {
    if (!currentCampaignId) return;
    if (event.target.closest('#simple-inventory-list')) {
      setTimeout(() => saveCharNow(currentChar()), 50);
    }
  }, true);

  async function loadDrops() {
    if (!currentCampaignId || !od42Token || !od42Token() || dropsBusy) return dropsCache;
    dropsBusy = true;
    try {
      const data = await od42Api(`/api/tables/${currentCampaignId}/drops`);
      dropsCache = data.drops || [];
      renderGroupDrops();
    } catch (error) {
      console.warn('Falha ao carregar drops:', error);
    } finally {
      dropsBusy = false;
    }
    return dropsCache;
  }

  function renderGroupDrops() {
    if (!currentCampaignId) return;
    const target = byId('player-dashboard') || byId('master-dashboard');
    if (!target) return;
    let panel = byId('group-drops-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'group-drops-panel';
      panel.className = 'group-drops-panel mini-card';
      const grid = byId('public-party-grid') || byId('master-characters-grid');
      if (grid?.parentNode) grid.parentNode.insertBefore(panel, grid.nextSibling);
      else target.appendChild(panel);
    }
    const chars = charactersInCurrentCampaign();
    const myChar = currentChar() || od63ActiveCharacter?.();
    const options = chars.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === myChar?.id ? 'selected' : ''}>${escapeHtml(c.name || 'Personagem')}</option>`).join('');
    panel.innerHTML = `<div class="section-title-row"><div><h3>Drop da Mesa</h3><p class="helper-text">Itens soltos na mesa. Escolha uma ficha e pegue o item.</p></div></div>
      <div class="group-drops-list">${dropsCache.length ? dropsCache.map(item => `
        <div class="group-drop-row">
          <div><strong>${escapeHtml(item.name || 'Item')}</strong><small>Peso ${escapeHtml(item.weight || 0)} • Usos ${escapeHtml(item.uses || 0)}</small>${item.desc ? `<p>${escapeHtml(item.desc)}</p>` : ''}</div>
          <select data-take-drop-target="${escapeHtml(item.id)}">${options}</select>
          <button class="primary-btn small" data-take-drop-item="${escapeHtml(item.id)}" type="button">Pegar</button>
          <button class="danger-btn small" data-delete-drop-item="${escapeHtml(item.id)}" type="button">Excluir</button>
        </div>`).join('') : '<div class="campaign-empty">Nenhum item dropado.</div>'}</div>`;
  }

  async function dropItemOnline(itemId) {
    clearTimeout(saveTimer);
    const from = currentChar();
    if (!from || !currentCampaignId) return false;
    try {
      const data = await od42Api(`/api/tables/${currentCampaignId}/drop-item`, {
        method: 'POST',
        body: JSON.stringify({ fromCharacterId: from.id, itemId })
      });
      if (data?.from) od42MergeById(STORAGE.characters, [od42CharacterFromRow(data.from)]);
      // Segurança contra autosave antigo: remove localmente também antes de qualquer re-render.
      od42MergeById(STORAGE.characters, get(STORAGE.characters, []).map(c => {
        if (String(c.id) !== String(from.id)) return c;
        const inventoryItems = (Array.isArray(c.inventoryItems) ? c.inventoryItems : []).filter(item => String(item.id) !== String(itemId));
        return { ...c, inventoryItems, weightCurrent: inventoryItems.reduce((sum, item) => sum + (Number(item.weight) || 0), 0) };
      }));
      clearTimeout(saveTimer);
      dropsCache = data?.drops || dropsCache;
      addChat(`${from.name} colocou ${data?.item?.name || 'um item'} no drop da mesa.`, 'roll');
      loadCharacter(from.id);
      renderGroupDrops();
      renderTableExperience();
      od66InventoryMutationUnlockSoon();
    } catch (error) {
      od66InventoryMutationUnlockSoon();
      alert(error.message || 'Erro ao enviar item para drop.');
    }
    return true;
  }

  async function takeDropOnline(dropId) {
    const select = document.querySelector(`[data-take-drop-target="${CSS.escape(dropId)}"]`);
    const toCharacterId = select?.value || currentChar()?.id;
    if (!toCharacterId) return alert('Escolha uma ficha para receber o item.');
    try {
      const data = await od42Api(`/api/tables/${currentCampaignId}/drops/${dropId}/take`, {
        method: 'POST',
        body: JSON.stringify({ toCharacterId })
      });
      if (data?.to) od42MergeById(STORAGE.characters, [od42CharacterFromRow(data.to)]);
      dropsCache = data?.drops || [];
      const receiver = get(STORAGE.characters, []).find(c => c.id === toCharacterId);
      addChat(`${receiver?.name || 'Personagem'} pegou ${data?.item?.name || 'um item'} do drop.`, 'roll');
      if (currentCharacterId === toCharacterId) loadCharacter(toCharacterId);
      renderGroupDrops();
      renderTableExperience();
    } catch (error) {
      alert(error.message || 'Erro ao pegar drop.');
    }
  }

  async function deleteDropOnline(dropId) {
    if (!dropId || !currentCampaignId) return;
    if (!confirm('Excluir este item dropado da mesa?')) return;
    try {
      const data = await od42Api(`/api/tables/${currentCampaignId}/drops/${dropId}`, { method: 'DELETE' });
      dropsCache = data?.drops || [];
      addChat(`Item removido do drop: ${data?.item?.name || 'Item'}.`, 'roll');
      renderGroupDrops();
      renderTableExperience();
    } catch (error) {
      alert(error.message || 'Erro ao excluir drop.');
    }
  }

  document.addEventListener('click', event => {
    const dropBtn = event.target.closest('[data-drop-simple-item]');
    if (dropBtn && currentCampaignId && od42Token && od42Token()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      od66InventoryMutationLock(true);
      dropItemOnline(dropBtn.dataset.dropSimpleItem);
      return;
    }
    const deleteDropBtn = event.target.closest('[data-delete-drop-item]');
    if (deleteDropBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteDropOnline(deleteDropBtn.dataset.deleteDropItem);
      return;
    }
    const takeBtn = event.target.closest('[data-take-drop-item]');
    if (takeBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      takeDropOnline(takeBtn.dataset.takeDropItem);
    }
  }, true);

  const baseRenderTableExperience64 = renderTableExperience;
  renderTableExperience = function() {
    baseRenderTableExperience64();
    renderGroupDrops();
    restoreCollapsedState();
  };

  const baseEnterCampaign64 = enterCampaign;
  enterCampaign = async function(campaignId) {
    await baseEnterCampaign64(campaignId);
    await loadMessagesNoFlicker(campaignId);
    await loadDrops();
  };

  // Rebaixa eventos de atualização ao mínimo necessário para não piscar tudo.
  if (typeof od44EnsureSocket === 'function') {
    const ensureBase64 = od44EnsureSocket;
    od44EnsureSocket = function() {
      const socket = ensureBase64();
      if (!socket || socket.__od64Patched) return socket;
      socket.__od64Patched = true;
      socket.off('inventory:updated');
      socket.on('inventory:updated', async payload => {
        if (payload?.tableId && String(payload.tableId) !== String(currentCampaignId)) return;
        await loadDrops();
        if (!tableStateBusy) {
          tableStateBusy = true;
          try { await od42LoadTableState(currentCampaignId); }
          catch (error) { console.warn('Falha ao atualizar inventário:', error); }
          finally { tableStateBusy = false; }
          if (currentCharacterId && !document.activeElement?.closest('#simple-inventory-list')) loadCharacter(currentCharacterId);
          renderTableExperience();
        }
      });
    };
  }

  // Remove visual e função do botão antigo de ocultar descrição em habilidades.
  const abilityToggle = byId('toggle-ability-desc');
  if (abilityToggle) abilityToggle.remove();

  setInterval(() => {
    if (!document.hidden && currentCampaignId && od42Token && od42Token()) {
      loadMessagesNoFlicker(currentCampaignId);
      loadDrops();
    }
  }, 5000);

  setTimeout(() => { restoreCollapsedState(); loadDrops(); renderChat(true); }, 500);
})();


/* =========================
   V66 - wrapper final: não salvar ficha antiga durante transferência/drop
========================= */
(function od66FinalGuards(){
  const baseSave = saveCurrentCharacter;
  saveCurrentCharacter = function() {
    if (od66InventoryMutationActive) return;
    return baseSave.apply(this, arguments);
  };
})();


/* =========================
   V67 - URLs internas por tela/aba
   V68 - guardas de inventário em rota
   V69 - navegação mobile por URL
========================= */
(function od67to69Routes(){
  const ROUTE_VERSION = 'v69';
  let applyingRoute = false;
  let routeReady = false;
  let routeNoticeTimer = null;
  let lastRoutePath = '';

  function pathParts() {
    return location.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  }

  function qs() { return new URLSearchParams(location.search); }

  function currentTabName() {
    return document.querySelector('.sheet-tab.active')?.dataset?.tab || 'resumo';
  }

  function isOnlineReady() {
    return !!(currentUser && (typeof od42Token !== 'function' || !od42Token || od42Token() || currentUser.id));
  }

  function routePathForCurrent(extraSection = '') {
    if (accountSheetMode) {
      return currentCharacterId ? `/ficha/${encodeURIComponent(currentCharacterId)}?tab=${encodeURIComponent(currentTabName())}` : '/fichas';
    }
    if (currentCampaignId) {
      if (extraSection) return `/mesa/${encodeURIComponent(currentCampaignId)}/${extraSection}`;
      if (currentCharacterId) return `/mesa/${encodeURIComponent(currentCampaignId)}/ficha/${encodeURIComponent(currentCharacterId)}?tab=${encodeURIComponent(currentTabName())}`;
      return `/mesa/${encodeURIComponent(currentCampaignId)}`;
    }
    if (document.getElementById('sessions-screen')?.classList.contains('active')) return '/mesas';
    return '/login';
  }

  function safeReplace(path) { return safeNavigate(path, true); }

  function safeNavigate(path, replace = false) {
    if (!path || applyingRoute) return;
    const next = path;
    const current = location.pathname + location.search;
    if (next === current || next === lastRoutePath) return;
    lastRoutePath = next;
    try {
      history[replace ? 'replaceState' : 'pushState']({ odRoute: ROUTE_VERSION, path: next }, '', next);
    } catch (_) {}
  }

  function setMobileRoute(section = '') {
    const body = document.body;
    body.classList.remove('route-mobile-focus', 'route-chat-focus', 'route-dados-focus', 'route-drops-focus', 'route-fichas-focus', 'route-ficha-focus');
    if (!section) return;
    body.classList.add('route-mobile-focus', `route-${section}-focus`);
  }

  function showRouteNotice(text) {
    let chip = document.getElementById('route-hint-chip');
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'route-hint-chip';
      chip.className = 'route-hint-chip';
      document.body.appendChild(chip);
    }
    chip.textContent = text;
    chip.classList.add('active');
    clearTimeout(routeNoticeTimer);
    routeNoticeTimer = setTimeout(() => chip.classList.remove('active'), 1200);
  }

  function focusElement(selector, sectionName = '') {
    const el = document.querySelector(selector);
    if (!el) return;
    document.querySelectorAll('.route-active-section').forEach(node => node.classList.remove('route-active-section'));
    el.classList.add('route-active-section');
    setMobileRoute(sectionName);
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }

  function activateSheetTab(tab) {
    if (!tab) return;
    const btn = document.querySelector(`.sheet-tab[data-tab="${CSS.escape(tab)}"]`);
    if (btn) btn.click();
  }

  function findCampaignIdFromRoute(parts) {
    if (parts[0] !== 'mesa') return null;
    return parts[1] || null;
  }

  async function ensureTableLoaded(tableId) {
    if (!tableId) return false;
    if (currentCampaignId === tableId && document.getElementById('app-screen')?.classList.contains('active')) return true;
    const isMember = getMembers().some(m => String(m.campaignId) === String(tableId) && String(m.userId) === String(currentUser?.id));
    if (!isMember) {
      showSessions();
      showRouteNotice('Você não faz parte dessa mesa.');
      return false;
    }
    await enterCampaign(tableId);
    return true;
  }

  async function applyRouteFromLocation() {
    if (applyingRoute) return;
    applyingRoute = true;
    try {
      const parts = pathParts();
      const query = qs();
      if (!parts.length) {
        if (currentUser) showSessions(); else showAuth();
        return;
      }
      if (!currentUser && parts[0] !== 'login') {
        showAuth();
        sessionStorage.setItem('od_pending_route', location.pathname + location.search);
        return;
      }
      if (parts[0] === 'login') {
        showAuth();
        return;
      }
      if (parts[0] === 'mesas' || parts[0] === 'campanhas') {
        showSessions();
        return;
      }
      if (parts[0] === 'fichas') {
        initAccountCharacterEditor();
        setMobileRoute('fichas');
        return;
      }
      if (parts[0] === 'ficha') {
        const charId = parts[1] || currentCharacterId;
        initAccountCharacterEditor(charId);
        activateSheetTab(query.get('tab') || 'resumo');
        setMobileRoute('ficha');
        return;
      }
      if (parts[0] === 'mesa') {
        const tableId = parts[1];
        const ok = await ensureTableLoaded(tableId);
        if (!ok) return;
        const section = parts[2] || '';
        if (section === 'ficha') {
          const charId = parts[3] || currentCharacterId;
          if (charId && get(STORAGE.characters, []).some(c => String(c.id) === String(charId))) {
            currentCharacterId = charId;
            loadCharacter(charId);
          }
          activateSheetTab(query.get('tab') || 'resumo');
          focusElement('.sheet-area', 'ficha');
          return;
        }
        if (section === 'chat') { focusElement('#conversation-chat-box', 'chat'); return; }
        if (section === 'dados') { focusElement('.dice-box', 'dados'); return; }
        if (section === 'drops') { focusElement('#group-drops-panel', 'drops'); return; }
        if (section === 'fichas') { focusElement('#players-sidebar', 'fichas'); return; }
        setMobileRoute('');
        return;
      }
      showSessions();
    } finally {
      setTimeout(() => { applyingRoute = false; }, 60);
    }
  }

  const baseShowAuth67 = showAuth;
  showAuth = function() {
    const result = baseShowAuth67.apply(this, arguments);
    safeReplace('/login');
    setMobileRoute('');
    return result;
  };

  const baseShowSessions67 = showSessions;
  showSessions = function() {
    const result = baseShowSessions67.apply(this, arguments);
    safeNavigate('/mesas');
    setMobileRoute('');
    return result;
  };

  const baseInitApp67 = initApp;
  initApp = function(campaignId = currentCampaignId) {
    const result = baseInitApp67.apply(this, arguments);
    const path = routePathForCurrent();
    safeNavigate(path, !routeReady);
    return result;
  };

  const baseEnterCampaign67 = enterCampaign;
  enterCampaign = async function(campaignId) {
    const result = await baseEnterCampaign67.apply(this, arguments);
    safeNavigate(`/mesa/${encodeURIComponent(campaignId)}`);
    return result;
  };

  const baseInitAccount67 = initAccountCharacterEditor;
  initAccountCharacterEditor = function(charId = null) {
    const result = baseInitAccount67.apply(this, arguments);
    safeNavigate(charId ? `/ficha/${encodeURIComponent(charId)}?tab=${encodeURIComponent(currentTabName())}` : '/fichas');
    return result;
  };

  const baseLoadCharacter67 = loadCharacter;
  loadCharacter = function(id) {
    const result = baseLoadCharacter67.apply(this, arguments);
    if (document.getElementById('app-screen')?.classList.contains('active')) {
      safeNavigate(routePathForCurrent());
    }
    return result;
  };

  // V68: após operações de inventário online, preferir o estado do servidor e não reabrir autosave antigo.
  if (typeof od66InventoryMutationLock === 'function') {
    const baseSave67 = saveCurrentCharacter;
    saveCurrentCharacter = function() {
      if (window.__odInventoryOnlineBusy) return;
      return baseSave67.apply(this, arguments);
    };
    document.addEventListener('click', event => {
      if (event.target.closest('[data-transfer-simple-item], [data-drop-simple-item], [data-take-drop-item], [data-delete-drop-item]')) {
        window.__odInventoryOnlineBusy = true;
        clearTimeout(saveTimer);
        setTimeout(() => { window.__odInventoryOnlineBusy = false; }, 1400);
      }
    }, true);
  }

  document.addEventListener('click', event => {
    const tabBtn = event.target.closest('.sheet-tab');
    if (tabBtn) {
      setTimeout(() => safeNavigate(routePathForCurrent()), 0);
      return;
    }
    const mobileTab = event.target.closest('[data-mobile-tab]');
    if (mobileTab && currentCampaignId) {
      setTimeout(() => safeNavigate(`/mesa/${encodeURIComponent(currentCampaignId)}/ficha/${encodeURIComponent(currentCharacterId || '')}?tab=${encodeURIComponent(mobileTab.dataset.mobileTab)}`), 0);
      return;
    }
    const mobileJump = event.target.closest('[data-mobile-jump]');
    if (mobileJump && currentCampaignId) {
      const sel = mobileJump.dataset.mobileJump || '';
      const section = sel.includes('chat') ? 'chat' : sel.includes('players') ? 'fichas' : sel.includes('right-panel') ? 'dados' : 'ficha';
      setTimeout(() => safeNavigate(`/mesa/${encodeURIComponent(currentCampaignId)}/${section}`), 0);
    }
  }, true);

  window.addEventListener('popstate', () => applyRouteFromLocation());

  async function bootRoute() {
    if (routeReady) return;
    routeReady = true;
    const pending = sessionStorage.getItem('od_pending_route');
    if (pending && currentUser) {
      sessionStorage.removeItem('od_pending_route');
      history.replaceState({ odRoute: ROUTE_VERSION, path: pending }, '', pending);
    }
    await applyRouteFromLocation();
  }

  // Dá tempo para sessão online, personagens e mesas carregarem antes de interpretar a URL.
  setTimeout(bootRoute, 550);
  setTimeout(() => {
    if (!routeReady) bootRoute();
  }, 1400);
})();


/* =========================
   V70 - Correções de persistência + layout tipo hub
   Base: mantém a estética One Dice, mas organiza início/fichas/campanhas.
========================= */
(function od70Patch(){
  const DELETED_KEY = 'od_deleted_characters_v70';
  const getDeleted = () => new Set(get(DELETED_KEY, []));
  const setDeleted = ids => set(DELETED_KEY, [...ids]);
  const markDeleted = id => { const ids = getDeleted(); ids.add(String(id)); setDeleted(ids); };
  const isDeleted = id => getDeleted().has(String(id));

  function purgeDeletedLocal() {
    const ids = getDeleted();
    if (!ids.size) return;
    set(STORAGE.characters, get(STORAGE.characters, []).filter(c => !ids.has(String(c.id))));
    setMembers(getMembers().map(m => ids.has(String(m.characterId)) ? { ...m, characterId: null } : m));
    if (ids.has(String(currentCharacterId))) currentCharacterId = null;
  }

  const baseMergeById70 = od42MergeById;
  od42MergeById = function(storageKey, items) {
    if (storageKey === STORAGE.characters) {
      items = (items || []).filter(item => item && !isDeleted(item.id));
    }
    baseMergeById70(storageKey, items);
    if (storageKey === STORAGE.characters) purgeDeletedLocal();
  };

  const baseScheduleSave70 = od42ScheduleCharacterSave;
  od42ScheduleCharacterSave = function(char) {
    if (!char || isDeleted(char.id)) return;
    return baseScheduleSave70(char);
  };

  const baseRefreshOwn70 = od42RefreshOwnCharacters;
  od42RefreshOwnCharacters = async function() {
    const owned = await baseRefreshOwn70();
    purgeDeletedLocal();
    return owned.filter(c => !isDeleted(c.id));
  };

  deleteAccountCharacter = async function(id) {
    const char = get(STORAGE.characters, []).find(c => String(c.id) === String(id) && c.ownerId === currentUser?.id);
    if (!char) return;
    if (!confirm(`Apagar a ficha "${char.name}"?`)) return;
    try {
      clearTimeout(typeof od42SaveTimer !== 'undefined' ? od42SaveTimer : null);
      clearTimeout(typeof saveTimer !== 'undefined' ? saveTimer : null);
      markDeleted(id);
      purgeDeletedLocal();
      renderAccountCharacterMenu();
      renderCampaignMenu();
      renderCharacterList();
      await od42Api(`/api/characters/${id}`, { method: 'DELETE' });
      await od42RefreshOwnCharacters().catch(() => {});
      await od42RefreshTables().catch(() => {});
      purgeDeletedLocal();
      renderAccountCharacterMenu();
      renderCampaignMenu();
      renderCharacterList();
    } catch (error) {
      alert(error.message || 'Erro ao apagar ficha.');
    }
  };

  const baseCreateAccount70 = createAccountCharacter;
  createAccountCharacter = function(openAfterCreate = true) {
    if (userCharacters().length >= 20) return alert('Você atingiu o limite de 20 personagens. Apague uma ficha para criar outra.');
    return baseCreateAccount70(openAfterCreate);
  };

  const baseCreateCampaign70 = createCampaign;
  createCampaign = function() {
    const owned = getCampaigns().filter(c => c.ownerId === currentUser?.id).length;
    if (owned >= 10) return alert('Você atingiu o limite de 10 campanhas. Apague uma campanha para criar outra.');
    return baseCreateCampaign70();
  };

  function percent(value, max) {
    return Math.max(0, Math.min(100, (Number(value || 0) / Math.max(1, Number(max || 1))) * 100));
  }
  function extraGradient(current, max, baseA, baseB, extraA, extraB) {
    current = Number(current || 0); max = Math.max(1, Number(max || 1));
    if (current <= max) return `linear-gradient(90deg, ${baseA}, ${baseB})`;
    const baseCut = Math.max(0, Math.min(100, (max / current) * 100));
    return `linear-gradient(90deg, ${baseA} 0%, ${baseB} ${baseCut}%, ${extraA} ${baseCut}%, ${extraB} 100%)`;
  }
  updateBars = function(char) {
    const pv = byId('pv-bar');
    const pe = byId('pe-bar');
    if (pv) {
      pv.style.width = `${Number(char.pvCurrent || 0) > Number(char.pvMax || 0) ? 100 : percent(char.pvCurrent, char.pvMax)}%`;
      pv.style.background = extraGradient(char.pvCurrent, char.pvMax, '#5c0f0f', '#d31e1e', '#e4b91a', '#fff06a');
      pv.classList.toggle('has-extra', Number(char.pvCurrent || 0) > Number(char.pvMax || 0));
    }
    if (pe) {
      pe.style.width = `${Number(char.peCurrent || 0) > Number(char.peMax || 0) ? 100 : percent(char.peCurrent, char.peMax)}%`;
      pe.style.background = extraGradient(char.peCurrent, char.peMax, '#143a76', '#4f8cff', '#156d30', '#57e46c');
      pe.classList.toggle('has-extra', Number(char.peCurrent || 0) > Number(char.peMax || 0));
    }
  };
  updateOverlay = function(char) {
    byId('overlay-portrait').src = char.portrait || 'assets/logo.jpg';
    byId('overlay-name').textContent = char.name;
    const opv = byId('overlay-pv');
    const ope = byId('overlay-pe');
    if (opv) { opv.style.width = `${Number(char.pvCurrent || 0) > Number(char.pvMax || 0) ? 100 : percent(char.pvCurrent, char.pvMax)}%`; opv.style.background = extraGradient(char.pvCurrent, char.pvMax, '#5c0f0f', '#d31e1e', '#e4b91a', '#fff06a'); }
    if (ope) { ope.style.width = `${Number(char.peCurrent || 0) > Number(char.peMax || 0) ? 100 : percent(char.peCurrent, char.peMax)}%`; ope.style.background = extraGradient(char.peCurrent, char.peMax, '#143a76', '#4f8cff', '#156d30', '#57e46c'); }
    byId('overlay-pv-text').textContent = `${char.pvCurrent}/${char.pvMax}`;
    byId('overlay-pe-text').textContent = `${char.peCurrent}/${char.peMax}`;
  };

  const baseShowSessions70 = showSessions;
  showSessions = function() {
    baseShowSessions70();
    document.body.classList.add('od70-hub-mode');
    try { od70RenderCounts(); } catch(_) {}
  };

  const baseShowApp70 = showApp;
  showApp = function() {
    baseShowApp70();
    document.body.classList.remove('od70-hub-mode');
  };

  function od70RenderCounts() {
    const charHead = document.querySelector('#account-sheets-panel .account-sheets-head .subtitle');
    if (charHead) charHead.textContent = `${userCharacters().length}/20 personagens. Crie e edite suas fichas antes de entrar em uma mesa.`;
    const campaignTitle = document.querySelector('.campaign-list-panel h2');
    const campaignEmpty = document.querySelector('#campaign-list .campaign-empty');
    const owned = getCampaigns().filter(c => c.ownerId === currentUser?.id).length;
    if (campaignTitle && !campaignTitle.dataset.v70) { campaignTitle.dataset.v70 = '1'; campaignTitle.textContent = 'Minhas Campanhas'; }
    if (campaignEmpty) campaignEmpty.textContent = `${owned}/10 campanhas. Crie uma campanha ou use o código de convite do mestre.`;
  }

  const baseRenderAccount70 = renderAccountCharacterMenu;
  renderAccountCharacterMenu = function() {
    baseRenderAccount70();
    od70RenderCounts();
  };

  const baseRenderCampaign70 = renderCampaignMenu;
  renderCampaignMenu = function() {
    baseRenderCampaign70();
    od70RenderCounts();
  };

  document.addEventListener('click', event => {
    const del = event.target.closest('[data-delete-account-character]');
    if (del) {
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteAccountCharacter(del.dataset.deleteAccountCharacter);
    }
  }, true);

  purgeDeletedLocal();
  setTimeout(() => { purgeDeletedLocal(); od70RenderCounts(); if (currentChar()) updateBars(currentChar()); }, 300);
})();

/* =========================
   V71 - Dashboard por abas inspirado no Lich RPG, mantendo One Dice
========================= */
(function od71Dashboard(){
  const OD71_LIMITS = { characters: 20, campaigns: 10 };
  let od71Tab = localStorage.getItem('od71_tab') || 'home';

  function od71LogoSrc() {
    return 'assets/logo-texto.png';
  }

  function od71UserInitials() {
    const name = userDisplayName(currentUser || {}) || 'GU';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'GU';
  }

  function od71EnsureShell() {
    const screen = document.getElementById('sessions-screen');
    if (!screen) return null;
    let shell = document.getElementById('od71-shell');
    if (shell) return shell;
    shell = document.createElement('div');
    shell.id = 'od71-shell';
    shell.className = 'od71-shell';
    screen.prepend(shell);
    return shell;
  }

  function od71NavButton(tab, icon, label) {
    return `<button class="od71-nav-btn ${od71Tab === tab ? 'active' : ''}" type="button" data-od71-tab="${tab}"><span>${icon}</span>${label}</button>`;
  }

  function od71RenderShell() {
    const shell = od71EnsureShell();
    if (!shell) return;
    shell.innerHTML = `
      <header class="od71-topbar">
        <div class="od71-logo od82-logo-static" aria-label="One Dice">
          <img src="${od71LogoSrc()}" alt="One Dice" />
        </div>
        <nav class="od71-main-nav" aria-label="Menu principal">
          ${od71NavButton('home', '◆', 'Início')}
          ${od71NavButton('characters', '♙', 'Personagens')}
          ${od71NavButton('campaigns', '⚔', 'Campanhas')}
        </nav>
        <div class="od71-user-area">
          <button class="od71-icon-btn" type="button" id="od71-settings-btn" title="Configurações">⚙</button>
          <button class="od71-user-pill" type="button" id="od71-account-btn" title="Conta">${escapeHtml(od71UserInitials())}</button>
        </div>
      </header>
      <main class="od71-content" id="od71-content"></main>`;
    od71RenderContent();
  }

  function od71SetTab(tab) {
    od71Tab = tab || 'home';
    if (!['home', 'characters', 'campaigns'].includes(od71Tab)) od71Tab = 'home';
    localStorage.setItem('od71_tab', od71Tab);

    // V82: trocar aba sem reconstruir toda a topbar.
    // Isso evita o efeito de "reset" visual no menu inicial.
    od71RenderContent();
    document.querySelectorAll('.od71-nav-btn').forEach(btn => {
      const target = btn.dataset.od71Tab || btn.dataset.od75Tab;
      btn.classList.toggle('active', target === od71Tab);
    });

    try {
      const route = od71Tab === 'home' ? '/inicio' : (od71Tab === 'characters' ? '/personagens' : '/campanhas');
      history.replaceState({ od71Tab }, '', route);
    } catch (_) {}
  }

  function od71RenderContent() {
    const content = document.getElementById('od71-content');
    if (!content) return;
    if (od71Tab === 'characters') return od71RenderCharacters(content);
    if (od71Tab === 'campaigns') return od71RenderCampaigns(content);
    if (!['home', 'characters', 'campaigns'].includes(od71Tab)) { od71Tab = 'home'; }
    return od71RenderHome(content);
  }

  function od71RenderHome(content) {
    content.innerHTML = `
      <section class="od71-home-hero">
        <div class="od71-hero-inner">
          <img class="od71-hero-logo od82-hero-logo-full" src="assets/logo-completa.png" alt="One Dice" />
          <div class="od71-divider"></div>
          <p class="od71-eyebrow">A aventura começa</p>
          <div class="od71-home-grid">
            <button class="od71-home-card" type="button" id="od71-create-character">
              <span class="od71-card-icon">＋</span>
              <strong>Criar Personagem</strong>
              <small>Dê vida a um novo herói</small>
            </button>
            <button class="od71-home-card" type="button" id="od71-create-campaign-home">
              <span class="od71-card-icon">♜</span>
              <strong>Criar Campanha</strong>
              <small>Forje uma nova aventura</small>
            </button>
            <button class="od71-home-card" type="button" data-od71-tab="characters">
              <span class="od71-card-icon">▱</span>
              <strong>Meus Personagens</strong>
              <small>Acesse suas fichas</small>
            </button>
            <button class="od71-home-card" type="button" data-od71-tab="campaigns">
              <span class="od71-card-icon">⚔</span>
              <strong>Minhas Campanhas</strong>
              <small>Continue sua jornada</small>
            </button>
          </div>
        </div>
      </section>`;
  }

  function od85CampaignNameForCharacter(char) {
    if (!char) return 'Fora de Campanha';
    const campaigns = typeof getCampaigns === 'function' ? getCampaigns() : [];
    const members = typeof getMembers === 'function' ? getMembers() : [];
    const linked = members
      .filter(member => String(member.characterId || '') === String(char.id || ''))
      .map(member => campaigns.find(campaign => String(campaign.id || '') === String(member.campaignId || '')))
      .filter(Boolean);
    const uniqueNames = [...new Set(linked.map(campaign => campaign.name || 'Campanha'))];
    return uniqueNames.length ? uniqueNames.join(', ') : 'Fora de Campanha';
  }

  function od71RenderCharacters(content) {
    const chars = userCharacters ? userCharacters() : [];
    content.innerHTML = `
      <section class="od71-page-head">
        <div>
          <h1>Seus Personagens</h1>
          <div class="od71-count">${chars.length}/${OD71_LIMITS.characters} personagens</div>
        </div>
        <div class="od71-actions">
          <button class="od71-action primary" type="button" id="od71-new-character">+ Novo Personagem</button>
        </div>
      </section>
      <section class="od71-list od85-character-list" id="od71-character-list"></section>`;
    const list = document.getElementById('od71-character-list');
    if (!list) return;
    if (!chars.length) {
      list.innerHTML = `<div class="od71-empty">Você ainda não tem personagens. Crie o primeiro para começar.</div>`;
      return;
    }
    list.innerHTML = chars.slice(0, OD71_LIMITS.characters).map(char => {
      const campaignName = od85CampaignNameForCharacter(char);
      return `
      <article class="od71-character-card od85-character-card">
        <img src="${escapeHtml(char.portrait || 'assets/logo.jpg')}" alt="" />
        <div class="od71-card-body">
          <h3>${escapeHtml(char.name || 'Novo Personagem')}</h3>
          <div class="od71-card-meta">${escapeHtml(char.race || 'Raça')} • ${escapeHtml(char.className || 'Classe')} • Nv. ${escapeHtml(char.level || 1)}</div>
          <div class="od71-card-row od85-campaign-row"><small>${escapeHtml(campaignName)}</small></div>
          <div class="od71-card-row end od85-card-actions">
            <button class="od71-card-btn" type="button" data-od71-open-character="${escapeHtml(char.id)}">Acessar Ficha</button>
            <button class="od71-card-btn danger od85-delete-character" type="button" data-od71-delete-character="${escapeHtml(char.id)}">Excluir</button>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  function od71RenderCampaigns(content) {
    const campaigns = getCampaigns ? getCampaigns() : [];
    const members = (getMembers ? getMembers() : []).filter(m => m.userId === currentUser?.id);
    const userCampaigns = members.map(member => ({ member, campaign: campaigns.find(c => c.id === member.campaignId) })).filter(x => x.campaign).slice(0, OD71_LIMITS.campaigns);
    content.innerHTML = `
      <section class="od71-page-head">
        <div>
          <h1>Suas Campanhas</h1>
          <div class="od71-count">${userCampaigns.length}/${OD71_LIMITS.campaigns} campanhas</div>
        </div>
        <div class="od71-actions">
          <button class="od71-action" type="button" id="od71-open-join">↪ Entrar</button>
          <button class="od71-action primary" type="button" id="od71-new-campaign">+ Nova Campanha</button>
        </div>
      </section>
      <div class="od71-mini-form" id="od71-join-form">
        <input id="od71-join-code" maxlength="5" placeholder="Código da campanha" />
        <button class="od71-action primary" type="button" id="od71-join-confirm">Entrar</button>
      </div>
      <section class="od71-list" id="od71-campaign-list"></section>`;
    const list = document.getElementById('od71-campaign-list');
    if (!list) return;
    if (!userCampaigns.length) {
      list.innerHTML = `<div class="od71-empty">Você ainda não criou ou entrou em nenhuma campanha.</div>`;
      return;
    }
    const chars = get(STORAGE.characters, []);
    list.innerHTML = userCampaigns.map(({ member, campaign }) => {
      const char = chars.find(c => c.id === member.characterId);
      return `
        <article class="od71-campaign-card">
          <div class="od71-campaign-top">
            <div class="od71-card-body">
              <h3>${escapeHtml(campaign.name || 'Campanha')}</h3>
              <div class="od71-card-meta">Código: <b>${escapeHtml(campaign.code)}</b> • Papel: ${escapeHtml(member.role || 'jogador')}</div>
            </div>
            <div class="od71-campaign-preview">
              <img src="${escapeHtml(char?.portrait || 'assets/logo.jpg')}" alt="" />
              <span>${char ? escapeHtml(char.name) : 'Sem ficha escolhida'}</span>
            </div>
          </div>
          <div class="od71-card-row end">
            <button class="od71-card-btn primary" type="button" data-enter-campaign="${campaign.id}">Acessar</button>
            <button class="od71-card-btn" type="button" data-choose-campaign-char="${campaign.id}">Escolher Ficha</button>
            ${campaign.ownerId === currentUser?.id ? `<button class="od71-card-btn" type="button" data-copy-code="${campaign.code}">Copiar Código</button><button class="od71-card-btn" type="button" data-delete-campaign="${campaign.id}">Excluir</button>` : `<button class="od71-card-btn" type="button" data-leave-campaign="${campaign.id}">Sair</button>`}
          </div>
        </article>`;
    }).join('');
  }

  function od71RenderPlaceholder(content, title, text) {
    content.innerHTML = `
      <section class="od71-page-head"><div><h1>${escapeHtml(title)}</h1><div class="od71-count">Em desenvolvimento</div></div></section>
      <div class="od71-placeholder">${escapeHtml(text)}</div>`;
  }

  async function od71CreateCharacter() {
    const chars = userCharacters ? userCharacters() : [];
    if (chars.length >= OD71_LIMITS.characters) return alert('Limite de 20 personagens atingido.');
    const btn = document.getElementById('create-account-character-btn');
    if (btn) btn.click();
    else if (typeof createAccountCharacter === 'function') createAccountCharacter(false);
    od71SetTab('characters');
  }

  async function od71CreateCampaign() {
    const owned = (getCampaigns ? getCampaigns() : []).filter(c => c.ownerId === currentUser?.id);
    if (owned.length >= OD71_LIMITS.campaigns) return alert('Limite de 10 campanhas criadas atingido.');
    const name = prompt('Nome da campanha:');
    if (!name) return;
    const input = document.getElementById('new-campaign-name');
    if (input) input.value = name;
    if (typeof createCampaign === 'function') await createCampaign();
    od71SetTab('campaigns');
  }

  document.addEventListener('click', async event => {
    const tab = event.target.closest('[data-od71-tab]');
    if (tab) {
      event.preventDefault();
      od71SetTab(tab.dataset.od71Tab);
      return;
    }
    if (event.target.closest('#od71-create-character') || event.target.closest('#od71-new-character')) {
      event.preventDefault();
      await od71CreateCharacter();
      return;
    }
    if (event.target.closest('#od71-create-campaign-home') || event.target.closest('#od71-new-campaign')) {
      event.preventDefault();
      await od71CreateCampaign();
      return;
    }
    const deleteChar = event.target.closest('[data-od71-delete-character]');
    if (deleteChar) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = deleteChar.dataset.od71DeleteCharacter;
      if (typeof deleteAccountCharacter === 'function') {
        await Promise.resolve(deleteAccountCharacter(id));
        od71SetTab('characters');
      }
      return;
    }
    const openChar = event.target.closest('[data-od71-open-character]');
    if (openChar) {
      event.preventDefault();
      if (typeof initAccountCharacterEditor === 'function') initAccountCharacterEditor(openChar.dataset.od71OpenCharacter);
      return;
    }
    if (event.target.closest('#od71-open-join')) {
      event.preventDefault();
      document.getElementById('od71-join-form')?.classList.toggle('active');
      document.getElementById('od71-join-code')?.focus();
      return;
    }
    if (event.target.closest('#od71-join-confirm')) {
      event.preventDefault();
      const src = document.getElementById('od71-join-code');
      const dst = document.getElementById('join-campaign-code');
      if (src && dst) dst.value = src.value;
      if (typeof joinCampaignByCode === 'function') await joinCampaignByCode();
      od71SetTab('campaigns');
      return;
    }
    if (event.target.closest('#od71-settings-btn')) {
      event.preventDefault();
      document.getElementById('sessions-menu-btn')?.click();
      return;
    }
    if (event.target.closest('#od71-account-btn')) {
      event.preventDefault();
      document.getElementById('open-account-settings-btn')?.click();
      return;
    }
  }, true);

  const od71BaseShowSessions = showSessions;
  showSessions = function() {
    od71BaseShowSessions();
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) od71Tab = tab;
    else if (location.pathname.includes('personagens')) od71Tab = 'characters';
    else if (location.pathname.includes('campanhas')) od71Tab = 'campaigns';
    else if (location.pathname.includes('inicio')) od71Tab = 'home';
    if (!['home','characters','campaigns'].includes(od71Tab)) od71Tab = 'home';
    od71RenderShell();
  };

  const od71BaseRenderAccountCharacterMenu = renderAccountCharacterMenu;
  renderAccountCharacterMenu = function() {
    od71BaseRenderAccountCharacterMenu();
    if (document.getElementById('sessions-screen')?.classList.contains('active')) od71RenderContent();
  };

  const od71BaseRenderCampaignMenu = renderCampaignMenu;
  renderCampaignMenu = function() {
    od71BaseRenderCampaignMenu();
    if (document.getElementById('sessions-screen')?.classList.contains('active')) od71RenderContent();
  };

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(location.search);
    od71Tab = params.get('tab') || (location.pathname.includes('personagens') ? 'characters' : location.pathname.includes('campanhas') ? 'campaigns' : 'home');
    if (!['home','characters','campaigns'].includes(od71Tab)) od71Tab = 'home';
    if (document.getElementById('sessions-screen')?.classList.contains('active')) od71RenderShell();
  });
})();

/* =========================
   V72-V74 - organização manual, OBS e micro-otimizações
========================= */
(function od74QualityPatch(){






  function od74EnhanceAllSortable() {
    // V81: ordenação antiga v74 removida; a ordenação oficial fica no patch v80.
    od74InjectObsButton();
  }

  document.addEventListener('click', event => {
    const obsBtn = event.target.closest('[data-copy-obs-link]');
    if (obsBtn) {
      event.preventDefault();
      const char = currentChar();
      if (!char?.id) return alert('Abra uma ficha antes de copiar o link OBS.');
      const mode = obsBtn.dataset.copyObsLink || 'card';
      const url = `${location.origin}/obs/personagem/${encodeURIComponent(char.id)}?modo=${encodeURIComponent(mode)}`;
      navigator.clipboard?.writeText(url).then(() => alert('Link OBS copiado.')).catch(() => prompt('Copie o link OBS:', url));
    }
  }, true);

  function od74WrapRender(name) {
    const original = window[name] || globalThis[name];
    if (typeof original !== 'function' || original.__od74Wrapped) return;
    const wrapped = function(...args) {
      const result = original.apply(this, args);
      setTimeout(od74EnhanceAllSortable, 0);
      return result;
    };
    wrapped.__od74Wrapped = true;
    try { window[name] = wrapped; } catch (_) {}
    try { globalThis[name] = wrapped; } catch (_) {}
  }

  ['renderSpells','renderAbilities','renderAttacks','renderSimpleInventory','loadCharacter','initApp'].forEach(od74WrapRender);

  function od74InjectObsButton() {
    const portraitBtn = document.getElementById('portrait-button');
    if (!portraitBtn || document.getElementById('obs-copy-link-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'obs-copy-link-btn';
    btn.type = 'button';
    btn.className = 'obs-copy-link-btn';
    btn.dataset.copyObsLink = 'card';
    btn.textContent = 'OBS';
    btn.title = 'Copiar link OBS desta ficha';
    portraitBtn.insertAdjacentElement('afterend', btn);
  }

  function od74AddCounters() {
    const sections = [
      ['account-character-list', 20, 'personagens'],
      ['campaign-list', 10, 'campanhas']
    ];
    sections.forEach(([id, limit, label]) => {
      const list = document.getElementById(id);
      if (!list) return;
      const title = list.closest('.manga-panel')?.querySelector('h2, h3');
      if (!title || title.querySelector('.list-section-count')) return;
      const count = document.createElement('span');
      count.className = 'list-section-count';
      const update = () => { count.textContent = ` ${list.children.length}/${limit} ${label}`; };
      title.appendChild(count);
      update();
      new MutationObserver(update).observe(list, { childList: true });
    });
  }

  function od74ThrottleInputSave() {
    let pending = false;
    document.addEventListener('input', () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; });
    }, { passive: true });
  }

  setTimeout(() => {
    od74EnhanceAllSortable();
    od74AddCounters();
    od74ThrottleInputSave();
  }, 250);
})();

/* =========================
   V75 - limpeza de layout, rotas simples, sidebar e perícias compactas
========================= */
(function od75LayoutPatch(){
  const TAB_TO_PATH = { home: '/inicio', characters: '/personagens', campaigns: '/campanhas' };
  const PATH_TO_TAB = { '/inicio': 'home', '/mesas': 'home', '/personagens': 'characters', '/campanhas': 'campaigns' };

  function od75AvatarSrc() {
    return currentUser?.avatar || currentUser?.avatarUrl || currentUser?.portrait || 'assets/logo.jpg';
  }

  function od75CurrentRole() {
    if (!currentCampaignId || !currentUser) return 'Conta One Dice';
    const member = getMembers().find(m => m.campaignId === currentCampaignId && m.userId === currentUser.id);
    return member?.role === 'mestre' ? 'Mestre da mesa' : member?.role === 'jogador' ? 'Jogador da mesa' : 'Conta One Dice';
  }

  function od75TabFromLocation() {
    const path = location.pathname.replace(/\/$/, '') || '/inicio';
    if (PATH_TO_TAB[path]) return PATH_TO_TAB[path];
    const params = new URLSearchParams(location.search);
    const legacy = params.get('tab');
    if (legacy === 'characters') return 'characters';
    if (legacy === 'campaigns') return 'campaigns';
    return localStorage.getItem('od71_tab') || 'home';
  }

  function od75CleanPathForTab(tab) {
    const path = TAB_TO_PATH[tab] || '/inicio';
    try {
      if (location.pathname !== path) history.replaceState({ od75Tab: tab }, '', path);
    } catch (_) {}
  }

  function od75NavButton(tab, icon, label) {
    const active = (localStorage.getItem('od71_tab') || od75TabFromLocation()) === tab;
    return `<button class="od71-nav-btn ${active ? 'active' : ''}" type="button" data-od75-tab="${tab}" data-od71-tab="${tab}"><span>${icon}</span>${label}</button>`;
  }

  function od75EnhanceDashboardShell() {
    const shell = document.getElementById('od71-shell');
    if (!shell) return;
    const tab = od75TabFromLocation();
    localStorage.setItem('od71_tab', tab);

    const logoWrap = shell.querySelector('.od71-logo');
    if (logoWrap) {
      logoWrap.classList.add('od82-logo-static');
      logoWrap.removeAttribute('data-od71-tab');
      logoWrap.removeAttribute('data-od75-tab');
      logoWrap.removeAttribute('role');
      logoWrap.removeAttribute('tabindex');
      logoWrap.title = '';
    }
    const logo = shell.querySelector('.od71-logo img');
    if (logo) logo.src = 'assets/logo-completa.png';

    const nav = shell.querySelector('.od71-main-nav');
    if (nav) {
      nav.innerHTML = `
        ${od75NavButton('home', '◆', 'Início')}
        ${od75NavButton('characters', '♙', 'Personagens')}
        ${od75NavButton('campaigns', '⚔', 'Campanhas')}`;
    }

    const settings = document.getElementById('od71-settings-btn');
    if (settings) settings.remove();

    const user = document.getElementById('od71-account-btn');
    if (user) {
      user.innerHTML = `<img src="${escapeHtml(od75AvatarSrc())}" alt="Perfil" />`;
      user.title = 'Configurações da conta';
    }

    const content = document.getElementById('od71-content');
    if (content && !['home','characters','campaigns'].includes(tab)) {
      localStorage.setItem('od71_tab', 'home');
      od75CleanPathForTab('home');
    } else {
      od75CleanPathForTab(tab);
    }
  }

  function od75EnhanceMenuPanel() {
    const panel = document.getElementById('sessions-menu-panel');
    if (!panel || panel.querySelector('.od75-account-menu-card')) return;
    const card = document.createElement('div');
    card.className = 'od75-account-menu-card';
    card.innerHTML = `
      <img src="${escapeHtml(od75AvatarSrc())}" alt="Perfil" />
      <div>
        <strong>${escapeHtml(userDisplayName(currentUser || {}))}</strong>
        <small>${escapeHtml(currentUser?.nick ? '@' + currentUser.nick : 'Conta One Dice')}</small>
        <small>${escapeHtml(od75CurrentRole())}</small>
      </div>`;
    panel.prepend(card);
  }

  function od75ReplaceSheetButtons() {
    const sheetButtons = [document.getElementById('toggle-account-panel-btn'), document.getElementById('sidebar-dock-btn')].filter(Boolean);
    sheetButtons.forEach(btn => {
      btn.innerHTML = `<img src="assets/folha.jpg" alt="Fichas" />`;
      btn.classList.add('od75-sheet-fab');
      btn.title = 'Minhas Fichas';
      btn.setAttribute('aria-label', 'Minhas Fichas');
    });
  }

  function od75UserCampaignCharacters() {
    const allChars = get(STORAGE.characters, []);
    if (!currentUser) return [];
    if (!currentCampaignId) return allChars.filter(c => c.ownerId === currentUser.id);
    const myMembers = getMembers().filter(m => m.campaignId === currentCampaignId && m.userId === currentUser.id);
    const linked = myMembers.map(m => allChars.find(c => c.id === m.characterId)).filter(Boolean);
    const extras = allChars.filter(c => c.ownerId === currentUser.id && !linked.some(x => x.id === c.id));
    return [...linked, ...extras].filter((char, index, arr) => arr.findIndex(c => c.id === char.id) === index);
  }

  renderCharacterList = function() {
    const list = document.getElementById('character-list');
    if (!list) return;
    const chars = od75UserCampaignCharacters();
    list.innerHTML = '';
    if (!chars.length) {
      list.innerHTML = `<div class="campaign-empty">Você ainda não tem ficha nesta conta.</div>`;
      od75ReplaceSheetButtons();
      return;
    }
    chars.forEach(char => {
      const active = char.id === currentCharacterId;
      const el = document.createElement('div');
      el.className = `character-pill session-character ${active ? 'active' : ''}`;
      el.innerHTML = `
        <div class="session-char-top">
          <img src="${escapeHtml(char.portrait || 'assets/logo.jpg')}" alt="" />
          <div class="session-char-info">
            <strong class="session-char-name">${escapeHtml(char.name || 'Personagem')}</strong>
            <span class="session-char-footer">${escapeHtml(char.race || 'Raça')} • ${escapeHtml(char.className || 'Classe')} • Nv. ${escapeHtml(char.level || 1)}</span>
            <small class="session-char-owner">PV ${escapeHtml(v35ResourceText(char.pvCurrent, char.pvMax))} • PE ${escapeHtml(v35ResourceText(char.peCurrent, char.peMax))}</small>
          </div>
        </div>`;
      el.onclick = () => {
        saveCurrentCharacter();
        currentCharacterId = char.id;
        loadCharacter(char.id);
        if (v35IsMaster()) document.body.classList.add('master-sheet-open');
        renderTableExperience();
      };
      list.appendChild(el);
    });
    od75ReplaceSheetButtons();
  };

  function od75AttrShort(attrKey) {
    const map = { forca: 'FOR', agilidade: 'AGI', vigor: 'VIG', intelecto: 'INT', presenca: 'PRE' };
    return map[attrKey] || String(attrKey || '').slice(0, 3).toUpperCase();
  }

  function od75SkillRow(char, skillName, attrKey) {
    char.skills = char.skills || {};
    const skill = char.skills[skillName] || { trained: false, bonus: 0 };
    return `
      <tr>
        <td class="od75-skill-name">${escapeHtml(skillName)}</td>
        <td class="od75-skill-attr">${escapeHtml(od75AttrShort(attrKey))}</td>
        <td class="od75-skill-mod">${escapeHtml(formatMod(attrMod(char.attrs?.[attrKey] ?? 1)))}${agilityOverweightPenalty(char, attrKey) ? ' <small class="skill-penalty">-5</small>' : ''}</td>
        <td class="od75-skill-bonus"><input data-skill-bonus="${escapeHtml(skillName)}" type="number" value="${escapeHtml(skill.bonus || 0)}"></td>
        <td class="od75-skill-total ${agilityOverweightPenalty(char, attrKey) ? 'penalized' : ''}">${escapeHtml(formatMod(skillTotal(char, skillName, attrKey)))}</td>
        <td class="od75-skill-roll"><button class="primary-btn small roll-skill" data-skill="${escapeHtml(skillName)}" data-skill-attr="${escapeHtml(attrKey)}">D20</button></td>
      </tr>`;
  }

  renderSkills = function(char) {
    const wrap = document.getElementById('skills-wrap');
    if (!wrap || !char) return;
    wrap.className = 'table-wrap od75-skills-wrap';
    const trained = SKILLS.filter(([name]) => !!char.skills?.[name]?.trained);
    const untrained = SKILLS.filter(([name]) => !char.skills?.[name]?.trained);
    const tableHead = `<thead><tr><th>Nome</th><th>Atr.</th><th>Mod</th><th>Bônus</th><th>Total</th><th>Rolar</th></tr></thead>`;
    const build = (title, rows, empty) => `
      <section class="od75-skill-block">
        <h4>${title}</h4>
        <table class="od75-skill-table">${tableHead}<tbody>${rows.length ? rows.map(([n,a]) => od75SkillRow(char,n,a)).join('') : `<tr><td colspan="6">${empty}</td></tr>`}</tbody></table>
      </section>`;
    wrap.innerHTML = `<div class="od75-skills-grid">
      ${build('Treinadas', trained, 'Nenhuma perícia treinada marcada.')}
      ${build('Não treinadas', untrained, 'Todas as perícias estão treinadas.')}
    </div>`;
    wrap.querySelectorAll('[data-skill-bonus]').forEach(input => {
      input.addEventListener('change', () => {
        const name = input.dataset.skillBonus;
        updateChar(saved => {
          saved.skills = saved.skills || {};
          saved.skills[name] = saved.skills[name] || { trained: false, bonus: 0, disadvantage: false };
          saved.skills[name].bonus = Number(input.value || 0);
        });
        const updated = currentChar();
        if (updated) { renderSkills(updated); updateDerivedStatsDisplay(updated); }
      });
    });
  };

  function od75AddOrderControls() {
    // V81: controles antigos v75 removidos; mantido como no-op para compatibilidade
    // com chamadas antigas dentro deste patch de layout.
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-od75-tab]');
    if (tab) {
      const next = tab.dataset.od75Tab;
      localStorage.setItem('od71_tab', next);
      setTimeout(() => { od75CleanPathForTab(next); od75EnhanceDashboardShell(); }, 0);
    }

    if (event.target.closest('#sessions-menu-btn, .topbar-menu-toggle')) {
      setTimeout(() => { od75EnhanceMenuPanel(); od75ReplaceSheetButtons(); }, 0);
    }
  }, true);

  const baseShowSessions75 = showSessions;
  showSessions = function() {
    const tab = od75TabFromLocation();
    localStorage.setItem('od71_tab', tab);
    baseShowSessions75();
    setTimeout(() => { od75EnhanceDashboardShell(); od75EnhanceMenuPanel(); od75ReplaceSheetButtons(); }, 0);
  };

  const baseRenderCampaignMenu75 = renderCampaignMenu;
  renderCampaignMenu = function() {
    baseRenderCampaignMenu75();
    setTimeout(() => { od75EnhanceDashboardShell(); od75ReplaceSheetButtons(); }, 0);
  };

  const baseRenderAccountCharacterMenu75 = renderAccountCharacterMenu;
  renderAccountCharacterMenu = function() {
    baseRenderAccountCharacterMenu75();
    setTimeout(() => { od75EnhanceDashboardShell(); od75ReplaceSheetButtons(); }, 0);
  };

  window.addEventListener('popstate', () => setTimeout(od75EnhanceDashboardShell, 0));

  setTimeout(() => {
    od75EnhanceDashboardShell();
    od75EnhanceMenuPanel();
    od75ReplaceSheetButtons();
    if (currentChar()) { renderSkills(currentChar()); od75AddOrderControls(); }
  }, 250);
})();


/* =========================
   V76 - Remoção real de abas extras da barra principal
========================= */
(function od76RemoveUnusedTabs(){
  const allowed = new Set(['home', 'characters', 'campaigns']);
  function cleanTabs() {
    document.querySelectorAll('[data-od71-tab="bestiary"], [data-od71-tab="community"], [data-od71-tab="map"]').forEach(el => el.remove());
    const params = new URLSearchParams(location.search);
    const current = params.get('tab');
    if (current && !allowed.has(current)) {
      try { history.replaceState({ od71Tab: 'home' }, '', '/inicio'); } catch (_) {}
    }
  }
  document.addEventListener('click', cleanTabs, true);
  window.addEventListener('popstate', cleanTabs);
  const mo = new MutationObserver(cleanTabs);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(cleanTabs, 0);
  setTimeout(cleanTabs, 250);
})();

/* =========================
   V78 - Minhas Fichas flutuante sem aba fixa
========================= */
(function od78FloatingSheets(){
  function applyFloatingSheets() {
    const sidebar = document.getElementById('players-sidebar');
    if (!sidebar) return;
    sidebar.classList.add('od78-floating-sheets');
    sidebar.setAttribute('role', 'dialog');
    sidebar.setAttribute('aria-label', 'Minhas Fichas');

    const close = sidebar.querySelector('.sidebar-toggle-btn');
    if (close) {
      close.textContent = '×';
      close.title = 'Fechar Minhas Fichas';
      close.setAttribute('aria-label', 'Fechar Minhas Fichas');
    }

    const dock = document.getElementById('sidebar-dock-btn');
    if (dock) {
      dock.classList.add('od62-app-sheet-btn');
      dock.classList.remove('hidden');
      dock.title = document.body.classList.contains('sidebar-collapsed') ? 'Abrir Minhas Fichas' : 'Fechar Minhas Fichas';
      dock.setAttribute('aria-expanded', String(!document.body.classList.contains('sidebar-collapsed')));
      dock.setAttribute('aria-controls', 'players-sidebar');
    }
  }

  function setSheetsOpen(open) {
    document.body.classList.toggle('sidebar-collapsed', !open);
    try { localStorage.setItem('od_sidebar_collapsed', open ? '0' : '1'); } catch (_) {}
    applyFloatingSheets();
  }

  document.addEventListener('click', (event) => {
    const dock = event.target.closest('#sidebar-dock-btn');
    if (dock) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const willOpen = document.body.classList.contains('sidebar-collapsed');
      setSheetsOpen(willOpen);
      return;
    }

    const close = event.target.closest('#players-sidebar .sidebar-toggle-btn');
    if (close) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setSheetsOpen(false);
      return;
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.body.classList.contains('sidebar-collapsed')) {
      setSheetsOpen(false);
    }
  });

  const previousRenderList = typeof renderCharacterList === 'function' ? renderCharacterList : null;
  if (previousRenderList) {
    renderCharacterList = function(...args) {
      const result = previousRenderList.apply(this, args);
      applyFloatingSheets();
      return result;
    };
  }

  const previousShowApp = typeof showApp === 'function' ? showApp : null;
  if (previousShowApp) {
    showApp = function(...args) {
      const result = previousShowApp.apply(this, args);
      setTimeout(applyFloatingSheets, 0);
      return result;
    };
  }

  setTimeout(() => {
    setSheetsOpen(false);
    applyFloatingSheets();
  }, 80);
})();


/* =========================
   V79 - Perícias em abas e cards compactos
========================= */
(function od79SkillsTabsPatch(){
  window.od79SkillTab = window.od79SkillTab || 'trained';

  function od79AttrShort(attrKey) {
    const map = { forca: 'FOR', agilidade: 'AGI', vigor: 'VIG', intelecto: 'INT', presenca: 'PRE' };
    return map[attrKey] || String(attrKey || '').slice(0, 3).toUpperCase();
  }

  function od79SkillCard(char, skillName, attrKey, trainedTab) {
    char.skills = char.skills || {};
    const skill = char.skills[skillName] || { trained: false, bonus: 0, disadvantage: false };
    const modValue = attrMod(char.attrs?.[attrKey] ?? 1) - agilityOverweightPenalty(char, attrKey);
    const totalValue = skillTotal(char, skillName, attrKey);
    const checked = !!skill.trained;
    return `
      <article class="od79-skill-card ${checked ? 'is-trained' : 'is-untrained'}">
        <label class="od79-skill-check" title="Marcar como treinada">
          <input data-skill-trained="${escapeHtml(skillName)}" type="checkbox" ${checked ? 'checked' : ''}>
          <span>${trainedTab ? 'Treinada' : 'Treinar'}</span>
        </label>
        <div class="od79-skill-main">
          <strong class="od79-skill-name">${escapeHtml(skillName)}</strong>
          <span class="od79-skill-attr">${escapeHtml(od79AttrShort(attrKey))}</span>
        </div>
        <div class="od79-skill-stats">
          <span><small>Mod</small><b>${escapeHtml(formatMod(modValue))}</b></span>
          <label><small>Bônus</small><input data-skill-bonus="${escapeHtml(skillName)}" type="number" value="${escapeHtml(skill.bonus || 0)}"></label>
          <span><small>Total</small><b class="od79-skill-total">${escapeHtml(formatMod(totalValue))}</b></span>
          <button class="primary-btn small roll-skill od79-skill-roll" data-skill="${escapeHtml(skillName)}" data-skill-attr="${escapeHtml(attrKey)}">D20</button>
        </div>
      </article>`;
  }

  function od79SetCompactButtonText() {
    const btn = document.getElementById('compact-skills-toggle');
    if (btn) btn.textContent = window.od79SkillTab === 'trained' ? 'Mostrar Não Treinadas' : 'Mostrar Treinadas';
  }

  const od79BaseApplySettings = typeof applySettings === 'function' ? applySettings : null;
  if (od79BaseApplySettings) {
    applySettings = function() {
      od79BaseApplySettings();
      od79SetCompactButtonText();
    };
  }

  renderSkills = function(char) {
    const wrap = document.getElementById('skills-wrap');
    if (!wrap || !char) return;
    char.skills = char.skills || {};
    wrap.className = 'table-wrap od79-skills-wrap';

    const trained = SKILLS.filter(([name]) => !!char.skills?.[name]?.trained);
    const untrained = SKILLS.filter(([name]) => !char.skills?.[name]?.trained);
    const active = window.od79SkillTab === 'untrained' ? 'untrained' : 'trained';
    const rows = active === 'trained' ? trained : untrained;
    const title = active === 'trained' ? 'Perícias Treinadas' : 'Perícias Não Treinadas';
    const empty = active === 'trained' ? 'Nenhuma perícia treinada marcada.' : 'Todas as perícias estão treinadas.';

    wrap.innerHTML = `
      <div class="od79-skills-shell">
        <div class="od79-skills-tabs" role="tablist" aria-label="Filtro de perícias">
          <button type="button" class="od79-skill-tab ${active === 'trained' ? 'active' : ''}" data-od79-skill-tab="trained">Treinadas <span>${trained.length}</span></button>
          <button type="button" class="od79-skill-tab ${active === 'untrained' ? 'active' : ''}" data-od79-skill-tab="untrained">Não Treinadas <span>${untrained.length}</span></button>
        </div>
        <section class="od79-skill-panel">
          <header class="od79-skill-panel-head">
            <h4>${title}</h4>
            <small>Nome • atributo • mod • bônus • total • rolagem</small>
          </header>
          <div class="od79-skills-card-grid">
            ${rows.length ? rows.map(([n,a]) => od79SkillCard(char, n, a, active === 'trained')).join('') : `<div class="od79-skill-empty">${empty}</div>`}
          </div>
        </section>
      </div>`;

    od79SetCompactButtonText();

    wrap.querySelectorAll('[data-od79-skill-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.od79SkillTab = btn.dataset.od79SkillTab === 'untrained' ? 'untrained' : 'trained';
        renderSkills(currentChar() || char);
      });
    });

    wrap.querySelectorAll('[data-skill-trained]').forEach(input => {
      input.addEventListener('change', () => {
        const name = input.dataset.skillTrained;
        updateChar(saved => {
          saved.skills = saved.skills || {};
          saved.skills[name] = saved.skills[name] || { trained: false, bonus: 0, disadvantage: false };
          saved.skills[name].trained = input.checked;
        });
        const updated = currentChar();
        if (updated) { renderSkills(updated); updateDerivedStatsDisplay(updated); }
      });
    });

    wrap.querySelectorAll('[data-skill-bonus]').forEach(input => {
      input.addEventListener('change', () => {
        const name = input.dataset.skillBonus;
        updateChar(saved => {
          saved.skills = saved.skills || {};
          saved.skills[name] = saved.skills[name] || { trained: false, bonus: 0, disadvantage: false };
          saved.skills[name].bonus = Number(input.value || 0);
        });
        const updated = currentChar();
        if (updated) { renderSkills(updated); updateDerivedStatsDisplay(updated); }
      });
    });
  };

  document.addEventListener('click', event => {
    const toggle = event.target.closest('#compact-skills-toggle');
    if (!toggle) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.od79SkillTab = window.od79SkillTab === 'trained' ? 'untrained' : 'trained';
    const char = currentChar();
    if (char) renderSkills(char);
  }, true);

  setTimeout(() => {
    od79SetCompactButtonText();
    const char = currentChar && currentChar();
    if (char) renderSkills(char);
  }, 80);
})();

/* =========================
   V80 - Correção isolada das setas de ordenação
   - Remove controles duplicados da v74/v75
   - Cria um único controle alinhado por card
   - Afeta apenas ataques, magias, habilidades e inventário simples
========================= */
(function od80OrderControlsFix() {
  const TARGETS = [
    { listId: 'attacks-list', cardSelector: '.attack-card' },
    { listId: 'spells-list', cardSelector: '.spell-card' },
    { listId: 'abilities-list', cardSelector: '.ability-card' },
    { listId: 'simple-inventory-list', cardSelector: '.simple-inventory-card' }
  ];

  let scheduled = false;

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceAll();
    });
  }

  function getCards(list) {
    if (!list) return [];
    return [...list.children].filter(card =>
      card.matches?.('.attack-card, .spell-card, .ability-card, .simple-inventory-card')
    );
  }

  function renumberList(list) {
    getCards(list).forEach((card, index) => {
      if (card.dataset) {
        card.dataset.index = String(index);
        card.dataset.inventoryIndex = String(index);
      }
    });
  }

  function saveOrder() {
    try {
      if (typeof saveCurrentCharacter === 'function') {
        saveCurrentCharacter();
      }

      const char = typeof currentChar === 'function' ? currentChar() : null;
      if (typeof od42ScheduleCharacterSave === 'function' && char) {
        od42ScheduleCharacterSave(char);
      }
    } catch (error) {
      console.warn('[One Dice v80] Falha ao salvar ordem:', error);
    }
  }

  function refreshButtons(list) {
    const cards = getCards(list);

    cards.forEach((card, index) => {
      card.dataset.index = String(index);
      card.dataset.inventoryIndex = String(index);

      const up = card.querySelector(':scope > .od80-card-order .od80-order-up');
      const down = card.querySelector(':scope > .od80-card-order .od80-order-down');

      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === cards.length - 1;
    });
  }

  function moveCard(button, direction) {
    const card = button.closest('.attack-card, .spell-card, .ability-card, .simple-inventory-card');
    const list = card?.parentElement;
    if (!card || !list) return;

    const sibling = direction < 0 ? card.previousElementSibling : card.nextElementSibling;
    if (!sibling) return;

    if (direction < 0) {
      list.insertBefore(card, sibling);
    } else {
      list.insertBefore(sibling, card);
    }

    renumberList(list);
    refreshButtons(list);
    saveOrder();
  }

  function cleanOldControls(card) {
    // V81: sem controles legados para remover; mantido para compatibilidade do fluxo v80.
  }

  function createControls() {
    const controls = document.createElement('div');
    controls.className = 'od80-card-order';
    controls.setAttribute('aria-label', 'Ordenar card');
    controls.innerHTML = `
      <button type="button" class="od80-order-btn od80-order-up" data-od80-order="up" title="Mover para cima" aria-label="Mover para cima">▲</button>
      <button type="button" class="od80-order-btn od80-order-down" data-od80-order="down" title="Mover para baixo" aria-label="Mover para baixo">▼</button>`;
    return controls;
  }

  function enhanceCard(card) {
    if (!card) return;

    card.classList.add('od80-sortable-card');
    cleanOldControls(card);

    if (!card.querySelector(':scope > .od80-card-order')) {
      card.appendChild(createControls());
    }
  }

  function enhanceList(target) {
    const list = document.getElementById(target.listId);
    if (!list) return;

    [...list.querySelectorAll(`:scope > ${target.cardSelector}`)].forEach(enhanceCard);
    refreshButtons(list);
  }

  function enhanceAll() {
    TARGETS.forEach(enhanceList);
  }

  function observeLists() {
    TARGETS.forEach(target => {
      const list = document.getElementById(target.listId);
      if (!list || list.dataset.od80Observed === '1') return;

      list.dataset.od80Observed = '1';
      new MutationObserver(scheduleEnhance).observe(list, {
        childList: true,
        subtree: true
      });
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-od80-order]');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    moveCard(button, button.dataset.od80Order === 'up' ? -1 : 1);
  }, true);

  function boot() {
    observeLists();
    enhanceAll();

    setTimeout(() => {
      observeLists();
      enhanceAll();
    }, 120);

    setTimeout(() => {
      observeLists();
      enhanceAll();
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.od80FixOrderControls = enhanceAll;
})();


/* V81 - limpeza: removidos painéis legados de backup local e controles antigos v74/v75 de ordenação. */

/* =========================
   V84 - Reparação do menu inicial
   - evita tela vazia caso o dashboard novo não renderize
   - adiciona engrenagem estável ao lado da conta
   - remove ações de clique da logo superior
   - aplica classe de tela inicial sem depender de :has()
========================= */
(function od84HomeRepair(){
  const PANEL_ID = 'od84-theme-panel';
  const BODY_CLASS = 'od84-session-home';

  function qs(sel, root = document) { return root.querySelector(sel); }

  function getSettingsSafe() {
    try {
      if (typeof get === 'function' && typeof STORAGE !== 'undefined') {
        return get(STORAGE.settings, { theme: 'light', accent: 'black', skillsCompact: true, font: 'impact', sound: true });
      }
    } catch (_) {}
    try { return JSON.parse(localStorage.getItem('od_settings') || '{}'); } catch (_) { return {}; }
  }

  function setSettingsSafe(mutator) {
    try {
      if (typeof updateSettings === 'function') {
        updateSettings(mutator);
        return;
      }
    } catch (_) {}
    const st = Object.assign({ theme: 'light', accent: 'black', skillsCompact: true, font: 'impact', sound: true }, getSettingsSafe());
    mutator(st);
    try { localStorage.setItem('od_settings', JSON.stringify(st)); } catch (_) {}
    try { if (typeof applySettings === 'function') applySettings(); } catch (_) {}
  }

  function avatarSrc() {
    try {
      const user = typeof currentUser !== 'undefined' ? currentUser : null;
      return user?.avatar || user?.avatarUrl || user?.portrait || user?.image || 'assets/account-logo.png';
    } catch (_) {
      return 'assets/account-logo.png';
    }
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'od84-theme-panel hidden';
    panel.innerHTML = `
      <div class="od84-theme-title">Aparência</div>
      <button id="od84-theme-toggle" class="od84-theme-action" type="button">Tema Escuro</button>
      <label>Cor do tema
        <select id="od84-accent-select">
          <option value="black">Preto</option>
          <option value="green">Verde</option>
          <option value="red">Vermelho</option>
          <option value="blue">Azul</option>
          <option value="gold">Dourado</option>
          <option value="purple">Roxo</option>
        </select>
      </label>
      <label>Fonte
        <select id="od84-font-select">
          <option value="impact">Fonte Manga</option>
          <option value="medieval">Fonte Medieval</option>
          <option value="clean">Fonte Limpa</option>
          <option value="mono">Fonte Técnica</option>
        </select>
      </label>
      <button id="od87-logout-btn" class="od84-theme-action od87-logout-action" type="button">Sair da Conta</button>`;
    document.body.appendChild(panel);
    return panel;
  }

  function syncPanel() {
    const st = getSettingsSafe();
    const toggle = document.getElementById('od84-theme-toggle');
    const accent = document.getElementById('od84-accent-select');
    const font = document.getElementById('od84-font-select');
    if (toggle) toggle.textContent = st.theme === 'dark' ? 'Tema Claro' : 'Tema Escuro';
    if (accent) accent.value = st.accent || 'black';
    if (font) font.value = st.font || 'impact';
  }

  function positionPanel() {
    const panel = ensurePanel();
    const btn = document.getElementById('od84-theme-btn') || document.getElementById('od71-settings-btn');
    if (!btn || panel.classList.contains('hidden')) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    panel.style.width = width + 'px';
    panel.style.left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width)) + 'px';
    panel.style.top = Math.max(12, Math.min(window.innerHeight - 20, rect.bottom + 10)) + 'px';
  }

  function togglePanel(force) {
    const panel = ensurePanel();
    const open = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    syncPanel();
    panel.classList.toggle('hidden', !open);
    document.getElementById('od84-theme-btn')?.classList.toggle('active', open);
    document.getElementById('od71-settings-btn')?.classList.toggle('active', open);
    if (open) positionPanel();
  }

  function protectTopLogo(shell) {
    shell.querySelectorAll('.od71-logo').forEach(logoWrap => {
      logoWrap.classList.add('od82-logo-static', 'od84-logo-static');
      logoWrap.removeAttribute('onclick');
      logoWrap.removeAttribute('role');
      logoWrap.removeAttribute('tabindex');
      logoWrap.removeAttribute('data-od71-tab');
      logoWrap.removeAttribute('data-od75-tab');
      logoWrap.title = '';
      const img = logoWrap.querySelector('img');
      if (img) img.src = 'assets/logo-completa.png';
    });
  }

  function ensureGear(shell) {
    const userArea = qs('.od71-user-area', shell);
    const account = document.getElementById('od71-account-btn');
    if (!userArea || !account) return;

    const old = document.getElementById('od71-settings-btn');
    if (old) old.remove();

    if (!document.getElementById('od84-theme-btn')) {
      const btn = document.createElement('button');
      btn.id = 'od84-theme-btn';
      btn.className = 'od71-icon-btn od84-theme-btn';
      btn.type = 'button';
      btn.title = 'Tema, cores e fonte';
      btn.setAttribute('aria-label', 'Tema, cores e fonte');
      btn.textContent = '⚙';
      userArea.insertBefore(btn, account);
    }

    if (!account.querySelector('img')) {
      account.innerHTML = `<img src="${typeof escapeHtml === 'function' ? escapeHtml(avatarSrc()) : avatarSrc()}" alt="Perfil" />`;
    }
  }

  function syncBodyState() {
    const sessions = document.getElementById('sessions-screen');
    const shell = document.getElementById('od71-shell');
    const homeHero = document.querySelector('#od71-content .od71-home-hero');
    const isSessions = !!sessions?.classList.contains('active');
    const isReady = !!(shell && shell.children.length && shell.offsetParent !== null);

    document.body.classList.toggle(BODY_CLASS, isSessions && !!homeHero);
    sessions?.classList.toggle('od84-dashboard-ready', !!shell && shell.children.length > 0);
    sessions?.classList.toggle('od84-session-mode', isSessions);

    if (shell) {
      shell.classList.add('od84-home-clean');
      protectTopLogo(shell);
      ensureGear(shell);
    }

    // Fallback: se por algum motivo o dashboard novo não apareceu, mostra o menu antigo
    // em vez de deixar a tela completamente vazia.
    if (isSessions && !isReady && !shell) {
      sessions?.classList.remove('od84-dashboard-ready');
    }

    ensurePanel();
    syncPanel();
  }

  document.addEventListener('click', event => {
    const logoClick = event.target.closest('.od71-logo, .od84-logo-static');
    if (logoClick) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    const themeBtn = event.target.closest('#od84-theme-btn, #od71-settings-btn');
    if (themeBtn) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      togglePanel();
      return;
    }

    if (!event.target.closest('#' + PANEL_ID)) togglePanel(false);

    const logoutBtn = event.target.closest('#od87-logout-btn');
    if (logoutBtn) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!confirm('Tem certeza que quer sair da conta?')) return;
      try {
        const oldLogout = document.getElementById('sessions-logout');
        if (oldLogout && oldLogout !== logoutBtn) {
          oldLogout.click();
          return;
        }
      } catch (_) {}
      try { if (typeof od42ClearSession === 'function') od42ClearSession(); } catch (_) {}
      try { if (typeof clearSessionValue === 'function') clearSessionValue(); } catch (_) {}
      try { currentUser = null; } catch (_) {}
      try { if (typeof showAuth === 'function') showAuth(); } catch (_) {}
      return;
    }

    const themeToggle = event.target.closest('#od84-theme-toggle');
    if (themeToggle) {
      event.preventDefault();
      setSettingsSafe(st => { st.theme = st.theme === 'dark' ? 'light' : 'dark'; });
      syncPanel();
      return;
    }
  }, true);

  document.addEventListener('change', event => {
    const accent = event.target.closest('#od84-accent-select');
    if (accent) {
      setSettingsSafe(st => { st.accent = accent.value; });
      syncPanel();
      return;
    }
    const font = event.target.closest('#od84-font-select');
    if (font) {
      setSettingsSafe(st => { st.font = font.value; });
      syncPanel();
      return;
    }
  }, true);

  const schedule = (() => {
    let pending = false;
    return () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        syncBodyState();
      });
    };
  })();

  window.addEventListener('resize', () => { syncBodyState(); positionPanel(); });
  window.addEventListener('scroll', positionPanel, true);

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  function boot() {
    syncBodyState();
    setTimeout(syncBodyState, 80);
    setTimeout(syncBodyState, 300);
    setTimeout(syncBodyState, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* =========================
   V86 - Menu Campanhas mestre: descrição, logo e jogadores
   - Redesenha apenas a aba Campanhas do dashboard
   - Criação/edição com descrição de até 200 caracteres
   - Logo por URL ou arquivo convertido em Data URL
   - Mostra total de jogadores/membros
========================= */
(function od86CampaignDashboardPatch(){
  const LIMIT = 5;
  let rendering = false;
  let editorMode = null;
  let editorCampaignId = null;
  let pendingLogoData = '';

  function od86CurrentTab() {
    const path = location.pathname.replace(/\/$/, '') || '/inicio';
    if (path.includes('campanhas')) return 'campaigns';
    return localStorage.getItem('od71_tab') || 'home';
  }

  function od86IsCampaignTab() {
    return document.getElementById('sessions-screen')?.classList.contains('active') && od86CurrentTab() === 'campaigns';
  }

  function od86Safe(value, fallback = '') {
    return String(value ?? fallback);
  }

  function od86CampaignLogo(campaign) {
    return campaign?.logoUrl || campaign?.logo_url || campaign?.logo || campaign?.settings?.logoUrl || campaign?.settings?.logo || 'assets/logo.jpg';
  }

  function od86CampaignDescription(campaign) {
    return (campaign?.description || campaign?.settings?.description || '').trim();
  }

  function od86CampaignCount(campaignId, campaign) {
    const direct = Number(campaign?.playerCount ?? campaign?.player_count ?? campaign?.membersCount ?? 0);
    if (direct > 0) return direct;
    return (typeof getMembers === 'function' ? getMembers() : []).filter(member => String(member.campaignId) === String(campaignId)).length;
  }

  function od86RoleLabel(role) {
    if (role === 'mestre' || role === 'master') return 'Mestre';
    if (role === 'mestre_jogador' || role === 'master_player') return 'Mestre + Jogador';
    return 'Jogador';
  }

  function od86SyncNav() {
    document.querySelectorAll('.od71-nav-btn').forEach(btn => {
      const target = btn.dataset.od71Tab || btn.dataset.od75Tab;
      btn.classList.toggle('active', target === 'campaigns');
    });
  }

  function od86EnsureEditor() {
    let dialog = document.getElementById('od86-campaign-editor');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'od86-campaign-editor';
    dialog.className = 'od86-campaign-editor od-modal';
    dialog.innerHTML = `
      <form method="dialog" class="modal-card od86-editor-card">
        <div class="modal-head">
          <h3 id="od86-editor-title">Nova Campanha</h3>
          <button class="icon-btn" type="button" id="od86-editor-close">×</button>
        </div>
        <div class="od86-editor-grid">
          <label>Nome da campanha
            <input id="od86-campaign-name" type="text" maxlength="80" placeholder="Nome da campanha" />
          </label>
          <label>Descrição breve <span id="od86-desc-count">0/200</span>
            <textarea id="od86-campaign-description" maxlength="200" placeholder="Resumo curto para jogadores entenderem a proposta"></textarea>
          </label>
          <label>Logo por URL
            <input id="od86-campaign-logo-url" type="url" placeholder="https://..." />
          </label>
          <label>Ou enviar logo
            <input id="od86-campaign-logo-file" type="file" accept="image/*" />
          </label>
          <div class="od86-logo-preview-box">
            <span>Prévia</span>
            <img id="od86-campaign-logo-preview" src="assets/logo.jpg" alt="Prévia da campanha" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="ghost-btn" type="button" id="od86-editor-cancel">Cancelar</button>
          <button class="primary-btn" type="button" id="od86-editor-save">Salvar Campanha</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function od86SetPreview(src) {
    const preview = document.getElementById('od86-campaign-logo-preview');
    if (preview) preview.src = src || 'assets/logo.jpg';
  }

  function od86OpenEditor(mode, campaignId = null) {
    editorMode = mode;
    editorCampaignId = campaignId;
    const dialog = od86EnsureEditor();
    const campaign = campaignId ? (getCampaigns ? getCampaigns() : []).find(c => String(c.id) === String(campaignId)) : null;
    pendingLogoData = campaign ? od86CampaignLogo(campaign) : '';
    document.getElementById('od86-editor-title').textContent = mode === 'edit' ? 'Editar Campanha' : 'Nova Campanha';
    document.getElementById('od86-campaign-name').value = campaign?.name || '';
    document.getElementById('od86-campaign-description').value = od86CampaignDescription(campaign);
    document.getElementById('od86-campaign-logo-url').value = campaign && !String(pendingLogoData).startsWith('data:') ? pendingLogoData : '';
    document.getElementById('od86-campaign-logo-file').value = '';
    document.getElementById('od86-desc-count').textContent = `${document.getElementById('od86-campaign-description').value.length}/200`;
    od86SetPreview(pendingLogoData || 'assets/logo.jpg');
    dialog.showModal();
    setTimeout(() => document.getElementById('od86-campaign-name')?.focus(), 30);
  }

  async function od86SaveEditor() {
    const name = document.getElementById('od86-campaign-name')?.value?.trim() || 'Nova Campanha';
    const description = (document.getElementById('od86-campaign-description')?.value || '').trim().slice(0, 200);
    const logoUrlInput = document.getElementById('od86-campaign-logo-url')?.value?.trim() || '';
    const logoUrl = pendingLogoData || logoUrlInput;

    try {
      if (editorMode === 'edit' && editorCampaignId) {
        await od42Api(`/api/tables/${editorCampaignId}`, {
          method: 'PUT',
          body: JSON.stringify({ name, description, logoUrl })
        });
      } else {
        await od42Api('/api/tables', {
          method: 'POST',
          body: JSON.stringify({ name, description, logoUrl })
        });
      }
      await od42RefreshTables();
      document.getElementById('od86-campaign-editor')?.close();
      od86RenderCampaigns(true);
    } catch (error) {
      alert(error.message || 'Erro ao salvar campanha.');
    }
  }

  function od86RenderCampaigns(force = false) {
    if (rendering || !od86IsCampaignTab()) return;
    const content = document.getElementById('od71-content');
    if (!content) return;
    if (!force && content.classList.contains('od86-campaigns-ready')) return;
    rendering = true;
    try {
      const campaigns = typeof getCampaigns === 'function' ? getCampaigns() : [];
      const members = (typeof getMembers === 'function' ? getMembers() : []).filter(m => String(m.userId) === String(currentUser?.id));
      const userCampaigns = members
        .map(member => ({ member, campaign: campaigns.find(c => String(c.id) === String(member.campaignId)) }))
        .filter(x => x.campaign)
        .slice(0, LIMIT);

      content.classList.add('od86-campaigns-ready');
      content.innerHTML = `
        <section class="od71-page-head od86-page-head">
          <div>
            <h1>Suas Campanhas</h1>
            <div class="od71-count">${userCampaigns.length}/${LIMIT} campanhas</div>
          </div>
          <div class="od71-actions od86-actions">
            <button class="od71-action" type="button" id="od86-open-join">↪ Entrar por Código</button>
            <button class="od71-action primary" type="button" id="od86-new-campaign">+ Nova Campanha</button>
          </div>
        </section>
        <div class="od71-mini-form od86-join-form" id="od86-join-form">
          <input id="od86-join-code" maxlength="5" placeholder="Código da campanha" />
          <button class="od71-action primary" type="button" id="od86-join-confirm">Entrar</button>
        </div>
        <section class="od86-campaign-list" id="od86-campaign-list"></section>`;

      const list = document.getElementById('od86-campaign-list');
      if (!userCampaigns.length) {
        list.innerHTML = `<div class="od71-empty od86-empty">Você ainda não criou ou entrou em nenhuma campanha.</div>`;
        od86SyncNav();
        return;
      }

      const chars = get(STORAGE.characters, []);
      list.innerHTML = userCampaigns.map(({ member, campaign }) => {
        const char = chars.find(c => String(c.id) === String(member.characterId));
        const isOwner = String(campaign.ownerId) === String(currentUser?.id);
        const playerCount = od86CampaignCount(campaign.id, campaign);
        const description = od86CampaignDescription(campaign) || 'Sem descrição breve. O mestre ainda não definiu o resumo desta campanha.';
        return `
          <article class="od86-campaign-card">
            <div class="od86-campaign-logo-wrap">
              <img src="${escapeHtml(od86CampaignLogo(campaign))}" alt="" />
            </div>
            <div class="od86-campaign-info">
              <div class="od86-campaign-title-row">
                <h3>${escapeHtml(campaign.name || 'Campanha')}</h3>
                <span class="od86-role-chip">${escapeHtml(od86RoleLabel(member.role))}</span>
              </div>
              <p class="od86-campaign-desc">${escapeHtml(description)}</p>
              <div class="od86-campaign-stats">
                <span>👥 ${escapeHtml(playerCount)} jogador${playerCount === 1 ? '' : 'es'}</span>
                <span>🔑 ${escapeHtml(campaign.code || '-----')}</span>
                <span>${char ? '🎭 ' + escapeHtml(char.name) : '🎭 Sem ficha escolhida'}</span>
              </div>
            </div>
            <div class="od86-campaign-actions">
              <button class="od71-card-btn primary" type="button" data-enter-campaign="${escapeHtml(campaign.id)}">Acessar</button>
              <button class="od71-card-btn" type="button" data-choose-campaign-char="${escapeHtml(campaign.id)}">Escolher Ficha</button>
              ${isOwner ? `<button class="od71-card-btn" type="button" data-od86-edit-campaign="${escapeHtml(campaign.id)}">Editar</button><button class="od71-card-btn" type="button" data-copy-code="${escapeHtml(campaign.code)}">Copiar Código</button><button class="od71-card-btn danger" type="button" data-delete-campaign="${escapeHtml(campaign.id)}">Excluir</button>` : `<button class="od71-card-btn danger" type="button" data-leave-campaign="${escapeHtml(campaign.id)}">Sair</button>`}
            </div>
          </article>`;
      }).join('');
      od86SyncNav();
    } finally {
      rendering = false;
    }
  }

  function od86Schedule(force = false) {
    setTimeout(() => od86RenderCampaigns(force), 0);
    setTimeout(() => od86RenderCampaigns(force), 120);
  }

  if (typeof od42TableFromRow === 'function' && !od42TableFromRow.__od86Wrapped) {
    const base = od42TableFromRow;
    od42TableFromRow = function(row) {
      const table = base(row);
      table.description = row?.description || row?.settings?.description || table.description || '';
      table.logoUrl = row?.logo_url || row?.logoUrl || row?.settings?.logoUrl || table.logoUrl || '';
      table.playerCount = Number(row?.player_count ?? row?.playerCount ?? table.playerCount ?? 0);
      return table;
    };
    od42TableFromRow.__od86Wrapped = true;
  }

  const baseRenderCampaignMenu86 = typeof renderCampaignMenu === 'function' ? renderCampaignMenu : null;
  if (baseRenderCampaignMenu86 && !baseRenderCampaignMenu86.__od86Wrapped) {
    renderCampaignMenu = function(...args) {
      const result = baseRenderCampaignMenu86.apply(this, args);
      od86Schedule(true);
      return result;
    };
    renderCampaignMenu.__od86Wrapped = true;
  }

  document.addEventListener('input', event => {
    if (event.target?.id === 'od86-campaign-description') {
      const count = document.getElementById('od86-desc-count');
      if (count) count.textContent = `${event.target.value.length}/200`;
    }
    if (event.target?.id === 'od86-campaign-logo-url') {
      pendingLogoData = '';
      od86SetPreview(event.target.value.trim() || 'assets/logo.jpg');
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target?.id !== 'od86-campaign-logo-file') return;
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingLogoData = String(reader.result || '');
      const urlInput = document.getElementById('od86-campaign-logo-url');
      if (urlInput) urlInput.value = '';
      od86SetPreview(pendingLogoData);
    };
    reader.readAsDataURL(file);
  }, true);

  document.addEventListener('click', async event => {
    const tab = event.target.closest('[data-od71-tab="campaigns"], [data-od75-tab="campaigns"]');
    if (tab) od86Schedule(true);

    if (event.target.closest('#od86-new-campaign')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      od86OpenEditor('new');
      return;
    }

    const edit = event.target.closest('[data-od86-edit-campaign]');
    if (edit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      od86OpenEditor('edit', edit.dataset.od86EditCampaign);
      return;
    }

    if (event.target.closest('#od86-open-join')) {
      event.preventDefault();
      document.getElementById('od86-join-form')?.classList.toggle('active');
      document.getElementById('od86-join-code')?.focus();
      return;
    }

    if (event.target.closest('#od86-join-confirm')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const src = document.getElementById('od86-join-code');
      const dst = document.getElementById('join-campaign-code');
      if (src && dst) dst.value = src.value;
      if (typeof joinCampaignByCode === 'function') await joinCampaignByCode();
      od86Schedule(true);
      return;
    }

    if (event.target.closest('#od86-editor-close, #od86-editor-cancel')) {
      event.preventDefault();
      document.getElementById('od86-campaign-editor')?.close();
      return;
    }

    if (event.target.closest('#od86-editor-save')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await od86SaveEditor();
      return;
    }
  }, true);

  const observer = new MutationObserver(() => {
    if (od86IsCampaignTab()) od86Schedule(false);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('popstate', () => od86Schedule(true));
  setTimeout(() => od86Schedule(true), 300);
})();


/* V87 - adiciona logout direto no painel da engrenagem do menu inicial. */

/* =========================
   V88 - Ajustes da ficha, perícias, OBS e reset de chats
   - Remove Overlay OBS do menu antigo
   - Mantém botão OBS como cópia de link dentro do menu das três linhas
   - Corrige salvamento das perícias em abas para não desmarcar as ocultas
   - Melhora comportamento de marcar/desmarcar treinadas
   - Limpa chat de conversa e rolagens ao sair da ficha/mesa
========================= */
(function od88SheetAndChatFixes(){
  function od88CurrentTableId() {
    return currentCampaignId || localStorage.getItem(STORAGE.activeCampaign) || null;
  }

  function od88ChatKeys(tableId = od88CurrentTableId()) {
    const keys = [];
    if (tableId) {
      keys.push(`${STORAGE.chat}_${tableId}`);
      keys.push(`${STORAGE.chat}_${tableId}_rolls`);
      keys.push(`od_chat_${tableId}`);
      keys.push(`od_chat_${tableId}_rolls`);
      keys.push(`od_chat_roll_${tableId}`);
    }
    keys.push(STORAGE.chat);
    keys.push(`${STORAGE.chat}_rolls`);
    return [...new Set(keys.filter(Boolean))];
  }

  function od88ClearLocalChats(tableId = od88CurrentTableId()) {
    od88ChatKeys(tableId).forEach(key => {
      try { localStorage.removeItem(key); } catch (_) {}
    });
    ['chat-log', 'roll-chat-log'].forEach(id => {
      const log = document.getElementById(id);
      if (log) log.innerHTML = '';
    });
    const last = document.getElementById('last-roll');
    if (last) last.textContent = '—';
    try { if (typeof renderChat === 'function') renderChat(true); } catch (_) {}
  }

  async function od88ResetTableChats(tableId = od88CurrentTableId()) {
    od88ClearLocalChats(tableId);
    if (!tableId || typeof od42Token !== 'function' || !od42Token() || typeof od42Api !== 'function') return;
    try {
      await od42Api(`/api/tables/${encodeURIComponent(tableId)}/messages`, { method: 'DELETE' });
    } catch (error) {
      console.warn('[One Dice v88] Não foi possível limpar chat online:', error);
    }
  }

  window.od88ResetTableChats = od88ResetTableChats;
  window.od88ClearLocalChats = od88ClearLocalChats;

  function od88CopyObsLink() {
    const char = typeof currentChar === 'function' ? currentChar() : null;
    if (!char?.id) return alert('Abra uma ficha antes de copiar o link OBS.');
    const url = `${location.origin}/obs/personagem/${encodeURIComponent(char.id)}?modo=card`;
    navigator.clipboard?.writeText(url)
      .then(() => alert('Link OBS copiado.'))
      .catch(() => prompt('Copie o link OBS:', url));
  }

  function od88TidyObsButtons() {
    const oldOverlay = document.getElementById('overlay-btn');
    if (oldOverlay) oldOverlay.remove();

    let btn = document.getElementById('copy-sheet-obs-btn');
    const nav = document.querySelector('#main-topbar .top-actions');
    if (!btn && nav) {
      btn = document.createElement('button');
      btn.id = 'copy-sheet-obs-btn';
      btn.className = 'ghost-btn';
      btn.type = 'button';
      btn.textContent = 'OBS';
      const logout = document.getElementById('logout-btn');
      nav.insertBefore(btn, logout || null);
    }
    if (btn && btn.dataset.od88Ready !== '1') {
      btn.dataset.od88Ready = '1';
      btn.title = 'Copiar link OBS desta ficha';
      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        od88CopyObsLink();
      });
    }
  }

  function od88AttrShort(attrKey) {
    const map = { forca: 'FOR', agilidade: 'AGI', vigor: 'VIG', intelecto: 'INT', presenca: 'PRE' };
    return map[attrKey] || String(attrKey || '').slice(0, 3).toUpperCase();
  }

  function od88SkillCard(char, skillName, attrKey, trainedTab) {
    char.skills = char.skills || {};
    const skill = char.skills[skillName] || { trained: false, bonus: 0, disadvantage: false };
    const checked = !!skill.trained;
    const baseMod = attrMod(char.attrs?.[attrKey] ?? 1) + agilityOverweightPenalty(char, attrKey);
    const prof = checked ? Number(char.profBonus || 0) : 0;
    const bonus = Number(skill.bonus || 0);
    const total = baseMod + bonus + prof;
    return `
      <article class="od88-skill-card od79-skill-card ${checked ? 'is-trained' : 'is-untrained'}" data-od88-skill-card="${escapeHtml(skillName)}">
        <div class="od88-skill-top">
          <label class="od88-skill-check od79-skill-check" title="Marcar como treinada">
            <input data-skill-trained="${escapeHtml(skillName)}" type="checkbox" ${checked ? 'checked' : ''}>
            <span>${checked ? 'Treinada' : 'Treinar'}</span>
          </label>
          <span class="od88-skill-attr od79-skill-attr">${escapeHtml(od88AttrShort(attrKey))}</span>
        </div>
        <strong class="od88-skill-name od79-skill-name">${escapeHtml(skillName)}</strong>
        <div class="od88-skill-math">
          <span><small>Mod</small><b>${escapeHtml(formatMod(baseMod))}</b></span>
          <span><small>Prof.</small><b>${escapeHtml(formatMod(prof))}</b></span>
          <label><small>Bônus</small><input data-skill-bonus="${escapeHtml(skillName)}" type="number" value="${escapeHtml(bonus)}"></label>
          <span><small>Total</small><b class="od88-skill-total od79-skill-total">${escapeHtml(formatMod(total))}</b></span>
        </div>
        <button class="primary-btn small roll-skill od88-skill-roll od79-skill-roll" data-skill="${escapeHtml(skillName)}" data-skill-attr="${escapeHtml(attrKey)}">D20</button>
      </article>`;
  }

  function od88SetCompactButtonText() {
    const btn = document.getElementById('compact-skills-toggle');
    if (btn) btn.textContent = window.od79SkillTab === 'trained' ? 'Mostrar Não Treinadas' : 'Mostrar Treinadas';
  }

  if (typeof renderSkills === 'function') {
    renderSkills = function(char) {
      const wrap = document.getElementById('skills-wrap');
      if (!wrap || !char) return;
      char.skills = char.skills || {};
      window.od79SkillTab = window.od79SkillTab === 'untrained' ? 'untrained' : 'trained';
      const trained = SKILLS.filter(([name]) => !!char.skills?.[name]?.trained);
      const untrained = SKILLS.filter(([name]) => !char.skills?.[name]?.trained);
      const active = window.od79SkillTab;
      const rows = active === 'trained' ? trained : untrained;
      const title = active === 'trained' ? 'Perícias Treinadas' : 'Perícias Não Treinadas';
      const empty = active === 'trained' ? 'Nenhuma perícia treinada marcada.' : 'Todas as perícias estão treinadas.';
      wrap.className = 'table-wrap od79-skills-wrap od88-skills-wrap';
      wrap.innerHTML = `
        <div class="od88-skills-shell od79-skills-shell">
          <div class="od88-skills-tabs od79-skills-tabs" role="tablist" aria-label="Filtro de perícias">
            <button type="button" class="od88-skill-tab od79-skill-tab ${active === 'trained' ? 'active' : ''}" data-od79-skill-tab="trained">Treinadas <span>${trained.length}</span></button>
            <button type="button" class="od88-skill-tab od79-skill-tab ${active === 'untrained' ? 'active' : ''}" data-od79-skill-tab="untrained">Não Treinadas <span>${untrained.length}</span></button>
          </div>
          <section class="od88-skill-panel od79-skill-panel">
            <header class="od88-skill-panel-head od79-skill-panel-head">
              <h4>${title}</h4>
              <small>Marque Treinar para somar proficiência; o total só recebe proficiência nas treinadas.</small>
            </header>
            <div class="od88-skills-card-grid od79-skills-card-grid">
              ${rows.length ? rows.map(([n,a]) => od88SkillCard(char, n, a, active === 'trained')).join('') : `<div class="od88-skill-empty od79-skill-empty">${empty}</div>`}
            </div>
          </section>
        </div>`;
      od88SetCompactButtonText();
    };
  }

  const od88OldSaveCurrentCharacter = typeof saveCurrentCharacter === 'function' ? saveCurrentCharacter : null;
  if (od88OldSaveCurrentCharacter && !saveCurrentCharacter.__od88SkillSafe) {
    saveCurrentCharacter = function() {
      const beforeChar = typeof currentChar === 'function' ? currentChar() : null;
      const beforeSkills = beforeChar?.skills ? JSON.parse(JSON.stringify(beforeChar.skills)) : {};
      const present = new Set([...document.querySelectorAll('[data-skill-trained], [data-skill-bonus]')].map(el => el.dataset.skillTrained || el.dataset.skillBonus).filter(Boolean));
      od88OldSaveCurrentCharacter.apply(this, arguments);
      if (!beforeChar || !present.size) return;
      updateChar(char => {
        char.skills = char.skills || {};
        SKILLS.forEach(([skillName]) => {
          if (!present.has(skillName) && beforeSkills[skillName]) {
            char.skills[skillName] = beforeSkills[skillName];
          }
        });
      });
    };
    saveCurrentCharacter.__od88SkillSafe = true;
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-od79-skill-tab]');
    if (tab) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.od79SkillTab = tab.dataset.od79SkillTab === 'untrained' ? 'untrained' : 'trained';
      const char = currentChar && currentChar();
      if (char) renderSkills(char);
      return;
    }

    const logout = event.target.closest('#logout-btn');
    if (logout) {
      const tableId = od88CurrentTableId();
      setTimeout(() => od88ResetTableChats(tableId), 0);
    }

    const back = event.target.closest('#back-to-sessions-btn');
    if (back) {
      const tableId = od88CurrentTableId();
      setTimeout(() => od88ResetTableChats(tableId), 0);
    }
  }, true);

  document.addEventListener('change', event => {
    const trained = event.target.closest('[data-skill-trained]');
    const bonus = event.target.closest('[data-skill-bonus]');
    if (!trained && !bonus) return;

    event.stopImmediatePropagation();
    const name = (trained || bonus).dataset.skillTrained || (trained || bonus).dataset.skillBonus;
    if (!name) return;

    updateChar(char => {
      char.skills = char.skills || {};
      char.skills[name] = char.skills[name] || { trained: false, bonus: 0, disadvantage: false };
      if (trained) char.skills[name].trained = !!trained.checked;
      if (bonus) char.skills[name].bonus = Number(bonus.value || 0);
    });
    try { saveCurrentCharacter(); } catch (_) {}
    const updated = currentChar && currentChar();
    if (updated) {
      if (trained) window.od79SkillTab = trained.checked ? 'trained' : 'untrained';
      renderSkills(updated);
      updateDerivedStatsDisplay(updated);
    }
  }, true);

  function od88PatchSocketClear() {
    try {
      const socket = typeof od44EnsureSocket === 'function' ? od44EnsureSocket() : null;
      if (!socket || socket.__od88MessagesClear) return;
      socket.__od88MessagesClear = true;
      socket.on('messages:cleared', payload => {
        if (!payload?.tableId || String(payload.tableId) === String(od88CurrentTableId())) {
          od88ClearLocalChats(payload?.tableId || od88CurrentTableId());
        }
      });
    } catch (_) {}
  }

  const boot = () => {
    od88TidyObsButtons();
    od88SetCompactButtonText();
    const char = currentChar && currentChar();
    if (char && document.getElementById('skills-wrap')) renderSkills(char);
    od88PatchSocketClear();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 250);
  setTimeout(boot, 1000);

  new MutationObserver(() => od88TidyObsButtons()).observe(document.documentElement, { childList: true, subtree: true });
})();

/* =========================
   V89 - Polimento da ficha, menu lateral e inventário compacto
   - Remove somente o botão OBS abaixo do retrato
   - Remove botão antigo "Mostrar Treinadas"
   - Esconde setas no inventário em modo reduzido
   - Reaplica ajustes visuais sem mexer na lógica principal
========================= */
(function od89SheetPolish(){
  function od89RemovePortraitObsButton() {
    document.querySelectorAll('#obs-copy-link-btn, .obs-copy-link-btn').forEach(btn => btn.remove());
  }

  function od89RemoveCompactSkillsButton() {
    document.querySelectorAll('#compact-skills-toggle').forEach(btn => btn.remove());
  }

  function od89CleanCompactInventoryArrows() {
    const list = document.getElementById('simple-inventory-list');
    if (!list) return;
    if (!list.classList.contains('compact')) return;
    list.querySelectorAll('.simple-inventory-card .od80-card-order').forEach(control => control.remove());
    list.querySelectorAll('.simple-inventory-card.od80-sortable-card').forEach(card => {
      card.classList.remove('od80-sortable-card');
    });
  }

  function od89Run() {
    od89RemovePortraitObsButton();
    od89RemoveCompactSkillsButton();
    od89CleanCompactInventoryArrows();
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#obs-copy-link-btn, .obs-copy-link-btn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      od89RemovePortraitObsButton();
      return;
    }

    if (event.target.closest('#simple-inventory-compact-toggle, #inventory-tab, [data-tab="inventory"]')) {
      setTimeout(od89CleanCompactInventoryArrows, 0);
      setTimeout(od89CleanCompactInventoryArrows, 120);
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target.closest('.portrait-wrap, #portrait-url')) {
      const img = document.getElementById('char-portrait-preview');
      if (img) img.classList.add('od89-portrait-fixed');
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', od89Run);
  else od89Run();
  setTimeout(od89Run, 200);
  setTimeout(od89Run, 800);
  setInterval(od89Run, 1500);

  new MutationObserver(od89Run).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
})();


/* =========================
   V90 - perfil do menu e ícone estável de fichas
   - Troca o card do menu lateral para foto + nome real do usuário
   - Remove marca One Dice do card de perfil do menu da ficha
   - Substitui o ícone de ficha por desenho CSS estável, sem imagem que falha/intermitente
========================= */
(function od90ProfileAndSheetIconFix(){
  function safe(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
  }

  function userName() {
    const user = typeof currentUser !== 'undefined' ? currentUser : null;
    if (!user) return 'Usuário';
    if (typeof userDisplayName === 'function') return userDisplayName(user) || user.realName || user.name || user.nick || 'Usuário';
    return user.realName || user.name || user.nick || 'Usuário';
  }

  function userNick() {
    const user = typeof currentUser !== 'undefined' ? currentUser : null;
    return user?.nick ? '@' + user.nick : 'Conta One Dice';
  }

  function userAvatar() {
    const user = typeof currentUser !== 'undefined' ? currentUser : null;
    return user?.avatar || user?.avatarUrl || user?.photo || user?.photoUrl || user?.portrait || user?.image || user?.picture || 'assets/account-logo.png';
  }

  function currentRoleText() {
    try {
      if (typeof currentMembership === 'function') {
        const member = currentMembership();
        if (member?.role === 'mestre') return 'Mestre da mesa';
        if (member?.role === 'jogador') return 'Jogador da mesa';
      }
      if (typeof currentCampaignId !== 'undefined' && currentCampaignId && typeof getMembers === 'function') {
        const user = typeof currentUser !== 'undefined' ? currentUser : null;
        const member = getMembers().find(m => m.campaignId === currentCampaignId && m.userId === user?.id);
        if (member?.role === 'mestre') return 'Mestre da mesa';
        if (member?.role === 'jogador') return 'Jogador da mesa';
      }
    } catch (_) {}
    return 'Conta';
  }

  function renderMenuProfileCard() {
    const panel = document.getElementById('sessions-menu-panel');
    if (!panel) return;

    let card = panel.querySelector('.od90-user-menu-card');
    const old = panel.querySelector('.od75-account-menu-card');

    if (!card) {
      card = document.createElement('div');
      card.className = 'od90-user-menu-card od75-account-menu-card';
      if (old && old.parentElement) old.replaceWith(card);
      else panel.prepend(card);
    }

    const html = `
      <img class="od90-user-avatar" src="${safe(userAvatar())}" alt="Foto do usuário" onerror="this.src='assets/account-logo.png'" />
      <div class="od90-user-info">
        <strong>${safe(userName())}</strong>
        <small>${safe(userNick())}</small>
        <small>${safe(currentRoleText())}</small>
      </div>`;

    // V93: evita reescrever o mesmo HTML toda vez.
    // A v90 fazia innerHTML em loop; combinado com MutationObserver no documento inteiro,
    // isso podia travar o carregamento da tela após login.
    if (card.dataset.od90ProfileHtml !== html) {
      card.dataset.od90ProfileHtml = html;
      card.innerHTML = html;
    }
  }

  function stabilizeSheetButton(btn) {
    if (!btn) return;
    btn.classList.add('od90-sheet-stable-btn');
    btn.title = 'Minhas Fichas';
    btn.setAttribute('aria-label', 'Minhas Fichas');

    const hasStable = btn.querySelector('.od90-sheet-icon');
    if (!hasStable || btn.querySelector('img, svg')) {
      btn.innerHTML = '<span class="od90-sheet-icon" aria-hidden="true"></span>';
    }
  }

  function stabilizeSheetButtons() {
    stabilizeSheetButton(document.getElementById('sidebar-dock-btn'));
    stabilizeSheetButton(document.getElementById('toggle-account-panel-btn'));
    stabilizeSheetButton(document.querySelector('.sessions-sheet-toggle'));
  }

  function run() {
    renderMenuProfileCard();
    stabilizeSheetButtons();
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#topbar-menu-toggle, .topbar-menu-toggle, #sessions-menu-btn')) {
      setTimeout(run, 0);
      setTimeout(run, 120);
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target.closest('#account-settings-name, #account-settings-real-name, #account-settings-nick, #account-settings-avatar-url')) {
      setTimeout(run, 0);
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target.closest('#account-settings-avatar-file, #account-settings-avatar-url')) {
      setTimeout(run, 80);
      setTimeout(run, 350);
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  setTimeout(run, 200);
  setTimeout(run, 800);

  // V93: removido setInterval infinito e MutationObserver global da v90.
  // O observer global observava document.documentElement e chamava run(),
  // mas run() alterava o próprio DOM; isso criava um ciclo de mutações.
  // Agora o patch só roda em eventos reais de abertura/edição do menu.
  window.od90RefreshUserMenuCard = run;
})();

/* V93 - Estabilidade: removido loop de MutationObserver/setInterval do patch v90. */

/* =========================
   V96 - Ícones OBS por estado de vida/transformação
   - Adiciona campos no modal de retrato
   - Salva ícones: normal, ferido, 0 PV e transformação
   - Mantém fallback para o retrato principal
========================= */
(function od96ObsStateIcons() {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const safe = typeof escapeHtml === 'function'
    ? escapeHtml
    : (value) => String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));

  function current() {
    try { return typeof currentChar === 'function' ? currentChar() : null; }
    catch (_) { return null; }
  }

  function ensurePanel() {
    const modal = $('portrait-modal');
    const form = modal?.querySelector('.modal-card');
    if (!form || form.querySelector('.od96-obs-icons-panel')) return;

    const panel = document.createElement('section');
    panel.className = 'od96-obs-icons-panel';
    panel.innerHTML = `
      <div class="od96-obs-icons-head">
        <h3>Ícones do OBS</h3>
        <p>Opcional. Se deixar vazio, o OBS usa o retrato principal.</p>
      </div>
      <label>Ícone 50% ou mais de PV
        <input id="od96-icon-normal" type="url" placeholder="URL ou imagem em base64" />
        <input class="od96-icon-file" data-target="od96-icon-normal" type="file" accept="image/*" />
      </label>
      <label>Ícone abaixo de 50% de PV
        <input id="od96-icon-low" type="url" placeholder="URL ou imagem em base64" />
        <input class="od96-icon-file" data-target="od96-icon-low" type="file" accept="image/*" />
      </label>
      <label>Ícone com 0 PV
        <input id="od96-icon-zero" type="url" placeholder="URL ou imagem em base64" />
        <input class="od96-icon-file" data-target="od96-icon-zero" type="file" accept="image/*" />
      </label>
      <label>Ícone de transformação
        <input id="od96-icon-transformation" type="url" placeholder="URL ou imagem em base64" />
        <input class="od96-icon-file" data-target="od96-icon-transformation" type="file" accept="image/*" />
      </label>
      <label class="od96-transform-toggle">
        <input id="od96-transform-active" type="checkbox" />
        <span>Usar ícone de transformação no OBS</span>
      </label>
    `;

    const actions = form.querySelector('.modal-actions');
    if (actions) actions.before(panel);
    else form.appendChild(panel);
  }

  function fillPanel(char = current()) {
    ensurePanel();
    if (!char) return;
    const icons = char.obsIcons || {};
    const normal = $('od96-icon-normal');
    const low = $('od96-icon-low');
    const zero = $('od96-icon-zero');
    const transformation = $('od96-icon-transformation');
    const active = $('od96-transform-active');

    if (normal) normal.value = icons.normal || char.obsIconNormal || '';
    if (low) low.value = icons.low || char.obsIconLow || '';
    if (zero) zero.value = icons.zero || char.obsIconZero || '';
    if (transformation) transformation.value = icons.transformation || char.obsIconTransformation || '';
    if (active) active.checked = Boolean(char.obsTransformationActive || char.activeTransformation || char.isTransformation);
  }

  function readPanel() {
    ensurePanel();
    return {
      normal: $('od96-icon-normal')?.value?.trim() || '',
      low: $('od96-icon-low')?.value?.trim() || '',
      zero: $('od96-icon-zero')?.value?.trim() || '',
      transformation: $('od96-icon-transformation')?.value?.trim() || '',
      active: Boolean($('od96-transform-active')?.checked)
    };
  }

  function applyPanelToChar(char) {
    if (!char) return;
    const values = readPanel();
    char.obsIcons = {
      normal: values.normal,
      low: values.low,
      zero: values.zero,
      transformation: values.transformation
    };
    char.obsIconNormal = values.normal;
    char.obsIconLow = values.low;
    char.obsIconZero = values.zero;
    char.obsIconTransformation = values.transformation;
    char.obsTransformationActive = values.active;
  }

  function readFileToInput(input, file) {
    if (!input || !file) return;
    if (!file.type || !file.type.startsWith('image/')) return alert('Escolha um arquivo de imagem.');
    const reader = new FileReader();
    reader.onload = () => {
      input.value = String(reader.result || '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    reader.readAsDataURL(file);
  }

  const baseLoadCharacter = typeof loadCharacter === 'function' ? loadCharacter : null;
  if (baseLoadCharacter && !baseLoadCharacter.__od96Wrapped) {
    const wrapped = function od96LoadCharacter(id) {
      const result = baseLoadCharacter.apply(this, arguments);
      setTimeout(() => fillPanel(current()), 0);
      return result;
    };
    wrapped.__od96Wrapped = true;
    try { window.loadCharacter = wrapped; } catch (_) {}
    try { globalThis.loadCharacter = wrapped; } catch (_) {}
  }

  const baseSaveCurrentCharacter = typeof saveCurrentCharacter === 'function' ? saveCurrentCharacter : null;
  if (baseSaveCurrentCharacter && !baseSaveCurrentCharacter.__od96Wrapped) {
    const wrapped = function od96SaveCurrentCharacter() {
      const result = baseSaveCurrentCharacter.apply(this, arguments);
      try {
        if (typeof updateChar === 'function') {
          updateChar(char => applyPanelToChar(char));
        }
      } catch (_) {}
      return result;
    };
    wrapped.__od96Wrapped = true;
    try { window.saveCurrentCharacter = wrapped; } catch (_) {}
    try { globalThis.saveCurrentCharacter = wrapped; } catch (_) {}
  }

  document.addEventListener('click', event => {
    /* v132: menu antigo de ícones OBS desativado para não interceptar o menu novo de fotos. */
  }, true);

  document.addEventListener('change', event => {
    const fileInput = event.target.closest('.od96-icon-file');
    if (!fileInput) return;
    const target = $(fileInput.dataset.target || '');
    readFileToInput(target, fileInput.files?.[0]);
    fileInput.value = '';
  }, true);

  document.addEventListener('input', event => {
    if (!event.target.closest('.od96-obs-icons-panel')) return;
    try {
      if (typeof updateChar === 'function') updateChar(char => applyPanelToChar(char));
      if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(current());
    } catch (_) {}
  }, true);

  document.addEventListener('change', event => {
    if (!event.target.closest('.od96-obs-icons-panel')) return;
    try {
      if (typeof updateChar === 'function') updateChar(char => applyPanelToChar(char));
      if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(current());
    } catch (_) {}
  }, true);

  function boot() {
    ensurePanel();
    fillPanel(current());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();


/* =========================
   V98 - Correções do primeiro beta em campanha/ficha
   - Perícias não desmarcam outras perícias e não mudam de aba automaticamente
   - Campos de texto não perdem foco por recarregamento ao salvar em mesa
   - Esquiva: base 10 + AGI + Reflexo, mas permite ajuste manual
   - Atributos com botões +/- próprios e sem setas nativas do input
   - Sair da mesa sempre volta para Início
========================= */
(function od98BetaCampaignSheetFixes(){
  const $ = id => document.getElementById(id);
  const editableSelector = 'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]';
  let saving = false;

  function safeEscape(value) {
    try { return typeof escapeHtml === 'function' ? escapeHtml(value ?? '') : String(value ?? ''); }
    catch (_) { return String(value ?? ''); }
  }

  function isAppActive() {
    return !!document.getElementById('app-screen')?.classList.contains('active');
  }

  function activeEditable() {
    const el = document.activeElement;
    return !!(el && el.matches && el.matches(editableSelector));
  }

  function attrShort(attrKey) {
    const map = { forca: 'FOR', agilidade: 'AGI', vigor: 'VIG', intelecto: 'INT', presenca: 'PRE' };
    return map[attrKey] || String(attrKey || '').slice(0, 3).toUpperCase();
  }

  function dodgeFormula(char) {
    if (!char) return 10;
    const agi = Number(char.attrs?.agilidade ?? 10);
    const agilityMod = (typeof attrMod === 'function' ? attrMod(agi) : Math.floor((agi - 10) / 2));
    const reflex = typeof skillTotal === 'function' ? skillTotal(char, 'Reflexo', 'agilidade') : 0;
    return 10 + agilityMod + reflex;
  }

  window.od98DodgeFormula = dodgeFormula;

  if (typeof calculatedDodge === 'function') {
    calculatedDodge = function(char = currentChar()) {
      if (!char) return 0;
      if (char.dodgeManual === true || char.dodgeLocked === true) {
        const manual = Number(char.dodge);
        if (Number.isFinite(manual)) return manual;
      }
      return dodgeFormula(char);
    };
  }

  if (typeof syncDodgeField === 'function') {
    syncDodgeField = function(char = currentChar(), force = false) {
      const field = $('dodge');
      if (!field || !char) return;
      if (document.activeElement === field && !force) return;
      field.value = calculatedDodge(char);
    };
  }

  if (typeof updateDerivedStatsDisplay === 'function') {
    const baseUpdateDerivedStatsDisplay = updateDerivedStatsDisplay;
    updateDerivedStatsDisplay = function(char = currentChar()) {
      baseUpdateDerivedStatsDisplay(char);
      const dodgeNote = $('dodge-formula-note');
      if (dodgeNote && char) {
        const agi = typeof attrMod === 'function' ? attrMod(char.attrs?.agilidade ?? 10) : 0;
        const reflex = typeof skillTotal === 'function' ? skillTotal(char, 'Reflexo', 'agilidade') : 0;
        const manual = char.dodgeManual === true || char.dodgeLocked === true;
        dodgeNote.textContent = `10 + AGI ${typeof formatMod === 'function' ? formatMod(agi) : agi} + Reflexo ${typeof formatMod === 'function' ? formatMod(reflex) : reflex}${manual ? ' · ajuste manual ativo' : ''}`;
      }
    };
  }

  function skillCard(char, skillName, attrKey) {
    char.skills = char.skills || {};
    const skill = char.skills[skillName] || { trained: false, bonus: 0, disadvantage: false };
    const checked = !!skill.trained;
    const baseMod = (typeof attrMod === 'function' ? attrMod(char.attrs?.[attrKey] ?? 10) : 0) + (typeof agilityOverweightPenalty === 'function' ? agilityOverweightPenalty(char, attrKey) : 0);
    const prof = checked ? Number(char.profBonus || 0) : 0;
    const bonus = Number(skill.bonus || 0);
    const total = baseMod + prof + bonus;
    return `
      <article class="od98-skill-card od88-skill-card od79-skill-card ${checked ? 'is-trained' : 'is-untrained'}" data-od98-skill-card="${safeEscape(skillName)}">
        <div class="od98-skill-top od88-skill-top">
          <label class="od98-skill-check od88-skill-check od79-skill-check" title="Marcar como treinada">
            <input data-od98-skill-trained="${safeEscape(skillName)}" type="checkbox" ${checked ? 'checked' : ''}>
            <span>${checked ? 'Treinada' : 'Treinar'}</span>
          </label>
          <span class="od98-skill-attr od88-skill-attr od79-skill-attr">${safeEscape(attrShort(attrKey))}</span>
        </div>
        <strong class="od98-skill-name od88-skill-name od79-skill-name">${safeEscape(skillName)}</strong>
        <div class="od98-skill-math od88-skill-math">
          <span><small>Mod</small><b>${safeEscape(typeof formatMod === 'function' ? formatMod(baseMod) : baseMod)}</b></span>
          <span><small>Prof.</small><b>${safeEscape(typeof formatMod === 'function' ? formatMod(prof) : prof)}</b></span>
          <label><small>Bônus</small><input data-od98-skill-bonus="${safeEscape(skillName)}" type="number" value="${safeEscape(bonus)}"></label>
          <span><small>Total</small><b class="od98-skill-total od88-skill-total od79-skill-total">${safeEscape(typeof formatMod === 'function' ? formatMod(total) : total)}</b></span>
        </div>
        <button class="primary-btn small roll-skill od98-skill-roll od88-skill-roll od79-skill-roll" data-skill="${safeEscape(skillName)}" data-skill-attr="${safeEscape(attrKey)}">D20</button>
      </article>`;
  }

  if (typeof renderSkills === 'function') {
    renderSkills = function(char) {
      const wrap = $('skills-wrap');
      if (!wrap || !char || !Array.isArray(SKILLS)) return;
      char.skills = char.skills || {};
      window.od79SkillTab = window.od79SkillTab === 'untrained' ? 'untrained' : 'trained';
      const trained = SKILLS.filter(([name]) => !!char.skills?.[name]?.trained);
      const untrained = SKILLS.filter(([name]) => !char.skills?.[name]?.trained);
      const active = window.od79SkillTab;
      const rows = active === 'trained' ? trained : untrained;
      const title = active === 'trained' ? 'Perícias Treinadas' : 'Perícias Não Treinadas';
      const empty = active === 'trained' ? 'Nenhuma perícia treinada marcada.' : 'Todas as perícias estão treinadas.';
      wrap.className = 'table-wrap od79-skills-wrap od88-skills-wrap od98-skills-wrap';
      wrap.innerHTML = `
        <div class="od98-skills-shell od88-skills-shell od79-skills-shell">
          <div class="od98-skills-tabs od88-skills-tabs od79-skills-tabs" role="tablist" aria-label="Filtro de perícias">
            <button type="button" class="od98-skill-tab od88-skill-tab od79-skill-tab ${active === 'trained' ? 'active' : ''}" data-od98-skill-tab="trained">Treinadas <span>${trained.length}</span></button>
            <button type="button" class="od98-skill-tab od88-skill-tab od79-skill-tab ${active === 'untrained' ? 'active' : ''}" data-od98-skill-tab="untrained">Não Treinadas <span>${untrained.length}</span></button>
          </div>
          <section class="od98-skill-panel od88-skill-panel od79-skill-panel">
            <header class="od98-skill-panel-head od88-skill-panel-head od79-skill-panel-head">
              <h4>${safeEscape(title)}</h4>
              <small>Marcar ou desmarcar não muda de aba automaticamente.</small>
            </header>
            <div class="od98-skills-card-grid od88-skills-card-grid od79-skills-card-grid">
              ${rows.length ? rows.map(([n, a]) => skillCard(char, n, a)).join('') : `<div class="od98-skill-empty od88-skill-empty od79-skill-empty">${safeEscape(empty)}</div>`}
            </div>
          </section>
        </div>`;
      const oldBtn = $('compact-skills-toggle');
      if (oldBtn) oldBtn.remove();
    };
  }

  function collectVisibleSkillValues() {
    const values = {};
    document.querySelectorAll('[data-od98-skill-trained]').forEach(input => {
      const name = input.dataset.od98SkillTrained;
      if (!name) return;
      values[name] = values[name] || {};
      values[name].trained = !!input.checked;
    });
    document.querySelectorAll('[data-od98-skill-bonus]').forEach(input => {
      const name = input.dataset.od98SkillBonus;
      if (!name) return;
      values[name] = values[name] || {};
      values[name].bonus = Number(input.value || 0);
    });
    return values;
  }

  function applyVisibleSkillValues(char, values) {
    if (!char) return;
    char.skills = char.skills || {};
    Object.entries(values || {}).forEach(([name, patch]) => {
      char.skills[name] = char.skills[name] || { trained: false, bonus: 0, disadvantage: false };
      if (Object.prototype.hasOwnProperty.call(patch, 'trained')) char.skills[name].trained = !!patch.trained;
      if (Object.prototype.hasOwnProperty.call(patch, 'bonus')) char.skills[name].bonus = Number(patch.bonus || 0);
      if (!Object.prototype.hasOwnProperty.call(char.skills[name], 'disadvantage')) char.skills[name].disadvantage = false;
    });
  }

  function readDodgeIntoChar(char) {
    if (!char) return;
    const field = $('dodge');
    if (!field) return;
    const raw = Number(field.value || 0);
    const formula = dodgeFormula(char);
    char.dodge = Number.isFinite(raw) ? raw : formula;
    char.dodgeManual = Number.isFinite(raw) && raw !== formula;
    char.dodgeLocked = char.dodgeManual;
  }

  const baseSave = typeof saveCurrentCharacter === 'function' ? saveCurrentCharacter : null;
  if (baseSave && !baseSave.__od98Wrapped) {
    saveCurrentCharacter = function od98SaveCurrentCharacter() {
      if (saving) return baseSave.apply(this, arguments);
      const before = typeof currentChar === 'function' ? currentChar() : null;
      const beforeSkills = before?.skills ? JSON.parse(JSON.stringify(before.skills)) : {};
      const visibleSkills = collectVisibleSkillValues();
      saving = true;
      try {
        const result = baseSave.apply(this, arguments);
        const current = typeof currentChar === 'function' ? currentChar() : null;
        if (current) {
          updateChar(char => {
            char.skills = beforeSkills || char.skills || {};
            applyVisibleSkillValues(char, visibleSkills);
            readDodgeIntoChar(char);
            const portraitField = $('portrait-url');
            if (portraitField) char.portrait = portraitField.value || '';
          });
          const fixed = currentChar();
          if (fixed && typeof od44SaveCharacterOnline === 'function') {
            od44SaveCharacterOnline(fixed).catch(error => console.warn('Falha ao salvar ficha online v98:', error));
          } else if (fixed && typeof od42ScheduleCharacterSave === 'function') {
            od42ScheduleCharacterSave(fixed);
          }
        }
        return result;
      } finally {
        saving = false;
      }
    };
    saveCurrentCharacter.__od98Wrapped = true;
  }

  if (typeof loadCharacter === 'function') {
    const baseLoad = loadCharacter;
    loadCharacter = function od98LoadCharacter(id) {
      if (isAppActive() && String(id) === String(currentCharacterId || '') && activeEditable()) {
        const char = typeof currentChar === 'function' ? currentChar() : null;
        if (char) {
          updateBars(char);
          updateOverlay(char);
          updateDerivedStatsDisplay(char);
        }
        return;
      }
      const result = baseLoad.apply(this, arguments);
      const char = typeof currentChar === 'function' ? currentChar() : null;
      if (char) {
        const field = $('dodge');
        if (field) field.value = calculatedDodge(char);
        updateDerivedStatsDisplay(char);
      }
      return result;
    };
  }

  if (typeof renderAttributes === 'function') {
    renderAttributes = function(char) {
      const grid = $('attributes-grid');
      if (!grid || !char) return;
      const labels = { forca: 'Força', agilidade: 'Agilidade', vigor: 'Vigor', intelecto: 'Intelecto', presenca: 'Presença' };
      grid.innerHTML = '';
      Object.entries(labels).forEach(([key, label]) => {
        const value = Number(char.attrs?.[key] ?? 10);
        const card = document.createElement('div');
        card.className = 'attr-card-v2 od98-attr-card';
        card.innerHTML = `
          <div class="attr-head">
            <div class="attr-name">${safeEscape(label)}</div>
            <div class="attr-mod">${safeEscape(typeof formatMod === 'function' ? formatMod(attrMod(value)) : value)}</div>
            <div class="attr-help">valor ${safeEscape(value)} · fórmula D&D</div>
          </div>
          <div class="od98-attr-control">
            <button type="button" class="od98-attr-step" data-od98-attr-step="${safeEscape(key)}" data-dir="-1">−</button>
            <input data-attr="${safeEscape(key)}" type="number" value="${safeEscape(value)}" min="1" inputmode="numeric">
            <button type="button" class="od98-attr-step" data-od98-attr-step="${safeEscape(key)}" data-dir="1">+</button>
          </div>
          <button class="primary-btn small roll-attr" data-roll-attr="${safeEscape(key)}">Rolar ${safeEscape(label)}</button>`;
        grid.appendChild(card);
      });
    };
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-od98-skill-tab]');
    if (tab) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.od79SkillTab = tab.dataset.od98SkillTab === 'untrained' ? 'untrained' : 'trained';
      const char = currentChar && currentChar();
      if (char) renderSkills(char);
      return;
    }

    const attrBtn = event.target.closest('[data-od98-attr-step]');
    if (attrBtn) {
      event.preventDefault();
      const key = attrBtn.dataset.od98AttrStep;
      const dir = Number(attrBtn.dataset.dir || 0);
      const input = document.querySelector(`input[data-attr="${CSS.escape(key)}"]`);
      if (!input) return;
      input.value = Math.max(1, Number(input.value || 1) + dir);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const char = currentChar && currentChar();
      if (char) {
        updateChar(c => { c.attrs = c.attrs || {}; c.attrs[key] = Number(input.value || 1); });
        const updated = currentChar();
        renderAttributes(updated);
        renderSkills(updated);
        updateDerivedStatsDisplay(updated);
        queueSave();
      }
      return;
    }
  }, true);

  document.addEventListener('change', event => {
    const trained = event.target.closest('[data-od98-skill-trained]');
    const bonus = event.target.closest('[data-od98-skill-bonus]');
    if (!trained && !bonus) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const name = trained?.dataset.od98SkillTrained || bonus?.dataset.od98SkillBonus;
    if (!name) return;
    updateChar(char => {
      char.skills = char.skills || {};
      char.skills[name] = char.skills[name] || { trained: false, bonus: 0, disadvantage: false };
      if (trained) char.skills[name].trained = !!trained.checked;
      if (bonus) char.skills[name].bonus = Number(bonus.value || 0);
    });
    const updated = currentChar && currentChar();
    if (updated) {
      renderSkills(updated);
      updateDerivedStatsDisplay(updated);
      queueSave();
    }
  }, true);

  document.addEventListener('input', event => {
    const bonus = event.target.closest('[data-od98-skill-bonus]');
    if (bonus) {
      event.stopImmediatePropagation();
      const name = bonus.dataset.od98SkillBonus;
      updateChar(char => {
        char.skills = char.skills || {};
        char.skills[name] = char.skills[name] || { trained: false, bonus: 0, disadvantage: false };
        char.skills[name].bonus = Number(bonus.value || 0);
      });
      updateDerivedStatsDisplay(currentChar());
      queueSave();
      return;
    }

    const dodge = event.target.closest('#dodge');
    if (dodge) {
      updateChar(char => readDodgeIntoChar(char));
      updateDerivedStatsDisplay(currentChar());
      queueSave();
    }
  }, true);

  if (typeof leaveCampaign === 'function') {
    const baseLeaveCampaign = leaveCampaign;
    leaveCampaign = async function od98LeaveCampaign(campaignId) {
      const result = await baseLeaveCampaign.apply(this, arguments);
      currentCampaignId = null;
      accountSheetMode = false;
      try { localStorage.removeItem(STORAGE.activeCampaign); } catch (_) {}
      try { localStorage.setItem('od71_tab', 'home'); } catch (_) {}
      if (typeof showSessions === 'function') showSessions();
      return result;
    };
  }

  function boot() {
    const char = currentChar && currentChar();
    if (char) {
      if ($('attributes-grid')) renderAttributes(char);
      if ($('skills-wrap')) renderSkills(char);
      if ($('dodge')) $('dodge').value = calculatedDodge(char);
      updateDerivedStatsDisplay(char);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/* =========================
   V99 - Beta 2: imagens, ficha em campanha, vitais, esquiva e organização
   - Troca de foto com crop quadrado e suporte a GIF
   - Atributos compactos, fórmula D20 e botões +/- menores
   - PV/PE com botões +/-
   - Esquiva = Defesa + Reflexo
   - Sair da mesa volta para Início de verdade
   - Listas em ordem alfabética
   - Campanhas em grade de 2 colunas
   - Corrige fluxo de entrar/criar ficha sem alerta duplicado
   - Transformação pode informar ao OBS a forma ativa
========================= */
(function od99Beta2Fixes(){
  const $ = id => document.getElementById(id);
  const escape = value => {
    try { return typeof escapeHtml === 'function' ? escapeHtml(value ?? '') : String(value ?? ''); }
    catch (_) { return String(value ?? ''); }
  };
  const editableSelector = 'input, textarea, select, [contenteditable="true"]';
  let od99CropState = null;

  function sortByName(list) {
    return [...(list || [])].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR', { sensitivity: 'base' }));
  }

  if (typeof userCharacters === 'function' && !userCharacters.__od99Sorted) {
    const baseUserCharacters = userCharacters;
    userCharacters = function od99UserCharactersSorted(){ return sortByName(baseUserCharacters.apply(this, arguments)); };
    userCharacters.__od99Sorted = true;
  }

  if (typeof getCampaigns === 'function' && !getCampaigns.__od99Sorted) {
    const baseGetCampaigns = getCampaigns;
    getCampaigns = function od99GetCampaignsSorted(){ return sortByName(baseGetCampaigns.apply(this, arguments)); };
    getCampaigns.__od99Sorted = true;
  }

  function defenseForDodge(char) {
    if (!char) return 10;
    if (typeof effectiveDefense === 'function') return Number(effectiveDefense(char) || 10);
    return Number(char.defense || char.defesa || 10);
  }

  function reflexForDodge(char) {
    if (!char) return 0;
    if (typeof skillTotal === 'function') return Number(skillTotal(char, 'Reflexo', 'agilidade') || 0);
    return 0;
  }

  function dodgeFormulaV99(char) {
    return defenseForDodge(char) + reflexForDodge(char);
  }

  window.od99DodgeFormula = dodgeFormulaV99;
  window.od98DodgeFormula = dodgeFormulaV99;

  if (typeof calculatedDodge === 'function') {
    calculatedDodge = function od99CalculatedDodge(char = currentChar()) {
      if (!char) return 0;
      const manual = Number(char.dodge);
      return Number.isFinite(manual) ? manual : 10;
    };
  }

  function updateDodgeNote(char = currentChar && currentChar()) {
    const note = $('dodge-formula-note');
    if (!note || !char) return;
    note.textContent = '';
    note.style.display = 'none';
  }

  if (typeof updateDerivedStatsDisplay === 'function' && !updateDerivedStatsDisplay.__od99Wrapped) {
    const baseUpdateDerived = updateDerivedStatsDisplay;
    updateDerivedStatsDisplay = function od99UpdateDerivedStatsDisplay(char = currentChar()) {
      const result = baseUpdateDerived.apply(this, arguments);
      updateDodgeNote(char);
      const dodge = $('dodge');
      if (dodge && char && document.activeElement !== dodge) dodge.value = calculatedDodge(char);
      return result;
    };
    updateDerivedStatsDisplay.__od99Wrapped = true;
  }

  function readDodgeIntoCharV99(char) {
    if (!char) return;
    const field = $('dodge');
    const fallback = Number(char.dodge ?? 10);
    if (!field) { char.dodge = Number.isFinite(fallback) ? fallback : 10; char.dodgeManual = true; char.dodgeLocked = true; return; }
    const raw = Number(field.value || fallback || 10);
    char.dodge = Number.isFinite(raw) ? raw : (Number.isFinite(fallback) ? fallback : 10);
    char.dodgeManual = true;
    char.dodgeLocked = true;
  }

  function renderAttributesV99(char) {
    const grid = $('attributes-grid');
    if (!grid || !char) return;
    const labels = { forca: 'Força', agilidade: 'Agilidade', vigor: 'Vigor', intelecto: 'Intelecto', presenca: 'Presença' };
    grid.innerHTML = '';
    Object.entries(labels).forEach(([key, label]) => {
      const value = Number(char.attrs?.[key] ?? 10);
      const card = document.createElement('div');
      card.className = 'attr-card-v2 od98-attr-card od99-attr-card';
      card.innerHTML = `
        <div class="attr-head">
          <div class="attr-name">${escape(label)}</div>
          <div class="attr-mod">${escape(typeof formatMod === 'function' ? formatMod(attrMod(value)) : value)}</div>
          <div class="attr-help">D20</div>
        </div>
        <div class="od98-attr-control od99-attr-control">
          <button type="button" class="od98-attr-step od99-step" data-od99-attr-step="${escape(key)}" data-dir="-1">−</button>
          <input data-attr="${escape(key)}" type="number" value="${escape(value)}" min="1" inputmode="numeric">
          <button type="button" class="od98-attr-step od99-step" data-od99-attr-step="${escape(key)}" data-dir="1">+</button>
        </div>
        <button class="primary-btn small roll-attr" data-roll-attr="${escape(key)}">D20</button>`;
      grid.appendChild(card);
    });
  }

  if (typeof renderAttributes === 'function') renderAttributes = renderAttributesV99;

  function ensureVitalControls() {
    [['pv-current', 'PV'], ['pv-max', 'PV Máx'], ['pe-current', 'PE'], ['pe-max', 'PE Máx']].forEach(([id]) => {
      const input = $(id);
      if (!input || input.closest('.od99-vital-step-wrap')) return;
      const wrap = document.createElement('span');
      wrap.className = 'od99-vital-step-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      wrap.insertAdjacentHTML('afterbegin', `<button type="button" class="od99-vital-step" data-od99-vital-step="${id}" data-dir="-1">−</button>`);
      wrap.insertAdjacentHTML('beforeend', `<button type="button" class="od99-vital-step" data-od99-vital-step="${id}" data-dir="1">+</button>`);
    });
  }

  function setPortraitEverywhere(src, shouldSave = true) {
    const value = String(src || '').trim();
    const hidden = $('portrait-url');
    const modalUrl = $('portrait-modal-url');
    const preview = $('char-portrait-preview');
    const overlay = $('overlay-portrait');
    if (hidden) hidden.value = value;
    if (modalUrl) modalUrl.value = value;
    if (preview) { preview.src = value || 'assets/logo.jpg'; preview.classList.add('od99-portrait-ok'); }
    if (overlay) overlay.src = value || 'assets/logo.jpg';
    updateChar?.(char => {
      char.portrait = value;
      char.image = value;
      char.photo = value;
      char.updatedAt = Date.now();
    });
    const char = currentChar && currentChar();
    if (char) {
      try { renderPortrait?.(char); } catch (_) {}
      try { updateOverlay?.(char); } catch (_) {}
      if (shouldSave) {
        try { queueSave?.(); } catch (_) {}
        try {
          if (typeof od44SaveCharacterOnline === 'function') od44SaveCharacterOnline(char).catch(error => console.warn('Falha ao salvar retrato v99:', error));
          else if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char);
        } catch (_) {}
      }
    }
  }

  function ensureCropDialog() {
    let dialog = $('od99-portrait-crop-modal');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'od99-portrait-crop-modal';
    dialog.className = 'od99-crop-modal od-modal';
    dialog.innerHTML = `
      <form method="dialog" class="modal-card manga-panel od99-crop-card">
        <div class="od99-crop-head">
          <div>
            <h2>Imagem da Ficha</h2>
            <p>Corte a imagem para ficar quadrada. GIFs são aceitos sem corte para manter a animação.</p>
          </div>
          <button type="button" class="icon-btn" id="od99-crop-close">×</button>
        </div>
        <input id="od99-portrait-file" type="file" accept="image/*,.gif,image/gif" />
        <input id="od99-portrait-url" type="text" placeholder="URL, data:image ou cole uma imagem" />
        <div class="od99-crop-stage"><canvas id="od99-crop-canvas" width="512" height="512"></canvas></div>
        <div class="od99-crop-controls">
          <label>Zoom <input id="od99-crop-zoom" type="range" min="0.5" max="3" step="0.01" value="1" /></label>
          <label>Horizontal <input id="od99-crop-x" type="range" min="-512" max="512" step="1" value="0" /></label>
          <label>Vertical <input id="od99-crop-y" type="range" min="-512" max="512" step="1" value="0" /></label>
        </div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" id="od99-use-url">Usar URL/Imagem sem corte</button>
          <button type="button" class="ghost-btn" id="od99-crop-cancel">Cancelar</button>
          <button type="button" class="primary-btn" id="od99-crop-save">Salvar Retrato</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function drawCrop() {
    const state = od99CropState;
    const canvas = $('od99-crop-canvas');
    if (!state || !canvas) return;
    const ctx = canvas.getContext('2d');
    const zoom = Number($('od99-crop-zoom')?.value || 1);
    const offsetX = Number($('od99-crop-x')?.value || 0);
    const offsetY = Number($('od99-crop-y')?.value || 0);
    ctx.clearRect(0,0,512,512);
    ctx.fillStyle = '#111';
    ctx.fillRect(0,0,512,512);
    const img = state.img;
    const base = Math.max(512 / img.width, 512 / img.height);
    const w = img.width * base * zoom;
    const h = img.height * base * zoom;
    const x = (512 - w) / 2 + offsetX;
    const y = (512 - h) / 2 + offsetY;
    ctx.drawImage(img, x, y, w, h);
  }

  function loadCropImage(src) {
    const img = new Image();
    img.onload = () => {
      od99CropState = { img, src };
      ['od99-crop-zoom','od99-crop-x','od99-crop-y'].forEach(id => { const el = $(id); if (el) el.value = id === 'od99-crop-zoom' ? '1' : '0'; });
      drawCrop();
    };
    img.onerror = () => alert('Não foi possível carregar essa imagem. Tente outra imagem ou use URL direta.');
    img.src = src;
  }

  function openPortraitCrop() {
    const dialog = ensureCropDialog();
    const url = $('od99-portrait-url');
    if (url) url.value = $('portrait-url')?.value || currentChar?.()?.portrait || '';
    if (url?.value) loadCropImage(url.value);
    dialog.showModal();
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handlePortraitFile(file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) return alert('Escolha um arquivo de imagem.');
    const dataUrl = await fileToDataUrl(file);
    const urlInput = $('od99-portrait-url');
    if (urlInput) urlInput.value = dataUrl;
    if (/image\/gif/i.test(file.type)) {
      setPortraitEverywhere(dataUrl, true);
      $('od99-portrait-crop-modal')?.close();
      return;
    }
    loadCropImage(dataUrl);
  }

  document.addEventListener('click', async event => {
    const portraitBtn = null;
    if (portraitBtn) { return; }

    const attrStep = event.target.closest('[data-od99-attr-step]');
    if (attrStep) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const key = attrStep.dataset.od99AttrStep;
      const dir = Number(attrStep.dataset.dir || 0);
      const input = document.querySelector(`input[data-attr="${CSS.escape(key)}"]`);
      if (!input) return;
      input.value = Math.max(1, Number(input.value || 1) + dir);
      updateChar?.(char => { char.attrs = char.attrs || {}; char.attrs[key] = Number(input.value || 1); readDodgeIntoCharV99(char); });
      const char = currentChar && currentChar();
      if (char) { renderAttributesV99(char); renderSkills?.(char); updateDerivedStatsDisplay?.(char); queueSave?.(); }
      return;
    }

    const vitalStep = event.target.closest('[data-od99-vital-step]');
    if (vitalStep) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = vitalStep.dataset.od99VitalStep;
      const input = $(id);
      const dir = Number(vitalStep.dataset.dir || 0);
      if (!input) return;
      input.value = Math.max(0, Number(input.value || 0) + dir);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      queueSave?.();
      return;
    }

    if (event.target.closest('#od99-crop-close, #od99-crop-cancel')) {
      event.preventDefault();
      $('od99-portrait-crop-modal')?.close();
      return;
    }

    if (event.target.closest('#od99-use-url')) {
      event.preventDefault();
      const value = $('od99-portrait-url')?.value?.trim() || '';
      setPortraitEverywhere(value, true);
      $('od99-portrait-crop-modal')?.close();
      return;
    }

    if (event.target.closest('#od99-crop-save')) {
      event.preventDefault();
      const canvas = $('od99-crop-canvas');
      if (!canvas || !od99CropState) return setPortraitEverywhere($('od99-portrait-url')?.value || '', true);
      const dataUrl = canvas.toDataURL('image/png', 0.92);
      setPortraitEverywhere(dataUrl, true);
      $('od99-portrait-crop-modal')?.close();
      return;
    }

    const leave = event.target.closest('[data-leave-campaign], #back-to-sessions-btn');
    if (leave && event.target.closest('[data-leave-campaign]')) {
      try { history.replaceState({ od71Tab: 'home' }, '', '/inicio'); } catch (_) {}
      try { localStorage.setItem('od71_tab', 'home'); localStorage.removeItem(STORAGE.activeCampaign); } catch (_) {}
    }
  }, true);

  document.addEventListener('change', async event => {
    const file = event.target.closest('#od99-portrait-file');
    if (file) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await handlePortraitFile(file.files?.[0]);
      file.value = '';
      return;
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target.closest('#od99-crop-zoom, #od99-crop-x, #od99-crop-y')) drawCrop();
    if (event.target.closest('#od99-portrait-url')) {
      const value = event.target.value.trim();
      if (value && !/^data:image\/gif/i.test(value)) loadCropImage(value);
    }
  }, true);

  document.addEventListener('paste', async event => {
    const dialog = $('od99-portrait-crop-modal');
    if (!dialog?.open) return;
    const item = [...(event.clipboardData?.items || [])].find(i => i.type?.startsWith('image/'));
    if (!item) return;
    event.preventDefault();
    await handlePortraitFile(item.getAsFile());
  }, true);

  // Permite GIF nos campos de ícone OBS criados na v96.
  function allowGifIconInputs() {
    document.querySelectorAll('.od96-icon-file').forEach(input => input.setAttribute('accept', 'image/*,.gif,image/gif'));
  }

  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od99Wrapped) {
    const baseSave = saveCurrentCharacter;
    saveCurrentCharacter = function od99SaveCurrentCharacter() {
      const active = document.activeElement;
      const editingLongText = active && active.matches?.('textarea, input[type="text"], input[type="url"], input:not([type])');
      const result = baseSave.apply(this, arguments);
      const char = currentChar && currentChar();
      if (char) {
        const hidden = $('portrait-url');
        if (hidden?.value) char.portrait = hidden.value;
        readDodgeIntoCharV99(char);
      }
      // preserva foco em campos de texto quando o autosave rodar durante digitação
      if (editingLongText && active?.isConnected) setTimeout(() => { try { active.focus(); } catch (_) {} }, 0);
      return result;
    };
    saveCurrentCharacter.__od99Wrapped = true;
  }

  if (typeof renderPortrait === 'function' && !renderPortrait.__od99Wrapped) {
    renderPortrait = function od99RenderPortrait(char) {
      const img = $('char-portrait-preview');
      if (!img) return;
      img.src = char?.portrait || char?.image || char?.photo || 'assets/logo.jpg';
      img.onerror = () => { img.src = 'assets/logo.jpg'; };
    };
    renderPortrait.__od99Wrapped = true;
  }

  if (typeof loadCharacter === 'function' && !loadCharacter.__od99Wrapped) {
    const baseLoadCharacter = loadCharacter;
    loadCharacter = function od99LoadCharacter(id) {
      const active = document.activeElement;
      if (active?.matches?.(editableSelector) && String(id) === String(currentCharacterId || '') && document.getElementById('app-screen')?.classList.contains('active')) {
        const char = currentChar && currentChar();
        if (char) { updateBars?.(char); updateDerivedStatsDisplay?.(char); }
        return;
      }
      const result = baseLoadCharacter.apply(this, arguments);
      const char = currentChar && currentChar();
      if (char) { ensureVitalControls(); allowGifIconInputs(); updateDodgeNote(char); }
      return result;
    };
    loadCharacter.__od99Wrapped = true;
  }

  // Fluxo sem alerta duplicado: se não há ficha, abre o modal; se há ficha, pede seleção antes de entrar.
  if (typeof enterCampaign === 'function' && !enterCampaign.__od99Wrapped) {
    const baseEnterCampaign = enterCampaign;
    enterCampaign = async function od99EnterCampaign(campaignId) {
      await od42RefreshOwnCharacters?.().catch?.(() => {});
      await od42RefreshTables?.().catch?.(() => {});
      const member = getMembers().find(m => String(m.campaignId) === String(campaignId) && String(m.userId) === String(currentUser?.id));
      if (member && !member.characterId) {
        pendingChooseCampaignId = campaignId;
        if (!userCharacters().length) document.getElementById('create-first-sheet-modal')?.showModal();
        else openChooseCharacterModal(campaignId);
        return;
      }
      return baseEnterCampaign.apply(this, arguments);
    };
    enterCampaign.__od99Wrapped = true;
  }

  if (typeof createCharacterForCampaign === 'function' && !createCharacterForCampaign.__od99Wrapped) {
    createCharacterForCampaign = async function od99CreateCharacterForCampaign() {
      try {
        const campaignId = pendingChooseCampaignId || currentCampaignId;
        const char = (typeof od42Token === 'function' && od42Token()) ? await od42CreateCharacter('Novo Personagem') : createCharacter(currentUser.id, 'Novo Personagem');
        if (!(typeof od42Token === 'function' && od42Token())) {
          const all = get(STORAGE.characters, []); all.push(char); set(STORAGE.characters, all);
        }
        if (campaignId) await attachCharacterToCampaign(campaignId, char.id);
        document.getElementById('create-first-sheet-modal')?.close();
        document.getElementById('choose-character-modal')?.close();
        currentCharacterId = char.id;
        if (campaignId) await enterCampaign(campaignId);
        else loadCharacter(char.id);
      } catch (error) {
        alert(error.message || 'Erro ao criar e vincular ficha.');
      }
    };
    createCharacterForCampaign.__od99Wrapped = true;
  }

  // Marca no personagem base qual transformação está ativa para o OBS não tentar montar várias imagens.
  document.addEventListener('click', event => {
    const open = event.target.closest('[data-open-transformation]');
    const back = event.target.closest('[data-open-base-form]');
    if (!open && !back) return;
    const chars = get(STORAGE.characters, []);
    if (open) {
      const transformationId = open.dataset.openTransformation;
      const form = chars.find(c => String(c.id) === String(transformationId));
      const baseId = form?.baseCharacterId;
      const base = chars.find(c => String(c.id) === String(baseId));
      if (base && form) {
        base.activeTransformationId = form.id;
        base.obsTransformationActive = true;
        base.obsTransformPortrait = form.portrait || '';
        base.updatedAt = Date.now();
        set(STORAGE.characters, chars);
        if (typeof od44SaveCharacterOnline === 'function') od44SaveCharacterOnline(base).catch(() => {});
      }
    }
    if (back) {
      const baseId = back.dataset.openBaseForm;
      const base = chars.find(c => String(c.id) === String(baseId));
      if (base) {
        base.activeTransformationId = '';
        base.obsTransformationActive = false;
        base.updatedAt = Date.now();
        set(STORAGE.characters, chars);
        if (typeof od44SaveCharacterOnline === 'function') od44SaveCharacterOnline(base).catch(() => {});
      }
    }
  }, true);

  const baseShowSessions = typeof showSessions === 'function' ? showSessions : null;
  if (baseShowSessions && !baseShowSessions.__od99Wrapped) {
    showSessions = function od99ShowSessions() {
      try { localStorage.setItem('od71_tab', 'home'); history.replaceState({ od71Tab: 'home' }, '', '/inicio'); } catch (_) {}
      const result = baseShowSessions.apply(this, arguments);
      setTimeout(() => {
        try {
          localStorage.setItem('od71_tab', 'home');
          document.querySelector('[data-od71-tab="home"], [data-od75-tab="home"]')?.click();
        } catch (_) {}
      }, 0);
      return result;
    };
    showSessions.__od99Wrapped = true;
  }

  function boot() {
    const char = currentChar && currentChar();
    const dodgeField = $('dodge');
    if (dodgeField) dodgeField.removeAttribute('readonly');
    if (char) {
      if ($('attributes-grid')) renderAttributesV99(char);
      ensureVitalControls();
      updateDodgeNote(char);
    }
    allowGifIconInputs();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();


/* =========================
   V100 - Beta 3: ficha, imagens por link, esquiva e vitais
   - PV/PE alinhados e controles compactos
   - Atributos sem botão vazando
   - Esquiva = Defesa + bônus de proficiência se Esquiva treinada + bônus manual de Esquiva
   - Imagens somente por link, com GIF aceito
   - Fotos de estado: normal, machucado (-50%) e morrendo (0 PV)
   - Abaixo de 0 PV a imagem some
   - Crop visual estilo Discord: arrastar/zoom sem barras
========================= */
(function od100Beta3Fixes(){
  const $ = id => document.getElementById(id);
  const qs = sel => document.querySelector(sel);
  const esc = value => {
    try { return typeof escapeHtml === 'function' ? escapeHtml(value ?? '') : String(value ?? ''); }
    catch (_) { return String(value ?? ''); }
  };

  try {
    if (Array.isArray(SKILLS) && !SKILLS.some(([name]) => name === 'Esquiva')) {
      SKILLS.push(['Esquiva', 'agilidade']);
    }
  } catch (_) {}

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeChar() {
    try { return typeof currentChar === 'function' ? currentChar() : null; } catch (_) { return null; }
  }

  function getSkill(char, name) {
    return char?.skills?.[name] || { trained: false, bonus: 0, disadvantage: false };
  }

  function od100DodgeFormula(char = safeChar()) {
    if (!char) return 0;
    const def = typeof effectiveDefense === 'function' ? num(effectiveDefense(char), 10) : num(char.defense ?? char.defesa, 10);
    const skill = getSkill(char, 'Esquiva');
    const prof = skill.trained ? num(char.profBonus, 0) : 0;
    const bonus = num(skill.bonus, 0);
    return def + prof + bonus;
  }

  window.od100DodgeFormula = od100DodgeFormula;
  window.od99DodgeFormula = od100DodgeFormula;
  window.od98DodgeFormula = od100DodgeFormula;

  if (typeof calculatedDodge === 'function') {
    calculatedDodge = function od100CalculatedDodge(char = safeChar()) {
      if (!char) return 0;
      const manual = Number(char.dodge);
      return Number.isFinite(manual) ? manual : 10;
    };
  }

  function syncDodge(char = safeChar()) {
    if (!char) return;
    const value = Number.isFinite(Number(char.dodge)) ? Number(char.dodge) : 10;
    char.dodge = value;
    char.dodgeManual = true;
    char.dodgeLocked = true;
    const field = $('dodge');
    if (field && document.activeElement !== field) {
      field.value = value;
      field.removeAttribute('readonly');
      field.title = '';
    }
    const note = $('dodge-formula-note');
    if (note) note.textContent = '';
  }

  function normalizeImageLink(value) {
    return String(value || '').trim();
  }

  function ensureObsIcons(char) {
    if (!char) return {};
    char.obsIcons = char.obsIcons || {};
    return char.obsIcons;
  }

  function selectedPortraitForState(char = safeChar()) {
    if (!char) return 'assets/logo.jpg';
    const pv = num(char.pvCurrent ?? char.pvAtual ?? char.pv, 0);
    const max = Math.max(1, num(char.pvMax ?? char.pvTotal ?? char.pv_max, 1));
    const icons = ensureObsIcons(char);
    if (pv < 0) return '';
    if (char.obsTransformationActive && (char.obsTransformPortrait || icons.transformation)) return char.obsTransformPortrait || icons.transformation;
    if (pv === 0 && icons.zero) return icons.zero;
    if (pv > 0 && pv / max < 0.5 && icons.low) return icons.low;
    return char.portrait || char.image || char.photo || 'assets/logo.jpg';
  }

  function applyPortraitCrop(img, char = safeChar()) {
    if (!img || !char) return;
    const crop = char.portraitCrop || {};
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${num(crop.x, 50)}% ${num(crop.y, 50)}%`;
    img.style.transformOrigin = `${num(crop.x, 50)}% ${num(crop.y, 50)}%`;
    img.style.transform = `scale(${Math.max(1, num(crop.scale, 1))})`;
  }

  function updatePortraitPreview(char = safeChar()) {
    const img = $('char-portrait-preview');
    if (!img || !char) return;
    const src = selectedPortraitForState(char);
    if (src) {
      img.style.visibility = '';
      img.src = src;
      img.onerror = () => { img.src = 'assets/logo.jpg'; };
      applyPortraitCrop(img, char);
    } else {
      img.removeAttribute('src');
      img.style.visibility = 'hidden';
    }
  }

  function savePortraitLinks() {
    const char = safeChar();
    if (!char) return;
    const normal = normalizeImageLink($('od100-portrait-normal')?.value || $('portrait-modal-url')?.value || '');
    const low = normalizeImageLink($('od100-portrait-low')?.value || '');
    const zero = normalizeImageLink($('od100-portrait-zero')?.value || '');
    const crop = window.od100CropState || { x: 50, y: 50, scale: 1 };
    updateChar?.(c => {
      c.portrait = normal;
      c.image = normal;
      c.photo = normal;
      c.obsIcons = c.obsIcons || {};
      c.obsIcons.low = low;
      c.obsIcons.zero = zero;
      c.obsIconLow = low;
      c.obsIconZero = zero;
      c.portraitCrop = { x: crop.x, y: crop.y, scale: crop.scale };
      c.updatedAt = Date.now();
    });
    const hidden = $('portrait-url');
    if (hidden) hidden.value = normal;
    updatePortraitPreview(safeChar());
    try { queueSave?.(); } catch (_) {}
    try {
      const current = safeChar();
      if (current && typeof od44SaveCharacterOnline === 'function') od44SaveCharacterOnline(current).catch(() => {});
      else if (current && typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(current);
    } catch (_) {}
  }

  function ensurePortraitDialogV100() {
    let dialog = $('od100-portrait-modal');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'od100-portrait-modal';
    dialog.className = 'od100-portrait-modal od-modal';
    dialog.innerHTML = `
      <form method="dialog" class="modal-card manga-panel od100-portrait-card">
        <div class="od100-modal-head">
          <div>
            <h2>Fotos da Ficha</h2>
            <p>Use links diretos de imagem. GIF também funciona.</p>
          </div>
          <button type="button" class="icon-btn" id="od100-photo-close">×</button>
        </div>
        <label>Foto normal<input id="od100-portrait-normal" type="text" placeholder="https://...jpg, png, webp ou gif" /></label>
        <label>Foto machucado, abaixo de 50% PV<input id="od100-portrait-low" type="text" placeholder="opcional" /></label>
        <label>Foto morrendo, 0 PV<input id="od100-portrait-zero" type="text" placeholder="opcional" /></label>
        <div class="od100-crop-shell">
          <div id="od100-crop-stage" class="od100-crop-stage" title="Arraste para posicionar. Use a roda do mouse para aproximar.">
            <img id="od100-crop-img" alt="prévia" draggable="false" />
          </div>
          <small>Arraste a imagem para posicionar. Use a roda do mouse para dar zoom. Não há upload local nesta versão.</small>
        </div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" id="od100-photo-reset">Centralizar</button>
          <button type="button" class="ghost-btn" id="od100-photo-cancel">Cancelar</button>
          <button type="button" class="primary-btn" id="od100-photo-save">Salvar Fotos</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function refreshCropPreview() {
    const img = $('od100-crop-img');
    const src = normalizeImageLink($('od100-portrait-normal')?.value || '');
    if (!img) return;
    if (!src) {
      img.removeAttribute('src');
      return;
    }
    img.src = src;
    img.style.objectFit = 'cover';
    const crop = window.od100CropState || { x: 50, y: 50, scale: 1 };
    img.style.objectPosition = `${crop.x}% ${crop.y}%`;
    img.style.transform = `scale(${crop.scale})`;
    img.onerror = () => { img.removeAttribute('src'); };
  }

  function openPortraitModalV100() {
    const char = safeChar();
    const dialog = ensurePortraitDialogV100();
    const icons = char?.obsIcons || {};
    $('od100-portrait-normal').value = char?.portrait || char?.image || char?.photo || $('portrait-url')?.value || '';
    $('od100-portrait-low').value = icons.low || char?.obsIconLow || '';
    $('od100-portrait-zero').value = icons.zero || char?.obsIconZero || '';
    window.od100CropState = Object.assign({ x: 50, y: 50, scale: 1 }, char?.portraitCrop || {});
    refreshCropPreview();
    dialog.showModal();
  }

  function renderAttributesV100(char = safeChar()) {
    const grid = $('attributes-grid');
    if (!grid || !char) return;
    const labels = { forca: 'Força', agilidade: 'Agilidade', vigor: 'Vigor', intelecto: 'Intelecto', presenca: 'Presença' };
    grid.innerHTML = '';
    Object.entries(labels).forEach(([key, label]) => {
      const value = num(char.attrs?.[key], 1);
      const card = document.createElement('div');
      card.className = 'attr-card-v2 od98-attr-card od99-attr-card od100-attr-card';
      card.innerHTML = `
        <div class="attr-head od100-attr-head">
          <div class="attr-name">${esc(label)}</div>
          <div class="attr-mod">${esc(typeof formatMod === 'function' ? formatMod(attrMod(value)) : value)}</div>
          <div class="attr-help">D20</div>
        </div>
        <div class="od100-attr-row">
          <button type="button" class="od100-step" data-od100-attr-step="${esc(key)}" data-dir="-1">−</button>
          <input data-attr="${esc(key)}" type="number" value="${esc(value)}" min="1" inputmode="numeric">
          <button type="button" class="od100-step" data-od100-attr-step="${esc(key)}" data-dir="1">+</button>
        </div>
        <button class="primary-btn small roll-attr od100-roll" data-roll-attr="${esc(key)}">D20</button>`;
      grid.appendChild(card);
    });
  }

  if (typeof renderAttributes === 'function') renderAttributes = renderAttributesV100;

  function ensureVitalControlsV100() {
    ['pv-current', 'pv-max', 'pe-current', 'pe-max'].forEach(id => {
      const input = $(id);
      if (!input) return;
      input.type = 'number';
      if (input.closest('.od100-vital-wrap')) return;
      const wrap = document.createElement('span');
      wrap.className = 'od100-vital-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      wrap.insertAdjacentHTML('afterbegin', `<button type="button" class="od100-vital-step" data-od100-vital-step="${id}" data-dir="-1">−</button>`);
      wrap.insertAdjacentHTML('beforeend', `<button type="button" class="od100-vital-step" data-od100-vital-step="${id}" data-dir="1">+</button>`);
    });
    document.querySelectorAll('.od99-vital-step-wrap').forEach(wrap => wrap.classList.add('od100-vital-normalized'));
  }

  if (typeof updateDerivedStatsDisplay === 'function' && !updateDerivedStatsDisplay.__od100Wrapped) {
    const base = updateDerivedStatsDisplay;
    updateDerivedStatsDisplay = function od100UpdateDerivedStatsDisplay(char = safeChar()) {
      const result = base.apply(this, arguments);
      syncDodge(char);
      updatePortraitPreview(char);
      ensureVitalControlsV100();
      return result;
    };
    updateDerivedStatsDisplay.__od100Wrapped = true;
  }

  if (typeof renderPortrait === 'function') {
    renderPortrait = function od100RenderPortrait(char) { updatePortraitPreview(char || safeChar()); };
    renderPortrait.__od100Wrapped = true;
  }

  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od100Wrapped) {
    const baseSave = saveCurrentCharacter;
    saveCurrentCharacter = function od100SaveCurrentCharacter() {
      const char = safeChar();
      if (char) syncDodge(char);
      return baseSave.apply(this, arguments);
    };
    saveCurrentCharacter.__od100Wrapped = true;
  }

  document.addEventListener('click', event => {
    const portraitBtn = null;
    if (portraitBtn) { return; }

    const close = event.target.closest('#od100-photo-close, #od100-photo-cancel');
    if (close) {
      event.preventDefault();
      $('od100-portrait-modal')?.close();
      return;
    }

    if (event.target.closest('#od100-photo-reset')) {
      event.preventDefault();
      window.od100CropState = { x: 50, y: 50, scale: 1 };
      refreshCropPreview();
      return;
    }

    if (event.target.closest('#od100-photo-save')) {
      event.preventDefault();
      savePortraitLinks();
      $('od100-portrait-modal')?.close();
      return;
    }

    const attrStep = event.target.closest('[data-od100-attr-step]');
    if (attrStep) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const key = attrStep.dataset.od100AttrStep;
      const dir = num(attrStep.dataset.dir, 0);
      const input = document.querySelector(`input[data-attr="${CSS.escape(key)}"]`);
      if (!input) return;
      input.value = Math.max(1, num(input.value, 1) + dir);
      updateChar?.(char => {
        char.attrs = char.attrs || {};
        char.attrs[key] = num(input.value, 1);
        syncDodge(char);
      });
      const char = safeChar();
      if (char) {
        renderAttributesV100(char);
        try { renderSkills?.(char); } catch (_) {}
        syncDodge(char);
        try { queueSave?.(); } catch (_) {}
      }
      return;
    }

    const vitalStep = event.target.closest('[data-od100-vital-step], [data-od99-vital-step]');
    if (vitalStep) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = vitalStep.dataset.od100VitalStep || vitalStep.dataset.od99VitalStep;
      const input = $(id);
      if (!input) return;
      input.value = num(input.value, 0) + num(vitalStep.dataset.dir, 0);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const char = safeChar();
      if (char) { syncDodge(char); updatePortraitPreview(char); }
      try { queueSave?.(); } catch (_) {}
      return;
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target.closest('#od100-portrait-normal, #od100-portrait-low, #od100-portrait-zero')) {
      refreshCropPreview();
      return;
    }
    if (event.target.matches?.('[data-skill-bonus], [data-od98-skill-bonus], [data-od88-skill-bonus], [data-od79-skill-bonus], [data-skill-trained], [data-od98-skill-trained]')) {
      setTimeout(() => syncDodge(safeChar()), 0);
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target.matches?.('[data-skill-trained], [data-od98-skill-trained]')) {
      setTimeout(() => syncDodge(safeChar()), 0);
    }
  }, true);

  function setupCropDragging() {
    const stage = $('od100-crop-stage');
    if (!stage || stage.dataset.od100Ready === '1') return;
    stage.dataset.od100Ready = '1';
    let dragging = false;
    let start = null;
    stage.addEventListener('pointerdown', ev => {
      dragging = true;
      stage.setPointerCapture?.(ev.pointerId);
      const crop = window.od100CropState || { x: 50, y: 50, scale: 1 };
      start = { x: ev.clientX, y: ev.clientY, cropX: crop.x, cropY: crop.y };
    });
    stage.addEventListener('pointermove', ev => {
      if (!dragging || !start) return;
      const rect = stage.getBoundingClientRect();
      const dx = ((ev.clientX - start.x) / Math.max(1, rect.width)) * -100;
      const dy = ((ev.clientY - start.y) / Math.max(1, rect.height)) * -100;
      window.od100CropState = Object.assign({}, window.od100CropState || {}, {
        x: Math.max(0, Math.min(100, start.cropX + dx)),
        y: Math.max(0, Math.min(100, start.cropY + dy))
      });
      refreshCropPreview();
    });
    ['pointerup','pointercancel','pointerleave'].forEach(type => stage.addEventListener(type, () => { dragging = false; start = null; }));
    stage.addEventListener('wheel', ev => {
      ev.preventDefault();
      const crop = window.od100CropState || { x: 50, y: 50, scale: 1 };
      const next = Math.max(1, Math.min(3, crop.scale + (ev.deltaY < 0 ? 0.08 : -0.08)));
      window.od100CropState = Object.assign({}, crop, { scale: next });
      refreshCropPreview();
    }, { passive: false });
  }

  if (typeof loadCharacter === 'function' && !loadCharacter.__od100Wrapped) {
    const baseLoad = loadCharacter;
    loadCharacter = function od100LoadCharacter(id) {
      const result = baseLoad.apply(this, arguments);
      const char = safeChar();
      if (char) {
        if ($('attributes-grid')) renderAttributesV100(char);
        ensureVitalControlsV100();
        syncDodge(char);
        updatePortraitPreview(char);
      }
      return result;
    };
    loadCharacter.__od100Wrapped = true;
  }

  function boot() {
    const oldPortraitModal = $('portrait-modal');
    if (oldPortraitModal) oldPortraitModal.classList.add('od100-hide-old-portrait-modal');
    const hidden = $('portrait-url');
    if (hidden) hidden.type = 'text';
    const dodge = $('dodge');
    if (dodge) dodge.removeAttribute('readonly');
    const char = safeChar();
    if (char) {
      if ($('attributes-grid')) renderAttributesV100(char);
      ensureVitalControlsV100();
      syncDodge(char);
      updatePortraitPreview(char);
    }
    setupCropDragging();
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 150);
  setTimeout(boot, 750);
  window.od100RefreshSheetFixes = boot;
})();

/* =========================
   V101 - Beta 4: vitais, atributos, foto por link, esquiva e vínculo em mesa
   - Remove duplicação dos botões +/- em PV/PE
   - Reposiciona atributos sem vazamento
   - Esquiva = Defesa + bônus/proficiência de Reflexo, sem AGI
   - Foto da ficha somente por link, com GIF aceito e recorte por arrastar/zoom
   - Vincular em Mesa abre painel com mesas participantes
========================= */
(function od101Beta4Fixes(){
  const $ = id => document.getElementById(id);
  const esc = value => {
    try { return typeof escapeHtml === 'function' ? escapeHtml(value ?? '') : String(value ?? ''); }
    catch (_) { return String(value ?? ''); }
  };
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const safeChar = () => { try { return typeof currentChar === 'function' ? currentChar() : null; } catch (_) { return null; } };
  const safeUsers = () => { try { return get(STORAGE.users, []); } catch (_) { return []; } };
  const safeCampaigns = () => { try { return typeof getCampaigns === 'function' ? getCampaigns() : []; } catch (_) { return []; } };
  const safeMembers = () => { try { return typeof getMembers === 'function' ? getMembers() : []; } catch (_) { return []; } };

  function cleanImageLink(value) {
    return String(value || '').trim();
  }

  function reflexForDodgeV101(char = safeChar()) {
    if (!char) return 0;
    const skill = char.skills?.Reflexo || char.skills?.Reflexos || { trained: false, bonus: 0 };
    const prof = skill.trained ? num(char.profBonus, 0) : 0;
    return prof + num(skill.bonus, 0);
  }

  function dodgeFormulaV101(char = safeChar()) {
    if (!char) return 0;
    const def = typeof effectiveDefense === 'function' ? num(effectiveDefense(char), 10) : num(char.defense ?? char.defesa, 10);
    return def + reflexForDodgeV101(char);
  }

  window.od101DodgeFormula = dodgeFormulaV101;
  window.od100DodgeFormula = dodgeFormulaV101;
  window.od99DodgeFormula = dodgeFormulaV101;
  window.od98DodgeFormula = dodgeFormulaV101;

  if (typeof calculatedDodge === 'function') {
    calculatedDodge = function od101CalculatedDodge(char = safeChar()) {
      const manual = Number(char?.dodge);
      return Number.isFinite(manual) ? manual : 10;
    };
  }

  function syncDodgeV101(char = safeChar()) {
    if (!char) return;
    const value = Number.isFinite(Number(char.dodge)) ? Number(char.dodge) : 10;
    char.dodge = value;
    char.dodgeManual = true;
    char.dodgeLocked = true;
    const field = $('dodge');
    if (field && document.activeElement !== field) {
      field.value = value;
      field.removeAttribute('readonly');
    }
    const note = $('dodge-formula-note');
    if (note) note.textContent = '';
  }

  function ensureCharacterImageFields(char) {
    if (!char) return {};
    char.obsIcons = char.obsIcons || {};
    return char.obsIcons;
  }

  function portraitByStateV101(char = safeChar()) {
    if (!char) return 'assets/logo.jpg';
    const pv = num(char.pvCurrent ?? char.pvAtual ?? char.pv, 0);
    const pvMax = Math.max(1, num(char.pvMax ?? char.pvTotal ?? char.pv_max, 1));
    const icons = ensureCharacterImageFields(char);
    if (pv < 0) return '';
    if (char.obsTransformationActive && (char.obsTransformPortrait || icons.transformation)) return char.obsTransformPortrait || icons.transformation;
    if (pv === 0 && (icons.zero || char.portraitZero)) return icons.zero || char.portraitZero;
    if (pv > 0 && pv / pvMax < 0.5 && (icons.low || char.portraitLow)) return icons.low || char.portraitLow;
    return cleanImageLink(char.portrait || char.image || char.photo || char.avatar || '') || 'assets/logo.jpg';
  }

  function applyObjectCropToImage(img, char = safeChar()) {
    if (!img || !char) return;
    const crop = Object.assign({ x: 50, y: 50, scale: 1 }, char.portraitCrop || {});
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${num(crop.x, 50)}% ${num(crop.y, 50)}%`;
    img.style.transformOrigin = `${num(crop.x, 50)}% ${num(crop.y, 50)}%`;
    img.style.transform = `scale(${Math.max(1, Math.min(3, num(crop.scale, 1)))})`;
  }

  function updatePortraitV101(char = safeChar()) {
    const img = $('char-portrait-preview');
    if (!img || !char) return;
    const src = portraitByStateV101(char);
    if (!src) {
      img.removeAttribute('src');
      img.style.visibility = 'hidden';
      return;
    }
    img.style.visibility = '';
    if (img.getAttribute('src') !== src) img.src = src;
    img.onerror = () => { img.src = 'assets/logo.jpg'; };
    applyObjectCropToImage(img, char);
    const hidden = $('portrait-url');
    if (hidden) hidden.value = cleanImageLink(char.portrait || '');
  }

  function writeCharacterImageFields() {
    const char = safeChar();
    if (!char) return;
    const normal = cleanImageLink($('od101-photo-normal')?.value || '');
    const low = cleanImageLink($('od101-photo-low')?.value || '');
    const zero = cleanImageLink($('od101-photo-zero')?.value || '');
    const transform = cleanImageLink($('od101-photo-transform')?.value || '');
    const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od101CropState || {});

    updateChar?.(c => {
      c.portrait = normal;
      c.image = normal;
      c.photo = normal;
      c.avatar = normal;
      c.obsIcons = c.obsIcons || {};
      c.obsIcons.low = low;
      c.obsIcons.zero = zero;
      c.obsIcons.transformation = transform;
      c.portraitLow = low;
      c.portraitZero = zero;
      c.portraitCrop = crop;
      c.updatedAt = Date.now();
    });

    const fresh = safeChar();
    const hidden = $('portrait-url');
    const modalHidden = $('portrait-modal-url');
    if (hidden) hidden.value = normal;
    if (modalHidden) modalHidden.value = normal;
    updatePortraitV101(fresh);
    try { updateOverlay?.(fresh); } catch (_) {}
    try { queueSave?.(); } catch (_) {}
    try {
      if (typeof od44SaveCharacterOnline === 'function' && fresh) od44SaveCharacterOnline(fresh).catch(error => console.warn('Falha ao salvar imagem v101:', error));
      else if (typeof od42ScheduleCharacterSave === 'function' && fresh) od42ScheduleCharacterSave(fresh);
    } catch (_) {}
  }

  function ensurePhotoDialogV101() {
    let dialog = $('od101-photo-modal');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'od101-photo-modal';
    dialog.className = 'od101-photo-modal od-modal';
    dialog.innerHTML = `
      <form method="dialog" class="modal-card manga-panel od101-photo-card">
        <div class="od101-modal-head">
          <div>
            <h2>Fotos da Ficha</h2>
            <p>Use links diretos de imagem. PNG, JPG, WEBP e GIF funcionam. Arraste a prévia para enquadrar e use a roda do mouse para zoom.</p>
          </div>
          <button type="button" class="icon-btn" id="od101-photo-close">×</button>
        </div>
        <div class="od101-photo-grid">
          <label>Foto normal<input id="od101-photo-normal" type="url" placeholder="https://..." autocomplete="off"></label>
          <label>Machucado, abaixo de 50% PV<input id="od101-photo-low" type="url" placeholder="opcional: https://...gif" autocomplete="off"></label>
          <label>Morrendo, 0 PV<input id="od101-photo-zero" type="url" placeholder="opcional: https://...gif" autocomplete="off"></label>
          <label>Transformação ativa<input id="od101-photo-transform" type="url" placeholder="opcional: foto/gif da transformação" autocomplete="off"></label>
        </div>
        <div class="od101-crop-area">
          <div id="od101-crop-stage" class="od101-crop-stage" title="Arraste para mover. Roda do mouse para zoom.">
            <img id="od101-crop-img" alt="Prévia do retrato" draggable="false">
            <div class="od101-crop-mask"></div>
          </div>
          <div class="od101-crop-help">Prévia quadrada da ficha. Para GIF, o recorte visual também é aplicado sem perder a animação.</div>
        </div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" id="od101-photo-reset">Centralizar</button>
          <button type="button" class="ghost-btn" id="od101-photo-cancel">Cancelar</button>
          <button type="button" class="primary-btn" id="od101-photo-save">Salvar Fotos</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function refreshPhotoPreviewV101() {
    const img = $('od101-crop-img');
    if (!img) return;
    const src = cleanImageLink($('od101-photo-normal')?.value || '');
    if (!src) {
      img.removeAttribute('src');
      return;
    }
    if (img.getAttribute('src') !== src) img.src = src;
    const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od101CropState || {});
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${crop.x}% ${crop.y}%`;
    img.style.transformOrigin = `${crop.x}% ${crop.y}%`;
    img.style.transform = `scale(${Math.max(1, Math.min(3, num(crop.scale, 1)))})`;
    img.onerror = () => { img.removeAttribute('src'); };
  }

  function openPhotoDialogV101() {
    const char = safeChar();
    const dialog = ensurePhotoDialogV101();
    const icons = char?.obsIcons || {};
    $('od101-photo-normal').value = cleanImageLink(char?.portrait || char?.image || char?.photo || $('portrait-url')?.value || '');
    $('od101-photo-low').value = cleanImageLink(icons.low || char?.portraitLow || char?.obsIconLow || '');
    $('od101-photo-zero').value = cleanImageLink(icons.zero || char?.portraitZero || char?.obsIconZero || '');
    $('od101-photo-transform').value = cleanImageLink(icons.transformation || char?.obsTransformPortrait || '');
    window.od101CropState = Object.assign({ x: 50, y: 50, scale: 1 }, char?.portraitCrop || {});
    refreshPhotoPreviewV101();
    setupCropV101();
    dialog.showModal();
  }

  function setupCropV101() {
    const stage = $('od101-crop-stage');
    if (!stage || stage.dataset.od101Ready === '1') return;
    stage.dataset.od101Ready = '1';
    let dragging = false;
    let start = null;
    stage.addEventListener('pointerdown', ev => {
      dragging = true;
      stage.setPointerCapture?.(ev.pointerId);
      const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od101CropState || {});
      start = { x: ev.clientX, y: ev.clientY, cropX: crop.x, cropY: crop.y };
    });
    stage.addEventListener('pointermove', ev => {
      if (!dragging || !start) return;
      const rect = stage.getBoundingClientRect();
      const dx = ((ev.clientX - start.x) / Math.max(1, rect.width)) * -100;
      const dy = ((ev.clientY - start.y) / Math.max(1, rect.height)) * -100;
      window.od101CropState = Object.assign({}, window.od101CropState || {}, {
        x: Math.max(0, Math.min(100, start.cropX + dx)),
        y: Math.max(0, Math.min(100, start.cropY + dy))
      });
      refreshPhotoPreviewV101();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => stage.addEventListener(type, () => { dragging = false; start = null; }));
    stage.addEventListener('wheel', ev => {
      ev.preventDefault();
      const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od101CropState || {});
      crop.scale = Math.max(1, Math.min(3, crop.scale + (ev.deltaY < 0 ? 0.08 : -0.08)));
      window.od101CropState = crop;
      refreshPhotoPreviewV101();
    }, { passive: false });
  }

  function renderAttributesV101(char = safeChar()) {
    const grid = $('attributes-grid');
    if (!grid || !char) return;
    const labels = { forca: 'Força', agilidade: 'Agilidade', vigor: 'Vigor', intelecto: 'Intelecto', presenca: 'Presença' };
    grid.innerHTML = '';
    Object.entries(labels).forEach(([key, label]) => {
      const value = num(char.attrs?.[key], 1);
      const card = document.createElement('div');
      card.className = 'attr-card-v2 od101-attr-card';
      card.innerHTML = `
        <div class="od101-attr-top">
          <div>
            <div class="attr-name">${esc(label)}</div>
            <div class="attr-help">D20</div>
          </div>
          <div class="attr-mod">${esc(typeof formatMod === 'function' ? formatMod(attrMod(value)) : value)}</div>
        </div>
        <div class="od101-attr-control">
          <button type="button" class="od101-step" data-od101-attr-step="${esc(key)}" data-dir="-1">−</button>
          <input data-attr="${esc(key)}" type="number" value="${esc(value)}" min="1" inputmode="numeric">
          <button type="button" class="od101-step" data-od101-attr-step="${esc(key)}" data-dir="1">+</button>
        </div>
        <button class="primary-btn small roll-attr od101-roll" data-roll-attr="${esc(key)}" type="button">D20</button>`;
      grid.appendChild(card);
    });
  }

  if (typeof renderAttributes === 'function') renderAttributes = renderAttributesV101;

  function normalizeVitalControl(id) {
    const input = $(id);
    if (!input) return;
    input.type = 'number';
    const root = input.closest('.od101-vital-wrap, .od100-vital-wrap, .od99-vital-step-wrap');
    if (root) {
      let outer = root;
      while (outer.parentElement?.matches?.('.od101-vital-wrap, .od100-vital-wrap, .od99-vital-step-wrap')) outer = outer.parentElement;
      outer.parentNode.insertBefore(input, outer);
      outer.remove();
    }
    const container = input.closest('.vital-inputs') || input.parentElement;
    container?.querySelectorAll(`[data-od100-vital-step="${CSS.escape(id)}"], [data-od99-vital-step="${CSS.escape(id)}"], [data-od101-vital-step="${CSS.escape(id)}"]`).forEach(btn => btn.remove());
    if (input.closest('.od101-vital-wrap')) return;
    const wrap = document.createElement('span');
    wrap.className = 'od101-vital-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    wrap.insertAdjacentHTML('afterbegin', `<button type="button" class="od101-vital-step" data-od101-vital-step="${id}" data-dir="-1">−</button>`);
    wrap.insertAdjacentHTML('beforeend', `<button type="button" class="od101-vital-step" data-od101-vital-step="${id}" data-dir="1">+</button>`);
  }

  function normalizeVitalsV101() {
    ['pv-current', 'pv-max', 'pe-current', 'pe-max'].forEach(normalizeVitalControl);
  }

  function ensureLinkCharacterDialogV101() {
    let dialog = $('od101-link-campaign-modal');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'od101-link-campaign-modal';
    dialog.className = 'od101-link-modal od-modal';
    dialog.innerHTML = `
      <form method="dialog" class="modal-card manga-panel od101-link-card">
        <div class="od101-modal-head">
          <div>
            <h2>Vincular em Mesa</h2>
            <p>Escolha uma das mesas em que você participa para usar esta ficha.</p>
          </div>
          <button type="button" class="icon-btn" id="od101-link-close">×</button>
        </div>
        <div id="od101-link-list" class="od101-link-list"></div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function roleLabel(role) {
    if (role === 'mestre_jogador') return 'Mestre + Jogador';
    if (role === 'mestre') return 'Mestre';
    return 'Jogador';
  }

  function openLinkCharacterDialogV101() {
    const char = safeChar();
    if (!char || !currentCharacterId) return alert('Abra ou crie uma ficha antes de vincular em uma mesa.');
    const dialog = ensureLinkCharacterDialogV101();
    const list = $('od101-link-list');
    const campaigns = safeCampaigns();
    const members = safeMembers().filter(m => String(m.userId) === String(currentUser?.id));
    const chars = (() => { try { return get(STORAGE.characters, []); } catch (_) { return []; } })();
    list.innerHTML = '';
    if (!members.length) {
      list.innerHTML = '<div class="campaign-empty">Você ainda não participa de nenhuma mesa.</div>';
    }
    members.forEach(member => {
      const campaign = campaigns.find(c => String(c.id) === String(member.campaignId));
      if (!campaign) return;
      const linked = chars.find(c => String(c.id) === String(member.characterId));
      const isThis = String(member.characterId || '') === String(char.id);
      const row = document.createElement('div');
      row.className = 'od101-link-row';
      row.innerHTML = `
        <div class="od101-link-info">
          <strong>${esc(campaign.name || 'Mesa sem nome')}</strong>
          <span>Código: ${esc(campaign.code || '—')} • ${esc(roleLabel(member.role))}</span>
          <small>${linked ? `Ficha atual: ${esc(linked.name || 'Sem nome')}` : 'Sem ficha vinculada'}</small>
        </div>
        <div class="od101-link-actions">
          <button type="button" class="${isThis ? 'ghost-btn' : 'primary-btn'}" data-od101-link-campaign="${esc(campaign.id)}">${isThis ? 'Já vinculada' : linked ? 'Trocar por esta ficha' : 'Vincular esta ficha'}</button>
          ${isThis ? `<button type="button" class="danger-btn small" data-od101-unlink-campaign="${esc(campaign.id)}">Remover vínculo</button>` : ''}
        </div>`;
      list.appendChild(row);
    });
    dialog.showModal();
  }

  async function linkCharacterToCampaignV101(campaignId) {
    const char = safeChar();
    if (!char) return;
    try {
      await Promise.resolve(attachCharacterToCampaign(campaignId, char.id));
      $('od101-link-campaign-modal')?.close();
      alert('Ficha vinculada à mesa.');
    } catch (error) {
      alert(error.message || 'Erro ao vincular ficha.');
    }
  }

  async function unlinkCharacterFromCampaignV101(campaignId) {
    try {
      if (typeof od42Api === 'function' && typeof od42Token === 'function' && od42Token()) {
        await od42Api(`/api/tables/${campaignId}/member`, { method: 'PUT', body: JSON.stringify({ characterId: null }) });
        await od42RefreshTables?.();
        await od42LoadTableState?.(campaignId);
      } else {
        const members = safeMembers();
        const member = members.find(m => String(m.campaignId) === String(campaignId) && String(m.userId) === String(currentUser?.id));
        if (member) member.characterId = null;
        setMembers(members);
      }
      $('od101-link-campaign-modal')?.close();
      renderCampaignMenu?.();
      alert('Vínculo removido.');
    } catch (error) {
      alert(error.message || 'Erro ao remover vínculo.');
    }
  }

  function bootV101() {
    const portraitBtn = $('portrait-button');
    if (portraitBtn) {
      portraitBtn.id = 'od101-portrait-button';
      portraitBtn.classList.add('portrait-button');
      portraitBtn.setAttribute('title', 'Trocar fotos da ficha');
    }
    $('portrait-modal')?.classList.add('od101-hidden-old-photo-modal');
    $('od99-portrait-crop-modal')?.classList.add('od101-hidden-old-photo-modal');
    $('od100-portrait-modal')?.classList.add('od101-hidden-old-photo-modal');

    const char = safeChar();
    if (char) {
      if ($('attributes-grid')) renderAttributesV101(char);
      normalizeVitalsV101();
      syncDodgeV101(char);
      updatePortraitV101(char);
    } else {
      normalizeVitalsV101();
    }
  }

  if (typeof updateDerivedStatsDisplay === 'function' && !updateDerivedStatsDisplay.__od101Wrapped) {
    const base = updateDerivedStatsDisplay;
    updateDerivedStatsDisplay = function od101UpdateDerivedStatsDisplay(char = safeChar()) {
      const result = base.apply(this, arguments);
      normalizeVitalsV101();
      syncDodgeV101(char);
      updatePortraitV101(char);
      return result;
    };
    updateDerivedStatsDisplay.__od101Wrapped = true;
  }

  if (typeof renderPortrait === 'function') {
    renderPortrait = function od101RenderPortrait(char) { updatePortraitV101(char || safeChar()); };
    renderPortrait.__od101Wrapped = true;
  }

  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od101Wrapped) {
    const baseSave = saveCurrentCharacter;
    saveCurrentCharacter = function od101SaveCurrentCharacter() {
      const char = safeChar();
      if (char) syncDodgeV101(char);
      return baseSave.apply(this, arguments);
    };
    saveCurrentCharacter.__od101Wrapped = true;
  }

  if (typeof loadCharacter === 'function' && !loadCharacter.__od101Wrapped) {
    const baseLoad = loadCharacter;
    loadCharacter = function od101LoadCharacter(id) {
      const result = baseLoad.apply(this, arguments);
      setTimeout(bootV101, 0);
      return result;
    };
    loadCharacter.__od101Wrapped = true;
  }

  document.addEventListener('click', event => {
    const portraitBtn = null;
    if (portraitBtn) { return; }

    const linkBtn = event.target.closest('#campaign-character-btn');
    if (linkBtn && accountSheetMode) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openLinkCharacterDialogV101();
      return;
    }

    if (event.target.closest('#od101-photo-close, #od101-photo-cancel')) {
      event.preventDefault();
      $('od101-photo-modal')?.close();
      return;
    }
    if (event.target.closest('#od101-photo-reset')) {
      event.preventDefault();
      window.od101CropState = { x: 50, y: 50, scale: 1 };
      refreshPhotoPreviewV101();
      return;
    }
    if (event.target.closest('#od101-photo-save')) {
      event.preventDefault();
      writeCharacterImageFields();
      $('od101-photo-modal')?.close();
      return;
    }
    if (event.target.closest('#od101-link-close')) {
      event.preventDefault();
      $('od101-link-campaign-modal')?.close();
      return;
    }

    const linkCampaign = event.target.closest('[data-od101-link-campaign]');
    if (linkCampaign) {
      event.preventDefault();
      event.stopImmediatePropagation();
      linkCharacterToCampaignV101(linkCampaign.dataset.od101LinkCampaign);
      return;
    }
    const unlinkCampaign = event.target.closest('[data-od101-unlink-campaign]');
    if (unlinkCampaign) {
      event.preventDefault();
      event.stopImmediatePropagation();
      unlinkCharacterFromCampaignV101(unlinkCampaign.dataset.od101UnlinkCampaign);
      return;
    }

    const attrStep = event.target.closest('[data-od101-attr-step]');
    if (attrStep) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const key = attrStep.dataset.od101AttrStep;
      const dir = num(attrStep.dataset.dir, 0);
      const input = document.querySelector(`input[data-attr="${CSS.escape(key)}"]`);
      if (!input) return;
      input.value = Math.max(1, num(input.value, 1) + dir);
      updateChar?.(char => {
        char.attrs = char.attrs || {};
        char.attrs[key] = num(input.value, 1);
        syncDodgeV101(char);
      });
      const char = safeChar();
      if (char) {
        renderAttributesV101(char);
        try { renderSkills?.(char); } catch (_) {}
        syncDodgeV101(char);
        try { queueSave?.(); } catch (_) {}
      }
      return;
    }

    const vitalStep = event.target.closest('[data-od101-vital-step]');
    if (vitalStep) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = vitalStep.dataset.od101VitalStep;
      const input = $(id);
      if (!input) return;
      input.value = num(input.value, 0) + num(vitalStep.dataset.dir, 0);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const char = safeChar();
      if (char) { syncDodgeV101(char); updatePortraitV101(char); }
      try { queueSave?.(); } catch (_) {}
      return;
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target.closest('#od101-photo-normal, #od101-photo-low, #od101-photo-zero, #od101-photo-transform')) {
      refreshPhotoPreviewV101();
      return;
    }
    if (event.target.matches?.('[data-skill-bonus], [data-od98-skill-bonus], [data-od88-skill-bonus], [data-od79-skill-bonus], [data-skill-trained], [data-od98-skill-trained], #defense, #prof-bonus')) {
      setTimeout(() => syncDodgeV101(safeChar()), 0);
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target.matches?.('[data-skill-trained], [data-od98-skill-trained], #defense, #prof-bonus')) {
      setTimeout(() => syncDodgeV101(safeChar()), 0);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', bootV101);
  setTimeout(bootV101, 100);
  setTimeout(bootV101, 600);
  window.od101RefreshSheetFixes = bootV101;
})();


/* =========================
   V102 - Beta 5: retratos, atributos, esquiva e entrada sem ficha
   - Corrige valores/bônus dos atributos cobertos pelos controles
   - Fotos por link aplicadas em ficha, menus, mesa e OBS
   - GIF por link preservado sem canvas/conversão
   - Esquiva = Defesa + bônus/proficiência de Reflexo, sem AGI
   - Modal de escolher ficha ganha opção Entrar sem ficha
========================= */
(function od102Beta5Fixes(){
  const $ = id => document.getElementById(id);
  const esc = value => {
    try { return typeof escapeHtml === 'function' ? escapeHtml(value ?? '') : String(value ?? ''); }
    catch (_) { return String(value ?? ''); }
  };
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const safeGet = (key, fallback) => { try { return get(key, fallback); } catch (_) { return fallback; } };
  const safeSet = (key, value) => { try { set(key, value); } catch (_) {} };
  const safeChar = () => { try { return typeof currentChar === 'function' ? currentChar() : null; } catch (_) { return null; } };
  const imageFallback = 'assets/logo.jpg';

  function cleanImage(value) { return String(value || '').trim(); }
  function isUsableImage(value) {
    const src = cleanImage(value);
    return !!src && !/^(null|undefined|about:blank)$/i.test(src);
  }
  function primaryPortrait(char) {
    return cleanImage(char?.portrait || char?.image || char?.photo || char?.avatar || char?.retrato || '');
  }
  function portraitByState(char = safeChar()) {
    if (!char) return imageFallback;
    const pv = num(char.pvCurrent ?? char.pvAtual ?? char.pv ?? char.hpCurrent ?? char.hp, 0);
    const max = Math.max(1, num(char.pvMax ?? char.pvTotal ?? char.pv_max ?? char.hpMax ?? char.hpTotal, 1));
    const icons = char.obsIcons || {};
    if (pv < 0) return '';
    if (char.obsTransformationActive && isUsableImage(char.obsTransformPortrait || icons.transformation || char.transformationPortrait)) {
      return cleanImage(char.obsTransformPortrait || icons.transformation || char.transformationPortrait);
    }
    if (pv === 0 && isUsableImage(icons.zero || char.portraitZero || char.obsIconZero)) return cleanImage(icons.zero || char.portraitZero || char.obsIconZero);
    if (pv > 0 && pv / max < .5 && isUsableImage(icons.low || char.portraitLow || char.obsIconLow)) return cleanImage(icons.low || char.portraitLow || char.obsIconLow);
    return primaryPortrait(char) || imageFallback;
  }
  function cropFor(char) { return Object.assign({ x: 50, y: 50, scale: 1 }, char?.portraitCrop || {}); }
  function applyCrop(img, char = safeChar()) {
    if (!img) return;
    const crop = cropFor(char);
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${num(crop.x,50)}% ${num(crop.y,50)}%`;
    img.style.transformOrigin = `${num(crop.x,50)}% ${num(crop.y,50)}%`;
    img.style.transform = `scale(${Math.max(1, Math.min(3, num(crop.scale,1)))})`;
  }
  function setImageElement(img, src, char = safeChar()) {
    if (!img) return;
    const value = cleanImage(src);
    if (!value) {
      img.removeAttribute('src');
      img.style.visibility = 'hidden';
      return;
    }
    img.style.visibility = '';
    if (img.getAttribute('src') !== value) img.src = value;
    img.onerror = () => { img.onerror = null; img.src = imageFallback; };
    applyCrop(img, char);
  }
  function updateVisiblePortraits(char = safeChar()) {
    if (!char) return;
    const normal = primaryPortrait(char) || imageFallback;
    const state = portraitByState(char);
    setImageElement($('char-portrait-preview'), state, char);
    setImageElement($('overlay-portrait'), normal, char);
    const hidden = $('portrait-url');
    if (hidden) hidden.value = primaryPortrait(char);

    // Atualiza cards já existentes sem esperar recarregar a página.
    document.querySelectorAll(`img[data-character-id="${CSS.escape(String(char.id || ''))}"], img[data-char-id="${CSS.escape(String(char.id || ''))}"]`).forEach(img => setImageElement(img, normal, char));
    document.querySelectorAll('.character-pill, .session-character, .choose-character-card, .account-character-card, .od71-character-card, .od85-character-card').forEach(card => {
      const text = card.textContent || '';
      if (char.name && text.includes(char.name)) {
        const img = card.querySelector('img');
        if (img) setImageElement(img, normal, char);
      }
    });
  }
  async function persistCharacterImage(char) {
    if (!char) return;
    try { queueSave?.(); } catch (_) {}
    try {
      if (typeof od44SaveCharacterOnline === 'function') await od44SaveCharacterOnline(char);
      else if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char);
    } catch (error) {
      console.warn('[One Dice v102] Falha ao salvar foto:', error);
    }
  }

  function reflexSkill(char) { return char?.skills?.Reflexo || char?.skills?.Reflexos || { trained: false, bonus: 0 }; }
  function reflexBonusOnly(char) {
    const skill = reflexSkill(char);
    return num(skill.bonus, 0) + (skill.trained ? num(char?.profBonus, 0) : 0);
  }
  function dodgeFormula(char = safeChar()) {
    const def = typeof effectiveDefense === 'function' ? num(effectiveDefense(char), 10) : num(char?.defense ?? char?.defesa, 10);
    return def + reflexBonusOnly(char);
  }
  window.od102DodgeFormula = dodgeFormula;
  window.od101DodgeFormula = dodgeFormula;
  window.od100DodgeFormula = dodgeFormula;
  window.od99DodgeFormula = dodgeFormula;
  window.od98DodgeFormula = dodgeFormula;
  if (typeof calculatedDodge === 'function') {
    calculatedDodge = function od102CalculatedDodge(char = safeChar()) { const manual = Number(char?.dodge); return Number.isFinite(manual) ? manual : 10; };
  }
  function syncDodge(char = safeChar()) {
    if (!char) return;
    const value = Number.isFinite(Number(char.dodge)) ? Number(char.dodge) : 10;
    char.dodge = value;
    char.dodgeManual = true;
    char.dodgeLocked = true;
    const field = $('dodge');
    if (field && document.activeElement !== field) {
      field.value = value;
      field.removeAttribute('readonly');
    }
    const note = $('dodge-formula-note');
    if (note) note.textContent = '';
  }

  function renderAttributesV102(char = safeChar()) {
    const grid = $('attributes-grid');
    if (!grid || !char) return;
    const labels = { forca: 'Força', agilidade: 'Agilidade', vigor: 'Vigor', intelecto: 'Intelecto', presenca: 'Presença' };
    grid.innerHTML = '';
    Object.entries(labels).forEach(([key, label]) => {
      const value = num(char.attrs?.[key], 1);
      const mod = typeof attrMod === 'function' ? attrMod(value) : value;
      const modText = typeof formatMod === 'function' ? formatMod(mod) : String(mod);
      const card = document.createElement('div');
      card.className = 'attr-card-v2 od102-attr-card';
      card.innerHTML = `
        <div class="od102-attr-name">${esc(label)}</div>
        <div class="od102-attr-body">
          <div class="od102-attr-left">
            <div class="od102-attr-mod">${esc(modText)}</div>
            <div class="od102-attr-help">D20</div>
          </div>
          <div class="od102-attr-control">
            <button type="button" class="od102-step" data-od102-attr-step="${esc(key)}" data-dir="-1">−</button>
            <input data-attr="${esc(key)}" type="number" value="${esc(value)}" min="1" inputmode="numeric">
            <button type="button" class="od102-step" data-od102-attr-step="${esc(key)}" data-dir="1">+</button>
          </div>
        </div>
        <button class="primary-btn small roll-attr od102-roll" data-roll-attr="${esc(key)}" type="button">D20</button>`;
      grid.appendChild(card);
    });
  }
  if (typeof renderAttributes === 'function') renderAttributes = renderAttributesV102;

  function ensurePhotoDialog() {
    let dialog = $('od102-photo-modal');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'od102-photo-modal';
    dialog.className = 'od102-photo-modal od-modal';
    dialog.innerHTML = `
      <form method="dialog" class="modal-card manga-panel od102-photo-card">
        <div class="od102-modal-head">
          <div>
            <h2>Fotos da Ficha</h2>
            <p>Cole links diretos. PNG, JPG, WEBP e GIF funcionam. GIF permanece animado.</p>
          </div>
          <button type="button" class="icon-btn" id="od102-photo-close">×</button>
        </div>
        <div class="od102-photo-grid">
          <label>Foto normal<input id="od102-photo-normal" type="text" placeholder="https://..." autocomplete="off"></label>
          <label>Machucado, abaixo de 50% PV<input id="od102-photo-low" type="text" placeholder="opcional" autocomplete="off"></label>
          <label>Morrendo, 0 PV<input id="od102-photo-zero" type="text" placeholder="opcional" autocomplete="off"></label>
          <label>Transformação ativa<input id="od102-photo-transform" type="text" placeholder="opcional" autocomplete="off"></label>
        </div>
        <div class="od102-preview-wrap">
          <div id="od102-crop-stage" class="od102-crop-stage" title="Arraste para mover. Roda do mouse para zoom.">
            <img id="od102-crop-img" alt="Prévia" draggable="false">
          </div>
          <small>Prévia da foto principal. Arraste para enquadrar e use a roda do mouse para zoom. Para GIF, o link é salvo direto.</small>
        </div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" id="od102-photo-reset">Centralizar</button>
          <button type="button" class="ghost-btn" id="od102-photo-cancel">Cancelar</button>
          <button type="button" class="primary-btn" id="od102-photo-save">Salvar Fotos</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }
  function refreshPhotoPreview() {
    const img = $('od102-crop-img');
    if (!img) return;
    const src = cleanImage($('od102-photo-normal')?.value || '');
    const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od102CropState || {});
    if (!src) { img.removeAttribute('src'); return; }
    if (img.getAttribute('src') !== src) img.src = src;
    img.onerror = () => { img.removeAttribute('src'); };
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${crop.x}% ${crop.y}%`;
    img.style.transformOrigin = `${crop.x}% ${crop.y}%`;
    img.style.transform = `scale(${Math.max(1, Math.min(3, num(crop.scale,1)))})`;
  }
  function openPhotoDialog() {
    const char = safeChar();
    const dialog = ensurePhotoDialog();
    const icons = char?.obsIcons || {};
    $('od102-photo-normal').value = primaryPortrait(char) || $('portrait-url')?.value || '';
    $('od102-photo-low').value = cleanImage(icons.low || char?.portraitLow || char?.obsIconLow || '');
    $('od102-photo-zero').value = cleanImage(icons.zero || char?.portraitZero || char?.obsIconZero || '');
    $('od102-photo-transform').value = cleanImage(icons.transformation || char?.obsTransformPortrait || char?.transformationPortrait || '');
    window.od102CropState = Object.assign({ x: 50, y: 50, scale: 1 }, char?.portraitCrop || {});
    setupCrop();
    refreshPhotoPreview();
    dialog.showModal();
  }
  function setupCrop() {
    const stage = $('od102-crop-stage');
    if (!stage || stage.dataset.od102Ready === '1') return;
    stage.dataset.od102Ready = '1';
    let dragging = false, start = null;
    stage.addEventListener('pointerdown', ev => {
      dragging = true;
      stage.setPointerCapture?.(ev.pointerId);
      const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od102CropState || {});
      start = { x: ev.clientX, y: ev.clientY, cropX: crop.x, cropY: crop.y };
    });
    stage.addEventListener('pointermove', ev => {
      if (!dragging || !start) return;
      const rect = stage.getBoundingClientRect();
      const dx = ((ev.clientX - start.x) / Math.max(1, rect.width)) * -100;
      const dy = ((ev.clientY - start.y) / Math.max(1, rect.height)) * -100;
      window.od102CropState = Object.assign({}, window.od102CropState || {}, {
        x: Math.max(0, Math.min(100, start.cropX + dx)),
        y: Math.max(0, Math.min(100, start.cropY + dy))
      });
      refreshPhotoPreview();
    });
    ['pointerup','pointercancel','pointerleave'].forEach(type => stage.addEventListener(type, () => { dragging = false; start = null; }));
    stage.addEventListener('wheel', ev => {
      ev.preventDefault();
      const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od102CropState || {});
      crop.scale = Math.max(1, Math.min(3, crop.scale + (ev.deltaY < 0 ? .08 : -.08)));
      window.od102CropState = crop;
      refreshPhotoPreview();
    }, { passive: false });
  }
  async function savePhotoDialog() {
    const char = safeChar();
    if (!char) return;
    const normal = cleanImage($('od102-photo-normal')?.value || '');
    const low = cleanImage($('od102-photo-low')?.value || '');
    const zero = cleanImage($('od102-photo-zero')?.value || '');
    const transformation = cleanImage($('od102-photo-transform')?.value || '');
    const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od102CropState || {});
    updateChar?.(c => {
      c.portrait = normal;
      c.image = normal;
      c.photo = normal;
      c.avatar = normal;
      c.retrato = normal;
      c.obsIcons = c.obsIcons || {};
      c.obsIcons.low = low;
      c.obsIcons.zero = zero;
      c.obsIcons.transformation = transformation;
      c.portraitLow = low;
      c.portraitZero = zero;
      c.obsIconLow = low;
      c.obsIconZero = zero;
      c.obsTransformPortrait = transformation;
      c.transformationPortrait = transformation;
      c.portraitCrop = crop;
      c.updatedAt = Date.now();
    });
    const fresh = safeChar();
    const hidden = $('portrait-url');
    const modalHidden = $('portrait-modal-url');
    if (hidden) hidden.value = normal;
    if (modalHidden) modalHidden.value = normal;
    updateVisiblePortraits(fresh);
    try { renderCharacterList?.(); } catch (_) {}
    try { renderAccountCharacterList?.(); } catch (_) {}
    try { renderCampaignMenu?.(); } catch (_) {}
    await persistCharacterImage(fresh);
  }

  // Escolher ficha: adiciona entrada sem ficha e usa imagens atualizadas nos cards.
  if (typeof openChooseCharacterModal === 'function' && !openChooseCharacterModal.__od102Wrapped) {
    const baseOpenChoose = openChooseCharacterModal;
    openChooseCharacterModal = function od102OpenChooseCharacterModal(campaignId = currentCampaignId) {
      const result = baseOpenChoose.apply(this, arguments);
      const list = $('choose-character-list');
      if (list) {
        list.querySelectorAll('.choose-character-card').forEach(btn => {
          const id = btn.dataset.selectCharacterForCampaign;
          const chars = safeGet(STORAGE.characters, []);
          const char = chars.find(c => String(c.id) === String(id));
          if (char) setImageElement(btn.querySelector('img'), primaryPortrait(char) || imageFallback, char);
        });
      }
      const modal = $('choose-character-modal');
      const actions = modal?.querySelector('.modal-actions');
      if (actions && !$('od102-enter-without-sheet')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'od102-enter-without-sheet';
        btn.className = 'ghost-btn';
        btn.textContent = 'Entrar sem ficha';
        actions.insertBefore(btn, actions.firstChild);
      }
      return result;
    };
    openChooseCharacterModal.__od102Wrapped = true;
  }

  async function enterWithoutSheet() {
    const campaignId = pendingChooseCampaignId || currentCampaignId;
    if (!campaignId) return;
    try {
      if (typeof od42Api === 'function' && typeof od42Token === 'function' && od42Token()) {
        await od42Api(`/api/tables/${campaignId}/member`, { method: 'PUT', body: JSON.stringify({ characterId: null }) });
        await od42RefreshTables?.();
        await od42LoadTableState?.(campaignId);
      } else {
        const members = typeof getMembers === 'function' ? getMembers() : [];
        let member = members.find(m => String(m.campaignId) === String(campaignId) && String(m.userId) === String(currentUser?.id));
        if (!member) { member = { id: typeof uid === 'function' ? uid('member') : String(Date.now()), campaignId, userId: currentUser?.id, role: 'jogador', characterId: null }; members.push(member); }
        member.characterId = null;
        if (typeof setMembers === 'function') setMembers(members); else safeSet(STORAGE.members, members);
      }
      $('choose-character-modal')?.close();
      $('create-first-sheet-modal')?.close();
      currentCampaignId = campaignId;
      safeSet(STORAGE.activeCampaign, campaignId);
      if (typeof initApp === 'function') initApp(campaignId);
    } catch (error) {
      alert(error.message || 'Erro ao entrar sem ficha.');
    }
  }

  function boot() {
    $('portrait-modal')?.classList.add('od102-hidden-old-photo-modal');
    $('od99-portrait-crop-modal')?.classList.add('od102-hidden-old-photo-modal');
    $('od100-portrait-modal')?.classList.add('od102-hidden-old-photo-modal');
    $('od101-photo-modal')?.classList.add('od102-hidden-old-photo-modal');
    const btn = $('portrait-button') || $('od101-portrait-button');
    if (btn) { btn.id = 'od102-portrait-button'; btn.setAttribute('title', 'Trocar fotos da ficha'); }
    const char = safeChar();
    if (char) {
      if ($('attributes-grid')) renderAttributesV102(char);
      syncDodge(char);
      updateVisiblePortraits(char);
    }
    try { document.querySelectorAll('[data-skill-bonus], [data-od98-skill-bonus]').forEach(el => el.dispatchEvent(new Event('change', { bubbles: true }))); } catch (_) {}
  }

  document.addEventListener('click', event => {
    const portraitBtn = null;
    if (portraitBtn) { return; }
    if (event.target.closest('#od102-photo-close, #od102-photo-cancel')) { event.preventDefault(); $('od102-photo-modal')?.close(); return; }
    if (event.target.closest('#od102-photo-reset')) { event.preventDefault(); window.od102CropState = { x: 50, y: 50, scale: 1 }; refreshPhotoPreview(); return; }
    if (event.target.closest('#od102-photo-save')) { event.preventDefault(); savePhotoDialog().then(() => $('od102-photo-modal')?.close()); return; }
    if (event.target.closest('#od102-enter-without-sheet')) { event.preventDefault(); event.stopImmediatePropagation(); enterWithoutSheet(); return; }

    const attrStep = event.target.closest('[data-od102-attr-step]');
    if (attrStep) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const key = attrStep.dataset.od102AttrStep;
      const dir = num(attrStep.dataset.dir, 0);
      const input = document.querySelector(`input[data-attr="${CSS.escape(key)}"]`);
      if (!input) return;
      input.value = Math.max(1, num(input.value, 1) + dir);
      updateChar?.(char => { char.attrs = char.attrs || {}; char.attrs[key] = num(input.value, 1); syncDodge(char); });
      const char = safeChar();
      if (char) {
        renderAttributesV102(char);
        try { renderSkills?.(char); } catch (_) {}
        syncDodge(char);
        try { queueSave?.(); } catch (_) {}
      }
      return;
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target.closest('#od102-photo-normal, #od102-photo-low, #od102-photo-zero, #od102-photo-transform')) { refreshPhotoPreview(); return; }
    if (event.target.matches?.('[data-skill-bonus], [data-od98-skill-bonus], [data-od88-skill-bonus], [data-od79-skill-bonus], [data-skill-trained], [data-od98-skill-trained], #defense, #prof-bonus')) {
      setTimeout(() => syncDodge(safeChar()), 0);
    }
  }, true);
  document.addEventListener('change', event => {
    if (event.target.matches?.('[data-skill-trained], [data-od98-skill-trained], #defense, #prof-bonus')) setTimeout(() => syncDodge(safeChar()), 0);
  }, true);

  if (typeof renderPortrait === 'function') {
    renderPortrait = function od102RenderPortrait(char) { updateVisiblePortraits(char || safeChar()); };
    renderPortrait.__od102Wrapped = true;
  }
  if (typeof updateDerivedStatsDisplay === 'function' && !updateDerivedStatsDisplay.__od102Wrapped) {
    const base = updateDerivedStatsDisplay;
    updateDerivedStatsDisplay = function od102UpdateDerivedStatsDisplay(char = safeChar()) {
      const result = base.apply(this, arguments);
      syncDodge(char);
      updateVisiblePortraits(char);
      return result;
    };
    updateDerivedStatsDisplay.__od102Wrapped = true;
  }
  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od102Wrapped) {
    const base = saveCurrentCharacter;
    saveCurrentCharacter = function od102SaveCurrentCharacter() {
      const char = safeChar();
      if (char) syncDodge(char);
      return base.apply(this, arguments);
    };
    saveCurrentCharacter.__od102Wrapped = true;
  }
  if (typeof loadCharacter === 'function' && !loadCharacter.__od102Wrapped) {
    const base = loadCharacter;
    loadCharacter = function od102LoadCharacter(id) {
      const result = base.apply(this, arguments);
      setTimeout(boot, 0);
      return result;
    };
    loadCharacter.__od102Wrapped = true;
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 120);
  setTimeout(boot, 700);
  window.od102RefreshBetaFixes = boot;
})();

/* =========================
   V103 - Ajuste isolado do painel de atributos
   Objetivo: mostrar nome, bônus, D20, rolagem, −/+, e valor cheio sem sobreposição.
========================= */
(function od103AttributePanelFix() {
  const $ = id => document.getElementById(id);
  const esc = value => {
    if (typeof escapeHtml === 'function') return escapeHtml(String(value ?? ''));
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  };
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const labels = {
    forca: 'Força',
    agilidade: 'Agilidade',
    vigor: 'Vigor',
    intelecto: 'Intelecto',
    presenca: 'Presença'
  };

  function getChar() {
    try { return typeof currentChar === 'function' ? currentChar() : null; } catch (_) { return null; }
  }

  function saveSoft() {
    try { if (typeof queueSave === 'function') queueSave(); } catch (_) {}
    try {
      const char = getChar();
      if (char && typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char);
    } catch (_) {}
  }

  function refreshAfterAttrChange(char) {
    if (!char) return;
    try { if (typeof syncDodge === 'function') syncDodge(char); } catch (_) {}
    try { if (typeof renderSkills === 'function') renderSkills(char); } catch (_) {}
    try { if (typeof updateDerivedStatsDisplay === 'function') updateDerivedStatsDisplay(char); } catch (_) {}
    try { if (typeof updateBars === 'function') updateBars(char); } catch (_) {}
  }

  function renderAttributesV103(char = getChar()) {
    const grid = $('attributes-grid');
    if (!grid || !char) return;

    char.attrs = char.attrs || {};
    grid.innerHTML = '';

    Object.entries(labels).forEach(([key, label]) => {
      const value = num(char.attrs[key], 1);
      const mod = typeof attrMod === 'function' ? attrMod(value) : value;
      const modText = typeof formatMod === 'function' ? formatMod(mod) : String(mod);

      const card = document.createElement('div');
      card.className = 'attr-card-v2 od103-attr-card';
      card.innerHTML = `
        <div class="od103-attr-top">
          <div class="od103-attr-name">${esc(label)}</div>
          <div class="od103-attr-bonus">${esc(modText)}</div>
        </div>

        <div class="od103-attr-mid">
          <button type="button" class="od103-attr-step" data-od103-attr-step="${esc(key)}" data-dir="-1" aria-label="Diminuir ${esc(label)}">−</button>
          <input class="od103-attr-value" data-attr="${esc(key)}" type="number" value="${esc(value)}" min="1" inputmode="numeric" aria-label="Valor de ${esc(label)}">
          <button type="button" class="od103-attr-step" data-od103-attr-step="${esc(key)}" data-dir="1" aria-label="Aumentar ${esc(label)}">+</button>
        </div>

        <div class="od103-attr-bottom">
          <span class="od103-attr-dice">D20</span>
          <button class="primary-btn small roll-attr od103-roll" data-roll-attr="${esc(key)}" type="button">D20</button>
        </div>`;
      grid.appendChild(card);
    });
  }

  if (typeof renderAttributes === 'function') {
    renderAttributes = renderAttributesV103;
  }
  window.renderAttributesV103 = renderAttributesV103;

  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-od103-attr-step]');
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const key = btn.dataset.od103AttrStep;
    const dir = num(btn.dataset.dir, 0);
    const input = document.querySelector(`input[data-attr="${CSS.escape(key)}"]`);
    if (!input) return;

    const next = Math.max(1, num(input.value, 1) + dir);
    input.value = next;

    try {
      if (typeof updateChar === 'function') {
        updateChar(char => {
          char.attrs = char.attrs || {};
          char.attrs[key] = next;
          try { if (typeof syncDodge === 'function') syncDodge(char); } catch (_) {}
        });
      }
    } catch (_) {}

    const char = getChar();
    if (char) {
      char.attrs = char.attrs || {};
      char.attrs[key] = next;
      renderAttributesV103(char);
      refreshAfterAttrChange(char);
      saveSoft();
    }
  }, true);

  document.addEventListener('input', event => {
    const input = event.target.closest('input.od103-attr-value[data-attr]');
    if (!input) return;

    const key = input.dataset.attr;
    const value = Math.max(1, num(input.value, 1));

    try {
      if (typeof updateChar === 'function') {
        updateChar(char => {
          char.attrs = char.attrs || {};
          char.attrs[key] = value;
          try { if (typeof syncDodge === 'function') syncDodge(char); } catch (_) {}
        });
      }
    } catch (_) {}

    const char = getChar();
    if (char) {
      char.attrs = char.attrs || {};
      char.attrs[key] = value;
      refreshAfterAttrChange(char);
      saveSoft();
    }
  }, true);

  function boot() {
    const char = getChar();
    if (char && $('attributes-grid')) renderAttributesV103(char);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* =========================
   V104 - Correção isolada: fotos da ficha por link
   - Salva a foto direto no personagem atual sem depender de wrappers antigos
   - Mantém GIF animado por link direto
   - Atualiza imediatamente imagem da ficha, menus e OBS
   - Protege contra save antigo sobrescrever o retrato com valor vazio/fallback
========================= */
(function od104PortraitLinkFix(){
  const $ = id => document.getElementById(id);
  const FALLBACK = 'assets/logo.jpg';
  const esc = value => {
    try { return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? ''); }
    catch (_) { return String(value ?? ''); }
  };
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const clean = value => String(value || '').trim();
  const valid = value => {
    const src = clean(value);
    return !!src && !/^(null|undefined|about:blank)$/i.test(src) && !src.includes('assets/logo');
  };
  const getChars = () => { try { return get(STORAGE.characters, []); } catch (_) { return []; } };
  const setChars = chars => { try { set(STORAGE.characters, chars); } catch (_) {} };
  const getChar = () => {
    try {
      const id = typeof currentCharacterId !== 'undefined' ? currentCharacterId : null;
      return getChars().find(c => String(c.id) === String(id));
    } catch (_) { return null; }
  };
  const primary = char => clean(char?.portrait || char?.image || char?.photo || char?.avatar || char?.retrato || '');
  const statePortrait = char => {
    if (!char) return FALLBACK;
    const pv = num(char.pvCurrent ?? char.pvAtual ?? char.pv ?? char.hpCurrent ?? char.hp, 0);
    const max = Math.max(1, num(char.pvMax ?? char.pvTotal ?? char.pv_max ?? char.hpMax ?? char.hpTotal, 1));
    const icons = char.obsIcons || {};
    if (pv < 0) return '';
    if (char.obsTransformationActive && valid(char.obsTransformPortrait || icons.transformation || char.transformationPortrait)) {
      return clean(char.obsTransformPortrait || icons.transformation || char.transformationPortrait);
    }
    if (pv === 0 && valid(icons.zero || char.portraitZero || char.obsIconZero)) return clean(icons.zero || char.portraitZero || char.obsIconZero);
    if (pv > 0 && pv / max < 0.5 && valid(icons.low || char.portraitLow || char.obsIconLow)) return clean(icons.low || char.portraitLow || char.obsIconLow);
    return primary(char) || FALLBACK;
  };
  function applyCrop(img, char){
    if (!img || !char) return;
    const crop = Object.assign({ x: 50, y: 50, scale: 1 }, char.portraitCrop || {});
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${num(crop.x, 50)}% ${num(crop.y, 50)}%`;
    img.style.transformOrigin = `${num(crop.x, 50)}% ${num(crop.y, 50)}%`;
    img.style.transform = `scale(${Math.max(1, Math.min(3, num(crop.scale, 1)))})`;
  }
  function putImg(img, src, char){
    if (!img) return;
    const value = clean(src);
    img.onerror = () => { img.onerror = null; img.src = FALLBACK; };
    if (!value) {
      img.removeAttribute('src');
      img.style.visibility = 'hidden';
      return;
    }
    img.style.visibility = '';
    if (img.getAttribute('src') !== value) img.src = value;
    applyCrop(img, char);
  }
  function syncAllImages(char = getChar()){
    if (!char) return;
    const normal = primary(char) || FALLBACK;
    const current = statePortrait(char);
    putImg($('char-portrait-preview'), current, char);
    putImg($('overlay-portrait'), normal, char);
    const hidden = $('portrait-url');
    const oldModal = $('portrait-modal-url');
    if (hidden) hidden.value = primary(char);
    if (oldModal) oldModal.value = primary(char);
    const id = String(char.id || '');
    if (id) {
      document.querySelectorAll(`img[data-character-id="${CSS.escape(id)}"], img[data-char-id="${CSS.escape(id)}"]`).forEach(img => putImg(img, normal, char));
    }
    document.querySelectorAll('.account-character-card, .od85-character-card, .choose-character-card, .session-character, .character-pill, .campaign-character-preview').forEach(card => {
      if (!char.name || !(card.textContent || '').includes(char.name)) return;
      const img = card.querySelector('img');
      if (img) putImg(img, normal, char);
    });
  }
  function directMutate(mutator){
    const chars = getChars();
    const id = typeof currentCharacterId !== 'undefined' ? currentCharacterId : null;
    const index = chars.findIndex(c => String(c.id) === String(id));
    if (index < 0) return null;
    mutator(chars[index]);
    chars[index].updatedAt = Date.now();
    setChars(chars);
    return chars[index];
  }
  async function saveOnline(char){
    if (!char) return;
    try { if (typeof queueSave === 'function') queueSave(); } catch (_) {}
    try {
      if (typeof od44SaveCharacterOnline === 'function') await od44SaveCharacterOnline(char);
      else if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char);
    } catch (error) {
      console.warn('[One Dice v104] Falha ao salvar foto online:', error);
    }
  }
  function ensureDialog(){
    let dialog = $('od104-photo-modal');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'od104-photo-modal';
    dialog.className = 'od104-photo-modal od-modal';
    dialog.innerHTML = `
      <form method="dialog" class="modal-card manga-panel od104-photo-card">
        <div class="od104-modal-head">
          <div>
            <h2>Fotos da Ficha</h2>
            <p>Cole links diretos. PNG, JPG, WEBP e GIF funcionam. GIF permanece animado.</p>
          </div>
          <button type="button" class="icon-btn" id="od104-photo-close">×</button>
        </div>
        <div class="od104-photo-grid">
          <label>Foto normal<input id="od104-photo-normal" type="text" placeholder="https://..." autocomplete="off"></label>
          <label>Machucado, abaixo de 50% PV<input id="od104-photo-low" type="text" placeholder="opcional" autocomplete="off"></label>
          <label>Morrendo, 0 PV<input id="od104-photo-zero" type="text" placeholder="opcional" autocomplete="off"></label>
          <label>Transformação ativa<input id="od104-photo-transform" type="text" placeholder="opcional" autocomplete="off"></label>
        </div>
        <div class="od104-preview-wrap">
          <div id="od104-crop-stage" class="od104-crop-stage" title="Arraste para mover. Roda do mouse para zoom.">
            <img id="od104-crop-img" alt="Prévia" draggable="false">
          </div>
          <small>Arraste a imagem para enquadrar e use a roda do mouse para zoom. GIF fica animado porque o link é preservado.</small>
        </div>
        <div class="modal-actions">
          <button type="button" class="ghost-btn" id="od104-photo-reset">Centralizar</button>
          <button type="button" class="ghost-btn" id="od104-photo-cancel">Cancelar</button>
          <button type="button" class="primary-btn" id="od104-photo-save">Salvar Fotos</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }
  function refreshPreview(){
    const img = $('od104-crop-img');
    if (!img) return;
    const src = clean($('od104-photo-normal')?.value || '');
    if (!src) { img.removeAttribute('src'); return; }
    const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od104CropState || {});
    img.onerror = () => { img.removeAttribute('src'); };
    if (img.getAttribute('src') !== src) img.src = src;
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${crop.x}% ${crop.y}%`;
    img.style.transformOrigin = `${crop.x}% ${crop.y}%`;
    img.style.transform = `scale(${Math.max(1, Math.min(3, num(crop.scale, 1)))})`;
  }
  function setupCrop(){
    const stage = $('od104-crop-stage');
    if (!stage || stage.dataset.od104Ready === '1') return;
    stage.dataset.od104Ready = '1';
    let dragging = false;
    let start = null;
    stage.addEventListener('pointerdown', ev => {
      dragging = true;
      stage.setPointerCapture?.(ev.pointerId);
      const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od104CropState || {});
      start = { x: ev.clientX, y: ev.clientY, cropX: crop.x, cropY: crop.y };
    });
    stage.addEventListener('pointermove', ev => {
      if (!dragging || !start) return;
      const rect = stage.getBoundingClientRect();
      const dx = ((ev.clientX - start.x) / Math.max(1, rect.width)) * -100;
      const dy = ((ev.clientY - start.y) / Math.max(1, rect.height)) * -100;
      window.od104CropState = Object.assign({}, window.od104CropState || {}, {
        x: Math.max(0, Math.min(100, start.cropX + dx)),
        y: Math.max(0, Math.min(100, start.cropY + dy))
      });
      refreshPreview();
    });
    ['pointerup','pointercancel','pointerleave'].forEach(type => stage.addEventListener(type, () => { dragging = false; start = null; }));
    stage.addEventListener('wheel', ev => {
      ev.preventDefault();
      const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od104CropState || {});
      crop.scale = Math.max(1, Math.min(3, crop.scale + (ev.deltaY < 0 ? 0.08 : -0.08)));
      window.od104CropState = crop;
      refreshPreview();
    }, { passive: false });
  }
  function openDialog(){
    const char = getChar();
    const dialog = ensureDialog();
    const icons = char?.obsIcons || {};
    $('od104-photo-normal').value = primary(char) || $('portrait-url')?.value || '';
    $('od104-photo-low').value = clean(icons.low || char?.portraitLow || char?.obsIconLow || '');
    $('od104-photo-zero').value = clean(icons.zero || char?.portraitZero || char?.obsIconZero || '');
    $('od104-photo-transform').value = clean(icons.transformation || char?.obsTransformPortrait || char?.transformationPortrait || '');
    window.od104CropState = Object.assign({ x: 50, y: 50, scale: 1 }, char?.portraitCrop || {});
    setupCrop();
    refreshPreview();
    dialog.showModal();
  }
  async function saveDialog(){
    const normal = clean($('od104-photo-normal')?.value || '');
    const low = clean($('od104-photo-low')?.value || '');
    const zero = clean($('od104-photo-zero')?.value || '');
    const transformation = clean($('od104-photo-transform')?.value || '');
    const crop = Object.assign({ x: 50, y: 50, scale: 1 }, window.od104CropState || {});
    const hidden = $('portrait-url');
    const oldModal = $('portrait-modal-url');
    if (hidden) hidden.value = normal;
    if (oldModal) oldModal.value = normal;
    const char = directMutate(c => {
      c.portrait = normal;
      c.image = normal;
      c.photo = normal;
      c.avatar = normal;
      c.retrato = normal;
      c.obsIcons = c.obsIcons || {};
      c.obsIcons.low = low;
      c.obsIcons.zero = zero;
      c.obsIcons.transformation = transformation;
      c.portraitLow = low;
      c.portraitZero = zero;
      c.obsIconLow = low;
      c.obsIconZero = zero;
      c.obsTransformPortrait = transformation;
      c.transformationPortrait = transformation;
      c.portraitCrop = crop;
    });
    syncAllImages(char);
    try { if (typeof updateOverlay === 'function') updateOverlay(char); } catch (_) {}
    try { if (typeof renderCharacterList === 'function') renderCharacterList(); } catch (_) {}
    try { if (typeof renderAccountCharacterList === 'function') renderAccountCharacterList(); } catch (_) {}
    try { if (typeof renderCampaignMenu === 'function') renderCampaignMenu(); } catch (_) {}
    await saveOnline(char);
    setTimeout(() => syncAllImages(getChar()), 50);
    setTimeout(() => syncAllImages(getChar()), 400);
  }

  // Proteção: saves antigos não podem apagar o retrato salvo com fallback/vazio.
  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od104PortraitWrapped) {
    const baseSave = saveCurrentCharacter;
    saveCurrentCharacter = function od104SaveCurrentCharacter() {
      const before = getChar();
      const keepPortrait = primary(before);
      const hidden = $('portrait-url');
      if (hidden && keepPortrait && (!valid(hidden.value) || hidden.value !== keepPortrait)) hidden.value = keepPortrait;
      const result = baseSave.apply(this, arguments);
      const after = directMutate(c => {
        if (keepPortrait && !valid(c.portrait)) {
          c.portrait = keepPortrait;
          c.image = keepPortrait;
          c.photo = keepPortrait;
          c.avatar = keepPortrait;
          c.retrato = keepPortrait;
        }
      });
      syncAllImages(after || getChar());
      return result;
    };
    saveCurrentCharacter.__od104PortraitWrapped = true;
  }
  if (typeof renderPortrait === 'function') {
    renderPortrait = function od104RenderPortrait(char) { syncAllImages(char || getChar()); };
    renderPortrait.__od104PortraitWrapped = true;
  }
  if (typeof loadCharacter === 'function' && !loadCharacter.__od104PortraitWrapped) {
    const baseLoad = loadCharacter;
    loadCharacter = function od104LoadCharacter(id) {
      const result = baseLoad.apply(this, arguments);
      setTimeout(() => syncAllImages(getChar()), 0);
      setTimeout(() => syncAllImages(getChar()), 250);
      return result;
    };
    loadCharacter.__od104PortraitWrapped = true;
  }

  document.addEventListener('click', event => {
    const portraitBtn = null;
    if (portraitBtn) { return; }
    if (event.target.closest('#od104-photo-close, #od104-photo-cancel')) { event.preventDefault(); $('od104-photo-modal')?.close(); return; }
    if (event.target.closest('#od104-photo-reset')) { event.preventDefault(); window.od104CropState = { x: 50, y: 50, scale: 1 }; refreshPreview(); return; }
    if (event.target.closest('#od104-photo-save')) { event.preventDefault(); saveDialog().then(() => $('od104-photo-modal')?.close()); return; }
  }, true);
  document.addEventListener('input', event => {
    if (event.target.closest('#od104-photo-normal, #od104-photo-low, #od104-photo-zero, #od104-photo-transform')) refreshPreview();
  }, true);
  function boot(){
    ['portrait-modal','od99-portrait-crop-modal','od100-portrait-modal','od101-photo-modal','od102-photo-modal'].forEach(id => $(id)?.classList.add('od104-hidden-old-photo-modal'));
    const btn = $('portrait-button') || $('od101-portrait-button') || $('od102-portrait-button') || document.querySelector('.portrait-button');
    if (btn) { btn.id = 'od104-portrait-button'; btn.classList.add('portrait-button'); btn.setAttribute('title', 'Trocar fotos da ficha'); }
    syncAllImages(getChar());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 150);
  setTimeout(boot, 800);
  window.od104RefreshPortraits = () => syncAllImages(getChar());
})();

/* =========================
   V105 - Transformações como estado da mesma ficha
   - Não cria personagem separado.
   - Cada transformação fica dentro da ficha base.
   - A foto da transformação pertence à transformação e não altera a foto normal.
========================= */
(function od105EmbeddedTransformations() {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (value) => (typeof escapeHtml === 'function' ? escapeHtml(value) : String(value ?? '').replace(/[&<>\"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])));
  const chars = () => (typeof get === 'function' && typeof STORAGE !== 'undefined') ? get(STORAGE.characters, []) : [];
  const setChars = (list) => { if (typeof set === 'function' && typeof STORAGE !== 'undefined') set(STORAGE.characters, list); };
  const idOf = () => (typeof currentCharacterId !== 'undefined' ? currentCharacterId : '');
  const makeId = () => (typeof uid === 'function' ? uid('form') : `form-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  function findCurrent() {
    const id = idOf();
    return chars().find(c => String(c.id) === String(id));
  }

  function baseIdOf(char) {
    return char?.baseCharacterId || char?.id || idOf();
  }

  function normalizeTransformations(char) {
    if (!char) return [];
    if (!Array.isArray(char.transformations)) char.transformations = [];
    char.transformations = char.transformations.map((form, index) => ({
      id: form.id || makeId(),
      name: form.name || `Transformação ${index + 1}`,
      portrait: form.portrait || form.image || form.photo || form.avatar || form.retrato || '',
      description: form.description || form.desc || form.notes || '',
      effects: form.effects || form.bonusText || form.modifiersText || '',
      active: Boolean(form.active)
    }));
    return char.transformations;
  }

  function mutateCurrent(mutator) {
    const list = chars();
    const index = list.findIndex(c => String(c.id) === String(idOf()));
    if (index < 0) return null;
    normalizeTransformations(list[index]);
    mutator(list[index]);
    list[index].updatedAt = Date.now();
    setChars(list);
    return list[index];
  }

  function saveOnline(char) {
    if (!char) return;
    try {
      if (typeof od44SaveCharacterOnline === 'function') od44SaveCharacterOnline(char);
      else if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char);
      else if (typeof queueSave === 'function') queueSave();
    } catch (error) {
      console.warn('[One Dice v105] Falha ao salvar transformação online:', error);
    }
  }

  function migrateLegacyTransformations() {
    const list = chars();
    if (!list.length) return;
    const legacy = list.filter(c => c?.isTransformation && c?.baseCharacterId);
    if (!legacy.length) return;

    let changed = false;
    const legacyIds = new Set(legacy.map(c => String(c.id)));
    for (const form of legacy) {
      const base = list.find(c => String(c.id) === String(form.baseCharacterId));
      if (!base) continue;
      normalizeTransformations(base);
      if (!base.transformations.some(t => String(t.id) === String(form.id))) {
        base.transformations.push({
          id: form.id,
          name: form.name || 'Transformação',
          portrait: form.portrait || form.image || form.photo || form.avatar || '',
          description: form.description || form.desc || '',
          effects: form.effects || form.notes || '',
          active: Boolean(form.activeTransformation || base.activeTransformationId === form.id)
        });
        changed = true;
      }
      if (typeof currentCharacterId !== 'undefined' && String(currentCharacterId) === String(form.id)) currentCharacterId = base.id;
    }

    if (changed || legacy.length) {
      const clean = list.filter(c => !legacyIds.has(String(c.id)));
      clean.forEach(c => {
        if (c?.transformations?.length) {
          const active = c.transformations.find(t => t.active || String(t.id) === String(c.activeTransformationId));
          c.activeTransformationId = active?.id || c.activeTransformationId || '';
          c.obsTransformationActive = Boolean(c.activeTransformationId);
          c.obsTransformPortrait = active?.portrait || '';
        }
      });
      setChars(clean);
      const current = findCurrent();
      if (current) saveOnline(current);
    }
  }

  function getActiveForm(char) {
    const forms = normalizeTransformations(char);
    return forms.find(t => String(t.id) === String(char.activeTransformationId)) || forms.find(t => t.active) || null;
  }

  function syncActiveTransform(char) {
    const active = getActiveForm(char);
    normalizeTransformations(char).forEach(t => { t.active = Boolean(active && String(t.id) === String(active.id)); });
    char.activeTransformationId = active?.id || '';
    char.activeTransformationName = active?.name || '';
    char.obsTransformationActive = Boolean(active);
    char.obsTransformPortrait = active?.portrait || '';
    char.transformationPortrait = active?.portrait || '';
    char.obsIcons = char.obsIcons || {};
    // Compatibilidade com OBS antigo: a fonte vem da transformação ativa, mas a foto normal não é alterada.
    char.obsIcons.transformation = active?.portrait || '';
    return char;
  }

  function renderEmpty(list) {
    list.innerHTML = `<div class="simple-inventory-empty">Nenhuma transformação criada. Crie uma forma para guardar foto, descrição e efeitos dentro desta mesma ficha.</div>`;
  }

  function renderTransformationsV105(char = findCurrent()) {
    const list = $('transformations-list');
    const banner = $('active-form-banner');
    if (!list) return;
    if (!char) { renderEmpty(list); return; }
    normalizeTransformations(char);
    syncActiveTransform(char);
    list.innerHTML = '';

    if (banner) {
      const active = getActiveForm(char);
      banner.classList.toggle('hidden', !active);
      banner.innerHTML = active
        ? `<strong>Transformação ativa:</strong> ${esc(active.name)} <button class="ghost-btn small" data-od105-deactivate-transform type="button">Desativar</button>`
        : '';
    }

    if (!char.transformations.length) return renderEmpty(list);

    char.transformations.forEach((form, index) => {
      const active = String(form.id) === String(char.activeTransformationId);
      const card = document.createElement('article');
      card.className = `mini-card transformation-card od105-transform-card ${active ? 'active' : ''}`;
      card.dataset.od105TransformId = form.id;
      card.innerHTML = `
        <div class="od105-transform-preview">
          ${form.portrait ? `<img src="${esc(form.portrait)}" alt="">` : `<span>Sem foto</span>`}
        </div>
        <div class="od105-transform-fields">
          <label>Nome
            <input data-od105-transform-field="name" value="${esc(form.name)}" placeholder="Nome da transformação">
          </label>
          <label>Foto da transformação
            <input data-od105-transform-field="portrait" value="${esc(form.portrait)}" placeholder="https://... PNG, JPG, WEBP ou GIF">
          </label>
          <label>Descrição
            <textarea data-od105-transform-field="description" rows="2" placeholder="Descrição breve da forma">${esc(form.description)}</textarea>
          </label>
          <label>Efeitos / bônus
            <textarea data-od105-transform-field="effects" rows="2" placeholder="Anote os bônus desta transformação">${esc(form.effects)}</textarea>
          </label>
        </div>
        <div class="transformation-actions od105-transform-actions">
          <button class="${active ? 'ghost-btn' : 'primary-btn'} small" data-od105-activate-transform="${esc(form.id)}" type="button">${active ? 'Ativa' : 'Ativar'}</button>
          <button class="ghost-btn small" data-od105-duplicate-transform="${esc(form.id)}" type="button">Duplicar</button>
          <button class="danger-btn small" data-od105-delete-transform="${esc(form.id)}" type="button">Apagar</button>
        </div>`;
      list.appendChild(card);
    });
  }

  function createTransform() {
    const char = mutateCurrent(c => {
      const forms = normalizeTransformations(c);
      forms.push({
        id: makeId(),
        name: `Transformação ${forms.length + 1}`,
        portrait: '',
        description: '',
        effects: '',
        active: false
      });
      syncActiveTransform(c);
    });
    saveOnline(char);
    renderTransformationsV105(char);
    document.querySelector('[data-tab="transformacoes"]')?.click();
  }

  function updateTransformFromCard(card) {
    if (!card) return;
    const id = card.dataset.od105TransformId;
    const char = mutateCurrent(c => {
      const form = normalizeTransformations(c).find(t => String(t.id) === String(id));
      if (!form) return;
      card.querySelectorAll('[data-od105-transform-field]').forEach(field => {
        form[field.dataset.od105TransformField] = field.value || '';
      });
      syncActiveTransform(c);
    });
    saveOnline(char);
    const img = card.querySelector('.od105-transform-preview img');
    const src = card.querySelector('[data-od105-transform-field="portrait"]')?.value?.trim() || '';
    const preview = card.querySelector('.od105-transform-preview');
    if (preview) preview.innerHTML = src ? `<img src="${esc(src)}" alt="">` : '<span>Sem foto</span>';
  }

  function activateTransform(id) {
    const char = mutateCurrent(c => {
      normalizeTransformations(c).forEach(t => { t.active = String(t.id) === String(id); });
      c.activeTransformationId = id;
      syncActiveTransform(c);
    });
    saveOnline(char);
    renderTransformationsV105(char);
  }

  function deactivateTransform() {
    const char = mutateCurrent(c => {
      normalizeTransformations(c).forEach(t => { t.active = false; });
      c.activeTransformationId = '';
      c.activeTransformationName = '';
      c.obsTransformationActive = false;
      c.obsTransformPortrait = '';
      c.transformationPortrait = '';
      if (c.obsIcons) c.obsIcons.transformation = '';
    });
    saveOnline(char);
    renderTransformationsV105(char);
  }

  function duplicateTransform(id) {
    const char = mutateCurrent(c => {
      const forms = normalizeTransformations(c);
      const source = forms.find(t => String(t.id) === String(id));
      if (!source) return;
      forms.push(Object.assign({}, source, { id: makeId(), name: `${source.name || 'Transformação'} (cópia)`, active: false }));
      syncActiveTransform(c);
    });
    saveOnline(char);
    renderTransformationsV105(char);
  }

  function deleteTransform(id) {
    if (!confirm('Apagar esta transformação?')) return;
    const char = mutateCurrent(c => {
      c.transformations = normalizeTransformations(c).filter(t => String(t.id) !== String(id));
      if (String(c.activeTransformationId) === String(id)) c.activeTransformationId = '';
      syncActiveTransform(c);
    });
    saveOnline(char);
    renderTransformationsV105(char);
  }

  // Substitui as funções antigas sem criar fichas novas.
  window.v39BaseCharId = baseIdOf;
  window.v39TransformationsOf = function(baseId) {
    const base = chars().find(c => String(c.id) === String(baseId)) || findCurrent();
    return normalizeTransformations(base);
  };
  window.v39CreateTransformation = createTransform;
  window.renderTransformations = renderTransformationsV105;

  if (typeof loadCharacter === 'function' && !loadCharacter.__od105TransformWrapped) {
    const baseLoad = loadCharacter;
    loadCharacter = function od105LoadCharacter(id) {
      migrateLegacyTransformations();
      const result = baseLoad.apply(this, arguments);
      setTimeout(() => renderTransformationsV105(findCurrent()), 0);
      return result;
    };
    loadCharacter.__od105TransformWrapped = true;
  }

  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od105TransformWrapped) {
    const baseSave = saveCurrentCharacter;
    saveCurrentCharacter = function od105SaveCurrentCharacter() {
      const result = baseSave.apply(this, arguments);
      const char = mutateCurrent(c => { normalizeTransformations(c); syncActiveTransform(c); });
      return result;
    };
    saveCurrentCharacter.__od105TransformWrapped = true;
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#create-transformation-btn')) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); createTransform(); return;
    }
    const oldOpen = event.target.closest('[data-open-transformation], [data-open-base-form]');
    if (oldOpen) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); return; }
    const activate = event.target.closest('[data-od105-activate-transform]');
    if (activate) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); activateTransform(activate.dataset.od105ActivateTransform); return; }
    const deactivate = event.target.closest('[data-od105-deactivate-transform]');
    if (deactivate) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); deactivateTransform(); return; }
    const duplicate = event.target.closest('[data-od105-duplicate-transform]');
    if (duplicate) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); duplicateTransform(duplicate.dataset.od105DuplicateTransform); return; }
    const del = event.target.closest('[data-od105-delete-transform]');
    if (del) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); deleteTransform(del.dataset.od105DeleteTransform); return; }
  }, true);

  document.addEventListener('input', event => {
    const field = event.target.closest('[data-od105-transform-field]');
    if (!field) return;
    updateTransformFromCard(field.closest('[data-od105-transform-id]'));
  }, true);

  function hideGlobalTransformPhotoField() {
    const input = $('od104-photo-transform') || $('od102-photo-transform') || $('od101-photo-transform');
    if (!input) return;
    const label = input.closest('label');
    if (label) label.style.display = 'none';
    input.value = '';
  }

  function boot() {
    migrateLegacyTransformations();
    hideGlobalTransformPhotoField();
    renderTransformationsV105(findCurrent());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 250);
  setTimeout(boot, 1000);

  window.od105RefreshTransformations = boot;
})();

/* V105b - remove campo global de foto da transformação do modal de fotos */
(function od105HideGlobalTransformPhotoField(){
  function hide(){
    ['od104-photo-transform','od102-photo-transform','od101-photo-transform','od100-photo-transform'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.value = '';
      const label = input.closest('label');
      if (label) label.style.display = 'none';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hide);
  else hide();
  new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
})();

/* =========================
   V107 - Remover perícia Esquiva
   - Esquiva não é mais uma perícia visível/treinável
   - Mantém cálculo usando Reflexo conforme regra atual
========================= */
(function od107RemoveDodgeSkill(){
  const normalize = value => String(value || '').trim().toLowerCase();

  function removeDodgeFromSkillList() {
    try {
      if (Array.isArray(window.SKILLS)) {
        window.SKILLS = window.SKILLS.filter(([name]) => normalize(name) !== 'esquiva');
      } else if (typeof SKILLS !== 'undefined' && Array.isArray(SKILLS)) {
        for (let i = SKILLS.length - 1; i >= 0; i--) {
          if (normalize(SKILLS[i]?.[0]) === 'esquiva') SKILLS.splice(i, 1);
        }
      }
    } catch (_) {}
  }

  function removeDodgeFromCharacter(char) {
    try {
      if (char?.skills?.Esquiva) delete char.skills.Esquiva;
      if (char?.skills?.esquiva) delete char.skills.esquiva;
    } catch (_) {}
  }

  function current() {
    try { return typeof currentChar === 'function' ? currentChar() : null; } catch (_) { return null; }
  }

  function cleanRenderedCards() {
    try {
      document.querySelectorAll('[data-od98-skill-card], [data-od88-skill-card], [data-od79-skill-card]').forEach(card => {
        const name = card.getAttribute('data-od98-skill-card') || card.getAttribute('data-od88-skill-card') || card.getAttribute('data-od79-skill-card') || '';
        if (normalize(name) === 'esquiva') card.remove();
      });
      document.querySelectorAll('[data-skill="Esquiva"], [data-skill-trained="Esquiva"], [data-skill-bonus="Esquiva"], [data-od98-skill-trained="Esquiva"], [data-od98-skill-bonus="Esquiva"]').forEach(el => {
        const card = el.closest('article, tr, .od98-skill-card, .od88-skill-card, .od79-skill-card');
        if (card) card.remove();
      });
    } catch (_) {}
  }

  removeDodgeFromSkillList();
  removeDodgeFromCharacter(current());

  if (typeof renderSkills === 'function' && !renderSkills.__od107NoDodge) {
    const baseRenderSkills = renderSkills;
    renderSkills = function od107RenderSkillsNoDodge(char) {
      removeDodgeFromSkillList();
      removeDodgeFromCharacter(char);
      const result = baseRenderSkills.apply(this, arguments);
      cleanRenderedCards();
      return result;
    };
    renderSkills.__od107NoDodge = true;
  }

  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od107NoDodge) {
    const baseSaveCurrentCharacter = saveCurrentCharacter;
    saveCurrentCharacter = function od107SaveCurrentCharacterNoDodge() {
      removeDodgeFromCharacter(current());
      return baseSaveCurrentCharacter.apply(this, arguments);
    };
    saveCurrentCharacter.__od107NoDodge = true;
  }

  function boot() {
    removeDodgeFromSkillList();
    removeDodgeFromCharacter(current());
    cleanRenderedCards();
    try { if (typeof renderSkills === 'function' && current()) renderSkills(current()); } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  setTimeout(boot, 200);
  setTimeout(boot, 900);
})();

/* =========================
   V108 - menu de informações útil
   - Troca o bloco vazio do menu lateral por um resumo real da sessão
   - Mantém #current-user-label para compatibilidade com o código antigo
========================= */
(function od108UsefulInfoMenu(){
  function esc(v){
    try { return typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? ''); }
    catch(_) { return String(v ?? ''); }
  }

  function getUser(){ return typeof currentUser !== 'undefined' ? currentUser : null; }
  function getChar(){ try { return typeof currentChar === 'function' ? currentChar() : null; } catch(_) { return null; } }
  function getCamp(){ try { return typeof activeCampaign === 'function' ? activeCampaign() : null; } catch(_) { return null; } }
  function getMember(){ try { return typeof currentMembership === 'function' ? currentMembership() : null; } catch(_) { return null; } }

  function userName(){
    const u = getUser();
    if (!u) return 'Usuário';
    try { if (typeof userDisplayName === 'function') return userDisplayName(u) || u.realName || u.name || u.nick || 'Usuário'; } catch(_) {}
    return u.realName || u.name || u.nick || 'Usuário';
  }

  function avatar(){
    const u = getUser();
    return u?.avatar || u?.avatarUrl || u?.photo || u?.photoUrl || u?.portrait || u?.image || u?.picture || 'assets/account-logo.png';
  }

  function roleLabel(){
    const m = getMember();
    if (m?.role === 'mestre') return 'Mestre';
    if (m?.role === 'jogador') return 'Jogador';
    if (m?.role === 'mestre_jogador') return 'Mestre/Jogador';
    return 'Conta';
  }

  function numberFrom(obj, keys, fallback = 0){
    for (const k of keys) {
      const n = Number(obj?.[k]);
      if (Number.isFinite(n)) return n;
    }
    return fallback;
  }

  function statBlock(label, cur, max, cls){
    const c = Number.isFinite(Number(cur)) ? Number(cur) : 0;
    const m = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 1;
    const pct = Math.max(0, Math.min(100, (c / m) * 100));
    return `
      <div class="od108-stat ${cls}">
        <div class="od108-stat-row"><b>${label}</b><span>${esc(c)} / ${esc(m)}</span></div>
        <div class="od108-stat-track"><i style="width:${pct}%"></i></div>
      </div>`;
  }

  function renderBrand(){
    const brand = document.querySelector('#main-topbar .brand');
    if (!brand) return;

    const user = getUser();
    const char = getChar();
    const camp = getCamp();
    const hp = numberFrom(char, ['pv', 'hp', 'currentHp', 'vidaAtual']);
    const hpMax = numberFrom(char, ['pvMax', 'hpMax', 'maxHp', 'vidaMaxima'], 1);
    const pe = numberFrom(char, ['pe', 'currentPe', 'esforcoAtual']);
    const peMax = numberFrom(char, ['peMax', 'maxPe', 'esforcoMaximo'], 1);

    const html = `
      <div class="od108-info-avatar-wrap">
        <img class="od108-info-avatar" src="${esc(avatar())}" alt="Foto do usuário" onerror="this.src='assets/account-logo.png'" />
      </div>
      <div class="od108-info-body">
        <div class="od108-info-kicker">PERFIL DA SESSÃO</div>
        <strong class="od108-info-name">${esc(userName())}</strong>
        <span id="current-user-label" class="od108-compat-label">${esc(user?.nick ? '@' + user.nick : 'Conta One Dice')}</span>
        <div class="od108-info-pills">
          <span>${esc(roleLabel())}</span>
          <span>${esc(camp?.name || 'Fora de mesa')}</span>
          <span>${esc(char?.name || 'Sem ficha aberta')}</span>
        </div>
        ${char ? `<div class="od108-info-stats">${statBlock('PV', hp, hpMax, 'hp')}${statBlock('PE', pe, peMax, 'pe')}</div>` : `<div class="od108-info-empty">Abra uma ficha para ver PV e PE aqui.</div>`}
      </div>`;

    if (brand.dataset.od108Html !== html) {
      brand.dataset.od108Html = html;
      brand.classList.add('od108-info-card');
      brand.innerHTML = html;
    }
  }

  function renderMenuPanel(){
    const card = document.querySelector('#sessions-menu-panel .od90-user-menu-card');
    if (!card) return;
    const char = getChar();
    const camp = getCamp();
    const html = `
      <img class="od90-user-avatar" src="${esc(avatar())}" alt="Foto do usuário" onerror="this.src='assets/account-logo.png'" />
      <div class="od90-user-info od108-panel-user-info">
        <strong>${esc(userName())}</strong>
        <small>${esc(getUser()?.nick ? '@' + getUser().nick : 'Conta One Dice')}</small>
        <small>${esc(roleLabel())} • ${esc(camp?.name || 'Fora de mesa')}</small>
        <small>${esc(char?.name || 'Sem ficha aberta')}</small>
      </div>`;
    if (card.dataset.od108PanelHtml !== html) {
      card.dataset.od108PanelHtml = html;
      card.innerHTML = html;
    }
  }

  function run(){
    renderBrand();
    renderMenuPanel();
  }

  document.addEventListener('click', function(event){
    if (event.target.closest('#topbar-menu-toggle, .topbar-menu-toggle, #sessions-menu-btn, #back-to-sessions-btn, #campaign-character-btn, .sheet-tab, [data-enter-campaign], [data-select-character-for-campaign]')) {
      setTimeout(run, 0);
      setTimeout(run, 160);
    }
  }, true);

  document.addEventListener('input', function(event){
    if (event.target.closest('input, textarea, select')) setTimeout(run, 250);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  setTimeout(run, 300);
  setTimeout(run, 1000);
  window.od108RefreshInfoMenu = run;
})();


/* =========================
   V111 - Sistema de condições da mesa
   - Condições como tags visuais por personagem
   - Controle pelo mestre individual, selecionados ou todos
   - OBS mostra tags coloridas
   - Terreno Difícil é a única condição com efeito: deslocamento pela metade
========================= */
(function od111ConditionsPatch(){
  const OD111_CONDITIONS = [
    { id:'fascinado', name:'Fascinado', color:'mental' },
    { id:'fatigado', name:'Fatigado', color:'fisico' },
    { id:'fraco', name:'Fraco', color:'fisico' },
    { id:'frustrado', name:'Frustrado', color:'mental' },
    { id:'imunidade', name:'Imunidade', color:'azul' },
    { id:'imovel', name:'Imóvel', color:'controle' },
    { id:'inconsciente', name:'Inconsciente', color:'cinza' },
    { id:'indefeso', name:'Indefeso', color:'cinza' },
    { id:'lento', name:'Lento', color:'controle' },
    { id:'machucado', name:'Machucado', color:'dano' },
    { id:'morrendo', name:'Morrendo', color:'dano' },
    { id:'ofuscado', name:'Ofuscado', color:'controle' },
    { id:'paralisado', name:'Paralisado', color:'controle' },
    { id:'pasmo', name:'Pasmo', color:'mental' },
    { id:'petrificado', name:'Petrificado', color:'cinza' },
    { id:'sangrando', name:'Sangrando', color:'dano' },
    { id:'surdo', name:'Surdo', color:'controle' },
    { id:'surpreendido', name:'Surpreendido', color:'mental' },
    { id:'vulneravel', name:'Vulnerável', color:'dano' },
    { id:'agarrado', name:'Agarrado', color:'controle' },
    { id:'cego', name:'Cego', color:'controle' },
    { id:'confuso', name:'Confuso', color:'mental' },
    { id:'envenenado', name:'Envenenado', color:'veneno' },
    { id:'terreno-dificil', name:'Terreno Difícil', color:'terreno', effect:'halfSpeed' }
  ];
  const OD111_BY_ID = Object.fromEntries(OD111_CONDITIONS.map(c => [c.id, c]));

  function slugCondition(value){
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function conditionName(id){ return OD111_BY_ID[id]?.name || String(id || '').replace(/-/g, ' '); }
  function conditionColor(id){ return OD111_BY_ID[id]?.color || 'cinza'; }

  function normalizeConditionIds(char){
    const out = [];
    const push = (value) => {
      if (!value) return;
      const raw = String(value).trim();
      if (!raw || /^normal$/i.test(raw)) return;
      const id = OD111_BY_ID[raw] ? raw : slugCondition(raw);
      if (!id || id === 'normal') return;
      const found = OD111_BY_ID[id] ? id : (OD111_CONDITIONS.find(c => slugCondition(c.name) === id)?.id || id);
      if (!out.includes(found)) out.push(found);
    };

    if (Array.isArray(char?.conditions)) char.conditions.forEach(push);
    if (Array.isArray(char?.conditionTags)) char.conditionTags.forEach(push);
    if (typeof char?.conditionsText === 'string') char.conditionsText.split(/[,;|\n]+/).forEach(push);
    if (typeof char?.condition === 'string') char.condition.split(/[,;|\n]+/).forEach(push);
    return out.filter(id => OD111_BY_ID[id] || id);
  }

  function setConditionIds(char, ids){
    const normalized = [];
    (ids || []).forEach(id => {
      const key = OD111_BY_ID[id] ? id : slugCondition(id);
      if (key && !normalized.includes(key)) normalized.push(key);
    });
    char.conditions = normalized;
    char.conditionTags = normalized;
    char.conditionsText = normalized.length ? normalized.map(conditionName).join(', ') : 'Normal';
    char.condition = char.conditionsText;
    applyConditionEffects(char);
  }

  function parseMeters(value){
    const text = String(value ?? '').replace(',', '.');
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    return Number(match[0]);
  }

  function formatMeters(value){
    const rounded = Math.round(Number(value || 0) * 10) / 10;
    return `${String(rounded).replace('.', ',')} m`;
  }

  function halfSpeedText(value){
    const meters = parseMeters(value);
    if (!Number.isFinite(meters)) return value || '';
    return formatMeters(Math.max(0, meters / 2));
  }

  function applyConditionEffects(char){
    if (!char || typeof char !== 'object') return;
    const ids = normalizeConditionIds(char);
    const hasTerrain = ids.includes('terreno-dificil');

    if (hasTerrain) {
      if (!char.od111BaseSpeed) char.od111BaseSpeed = char.speed || char.deslocamento || '0 m';
      char.speed = halfSpeedText(char.od111BaseSpeed);
      char.deslocamento = char.speed;
      return;
    }

    if (char.od111BaseSpeed) {
      char.speed = char.od111BaseSpeed;
      char.deslocamento = char.od111BaseSpeed;
      delete char.od111BaseSpeed;
    }
  }

  function conditionTagsHtml(char){
    const ids = normalizeConditionIds(char);
    if (!ids.length) return `<span class="od111-empty-tag">Sem condições</span>`;
    return ids.map(id => `<span class="od111-condition-tag od111-${escapeHtml(conditionColor(id))}" data-condition-id="${escapeHtml(id)}">${escapeHtml(conditionName(id))}</span>`).join('');
  }

  function conditionButtonsHtml(char){
    const active = new Set(normalizeConditionIds(char));
    return OD111_CONDITIONS.map(c => `
      <button type="button"
        class="od111-condition-toggle od111-${escapeHtml(c.color)} ${active.has(c.id) ? 'active' : ''}"
        data-toggle-condition="${escapeHtml(c.id)}"
        data-char-id="${escapeHtml(char.id)}">
        ${escapeHtml(c.name)}
      </button>`).join('');
  }

  function conditionOptionsHtml(){
    return OD111_CONDITIONS.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  }

  function selectedMasterCharacters(){
    return [...document.querySelectorAll('[data-od111-select-char]:checked')].map(input => input.value).filter(Boolean);
  }

  function updateManyConditions(charIds, conditionId, action){
    if (!conditionId || !charIds.length) return;
    charIds.forEach(charId => {
      v35UpdateCharacter(charId, char => {
        const ids = normalizeConditionIds(char);
        const set = new Set(ids);
        if (action === 'remove') set.delete(conditionId);
        else set.add(conditionId);
        setConditionIds(char, [...set]);
      }, `${action === 'remove' ? 'Removida' : 'Aplicada'} condição ${conditionName(conditionId)}.`);
    });
  }

  function clearManyConditions(charIds){
    if (!charIds.length) return;
    charIds.forEach(charId => {
      v35UpdateCharacter(charId, char => setConditionIds(char, []), 'Condições removidas.');
    });
  }

  // Compatibilidade com funções antigas que exibiam condição em texto.
  window.od111NormalizeConditionIds = normalizeConditionIds;
  window.od111ConditionTagsHtml = conditionTagsHtml;
  window.od111Conditions = OD111_CONDITIONS;
  v35CharCondition = function(char){
    const ids = normalizeConditionIds(char);
    return ids.length ? ids.map(conditionName).join(', ') : 'Normal';
  };

  const baseLoadCharacter111 = loadCharacter;
  loadCharacter = function(id){
    baseLoadCharacter111(id);
    const char = currentChar();
    if (char) {
      applyConditionEffects(char);
      const speed = byId('char-speed');
      if (speed && char.speed != null) speed.value = char.speed;
    }
  };

  const previousRenderMasterDashboard111 = renderMasterDashboard;
  renderMasterDashboard = function(){
    const panel = byId('master-dashboard');
    const grid = byId('master-characters-grid');
    if (!panel || !grid) return previousRenderMasterDashboard111?.();

    const master = v35IsMaster();
    panel.classList.toggle('hidden', !master);
    document.body.classList.toggle('master-dashboard-mode', master);
    if (!master) return;

    const chars = charactersInCurrentCampaign();
    const users = get(STORAGE.users, []);
    const members = getMembers().filter(m => m.campaignId === currentCampaignId);
    grid.innerHTML = '';

    if (!chars.length) {
      grid.innerHTML = `<div class="campaign-empty">Nenhum jogador vinculou ficha nesta mesa ainda.</div>`;
      if (typeof renderInitiativePanel === 'function') renderInitiativePanel();
      if (typeof v39RenderCommercePanel === 'function') v39RenderCommercePanel();
      return;
    }

    const toolbar = document.createElement('section');
    toolbar.className = 'od111-master-condition-toolbar';
    toolbar.innerHTML = `
      <div>
        <h3>Condições da Mesa</h3>
        <p>Aplique tags visuais em um jogador, vários selecionados ou todos. Apenas Terreno Difícil altera deslocamento.</p>
      </div>
      <div class="od111-toolbar-actions">
        <select id="od111-condition-select">${conditionOptionsHtml()}</select>
        <button type="button" class="ghost-btn small" data-od111-apply="selected">Aplicar selecionados</button>
        <button type="button" class="ghost-btn small" data-od111-remove="selected">Remover selecionados</button>
        <button type="button" class="primary-btn small" data-od111-apply="all">Aplicar todos</button>
        <button type="button" class="danger-btn small" data-od111-clear="selected">Limpar selecionados</button>
        <button type="button" class="danger-btn small" data-od111-clear="all">Limpar todos</button>
      </div>`;
    grid.appendChild(toolbar);

    chars.forEach(char => {
      applyConditionEffects(char);
      const member = members.find(m => m.characterId === char.id);
      const user = users.find(u => u.id === member?.userId);
      const card = document.createElement('article');
      card.className = 'master-character-card v51-master-card od111-master-card';
      card.innerHTML = `
        <div class="master-card-top od111-master-top">
          <label class="od111-select-wrap" title="Selecionar para aplicar condição em grupo">
            <input type="checkbox" data-od111-select-char value="${escapeHtml(char.id)}" />
          </label>
          <img src="${escapeHtml(char.portrait || 'assets/favicon.png')}" alt="" />
          <div>
            <small>Jogador: ${escapeHtml(userDisplayName(user))}</small>
            <strong>${escapeHtml(char.name || 'Personagem')}</strong>
            <span>${escapeHtml(char.race || 'Raça')} • ${escapeHtml(char.className || 'Classe')} • Nv. ${escapeHtml(char.level || 1)}</span>
          </div>
          <span class="v51-online-chip">Na mesa</span>
        </div>
        <div class="master-quick-grid v51-quick-grid">
          <div class="quick-vital">
            <label>PV</label>
            <div class="quick-vital-row">
              <button type="button" data-quick-resource="pv" data-quick-delta="-5" data-char-id="${escapeHtml(char.id)}">−5</button>
              <input data-quick-input="pv" data-char-id="${escapeHtml(char.id)}" value="${escapeHtml(char.pvCurrent ?? 0)}" type="number" />
              <button type="button" data-quick-resource="pv" data-quick-delta="5" data-char-id="${escapeHtml(char.id)}">+5</button>
            </div>
            <small>Máx: ${escapeHtml(char.pvMax ?? 0)}</small>
          </div>
          <div class="quick-vital">
            <label>PE</label>
            <div class="quick-vital-row">
              <button type="button" data-quick-resource="pe" data-quick-delta="-1" data-char-id="${escapeHtml(char.id)}">−1</button>
              <input data-quick-input="pe" data-char-id="${escapeHtml(char.id)}" value="${escapeHtml(char.peCurrent ?? 0)}" type="number" />
              <button type="button" data-quick-resource="pe" data-quick-delta="1" data-char-id="${escapeHtml(char.id)}">+1</button>
            </div>
            <small>Máx: ${escapeHtml(char.peMax ?? 0)}</small>
          </div>
        </div>
        <div class="od111-active-tags">${conditionTagsHtml(char)}</div>
        <details class="od111-condition-panel">
          <summary>Editar condições</summary>
          <div class="od111-condition-grid">${conditionButtonsHtml(char)}</div>
        </details>
        <div class="master-card-actions">
          <button class="primary-btn small" type="button" data-open-master-char="${escapeHtml(char.id)}">Abrir Ficha</button>
          <button class="ghost-btn small" type="button" data-quick-resource="pv" data-quick-delta="-1" data-char-id="${escapeHtml(char.id)}">-1 PV</button>
          <button class="ghost-btn small" type="button" data-quick-resource="pv" data-quick-delta="1" data-char-id="${escapeHtml(char.id)}">+1 PV</button>
          <button class="danger-btn small" type="button" data-od111-clear-char="${escapeHtml(char.id)}">Limpar condições</button>
        </div>`;
      grid.appendChild(card);
    });

    if (typeof renderInitiativePanel === 'function') renderInitiativePanel();
    if (typeof v39RenderCommercePanel === 'function') v39RenderCommercePanel();
    if (typeof od51RenderHistory === 'function') od51RenderHistory();
  };

  const previousRenderPlayerDashboard111 = renderPlayerDashboard;
  renderPlayerDashboard = function(){
    previousRenderPlayerDashboard111?.();
    const char = currentChar();
    const host = document.querySelector('#player-dashboard, .player-dashboard, .sheet-header, .sheet-area');
    if (!host || !char) return;
    let box = document.getElementById('od111-player-condition-tags');
    if (!box) {
      box = document.createElement('div');
      box.id = 'od111-player-condition-tags';
      box.className = 'od111-player-condition-tags';
      host.prepend(box);
    }
    box.innerHTML = conditionTagsHtml(char);
  };

  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-toggle-condition]');
    if (toggle) {
      event.preventDefault();
      const charId = toggle.dataset.charId;
      const conditionId = toggle.dataset.toggleCondition;
      v35UpdateCharacter(charId, char => {
        const set = new Set(normalizeConditionIds(char));
        if (set.has(conditionId)) set.delete(conditionId);
        else set.add(conditionId);
        setConditionIds(char, [...set]);
      }, `${toggle.classList.contains('active') ? 'Removida' : 'Aplicada'} condição ${conditionName(conditionId)}.`);
      return;
    }

    const clearChar = event.target.closest('[data-od111-clear-char]');
    if (clearChar) {
      event.preventDefault();
      v35UpdateCharacter(clearChar.dataset.od111ClearChar, char => setConditionIds(char, []), 'Condições removidas.');
      return;
    }

    const apply = event.target.closest('[data-od111-apply]');
    if (apply) {
      event.preventDefault();
      const conditionId = byId('od111-condition-select')?.value;
      const chars = charactersInCurrentCampaign().map(c => c.id);
      const targets = apply.dataset.od111Apply === 'all' ? chars : selectedMasterCharacters();
      if (!targets.length) return alert('Selecione pelo menos um personagem.');
      updateManyConditions(targets, conditionId, 'add');
      return;
    }

    const remove = event.target.closest('[data-od111-remove]');
    if (remove) {
      event.preventDefault();
      const conditionId = byId('od111-condition-select')?.value;
      const targets = remove.dataset.od111Remove === 'all' ? charactersInCurrentCampaign().map(c => c.id) : selectedMasterCharacters();
      if (!targets.length) return alert('Selecione pelo menos um personagem.');
      updateManyConditions(targets, conditionId, 'remove');
      return;
    }

    const clear = event.target.closest('[data-od111-clear]');
    if (clear) {
      event.preventDefault();
      const targets = clear.dataset.od111Clear === 'all' ? charactersInCurrentCampaign().map(c => c.id) : selectedMasterCharacters();
      if (!targets.length) return alert('Selecione pelo menos um personagem.');
      clearManyConditions(targets);
    }
  });

  // Garante consistência ao salvar e ao receber atualizações online.
  const previousSaveCurrentCharacter111 = saveCurrentCharacter;
  saveCurrentCharacter = function(){
    previousSaveCurrentCharacter111();
    const char = currentChar();
    if (char) {
      updateChar(saved => {
        setConditionIds(saved, normalizeConditionIds(saved));
      });
    }
  };
})();


/* =========================
   V113 - Modelo de Sistema: D20 / Pool Dice
   - Campo em fichas e campanhas
   - Compatibilidade ficha x campanha
   - Rolagem de atributo D20 ou pool de D20
========================= */
(function od113SystemModelPatch(){
  const MODEL_D20 = 'd20';
  const MODEL_POOL = 'pool';
  const LABELS = { d20: 'D20', pool: 'Pool Dice' };
  const $ = id => document.getElementById(id);
  const esc = value => {
    try { return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? ''); }
    catch (_) { return String(value ?? ''); }
  };
  const safe = value => String(value || '').trim();
  const normalizeModel = value => {
    const v = String(value || '').trim().toLowerCase().replace(/[_\s-]+/g, '');
    if (['pool','pooldice','dices','dados','ordem','ordemparanormal'].includes(v)) return MODEL_POOL;
    return MODEL_D20;
  };
  const modelLabel = value => LABELS[normalizeModel(value)] || 'D20';
  const getChars = () => { try { return get(STORAGE.characters, []); } catch (_) { return []; } };
  const setChars = chars => { try { set(STORAGE.characters, chars); } catch (_) {} };
  const getTables = () => { try { return getCampaigns(); } catch (_) { return []; } };
  const current = () => { try { return typeof currentChar === 'function' ? currentChar() : getChars().find(c => String(c.id) === String(currentCharacterId)); } catch (_) { return null; } };
  const characterModel = char => normalizeModel(char?.systemModel || char?.systemType || char?.sheetModel || char?.diceSystem || char?.ruleset);
  const setCharacterModel = (char, model) => {
    if (!char) return;
    const normalized = normalizeModel(model);
    char.systemModel = normalized;
    char.systemType = normalized;
    char.sheetModel = normalized;
  };
  const campaignModel = table => normalizeModel(table?.systemModel || table?.systemType || table?.settings?.systemModel || table?.settings?.systemType || table?.ruleset);
  const setCampaignModel = (table, model) => {
    if (!table) return;
    const normalized = normalizeModel(model);
    table.settings = table.settings || {};
    table.systemModel = normalized;
    table.systemType = normalized;
    table.settings.systemModel = normalized;
    table.settings.systemType = normalized;
  };
  const getSelectedCharacterModel = () => normalizeModel($('od113-character-system-select')?.value || MODEL_D20);
  const getSelectedCampaignModel = () => normalizeModel($('od113-campaign-system-select')?.value || MODEL_D20);

  function ensureCharacterDefaults(char) {
    if (!char) return char;
    setCharacterModel(char, characterModel(char));
    return char;
  }
  function ensureAllDefaults() {
    const chars = getChars();
    let changedChars = false;
    chars.forEach(c => {
      const before = c.systemModel || c.systemType || c.sheetModel;
      ensureCharacterDefaults(c);
      if (!before) changedChars = true;
    });
    if (changedChars) setChars(chars);

    try {
      const tables = getTables();
      let changedTables = false;
      tables.forEach(t => {
        const before = t.systemModel || t.systemType || t.settings?.systemModel || t.settings?.systemType;
        setCampaignModel(t, campaignModel(t));
        if (!before) changedTables = true;
      });
      if (changedTables && typeof setCampaigns === 'function') setCampaigns(tables);
    } catch (_) {}
  }

  function makeModelSelect(id, selected = MODEL_D20, compact = false) {
    return `<label class="od113-system-field ${compact ? 'compact' : ''}">
      <span>Modelo</span>
      <select id="${id}" class="od113-system-select">
        <option value="d20" ${normalizeModel(selected) === MODEL_D20 ? 'selected' : ''}>D20</option>
        <option value="pool" ${normalizeModel(selected) === MODEL_POOL ? 'selected' : ''}>Pool Dice</option>
      </select>
    </label>`;
  }

  function ensureCreateControls() {
    const createAccount = $('create-account-character-btn');
    if (createAccount && !$('od113-character-system-select')) {
      createAccount.insertAdjacentHTML('beforebegin', makeModelSelect('od113-character-system-select', MODEL_D20, true));
    }
    const newCampaignName = $('new-campaign-name');
    if (newCampaignName && !$('od113-campaign-system-select')) {
      newCampaignName.insertAdjacentHTML('afterend', makeModelSelect('od113-campaign-system-select', MODEL_D20, true));
    }
  }

  function decorateSystemBadges() {
    ensureAllDefaults();
    document.querySelectorAll('.account-character-card').forEach(card => {
      const edit = card.querySelector('[data-edit-account-character]');
      if (!edit || card.querySelector('.od113-system-badge')) return;
      const char = getChars().find(c => String(c.id) === String(edit.dataset.editAccountCharacter));
      const strong = card.querySelector('strong');
      if (char && strong) strong.insertAdjacentHTML('afterend', `<em class="od113-system-badge">${modelLabel(characterModel(char))}</em>`);
    });
    document.querySelectorAll('.session-character').forEach(card => {
      if (card.querySelector('.od113-system-badge')) return;
      const img = card.querySelector('img');
      let char = null;
      if (card.dataset?.characterId) char = getChars().find(c => String(c.id) === String(card.dataset.characterId));
      const name = card.querySelector('strong')?.textContent?.trim();
      if (!char && name) char = getChars().find(c => safe(c.name) === name);
      const small = card.querySelector('small, span:last-child');
      if (char && (small || card)) (small || card).insertAdjacentHTML('afterend', `<em class="od113-system-badge mini">${modelLabel(characterModel(char))}</em>`);
    });
    document.querySelectorAll('.campaign-card').forEach(card => {
      if (card.querySelector('.od113-campaign-model-badge')) return;
      const enter = card.querySelector('[data-enter-campaign]');
      if (!enter) return;
      const table = getTables().find(t => String(t.id) === String(enter.dataset.enterCampaign));
      const title = card.querySelector('.campaign-main strong, strong');
      if (table && title) title.insertAdjacentHTML('afterend', `<em class="od113-campaign-model-badge">${modelLabel(campaignModel(table))}</em>`);
    });
  }

  function sortAlpha() {
    try {
      const chars = getChars();
      chars.sort((a,b)=>safe(a.name).localeCompare(safe(b.name), 'pt-BR', { sensitivity:'base' }));
      setChars(chars);
    } catch (_) {}
    try {
      const tables = getTables();
      tables.sort((a,b)=>safe(a.name).localeCompare(safe(b.name), 'pt-BR', { sensitivity:'base' }));
      if (typeof setCampaigns === 'function') setCampaigns(tables);
    } catch (_) {}
  }

  function scheduleDecorate() {
    setTimeout(() => { ensureCreateControls(); decorateSystemBadges(); }, 0);
  }

  // Criação local/offline
  const baseCreateCharacter113 = createCharacter;
  createCharacter = function(ownerId, name = 'Novo Personagem', model = MODEL_D20) {
    const char = baseCreateCharacter113(ownerId, name);
    setCharacterModel(char, model);
    return char;
  };

  // Normalização online
  if (typeof od42CharacterFromRow === 'function') {
    const oldCharFromRow = od42CharacterFromRow;
    od42CharacterFromRow = function(row) {
      const char = oldCharFromRow(row);
      ensureCharacterDefaults(char);
      return char;
    };
  }
  if (typeof od42TableFromRow === 'function') {
    const oldTableFromRow = od42TableFromRow;
    od42TableFromRow = function(row) {
      const table = oldTableFromRow(row);
      table.settings = row?.settings || table.settings || {};
      if (row?.system_model || row?.system_type) setCampaignModel(table, row.system_model || row.system_type);
      else setCampaignModel(table, campaignModel(table));
      return table;
    };
  }

  if (typeof od42CreateCharacter === 'function') {
    od42CreateCharacter = async function(name = 'Novo Personagem', model = getSelectedCharacterModel()) {
      const base = createCharacter(currentUser.id, name, model);
      const data = await od42Api('/api/characters', {
        method: 'POST',
        body: JSON.stringify({ name: base.name, data: base })
      });
      const char = od42CharacterFromRow(data.character);
      setCharacterModel(char, model);
      od42MergeById(STORAGE.characters, [char]);
      sortAlpha();
      return char;
    };
  }

  createAccountCharacter = function(openAfterCreate = true) {
    const model = getSelectedCharacterModel();
    if (typeof od42CreateCharacter === 'function' && typeof od42Api === 'function' && typeof od42Token === 'function' && od42Token()) {
      od42CreateCharacter('Novo Personagem', model).then(char => {
        currentCharacterId = char.id;
        if (typeof renderAccountCharacterMenu === 'function') renderAccountCharacterMenu();
        if (openAfterCreate && typeof initAccountCharacterEditor === 'function') initAccountCharacterEditor(char.id);
        scheduleDecorate();
      }).catch(error => alert(error.message || 'Erro ao criar ficha.'));
      return;
    }
    const chars = getChars();
    const char = createCharacter(currentUser.id, 'Novo Personagem', model);
    chars.push(char);
    setChars(chars);
    currentCharacterId = char.id;
    if (typeof renderAccountCharacterMenu === 'function') renderAccountCharacterMenu();
    if (openAfterCreate && typeof initAccountCharacterEditor === 'function') initAccountCharacterEditor(char.id);
    scheduleDecorate();
  };

  createCampaign = async function() {
    try {
      const name = $('new-campaign-name')?.value?.trim() || 'Nova Mesa';
      const model = getSelectedCampaignModel();
      if (typeof od42Api === 'function' && typeof od42Token === 'function' && od42Token()) {
        const data = await od42Api('/api/tables', {
          method: 'POST',
          body: JSON.stringify({ name, systemType: model, settings: { systemType: model, systemModel: model } })
        });
        const table = od42TableFromRow(data.table);
        setCampaignModel(table, model);
        if ($('new-campaign-name')) $('new-campaign-name').value = '';
        await od42RefreshTables();
        if (typeof renderCampaignMenu === 'function') renderCampaignMenu();
        scheduleDecorate();
        alert(`Mesa criada! Código de convite: ${table.code}`);
        return;
      }
      const campaigns = getTables();
      const campaign = { id: uid('camp'), name, code: generateInviteCode(), ownerId: currentUser.id, createdAt: Date.now(), settings: {} };
      setCampaignModel(campaign, model);
      campaigns.push(campaign);
      setCampaigns(campaigns);
      const members = getMembers();
      members.push({ id: uid('member'), campaignId: campaign.id, userId: currentUser.id, role: 'mestre', characterId: null });
      setMembers(members);
      if ($('new-campaign-name')) $('new-campaign-name').value = '';
      if (typeof renderCampaignMenu === 'function') renderCampaignMenu();
      scheduleDecorate();
      alert(`Mesa criada! Código de convite: ${campaign.code}`);
    } catch (error) {
      alert(error.message || 'Erro ao criar mesa.');
    }
  };

  function compatibleWithCampaign(char, table) {
    if (!char || !table) return false;
    return characterModel(char) === campaignModel(table);
  }

  openChooseCharacterModal = function(campaignId = currentCampaignId) {
    pendingChooseCampaignId = campaignId;
    const list = $('choose-character-list');
    if (!list) return;
    ensureAllDefaults();
    const table = getTables().find(t => String(t.id) === String(campaignId));
    const model = campaignModel(table);
    const chars = getChars()
      .filter(c => c.ownerId === currentUser?.id)
      .sort((a,b)=>safe(a.name).localeCompare(safe(b.name), 'pt-BR', { sensitivity:'base' }));
    const compatible = chars.filter(c => characterModel(c) === model);

    list.innerHTML = `<div class="od113-choose-hint">Esta campanha usa <b>${modelLabel(model)}</b>. Só fichas do mesmo modelo podem ser vinculadas.</div>`;

    if (!compatible.length) {
      const empty = document.createElement('div');
      empty.className = 'campaign-empty';
      empty.innerHTML = `Você ainda não tem ficha <b>${modelLabel(model)}</b>. Crie uma nova ficha nesse modelo ou entre sem ficha.`;
      list.appendChild(empty);
    }

    compatible.forEach(char => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choose-character-card';
      btn.dataset.selectCharacterForCampaign = char.id;
      btn.innerHTML = `<img src="${esc(char.portrait || 'assets/logo.jpg')}" alt="" /><strong>${esc(char.name)}</strong><span>${esc(char.race)} • ${esc(char.className)} • Nv. ${char.level}</span><em class="od113-system-badge">${modelLabel(characterModel(char))}</em>`;
      list.appendChild(btn);
    });

    const incompatible = chars.filter(c => characterModel(c) !== model);
    if (incompatible.length) {
      const note = document.createElement('div');
      note.className = 'od113-incompatible-note';
      note.textContent = `${incompatible.length} ficha(s) ocultas por serem de outro modelo.`;
      list.appendChild(note);
    }

    const modal = $('choose-character-modal');
    const createBtn = $('create-character-for-campaign');
    if (createBtn) createBtn.textContent = `+ Nova Ficha ${modelLabel(model)}`;
    if (modal?.showModal) modal.showModal();
  };

  attachCharacterToCampaign = async function(campaignId, characterId) {
    try {
      const table = getTables().find(t => String(t.id) === String(campaignId));
      const char = characterId ? getChars().find(c => String(c.id) === String(characterId)) : null;
      if (characterId && table && char && !compatibleWithCampaign(char, table)) {
        return alert(`Essa mesa é ${modelLabel(campaignModel(table))}. Escolha uma ficha ${modelLabel(campaignModel(table))}.`);
      }
      if (typeof od42Api === 'function' && typeof od42Token === 'function' && od42Token()) {
        await od42Api(`/api/tables/${campaignId}/member`, { method: 'PUT', body: JSON.stringify({ characterId }) });
        await od42RefreshTables();
        await od42LoadTableState(campaignId);
      } else {
        const members = getMembers().map(m => m.campaignId === campaignId && m.userId === currentUser.id ? { ...m, characterId } : m);
        setMembers(members);
      }
      $('choose-character-modal')?.close();
      if (typeof renderCampaignMenu === 'function') renderCampaignMenu();
      if (currentCampaignId === campaignId && typeof initApp === 'function') initApp(campaignId);
      scheduleDecorate();
    } catch (error) {
      alert(error.message || 'Erro ao vincular ficha.');
    }
  };

  createCharacterForCampaign = async function() {
    try {
      const table = getTables().find(t => String(t.id) === String(pendingChooseCampaignId));
      const model = campaignModel(table);
      const char = typeof od42CreateCharacter === 'function'
        ? await od42CreateCharacter('Novo Personagem', model)
        : createCharacter(currentUser.id, 'Novo Personagem', model);
      if (!char.id) {
        const chars = getChars();
        chars.push(char);
        setChars(chars);
      }
      await attachCharacterToCampaign(pendingChooseCampaignId, char.id);
    } catch (error) {
      alert(error.message || 'Erro ao criar ficha.');
    }
  };

  // Botão entrar sem ficha, sem erro duplicado.
  document.addEventListener('click', event => {
    const noSheet = event.target.closest('#od113-enter-without-sheet');
    if (!noSheet) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (typeof enterWithoutSheet === 'function') {
      enterWithoutSheet();
      return;
    }
    const campaignId = pendingChooseCampaignId || currentCampaignId;
    $('choose-character-modal')?.close();
    $('create-first-sheet-modal')?.close();
    if (campaignId) {
      currentCampaignId = campaignId;
      safeSet?.(STORAGE.activeCampaign, campaignId);
      initApp?.(campaignId);
    }
  }, true);

  function ensureNoSheetButton() {
    const modalActions = document.querySelector('#choose-character-modal .modal-actions');
    if (modalActions && !$('od113-enter-without-sheet')) {
      modalActions.insertAdjacentHTML('afterbegin', `<button id="od113-enter-without-sheet" class="ghost-btn" type="button">Entrar sem ficha</button>`);
    }
  }

  // Salva alteração manual do modelo da ficha aberta, sem trocar campanha automaticamente.
  function ensureSheetModelField() {
    const identityPanel = $('char-name')?.closest('section, .sheet-section, .manga-panel, div');
    const char = current();
    if (!identityPanel || !char || $('od113-open-sheet-model')) return;
    const wrap = document.createElement('label');
    wrap.className = 'od113-open-sheet-model';
    wrap.innerHTML = `<span>Modelo da ficha</span><select id="od113-open-sheet-model" class="od113-system-select"><option value="d20">D20</option><option value="pool">Pool Dice</option></select>`;
    const nameInput = $('char-name');
    if (nameInput?.parentElement) nameInput.parentElement.appendChild(wrap);
    const select = $('od113-open-sheet-model');
    if (select) {
      select.value = characterModel(char);
      select.addEventListener('change', () => {
        const next = normalizeModel(select.value);
        const linked = (typeof getMembers === 'function' ? getMembers() : []).some(m => String(m.characterId) === String(char.id));
        if (linked && !confirm('Essa ficha pode estar vinculada a uma mesa. Alterar o modelo pode impedir vínculo com campanhas de outro modelo. Continuar?')) {
          select.value = characterModel(char);
          return;
        }
        updateChar(c => setCharacterModel(c, next));
        const currentCharNow = current();
        if (currentCharNow) setCharacterModel(currentCharNow, next);
        try { saveCurrentCharacter(); } catch (_) {}
        scheduleDecorate();
      });
    }
  }

  const oldLoadCharacter113 = typeof loadCharacter === 'function' ? loadCharacter : null;
  if (oldLoadCharacter113) {
    loadCharacter = function(id) {
      oldLoadCharacter113(id);
      setTimeout(() => {
        ensureSheetModelField();
        const select = $('od113-open-sheet-model');
        const char = current();
        if (select && char) select.value = characterModel(char);
      }, 0);
    };
  }

  // Compatibilidade visual após renderizações existentes.
  const wrapRender = name => {
    try {
      if (typeof globalThis[name] !== 'function') return;
      const old = globalThis[name];
      globalThis[name] = function(...args) {
        const out = old.apply(this, args);
        sortAlpha();
        scheduleDecorate();
        return out;
      };
    } catch (_) {}
  };
  wrapRender('renderAccountCharacterMenu');
  wrapRender('renderCampaignMenu');
  wrapRender('renderAccountCharacterSidebar');

  // Rolagem de atributos por modelo.
  document.addEventListener('click', event => {
    const btn = event.target.closest('.roll-attr[data-roll-attr]');
    if (!btn) return;
    const char = current();
    if (!char) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const key = btn.dataset.rollAttr;
    const label = (typeof ATTRIBUTE_KEYS !== 'undefined' ? ATTRIBUTE_KEYS.find(a => a[0] === key)?.[1] : null) || key;
    const value = Math.max(1, Number(char.attrs?.[key] ?? 1) || 1);
    if (characterModel(char) === MODEL_POOL) {
      const qty = Math.max(1, Math.min(20, Math.floor(value)));
      const results = Array.from({ length: qty }, () => Math.floor(Math.random() * 20) + 1);
      const best = Math.max(...results);
      const text = `${label} • Pool Dice: ${qty}D20 → [${results.join(', ')}] melhor = ${best}`;
      if ($('last-roll')) {
        $('last-roll').textContent = text;
        $('last-roll').classList.remove('shake'); void $('last-roll').offsetWidth; $('last-roll').classList.add('shake');
      }
      if (typeof addChat === 'function') addChat(text, 'roll');
    } else {
      const mod = typeof attrMod === 'function' ? attrMod(value) : 0;
      if (typeof doRoll === 'function') doRoll(`Teste de ${label}`, 1, 20, mod);
    }
  }, true);

  // Atualiza texto dos cards de atributo para o modelo ativo.
  const oldRenderAttributes113 = typeof renderAttributes === 'function' ? renderAttributes : null;
  if (oldRenderAttributes113) {
    renderAttributes = function(char) {
      oldRenderAttributes113(char);
      const model = characterModel(char);
      document.querySelectorAll('.attr-card-v2, .od103-attr-card').forEach(card => {
        const dice = card.querySelector('.od103-attr-dice, .attr-help');
        const btn = card.querySelector('.roll-attr');
        if (model === MODEL_POOL) {
          if (dice) dice.textContent = 'POOL';
          if (btn) btn.textContent = 'POOL';
        } else {
          if (dice && dice.classList.contains('od103-attr-dice')) dice.textContent = 'D20';
          if (dice && dice.classList.contains('attr-help')) dice.textContent = dice.textContent.replace(/fórmula D&D|POOL/g, 'D20');
          if (btn) btn.textContent = 'D20';
        }
      });
      ensureSheetModelField();
    };
  }

  document.addEventListener('change', event => {
    const select = event.target.closest('#od113-character-system-select, #od113-campaign-system-select');
    if (!select) return;
    scheduleDecorate();
  }, true);

  function boot() {
    ensureAllDefaults();
    ensureCreateControls();
    ensureNoSheetButton();
    ensureSheetModelField();
    decorateSystemBadges();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 300);
  setTimeout(boot, 1000);

  window.od113SystemModel = { normalizeModel, characterModel, campaignModel, modelLabel, decorateSystemBadges };
})();

/* =========================
   V113.1 - Integração com editor moderno de campanhas v86
========================= */
(function od113CampaignEditorIntegration(){
  const $ = id => document.getElementById(id);
  const normalizeModel = value => {
    const v = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    return ['pool','pooldice','dados','ordem','ordemparanormal'].includes(v) ? 'pool' : 'd20';
  };
  const label = value => normalizeModel(value) === 'pool' ? 'Pool Dice' : 'D20';
  const campaignModel = campaign => normalizeModel(campaign?.systemModel || campaign?.systemType || campaign?.settings?.systemModel || campaign?.settings?.systemType);
  let lastEditorCampaignId = null;

  function ensureEditorModelField() {
    const grid = document.querySelector('#od86-campaign-editor .od86-editor-grid');
    if (!grid || $('od86-campaign-system')) return;
    const campaign = lastEditorCampaignId ? (typeof getCampaigns === 'function' ? getCampaigns() : []).find(c => String(c.id) === String(lastEditorCampaignId)) : null;
    const current = campaignModel(campaign);
    const labelEl = document.createElement('label');
    labelEl.className = 'od113-od86-system-label';
    labelEl.innerHTML = `Modelo da campanha
      <select id="od86-campaign-system" class="od113-system-select">
        <option value="d20" ${current === 'd20' ? 'selected' : ''}>D20</option>
        <option value="pool" ${current === 'pool' ? 'selected' : ''}>Pool Dice</option>
      </select>`;
    const desc = $('od86-campaign-description')?.closest('label');
    if (desc) desc.insertAdjacentElement('afterend', labelEl);
    else grid.prepend(labelEl);
  }

  function syncEditorValue() {
    ensureEditorModelField();
    const select = $('od86-campaign-system');
    if (!select) return;
    const campaign = lastEditorCampaignId ? (typeof getCampaigns === 'function' ? getCampaigns() : []).find(c => String(c.id) === String(lastEditorCampaignId)) : null;
    select.value = campaignModel(campaign);
  }

  document.addEventListener('click', event => {
    const edit = event.target.closest('[data-od86-edit-campaign]');
    const create = event.target.closest('#od86-new-campaign');
    if (edit) lastEditorCampaignId = edit.dataset.od86EditCampaign || null;
    if (create) lastEditorCampaignId = null;
    if (edit || create) {
      setTimeout(syncEditorValue, 0);
      setTimeout(syncEditorValue, 80);
    }
  }, true);

  // Injeta o modelo escolhido em qualquer POST/PUT de campanhas, inclusive no editor v86.
  if (typeof od42Api === 'function' && !od42Api.__od113Wrapped) {
    const originalApi = od42Api;
    od42Api = async function(path, options = {}) {
      try {
        const method = String(options?.method || 'GET').toUpperCase();
        const isTableSave = String(path || '') === '/api/tables' && method === 'POST'
          || (/^\/api\/tables\/[^/]+$/.test(String(path || '')) && method === 'PUT');
        if (isTableSave) {
          let body = {};
          try { body = options.body ? JSON.parse(options.body) : {}; } catch (_) { body = {}; }
          const selected = normalizeModel($('od86-campaign-system')?.value || $('od113-campaign-system-select')?.value || body.systemType || body.systemModel || body?.settings?.systemType);
          body.systemType = selected;
          body.systemModel = selected;
          body.settings = { ...(body.settings && typeof body.settings === 'object' ? body.settings : {}), systemType: selected, systemModel: selected };
          options = { ...options, body: JSON.stringify(body) };
        }
      } catch (_) {}
      return originalApi(path, options);
    };
    od42Api.__od113Wrapped = true;
  }

  function decorateOd86Cards() {
    document.querySelectorAll('.od86-campaign-card').forEach(card => {
      if (card.querySelector('.od113-campaign-model-badge')) return;
      const enter = card.querySelector('[data-enter-campaign]');
      if (!enter) return;
      const campaign = (typeof getCampaigns === 'function' ? getCampaigns() : []).find(c => String(c.id) === String(enter.dataset.enterCampaign));
      const title = card.querySelector('.od86-campaign-title-row h3, .od86-campaign-title-row strong, h3, strong');
      if (title) title.insertAdjacentHTML('afterend', `<em class="od113-campaign-model-badge">${label(campaignModel(campaign))}</em>`);
    });
  }

  setInterval(decorateOd86Cards, 1200);
})();


/* =========================
   V115 - Manutenção geral: rotas formais, sons leves, limpeza segura e microanimações
   Este bloco não altera regras de ficha; apenas melhora autonomia e experiência.
========================= */
(function od115Maintenance(){
  const VERSION = '1.77.1';
  const STORAGE_PREFIX = 'od_';
  const routeMap = {
    home: '/inicio',
    inicio: '/inicio',
    characters: '/personagens',
    personagens: '/personagens',
    campaigns: '/campanhas',
    campanhas: '/campanhas'
  };
  const lastSound = { at: 0, name: '' };

  function now(){ return Date.now(); }
  function hasMotion(){ return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
  function getSoundEnabled(){ return localStorage.getItem('od115_sound_enabled') !== '0'; }
  function setSoundEnabled(value){ localStorage.setItem('od115_sound_enabled', value ? '1' : '0'); updateSoundButton(); }

  function beep(name = 'click') {
    if (!getSoundEnabled()) return;
    const at = now();
    if (lastSound.name === name && at - lastSound.at < 90) return;
    lastSound.name = name;
    lastSound.at = at;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = window.__od115AudioContext || (window.__od115AudioContext = new AudioContext());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const map = {
        click: [420, 0.025, 0.018],
        tab: [520, 0.035, 0.022],
        success: [660, 0.045, 0.026],
        error: [160, 0.055, 0.030],
        roll: [880, 0.060, 0.035]
      };
      const [freq, duration, volume] = map[name] || map.click;
      osc.frequency.value = freq;
      osc.type = name === 'error' ? 'sawtooth' : 'triangle';
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.01);
    } catch (_) {}
  }

  function animate(node, className = 'od115-pop') {
    if (!node || !hasMotion()) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
    setTimeout(() => node.classList.remove(className), 260);
  }

  function updateSoundButton() {
    const button = document.getElementById('od115-sound-toggle');
    if (!button) return;
    button.textContent = getSoundEnabled() ? 'Sons: Ligados' : 'Sons: Desligados';
    button.setAttribute('aria-pressed', getSoundEnabled() ? 'true' : 'false');
  }

  function ensureSoundButton() {
    const panel = document.getElementById('sessions-menu-panel');
    if (!panel || document.getElementById('od115-sound-toggle')) return;
    const button = document.createElement('button');
    button.id = 'od115-sound-toggle';
    button.type = 'button';
    button.className = 'ghost-btn menu-entry od115-sound-toggle';
    button.addEventListener('click', event => {
      event.preventDefault();
      setSoundEnabled(!getSoundEnabled());
      beep('success');
    });
    panel.appendChild(button);
    updateSoundButton();
  }

  function formalRouteForTab(tab) {
    const key = String(tab || '').toLowerCase();
    return routeMap[key] || '';
  }

  function safePushRoute(route) {
    if (!route || location.pathname === route) return;
    try { history.pushState({ odRoute: 'v115', route }, '', route); } catch (_) {}
  }

  function cleanupLocalCache() {
    try {
      const obsolete = [
        'od_route_notice',
        'od_legacy_cache',
        'od_last_overlay',
        'one_dice_temp_image',
        'od_debug_route'
      ];
      obsolete.forEach(key => localStorage.removeItem(key));
      const stampKey = `${STORAGE_PREFIX}maintenance_version`;
      if (localStorage.getItem(stampKey) !== VERSION) {
        localStorage.setItem(stampKey, VERSION);
        sessionStorage.removeItem('od_pending_route');
      }
    } catch (_) {}
  }

  document.addEventListener('click', event => {
    const clickable = event.target.closest('button, .tab-btn, .sheet-tab, [role="button"], [data-od71-tab], [data-od75-tab]');
    if (!clickable || clickable.disabled) return;

    const text = (clickable.textContent || '').toLowerCase();
    if (/d20|rolar|dado|dice/.test(text)) beep('roll');
    else if (clickable.matches('.tab-btn, .sheet-tab, [data-od71-tab], [data-od75-tab]')) beep('tab');
    else if (clickable.matches('.danger-btn')) beep('error');
    else beep('click');

    animate(clickable);

    const tab = clickable.dataset?.od71Tab || clickable.dataset?.od75Tab || clickable.dataset?.tab;
    const route = formalRouteForTab(tab);
    if (route && !document.body.classList.contains('app-mode')) safePushRoute(route);
  }, true);

  window.addEventListener('error', event => {
    if (String(event.message || '').includes('ResizeObserver')) return;
    document.body.classList.add('od115-front-error');
  });

  function boot() {
    cleanupLocalCache();
    ensureSoundButton();
    document.documentElement.dataset.odVersion = VERSION;
    setTimeout(ensureSoundButton, 500);
    setTimeout(ensureSoundButton, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.od115 = { version: VERSION, beep, cleanupLocalCache, setSoundEnabled };
})();


/* =========================
   V116 - Reparo: entrar na sessão sem ficha
   - Corrige reset ao clicar em Entrar sem ficha
   - Evita que wrappers antigos reabram o modal de ficha
========================= */
(function od116EnterWithoutSheetFix() {
  function $(id) { return document.getElementById(id); }
  function asList(value) { return Array.isArray(value) ? value : []; }
  function token() { try { return typeof od42Token === 'function' ? od42Token() : null; } catch (_) { return null; } }
  function setSafe(key, value) {
    try {
      if (typeof set === 'function') set(key, value);
      else if (typeof safeSet === 'function') safeSet(key, value);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }
  function getSafe(key, fallback) {
    try {
      if (typeof get === 'function') return get(key, fallback);
      if (typeof safeGet === 'function') return safeGet(key, fallback);
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }
  async function saveNoSheetMember(campaignId) {
    if (!campaignId) return;
    if (token() && typeof od42Api === 'function') {
      await od42Api(`/api/tables/${campaignId}/member`, {
        method: 'PUT',
        body: JSON.stringify({ characterId: null, noSheet: true })
      });
      await od42RefreshTables?.().catch?.(() => {});
      await od42LoadTableState?.(campaignId).catch?.(() => {});
      return;
    }
    const members = typeof getMembers === 'function' ? getMembers() : asList(getSafe(STORAGE.members, []));
    let member = members.find(m => String(m.campaignId) === String(campaignId) && String(m.userId) === String(currentUser?.id));
    if (!member) {
      member = { id: typeof uid === 'function' ? uid('member') : `member-${Date.now()}`, campaignId, userId: currentUser?.id, role: 'jogador', characterId: null };
      members.push(member);
    }
    member.characterId = null;
    member.noSheet = true;
    if (typeof setMembers === 'function') setMembers(members);
    else setSafe(STORAGE.members, members);
  }
  async function enterNoSheet(campaignId) {
    if (!campaignId) return;
    window.__od116EnteringWithoutSheet = true;
    try {
      await saveNoSheetMember(campaignId);
      $('choose-character-modal')?.close?.();
      $('create-first-sheet-modal')?.close?.();
      if (typeof currentCampaignId !== 'undefined') currentCampaignId = campaignId;
      try { setSafe(STORAGE.activeCampaign, campaignId); } catch (_) {}
      if (typeof showApp === 'function') showApp();
      if (typeof initApp === 'function') initApp(campaignId);
      try { renderCampaignMenu?.(); } catch (_) {}
    } catch (error) {
      alert(error?.message || 'Não foi possível entrar sem ficha.');
    } finally {
      setTimeout(() => { window.__od116EnteringWithoutSheet = false; }, 300);
    }
  }
  window.od116EnterNoSheet = enterNoSheet;

  if (typeof enterCampaign === 'function' && !enterCampaign.__od116NoSheetFix) {
    const baseEnterCampaign = enterCampaign;
    enterCampaign = async function od116EnterCampaign(campaignId) {
      if (window.__od116EnteringWithoutSheet) {
        if (typeof currentCampaignId !== 'undefined') currentCampaignId = campaignId;
        try { setSafe(STORAGE.activeCampaign, campaignId); } catch (_) {}
        return initApp?.(campaignId);
      }
      return baseEnterCampaign.apply(this, arguments);
    };
    enterCampaign.__od116NoSheetFix = true;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#od102-enter-without-sheet, #od113-enter-without-sheet, [data-enter-without-sheet]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const campaignId = pendingChooseCampaignId || currentCampaignId || button.dataset.campaignId;
    enterNoSheet(campaignId);
  }, true);
})();

/* =========================
   V117 - Reparo do topo da ficha
   - Corrige campo Modelo da Ficha que era inserido dentro do label do nome
   - Reorganiza o cabeçalho sem alterar dados da ficha
========================= */
(function od117RepairSheetHeaderLayout() {
  const $ = id => document.getElementById(id);

  function repairModelField() {
    const nameInput = $('char-name');
    const identityGrid = document.querySelector('#mobile-identity-panel .identity-grid, .sheet-header .identity-grid');
    const select = $('od113-open-sheet-model');
    if (!nameInput || !identityGrid || !select) return;

    const wrapper = select.closest('.od113-open-sheet-model');
    if (!wrapper) return;

    wrapper.classList.add('od117-model-field');

    const nameLabel = nameInput.closest('label');
    if (nameLabel && nameLabel.contains(wrapper)) {
      const raceLabel = $('char-race')?.closest('label');
      if (raceLabel && raceLabel.parentElement === identityGrid) {
        identityGrid.insertBefore(wrapper, raceLabel);
      } else {
        identityGrid.insertBefore(wrapper, identityGrid.children[1] || null);
      }
    }
  }

  function repairHeader() {
    const panel = $('mobile-identity-panel');
    if (panel) panel.classList.add('od117-sheet-header-fixed');
    const grid = panel?.querySelector('.identity-grid');
    if (grid) grid.classList.add('od117-identity-grid-fixed');
    repairModelField();
  }

  const baseLoad = typeof loadCharacter === 'function' ? loadCharacter : null;
  if (baseLoad && !baseLoad.__od117HeaderFix) {
    loadCharacter = function od117LoadCharacterHeaderFix(id) {
      const result = baseLoad.apply(this, arguments);
      requestAnimationFrame(repairHeader);
      setTimeout(repairHeader, 80);
      return result;
    };
    loadCharacter.__od117HeaderFix = true;
  }

  const observer = new MutationObserver(() => {
    if ($('char-name') && $('od113-open-sheet-model')) repairHeader();
  });

  function boot() {
    repairHeader();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


/* =========================
   V118 - Painel de atributos refeito
   - Nome
   - Bônus/valor de rolagem quando D20
   - Botão - e botão + dentro do card
   - Valor total do atributo
   - Botão de rolagem
   - Pool Dice usa atributo como quantidade de D20
========================= */
(function od118AttributePanelFinalFix() {
  const $ = id => document.getElementById(id);
  const labels = {
    forca: 'Força',
    agilidade: 'Agilidade',
    vigor: 'Vigor',
    intelecto: 'Intelecto',
    presenca: 'Presença'
  };

  const esc = value => {
    try {
      if (typeof escapeHtml === 'function') return escapeHtml(String(value ?? ''));
    } catch (_) {}
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  };

  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  function getChar() {
    try { return typeof currentChar === 'function' ? currentChar() : null; }
    catch (_) { return null; }
  }

  function getModel(char) {
    const raw = String(char?.systemModel || char?.model || char?.sheetModel || char?.fichaModelo || 'd20').toLowerCase();
    return raw.includes('pool') ? 'pool' : 'd20';
  }

  function saveSoft() {
    try { if (typeof queueSave === 'function') queueSave(); } catch (_) {}
    try {
      const char = getChar();
      if (char && typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char);
    } catch (_) {}
  }

  function refreshDerived(char) {
    if (!char) return;
    try { if (typeof syncDodge === 'function') syncDodge(char); } catch (_) {}
    try { if (typeof updateDerivedStatsDisplay === 'function') updateDerivedStatsDisplay(char); } catch (_) {}
    try { if (typeof renderSkills === 'function') renderSkills(char); } catch (_) {}
    try { if (typeof updateBars === 'function') updateBars(char); } catch (_) {}
  }

  function buildRollText(model, value, modText) {
    if (model === 'pool') return `${Math.max(1, value)}D20`;
    return `D20 ${modText === '+0' ? '' : modText}`.trim();
  }

  function renderAttributesV118(char = getChar()) {
    const grid = $('attributes-grid');
    if (!grid || !char) return;

    char.attrs = char.attrs || {};
    const model = getModel(char);
    grid.innerHTML = '';

    Object.entries(labels).forEach(([key, label]) => {
      const value = Math.max(1, num(char.attrs[key], 1));
      const mod = typeof attrMod === 'function' ? attrMod(value) : value;
      const modText = typeof formatMod === 'function' ? formatMod(mod) : (mod >= 0 ? `+${mod}` : String(mod));
      const rollText = buildRollText(model, value, modText);

      const card = document.createElement('div');
      card.className = `od118-attr-card ${model === 'pool' ? 'is-pool' : 'is-d20'}`;
      card.dataset.attrKey = key;
      card.innerHTML = `
        <div class="od118-attr-head">
          <span class="od118-attr-name">${esc(label)}</span>
          ${model === 'd20'
            ? `<span class="od118-attr-bonus" title="Bônus do atributo">${esc(modText)}</span>`
            : `<span class="od118-attr-bonus od118-pool-chip" title="Pool de dados">${esc(value)}D20</span>`}
        </div>

        <div class="od118-attr-control">
          <button type="button" class="od118-step" data-od118-attr-step="${esc(key)}" data-dir="-1" aria-label="Diminuir ${esc(label)}">−</button>
          <input class="od118-value" data-attr="${esc(key)}" type="number" value="${esc(value)}" min="1" inputmode="numeric" aria-label="Valor total de ${esc(label)}">
          <button type="button" class="od118-step" data-od118-attr-step="${esc(key)}" data-dir="1" aria-label="Aumentar ${esc(label)}">+</button>
          <div class="od118-total" title="Valor total do atributo">
            <small>Total</small>
            <strong>${esc(value)}</strong>
          </div>
        </div>

        <button class="primary-btn small roll-attr od118-roll" data-roll-attr="${esc(key)}" type="button">${esc(rollText)}</button>
      `;
      grid.appendChild(card);
    });
  }

  function applyAttrChange(key, next) {
    next = Math.max(1, num(next, 1));
    try {
      if (typeof updateChar === 'function') {
        updateChar(char => {
          char.attrs = char.attrs || {};
          char.attrs[key] = next;
          refreshDerived(char);
        });
      }
    } catch (_) {}

    const char = getChar();
    if (char) {
      char.attrs = char.attrs || {};
      char.attrs[key] = next;
      refreshDerived(char);
      renderAttributesV118(char);
      saveSoft();
    }
  }

  if (typeof renderAttributes === 'function') renderAttributes = renderAttributesV118;
  window.renderAttributesV103 = renderAttributesV118;
  window.renderAttributesV118 = renderAttributesV118;

  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-od118-attr-step]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const key = btn.dataset.od118AttrStep;
    const input = document.querySelector(`input.od118-value[data-attr="${CSS.escape(key)}"]`);
    const current = input ? num(input.value, 1) : num(getChar()?.attrs?.[key], 1);
    const next = current + num(btn.dataset.dir, 0);
    applyAttrChange(key, next);
  }, true);

  document.addEventListener('change', event => {
    const input = event.target.closest('input.od118-value[data-attr]');
    if (!input) return;
    applyAttrChange(input.dataset.attr, input.value);
  }, true);

  document.addEventListener('input', event => {
    const input = event.target.closest('input.od118-value[data-attr]');
    if (!input) return;
    const key = input.dataset.attr;
    const value = Math.max(1, num(input.value, 1));
    const char = getChar();
    if (!char) return;
    char.attrs = char.attrs || {};
    char.attrs[key] = value;
    refreshDerived(char);
    saveSoft();
  }, true);

  function boot() {
    const char = getChar();
    if (char && $('attributes-grid')) renderAttributesV118(char);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 150);
  setTimeout(boot, 800);
})();

/* =========================
   V119 - Estabilização das imagens da ficha
   - Evita flicker depois de salvar/clicar em botões.
   - Impede que renders antigos troquem a foto por fallback momentâneo.
   - Atualiza imagens por link direto sem recarregar se o src não mudou.
========================= */
(function od119StablePortraits(){
  'use strict';

  const FALLBACK = 'assets/logo.jpg';
  const $ = id => document.getElementById(id);
  const clean = value => String(value || '').trim();
  const isFallback = src => !src || /(^|\/)assets\/(logo|account-logo|favicon)\.(jpg|png|webp|gif)$/i.test(String(src || '')) || String(src || '').includes('assets/logo');
  const isRealImage = src => {
    const value = clean(src);
    return !!value && !/^(null|undefined|about:blank)$/i.test(value) && !isFallback(value);
  };

  function chars(){
    try { return typeof get === 'function' ? get(STORAGE.characters, []) : []; }
    catch (_) { return []; }
  }

  function current(){
    try { return typeof currentChar === 'function' ? currentChar() : null; }
    catch (_) { return null; }
  }

  function primary(char = current()){
    return clean(
      char?.portrait ||
      char?.image ||
      char?.photo ||
      char?.avatar ||
      char?.retrato ||
      char?.picture ||
      ''
    );
  }

  function statePortrait(char = current()){
    if (!char) return FALLBACK;
    const pv = Number(char.pvCurrent ?? char.pvAtual ?? char.pv ?? char.hpCurrent ?? 1);
    const max = Math.max(1, Number(char.pvMax ?? char.pvTotal ?? char.hpMax ?? 1));
    const icons = char.obsIcons || {};
    const activeId = char.activeTransformationId || char.activeTransformation || '';
    const forms = Array.isArray(char.transformations) ? char.transformations : [];
    const activeForm = forms.find(f => String(f.id) === String(activeId));

    if (pv < 0) return '';
    if (activeForm && isRealImage(activeForm.portrait)) return clean(activeForm.portrait);
    if (char.obsTransformationActive && isRealImage(char.obsTransformPortrait || icons.transformation || char.transformationPortrait)) {
      return clean(char.obsTransformPortrait || icons.transformation || char.transformationPortrait);
    }
    if (pv === 0 && isRealImage(icons.zero || char.portraitZero || char.obsIconZero)) {
      return clean(icons.zero || char.portraitZero || char.obsIconZero);
    }
    if (pv > 0 && pv / max < 0.5 && isRealImage(icons.low || char.portraitLow || char.obsIconLow)) {
      return clean(icons.low || char.portraitLow || char.obsIconLow);
    }
    return primary(char) || FALLBACK;
  }

  function applyCrop(img, char = current()){
    if (!img || !char) return;
    const crop = Object.assign({ x: 50, y: 50, scale: 1 }, char.portraitCrop || {});
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${Number(crop.x) || 50}% ${Number(crop.y) || 50}%`;
    img.style.transformOrigin = `${Number(crop.x) || 50}% ${Number(crop.y) || 50}%`;
    img.style.transform = `scale(${Math.max(1, Math.min(3, Number(crop.scale) || 1))})`;
  }

  function setStableImage(img, src, char = current(), options = {}){
    if (!img) return;
    const wanted = clean(src) || FALLBACK;
    const currentSrc = img.getAttribute('src') || '';
    const lastReal = img.dataset.od119LastReal || '';

    // Não deixe fallback antigo apagar uma foto real durante saves/renders intermediários.
    if (isFallback(wanted) && isRealImage(lastReal) && !options.forceFallback) {
      applyCrop(img, char);
      return;
    }

    if (!wanted) {
      img.removeAttribute('src');
      img.style.visibility = 'hidden';
      return;
    }

    img.style.visibility = '';
    img.decoding = 'async';
    img.loading = 'eager';
    img.onerror = () => {
      img.onerror = null;
      if (isRealImage(lastReal) && img.getAttribute('src') !== lastReal) img.src = lastReal;
      else if (!isFallback(wanted)) img.src = FALLBACK;
    };

    if (currentSrc !== wanted) {
      // Para GIF e links externos, trocar só quando o endereço mudou evita reiniciar animação/flicker.
      img.src = wanted;
    }
    if (isRealImage(wanted)) img.dataset.od119LastReal = wanted;
    applyCrop(img, char);
  }

  function writeHidden(char = current()){
    const value = primary(char);
    const hidden = $('portrait-url');
    const modal = $('portrait-modal-url');
    if (hidden && value && hidden.value !== value) hidden.value = value;
    if (modal && value && modal.value !== value) modal.value = value;
  }

  function syncImages(char = current()){
    if (!char) return;
    const main = statePortrait(char);
    const normal = primary(char) || FALLBACK;

    setStableImage($('char-portrait-preview'), main, char);
    setStableImage($('overlay-portrait'), normal, char);
    writeHidden(char);

    const id = String(char.id || '');
    if (id && window.CSS?.escape) {
      document.querySelectorAll(`img[data-character-id="${CSS.escape(id)}"], img[data-char-id="${CSS.escape(id)}"]`).forEach(img => setStableImage(img, normal, char));
    }

    document.querySelectorAll('.account-character-card, .od85-character-card, .choose-character-card, .session-character, .character-pill, .campaign-character-preview, .od114-discussion-post, .campaign-card').forEach(card => {
      if (!char.name || !(card.textContent || '').includes(char.name)) return;
      const img = card.querySelector('img');
      if (img) setStableImage(img, normal, char);
    });
  }

  let pending = false;
  function scheduleSync(){
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      syncImages(current());
    });
  }

  // Override direto: qualquer render antigo passa por aqui, sem piscar para fallback.
  try {
    window.renderPortrait = function od119RenderPortrait(char){ syncImages(char || current()); };
    globalThis.renderPortrait = window.renderPortrait;
  } catch (_) {}

  if (typeof updateOverlay === 'function' && !updateOverlay.__od119Wrapped) {
    const baseOverlay = updateOverlay;
    updateOverlay = function od119UpdateOverlay(char){
      const result = baseOverlay.apply(this, arguments);
      syncImages(char || current());
      return result;
    };
    updateOverlay.__od119Wrapped = true;
  }

  if (typeof loadCharacter === 'function' && !loadCharacter.__od119Wrapped) {
    const baseLoad = loadCharacter;
    loadCharacter = function od119LoadCharacter(){
      const result = baseLoad.apply(this, arguments);
      scheduleSync();
      setTimeout(scheduleSync, 120);
      return result;
    };
    loadCharacter.__od119Wrapped = true;
  }

  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od119Wrapped) {
    const baseSave = saveCurrentCharacter;
    saveCurrentCharacter = function od119SaveCurrentCharacter(){
      const charBefore = current();
      const keep = primary(charBefore);
      const hidden = $('portrait-url');
      if (hidden && keep && !isRealImage(hidden.value)) hidden.value = keep;
      const result = baseSave.apply(this, arguments);
      scheduleSync();
      return result;
    };
    saveCurrentCharacter.__od119Wrapped = true;
  }

  // Quando salva no modal de fotos, sincroniza uma vez após o save; sem timeouts repetidos.
  document.addEventListener('click', event => {
    if (event.target.closest('#od104-photo-save, #od100-photo-save, #od101-photo-save, #od102-photo-save')) {
      setTimeout(scheduleSync, 80);
      setTimeout(scheduleSync, 300);
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => syncImages(current()), { once: true });
  else syncImages(current());

  window.od119SyncPortraits = () => syncImages(current());
})();


/* =========================
   V121 - Reparo dos atributos e retorno dos menus da v119
   - Mantém a base visual/menus da v119, sem abas de discussão da v120.
   - Reorganiza atributos para não estourarem o card.
   - D20: mostra nome, bônus, D20, botões -/+, valor total e rolagem.
   - Pool Dice: mostra nome, pool de dados, botões -/+, valor total e rolagem.
========================= */
(function od121AttributeCardsFinal(){
  'use strict';

  const $ = id => document.getElementById(id);
  const labels = {
    forca: 'Força',
    agilidade: 'Agilidade',
    vigor: 'Vigor',
    intelecto: 'Intelecto',
    presenca: 'Presença'
  };

  function esc(value) {
    try { if (typeof escapeHtml === 'function') return escapeHtml(String(value ?? '')); } catch (_) {}
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function getChar() {
    try { return typeof currentChar === 'function' ? currentChar() : null; }
    catch (_) { return null; }
  }

  function getModel(char) {
    const raw = String(char?.systemModel || char?.model || char?.sheetModel || char?.fichaModelo || 'd20').toLowerCase();
    return raw.includes('pool') ? 'pool' : 'd20';
  }

  function modText(value) {
    const mod = typeof attrMod === 'function' ? attrMod(value) : value;
    return typeof formatMod === 'function' ? formatMod(mod) : (mod >= 0 ? `+${mod}` : String(mod));
  }

  function rollText(model, value, mod) {
    if (model === 'pool') return `${Math.max(1, value)}D20`;
    return mod === '+0' ? 'D20' : `D20 ${mod}`;
  }

  function saveSoft() {
    try { if (typeof queueSave === 'function') queueSave(); } catch (_) {}
    try {
      const char = getChar();
      if (char && typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char);
    } catch (_) {}
  }

  function refresh(char) {
    if (!char) return;
    try { if (typeof syncDodge === 'function') syncDodge(char); } catch (_) {}
    try { if (typeof updateDerivedStatsDisplay === 'function') updateDerivedStatsDisplay(char); } catch (_) {}
    try { if (typeof renderSkills === 'function') renderSkills(char); } catch (_) {}
    try { if (typeof updateBars === 'function') updateBars(char); } catch (_) {}
    try { if (typeof updateOverlay === 'function') updateOverlay(char); } catch (_) {}
  }

  function renderAttributesV121(char = getChar()) {
    const grid = $('attributes-grid');
    if (!grid || !char) return;
    char.attrs = char.attrs || {};
    const model = getModel(char);
    grid.innerHTML = '';

    Object.entries(labels).forEach(([key, label]) => {
      const value = Math.max(1, num(char.attrs[key], 1));
      const bonus = modText(value);
      const isPool = model === 'pool';
      const card = document.createElement('div');
      card.className = `od121-attr-card ${isPool ? 'is-pool' : 'is-d20'}`;
      card.dataset.attrKey = key;
      card.innerHTML = `
        <div class="od121-attr-top">
          <div class="od121-attr-name">${esc(label)}</div>
          <div class="od121-attr-badge ${isPool ? 'is-pool' : ''}">${isPool ? esc(`${value}D20`) : esc(bonus)}</div>
        </div>
        <div class="od121-attr-meta">${isPool ? 'Pool Dice' : 'D20'}</div>
        <div class="od121-attr-body">
          <button type="button" class="od121-step" data-od121-attr-step="${esc(key)}" data-dir="-1" aria-label="Diminuir ${esc(label)}">−</button>
          <input class="od121-value" data-attr="${esc(key)}" type="number" value="${esc(value)}" min="1" inputmode="numeric" aria-label="Valor total de ${esc(label)}">
          <button type="button" class="od121-step" data-od121-attr-step="${esc(key)}" data-dir="1" aria-label="Aumentar ${esc(label)}">+</button>
        </div>
        <button type="button" class="primary-btn small roll-attr od121-roll" data-roll-attr="${esc(key)}">${esc(rollText(model, value, bonus))}</button>
      `;
      grid.appendChild(card);
    });
  }

  function applyChange(key, raw) {
    const next = Math.max(1, num(raw, 1));
    const char = getChar();
    if (!char) return;
    char.attrs = char.attrs || {};
    char.attrs[key] = next;

    try {
      if (typeof updateChar === 'function') {
        updateChar(c => {
          c.attrs = c.attrs || {};
          c.attrs[key] = next;
        });
      }
    } catch (_) {}

    refresh(char);
    renderAttributesV121(char);
    saveSoft();
  }

  if (typeof renderAttributes === 'function') renderAttributes = renderAttributesV121;
  window.renderAttributesV121 = renderAttributesV121;
  window.renderAttributesV118 = renderAttributesV121;
  window.renderAttributesV103 = renderAttributesV121;

  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-od121-attr-step]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const key = btn.dataset.od121AttrStep;
    const char = getChar();
    const current = num(char?.attrs?.[key], 1);
    applyChange(key, current + num(btn.dataset.dir, 0));
  }, true);

  document.addEventListener('change', event => {
    const input = event.target.closest('input.od121-value[data-attr]');
    if (!input) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    applyChange(input.dataset.attr, input.value);
  }, true);

  document.addEventListener('input', event => {
    const input = event.target.closest('input.od121-value[data-attr]');
    if (!input) return;
    const char = getChar();
    if (!char) return;
    char.attrs = char.attrs || {};
    char.attrs[input.dataset.attr] = Math.max(1, num(input.value, 1));
    refresh(char);
    saveSoft();
  }, true);

  function boot() {
    const char = getChar();
    if (char && $('attributes-grid')) renderAttributesV121(char);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  setTimeout(boot, 150);
  setTimeout(boot, 900);
})();


/* =========================
   V122 - Reparo definitivo: entrar na sessão sem ficha
   - Permite marcar uma mesa como "entrar sem ficha"
   - Bypassa wrappers antigos que reabriam o modal ao detectar characterId vazio
   - Mantém currentCharacterId nulo e abre a mesa normalmente
========================= */
(function od122NoSheetSessionFix() {
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? '');

  function userId() {
    try { return currentUser?.id || currentUser?.userId || currentUser?.nick || 'local'; }
    catch (_) { return 'local'; }
  }

  function noSheetKey(tableId) {
    return `od_no_sheet_table_${safe(userId())}_${safe(tableId)}`;
  }

  function setNoSheet(tableId, enabled = true) {
    if (!tableId) return;
    try {
      if (enabled) localStorage.setItem(noSheetKey(tableId), '1');
      else localStorage.removeItem(noSheetKey(tableId));
    } catch (_) {}
  }

  function wantsNoSheet(tableId) {
    try { return localStorage.getItem(noSheetKey(tableId)) === '1'; }
    catch (_) { return false; }
  }

  function storageSet(key, value) {
    try {
      if (typeof set === 'function') return set(key, value);
      if (typeof safeSet === 'function') return safeSet(key, value);
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function localMember(tableId) {
    try {
      const members = typeof getMembers === 'function' ? getMembers() : [];
      return members.find(m => String(m.campaignId || m.tableId) === String(tableId) && String(m.userId) === String(currentUser?.id));
    } catch (_) { return null; }
  }

  async function refreshTable(tableId) {
    if (typeof od42RefreshOwnCharacters === 'function') await od42RefreshOwnCharacters().catch(() => {});
    if (typeof od42RefreshTables === 'function') await od42RefreshTables().catch(() => {});
    if (typeof od42LoadTableState === 'function') await od42LoadTableState(tableId).catch(() => {});
  }

  async function persistNoSheetMember(tableId) {
    if (!tableId) return;
    if (typeof od42Api === 'function' && typeof od42Token === 'function' && od42Token()) {
      await od42Api(`/api/tables/${tableId}/member`, {
        method: 'PUT',
        body: JSON.stringify({ characterId: null })
      }).catch(() => {});
      await refreshTable(tableId);
      return;
    }
    try {
      const members = typeof getMembers === 'function' ? getMembers() : [];
      let member = members.find(m => String(m.campaignId || m.tableId) === String(tableId) && String(m.userId) === String(currentUser?.id));
      if (member) {
        member.characterId = null;
        member.noSheet = true;
        if (typeof setMembers === 'function') setMembers(members);
      }
    } catch (_) {}
  }

  function showNoSheetScreen() {
    try {
      if (typeof showApp === 'function') showApp();
      if (typeof renderCampaignMiniCard === 'function') renderCampaignMiniCard();
      if (typeof renderCharacterList === 'function') renderCharacterList();
      if (typeof renderChat === 'function') renderChat();
      if (typeof showNoCharacterSelected === 'function') showNoCharacterSelected();
      const btn = $('campaign-character-btn');
      if (btn) btn.textContent = 'Escolher Minha Ficha';
    } catch (_) {}
  }

  async function openNoSheetTable(tableId) {
    if (!tableId) return;
    window.__od122OpeningNoSheet = true;
    try {
      setNoSheet(tableId, true);
      await persistNoSheetMember(tableId);
      await refreshTable(tableId);
      const member = localMember(tableId);
      if (!member) {
        alert('Você não participa desta mesa.');
        return;
      }
      if (typeof currentCampaignId !== 'undefined') currentCampaignId = tableId;
      if (typeof currentCharacterId !== 'undefined') currentCharacterId = null;
      try { storageSet(STORAGE.activeCampaign, tableId); } catch (_) {}
      $('choose-character-modal')?.close?.();
      $('create-first-sheet-modal')?.close?.();
      if (typeof initApp === 'function') {
        initApp(tableId);
        if (!currentCharacterId) showNoSheetScreen();
      } else {
        showNoSheetScreen();
      }
    } finally {
      setTimeout(() => { window.__od122OpeningNoSheet = false; }, 500);
    }
  }

  window.od122OpenNoSheetTable = openNoSheetTable;

  if (typeof attachCharacterToCampaign === 'function' && !attachCharacterToCampaign.__od122NoSheetClear) {
    const baseAttach = attachCharacterToCampaign;
    attachCharacterToCampaign = async function od122AttachCharacterToCampaign(tableId, characterId) {
      if (characterId) setNoSheet(tableId, false);
      return baseAttach.apply(this, arguments);
    };
    attachCharacterToCampaign.__od122NoSheetClear = true;
  }

  if (typeof enterCampaign === 'function' && !enterCampaign.__od122NoSheetFinal) {
    const baseEnter = enterCampaign;
    enterCampaign = async function od122EnterCampaign(tableId) {
      await refreshTable(tableId);
      const member = localMember(tableId);
      if (member && !member.characterId && wantsNoSheet(tableId)) {
        return openNoSheetTable(tableId);
      }
      if (member && !member.characterId && window.__od122OpeningNoSheet) {
        return openNoSheetTable(tableId);
      }
      return baseEnter.apply(this, arguments);
    };
    enterCampaign.__od122NoSheetFinal = true;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#od102-enter-without-sheet, #od113-enter-without-sheet, [data-enter-without-sheet]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const tableId = button.dataset.campaignId || button.dataset.tableId || pendingChooseCampaignId || currentCampaignId;
    openNoSheetTable(tableId);
  }, true);

  function ensureButton() {
    const actions = document.querySelector('#choose-character-modal .modal-actions');
    if (!actions || $('#od122-enter-without-sheet')) return;
    const old = $('#od102-enter-without-sheet') || $('#od113-enter-without-sheet');
    if (old) {
      old.id = 'od122-enter-without-sheet';
      old.dataset.enterWithoutSheet = '1';
      old.textContent = 'Entrar sem ficha';
      return;
    }
    actions.insertAdjacentHTML('afterbegin', '<button id="od122-enter-without-sheet" class="ghost-btn" data-enter-without-sheet="1" type="button">Entrar sem ficha</button>');
  }

  const baseOpenChoose = typeof openChooseCharacterModal === 'function' ? openChooseCharacterModal : null;
  if (baseOpenChoose && !baseOpenChoose.__od122NoSheetButton) {
    openChooseCharacterModal = function od122OpenChooseCharacterModal() {
      const result = baseOpenChoose.apply(this, arguments);
      setTimeout(ensureButton, 0);
      setTimeout(ensureButton, 80);
      return result;
    };
    openChooseCharacterModal.__od122NoSheetButton = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureButton);
  else ensureButton();
})();

/* =========================
   V123 - Reparo: botão Entrar sem ficha duplicado
   - Remove botões antigos duplicados criados por patches anteriores
   - Mantém apenas um botão funcional no modal de escolher ficha
   - Evita overflow horizontal do modal
========================= */
(function od123SingleNoSheetButtonFix() {
  const BTN_ID = 'od123-enter-without-sheet';

  function $(id) { return document.getElementById(id); }

  function isNoSheetButton(el) {
    if (!el || el.tagName !== 'BUTTON') return false;
    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return el.id === BTN_ID
      || el.id === 'od122-enter-without-sheet'
      || el.id === 'od113-enter-without-sheet'
      || el.id === 'od102-enter-without-sheet'
      || el.dataset?.enterWithoutSheet === '1'
      || text === 'entrar sem ficha';
  }

  function makeButton(oldButton) {
    const button = oldButton || document.createElement('button');
    button.id = BTN_ID;
    button.type = 'button';
    button.className = 'ghost-btn od123-enter-without-sheet';
    button.dataset.enterWithoutSheet = '1';
    button.textContent = 'Entrar sem ficha';
    return button;
  }

  function modalActions() {
    return document.querySelector('#choose-character-modal .modal-actions');
  }

  function normalizeNoSheetButton() {
    const actions = modalActions();
    if (!actions) return;

    const allButtons = [...actions.querySelectorAll('button')];
    const noSheetButtons = allButtons.filter(isNoSheetButton);
    let main = noSheetButtons[0] || null;

    noSheetButtons.slice(1).forEach(button => button.remove());
    main = makeButton(main);

    if (!actions.contains(main)) actions.prepend(main);
    else if (actions.firstElementChild !== main) actions.prepend(main);

    actions.classList.add('od123-modal-actions-fixed');
  }

  async function enterWithoutSheetFromButton(button) {
    const tableId = button?.dataset?.campaignId
      || button?.dataset?.tableId
      || (typeof pendingChooseCampaignId !== 'undefined' ? pendingChooseCampaignId : null)
      || (typeof currentCampaignId !== 'undefined' ? currentCampaignId : null);

    if (typeof od122OpenNoSheetTable === 'function') {
      await od122OpenNoSheetTable(tableId);
      return;
    }

    try { document.getElementById('choose-character-modal')?.close?.(); } catch (_) {}
    try { document.getElementById('create-first-sheet-modal')?.close?.(); } catch (_) {}
    if (tableId && typeof currentCampaignId !== 'undefined') currentCampaignId = tableId;
    if (typeof currentCharacterId !== 'undefined') currentCharacterId = null;
    try { if (typeof initApp === 'function') initApp(tableId); } catch (_) {}
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!isNoSheetButton(button)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    normalizeNoSheetButton();
    enterWithoutSheetFromButton(button);
  }, true);

  const baseOpenChoose = typeof openChooseCharacterModal === 'function' ? openChooseCharacterModal : null;
  if (baseOpenChoose && !baseOpenChoose.__od123SingleNoSheetButton) {
    openChooseCharacterModal = function od123OpenChooseCharacterModal() {
      const result = baseOpenChoose.apply(this, arguments);
      requestAnimationFrame(normalizeNoSheetButton);
      setTimeout(normalizeNoSheetButton, 60);
      setTimeout(normalizeNoSheetButton, 250);
      return result;
    };
    openChooseCharacterModal.__od123SingleNoSheetButton = true;
  }

  function boot() {
    normalizeNoSheetButton();
    const modal = $('choose-character-modal');
    if (modal && !modal.__od123NoSheetObserver) {
      modal.__od123NoSheetObserver = true;
      new MutationObserver(() => requestAnimationFrame(normalizeNoSheetButton)).observe(modal, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();


/* =========================
   V124 - Remoção definitiva do sistema de discussão
   Limpa restos locais antigos para impedir botões/modais herdados.
========================= */
(function od124RemoveDiscussionResidue(){
  try {
    Object.keys(localStorage || {}).forEach(key => {
      if (String(key).startsWith('od114_discussion_')) localStorage.removeItem(key);
    });
  } catch (_) {}
  function cleanDiscussionUi(){
    try {
      document.querySelectorAll('#od114-discussion-modal, .od114-discussion-modal, .od114-discussion-btn, [data-od114-discussion]').forEach(el => el.remove());
    } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cleanDiscussionUi);
  else cleanDiscussionUi();
  setTimeout(cleanDiscussionUi, 250);
  setTimeout(cleanDiscussionUi, 1000);
})();

/* =========================
   V125 - Correção definitiva do painel de atributos
   - Recria o HTML dos atributos com classes próprias
   - Mantém todos os elementos dentro do card
   - D20: nome, bônus, D20, -, valor total, +, rolagem
   - Pool Dice: nome, pool, -, valor total, +, rolagem
========================= */
(function od125AttributeLayoutFix() {
  'use strict';

  const $ = id => document.getElementById(id);
  const ATTRS = {
    forca: 'Força',
    agilidade: 'Agilidade',
    vigor: 'Vigor',
    intelecto: 'Intelecto',
    presenca: 'Presença'
  };

  function esc(value) {
    try {
      if (typeof escapeHtml === 'function') return escapeHtml(String(value ?? ''));
    } catch (_) {}
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function num(value, fallback = 1) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function getChar() {
    try { return typeof currentChar === 'function' ? currentChar() : null; }
    catch (_) { return null; }
  }

  function modelOf(char) {
    const raw = String(char?.systemModel || char?.model || char?.sheetModel || char?.fichaModelo || 'd20').toLowerCase();
    return raw.includes('pool') ? 'pool' : 'd20';
  }

  function attrBonus(value) {
    const mod = typeof attrMod === 'function' ? attrMod(value) : value;
    return typeof formatMod === 'function' ? formatMod(mod) : (mod >= 0 ? `+${mod}` : String(mod));
  }

  function rollLabel(model, value, bonus) {
    if (model === 'pool') return `${Math.max(1, value)}D20`;
    return bonus === '+0' ? 'D20' : `D20 ${bonus}`;
  }

  function saveAttribute(key, value, rerender = true) {
    const next = Math.max(1, num(value, 1));
    let char = getChar();

    try {
      if (typeof updateChar === 'function') {
        updateChar(c => {
          c.attrs = c.attrs || {};
          c.attrs[key] = next;
        });
      }
    } catch (_) {}

    char = getChar();
    if (char) {
      char.attrs = char.attrs || {};
      char.attrs[key] = next;
      try { if (typeof syncDodge === 'function') syncDodge(char); } catch (_) {}
      try { if (typeof updateDerivedStatsDisplay === 'function') updateDerivedStatsDisplay(char); } catch (_) {}
      try { if (typeof renderSkills === 'function') renderSkills(char); } catch (_) {}
      try { if (typeof updateBars === 'function') updateBars(char); } catch (_) {}
      try { if (typeof updateOverlay === 'function') updateOverlay(char); } catch (_) {}
      try { if (typeof queueSave === 'function') queueSave(); } catch (_) {}
      try { if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char); } catch (_) {}
      if (rerender) renderAttributesV125(char);
    }
  }

  function renderAttributesV125(char = getChar()) {
    const grid = $('attributes-grid');
    if (!grid || !char) return;

    char.attrs = char.attrs || {};
    const model = modelOf(char);
    grid.innerHTML = '';
    grid.classList.add('od125-attributes-grid');

    Object.entries(ATTRS).forEach(([key, label]) => {
      const value = Math.max(1, num(char.attrs[key], 1));
      const bonus = attrBonus(value);
      const isPool = model === 'pool';
      const roll = rollLabel(model, value, bonus);
      const subLabel = isPool ? 'Pool Dice' : 'D20';
      const badge = isPool ? `${value}D20` : bonus;

      const card = document.createElement('div');
      card.className = `od125-attr-card ${isPool ? 'is-pool' : 'is-d20'}`;
      card.dataset.attrKey = key;
      card.innerHTML = `
        <div class="od125-attr-top">
          <div class="od125-attr-name">${esc(label)}</div>
          <div class="od125-attr-bonus ${isPool ? 'is-pool' : ''}">${esc(badge)}</div>
        </div>

        <div class="od125-attr-subline">
          <span>${esc(subLabel)}</span>
          <span>Valor total</span>
        </div>

        <div class="od125-attr-controls">
          <button type="button" class="od125-step" data-od125-attr-step="${esc(key)}" data-dir="-1" aria-label="Diminuir ${esc(label)}">−</button>
          <input class="od125-value" data-attr="${esc(key)}" type="number" value="${esc(value)}" min="1" inputmode="numeric" aria-label="Valor total de ${esc(label)}">
          <button type="button" class="od125-step" data-od125-attr-step="${esc(key)}" data-dir="1" aria-label="Aumentar ${esc(label)}">+</button>
        </div>

        <button type="button" class="primary-btn small roll-attr od125-roll" data-roll-attr="${esc(key)}">${esc(roll)}</button>
      `;
      grid.appendChild(card);
    });
  }

  if (typeof renderAttributes === 'function') renderAttributes = renderAttributesV125;
  window.renderAttributesV125 = renderAttributesV125;
  window.renderAttributesV121 = renderAttributesV125;
  window.renderAttributesV118 = renderAttributesV125;
  window.renderAttributesV103 = renderAttributesV125;

  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-od125-attr-step]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const key = btn.dataset.od125AttrStep;
    const char = getChar();
    const current = num(char?.attrs?.[key], 1);
    saveAttribute(key, current + num(btn.dataset.dir, 0), true);
  }, true);

  document.addEventListener('input', event => {
    const input = event.target.closest('input.od125-value[data-attr]');
    if (!input) return;
    event.stopPropagation();
    saveAttribute(input.dataset.attr, input.value, false);
  }, true);

  document.addEventListener('change', event => {
    const input = event.target.closest('input.od125-value[data-attr]');
    if (!input) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    saveAttribute(input.dataset.attr, input.value, true);
  }, true);

  function boot() {
    const char = getChar();
    if (char && $('attributes-grid')) renderAttributesV125(char);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  setTimeout(boot, 100);
  setTimeout(boot, 700);
})();



/* =========================
   V134 - Retrato e atributos limpos
   - Um único modal de fotos ativo.
   - Remove modais antigos antes de abrir.
   - Layout de atributos sem render antigo competindo.
========================= */
(function od134CleanPortraitAndAttributes(){
  'use strict';

  const $ = id => document.getElementById(id);
  const ATTRS = [
    ['forca', 'Força'],
    ['agilidade', 'Agilidade'],
    ['vigor', 'Vigor'],
    ['intelecto', 'Intelecto'],
    ['presenca', 'Presença']
  ];
  const FALLBACK = 'assets/logo.jpg';
  const OLD_PHOTO_SELECTORS = [
    '#portrait-modal', '#od99-portrait-crop-modal', '#od100-portrait-modal', '#od101-photo-modal', '#od102-photo-modal', '#od104-photo-modal', '#od130-photo-modal', '#od131-photo-overlay', '#od132-photo-overlay', '#od133-photo-overlay',
    '.portrait-modal', '.od99-crop-modal', '.od100-portrait-modal', '.od101-photo-modal', '.od102-photo-modal', '.od104-photo-modal', '.od130-photo-modal', '.od131-photo-overlay', '.od132-photo-overlay', '.od133-photo-overlay'
  ];

  const esc = value => {
    if (typeof escapeHtml === 'function') return escapeHtml(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  };
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const clean = value => String(value || '').trim();
  const chars = () => { try { return typeof get === 'function' && STORAGE ? get(STORAGE.characters, []) : []; } catch (_) { return []; } };
  const setChars = list => { try { if (typeof set === 'function' && STORAGE) set(STORAGE.characters, list); } catch (_) {} };
  const currentId = () => { try { return typeof currentCharacterId !== 'undefined' ? currentCharacterId : null; } catch (_) { return null; } };
  const current = () => chars().find(c => String(c.id) === String(currentId())) || null;
  const modelOf = c => String(c?.sheetModel || c?.systemModel || c?.model || 'd20').toLowerCase().includes('pool') ? 'pool' : 'd20';
  const attrVal = (c, key) => Math.max(1, num(c?.attrs?.[key], key === 'vigor' ? 10 : 10));
  const attrBonus = (c, key) => {
    const value = attrVal(c, key);
    if (typeof attrMod === 'function') return attrMod(value);
    return Math.floor((value - 10) / 2);
  };
  const fmt = value => value >= 0 ? `+${value}` : String(value);
  const primary = c => clean(c?.portrait || c?.image || c?.photo || c?.avatar || c?.retrato || '');
  const statePhoto = c => {
    if (!c) return FALLBACK;
    const pv = num(c.pvCurrent ?? c.pvAtual ?? c.pv ?? c.hpCurrent ?? c.hp, 0);
    const max = Math.max(1, num(c.pvMax ?? c.pvTotal ?? c.pv_max ?? c.hpMax ?? c.hpTotal, 1));
    const icons = c.obsIcons || {};
    if (pv < 0) return '';
    const activeForm = Array.isArray(c.transformations) ? c.transformations.find(f => f && f.active) : null;
    if (activeForm && clean(activeForm.portrait || activeForm.image || activeForm.photo)) return clean(activeForm.portrait || activeForm.image || activeForm.photo);
    if (pv === 0 && clean(c.portraitZero || icons.zero || c.obsIconZero)) return clean(c.portraitZero || icons.zero || c.obsIconZero);
    if (pv > 0 && pv / max < 0.5 && clean(c.portraitLow || icons.low || c.obsIconLow)) return clean(c.portraitLow || icons.low || c.obsIconLow);
    return primary(c) || FALLBACK;
  };
  function setImg(img, src){
    if (!img) return;
    const value = clean(src);
    if (!value) {
      img.removeAttribute('src');
      img.style.visibility = 'hidden';
      return;
    }
    img.style.visibility = '';
    img.onerror = () => { img.onerror = null; if (img.getAttribute('src') !== FALLBACK) img.src = FALLBACK; };
    if (img.getAttribute('src') !== value) img.src = value;
  }
  function applySavedCrop(img, c){
    if (!img || !c) return;
    const raw = c.portraitCrop && typeof c.portraitCrop === 'object' ? c.portraitCrop : {};
    const x = Math.max(0, Math.min(100, Number(raw.x ?? 50) || 50));
    const y = Math.max(0, Math.min(100, Number(raw.y ?? 50) || 50));
    const scale = Math.max(1, Math.min(3, Number(raw.scale ?? 1) || 1));
    // Usa prioridade important porque camadas antigas do CSS forçavam object-position:center.
    img.style.setProperty('object-fit', 'cover', 'important');
    img.style.setProperty('object-position', `${x}% ${y}%`, 'important');
    img.style.setProperty('transform-origin', `${x}% ${y}%`, 'important');
    img.style.setProperty('transform', `scale(${scale})`, 'important');
    img.dataset.od162CropApplied = `${x},${y},${scale}`;
  }
  function persist(c){
    if (!c) return;
    try { if (typeof od44SaveCharacterOnline === 'function') od44SaveCharacterOnline(c); }
    catch (_) {}
    try { if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(c); }
    catch (_) {}
    try { if (typeof queueSave === 'function') queueSave(); }
    catch (_) {}
  }
  function mutate(mutator){
    const list = chars();
    const id = currentId();
    const index = list.findIndex(c => String(c.id) === String(id));
    if (index < 0) return null;
    mutator(list[index]);
    list[index].updatedAt = Date.now();
    setChars(list);
    persist(list[index]);
    return list[index];
  }

  function killOldPhotoUi(){
    OLD_PHOTO_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (el.id === 'od134-photo-overlay') return;
        try { if (typeof el.close === 'function' && el.open) el.close(); } catch (_) {}
        el.remove();
      });
    });
    const btns = document.querySelectorAll('#portrait-button,#od99-portrait-button,#od100-portrait-button,#od101-portrait-button,#od102-portrait-button,#od104-portrait-button,#od130-portrait-button,#od131-portrait-button,#od132-portrait-button,#od133-portrait-button,.portrait-button,.portrait-wrap');
    btns.forEach(btn => {
      if (btn.id === 'od134-portrait-button' && btn.dataset.od134Clean === '1') return;
      const clone = btn.cloneNode(true);
      clone.id = 'od134-portrait-button';
      clone.dataset.od134Clean = '1';
      clone.classList.add('portrait-button');
      clone.setAttribute('role', 'button');
      clone.setAttribute('tabindex', '0');
      clone.setAttribute('title', 'Editar fotos da ficha');
      try { btn.replaceWith(clone); } catch (_) {}
    });
  }

  let crop = { x: 50, y: 50, scale: 1 };
  let dragging = null;
  function ensurePhotoModal(){
    killOldPhotoUi();
    let overlay = $('od134-photo-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'od134-photo-overlay';
    overlay.className = 'od134-photo-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="od134-photo-panel" role="dialog" aria-modal="true" aria-labelledby="od134-photo-title">
        <button type="button" id="od134-photo-close" class="od134-photo-close">×</button>
        <div class="od134-photo-left">
          <header class="od134-photo-head">
            <h2 id="od134-photo-title">Fotos da ficha</h2>
            <p>Cole links diretos de imagem. PNG, JPG, WEBP e GIF funcionam. GIF permanece animado.</p>
          </header>
          <div class="od134-photo-grid">
            <label><span>Foto normal</span><input id="od134-photo-normal" type="text" autocomplete="off" spellcheck="false" placeholder="https://..."></label>
            <label><span>Machucado, abaixo de 50% PV</span><input id="od134-photo-low" type="text" autocomplete="off" spellcheck="false" placeholder="opcional"></label>
            <label><span>Morrendo, 0 PV</span><input id="od134-photo-zero" type="text" autocomplete="off" spellcheck="false" placeholder="opcional"></label>
          </div>
          <footer class="od134-photo-actions">
            <button type="button" id="od134-photo-center" class="od134-photo-btn">Centralizar</button>
            <button type="button" id="od134-photo-cancel" class="od134-photo-btn">Cancelar</button>
            <button type="button" id="od134-photo-save" class="od134-photo-btn primary">Salvar fotos</button>
          </footer>
        </div>
        <aside class="od134-photo-right">
          <div id="od134-photo-preview" class="od134-photo-preview"><img id="od134-photo-preview-img" draggable="false" alt="Prévia"></div>
          <p>Arraste a imagem para enquadrar e use a roda do mouse para aproximar.</p>
        </aside>
      </section>`;
    document.body.appendChild(overlay);
    bindPhotoPreview();
    return overlay;
  }
  function previewSrc(){ return clean($('od134-photo-normal')?.value || FALLBACK); }
  function applyPreview(){
    const img = $('od134-photo-preview-img');
    if (!img) return;
    setImg(img, previewSrc());
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${crop.x}% ${crop.y}%`;
    img.style.transform = `scale(${Math.max(1, Math.min(3, crop.scale))})`;
    img.style.transformOrigin = `${crop.x}% ${crop.y}%`;
  }
  function bindPhotoPreview(){
    const box = $('od134-photo-preview');
    if (!box || box.dataset.od134Ready === '1') return;
    box.dataset.od134Ready = '1';
    box.addEventListener('pointerdown', event => {
      dragging = { sx: event.clientX, sy: event.clientY, x: crop.x, y: crop.y };
      box.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    box.addEventListener('pointermove', event => {
      if (!dragging) return;
      const rect = box.getBoundingClientRect();
      crop.x = Math.max(0, Math.min(100, dragging.x - ((event.clientX - dragging.sx) / Math.max(1, rect.width)) * 100));
      crop.y = Math.max(0, Math.min(100, dragging.y - ((event.clientY - dragging.sy) / Math.max(1, rect.height)) * 100));
      applyPreview();
    });
    const stop = () => { dragging = null; };
    box.addEventListener('pointerup', stop);
    box.addEventListener('pointercancel', stop);
    box.addEventListener('wheel', event => {
      event.preventDefault();
      crop.scale = Math.max(1, Math.min(3, Number((crop.scale + (event.deltaY < 0 ? 0.08 : -0.08)).toFixed(2))));
      applyPreview();
    }, { passive: false });
  }
  function openPhoto(){
    const c = current();
    const overlay = ensurePhotoModal();
    const icons = c?.obsIcons || {};
    $('od134-photo-normal').value = primary(c) || '';
    $('od134-photo-low').value = clean(c?.portraitLow || icons.low || c?.obsIconLow || '');
    $('od134-photo-zero').value = clean(c?.portraitZero || icons.zero || c?.obsIconZero || '');
    crop = Object.assign({ x: 50, y: 50, scale: 1 }, c?.portraitCrop || {});
    applyPreview();
    overlay.hidden = false;
    document.body.classList.add('od134-photo-open');
  }
  function closePhoto(){
    const overlay = $('od134-photo-overlay');
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('od134-photo-open');
  }
  function savePhoto(){
    const normal = clean($('od134-photo-normal')?.value || '');
    const low = clean($('od134-photo-low')?.value || '');
    const zero = clean($('od134-photo-zero')?.value || '');
    const updated = mutate(c => {
      c.portrait = normal; c.image = normal; c.photo = normal; c.avatar = normal; c.retrato = normal;
      c.obsIcons = c.obsIcons || {};
      c.obsIcons.low = low; c.obsIcons.zero = zero;
      c.portraitLow = low; c.portraitZero = zero;
      c.obsIconLow = low; c.obsIconZero = zero;
      c.portraitCrop = { x: crop.x, y: crop.y, scale: crop.scale };
    });
    syncPortrait(updated || current());
    try { if (typeof renderCharacterList === 'function') renderCharacterList(); } catch (_) {}
    try { if (typeof renderCampaignMenu === 'function') renderCampaignMenu(); } catch (_) {}
    closePhoto();
  }
  function syncPortrait(c = current()){
    if (!c) return;
    const src = statePhoto(c);
    const hidden = $('portrait-url');
    if (hidden && hidden.value !== primary(c)) hidden.value = primary(c);
    const portraitImg = $('char-portrait-preview');
    setImg(portraitImg, src);
    applySavedCrop(portraitImg, c);
    setImg($('overlay-portrait'), src);
    const id = String(c.id || '');
    if (id && window.CSS && CSS.escape) document.querySelectorAll(`img[data-character-id="${CSS.escape(id)}"], img[data-char-id="${CSS.escape(id)}"]`).forEach(img => setImg(img, src));
  }


  /* V136: render de atributos removido deste bloco para evitar conflito. */
  document.addEventListener('click', event => {
    if (event.target.closest('#od134-photo-close,#od134-photo-cancel')) { event.preventDefault(); event.stopImmediatePropagation(); closePhoto(); return; }
    if (event.target.closest('#od134-photo-center')) { event.preventDefault(); event.stopImmediatePropagation(); crop = { x: 50, y: 50, scale: 1 }; applyPreview(); return; }
    if (event.target.closest('#od134-photo-save')) { event.preventDefault(); event.stopImmediatePropagation(); savePhoto(); return; }
  }, true);
  document.addEventListener('input', event => {
    if (event.target.closest('#od134-photo-normal')) { applyPreview(); return; }
  }, true);

  function boot(){
    killOldPhotoUi();
    ensurePhotoModal();
    syncPortrait();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  setTimeout(boot, 200);
  setTimeout(boot, 1000);

  window.od134OpenPhotoModal = openPhoto;
  window.od134SyncPortrait = syncPortrait;
})();


/* =========================
   V136 - Atributos definitivos, sem conflito com fotos
   Mantém a foto da v134 e corrige os botões desde o carregamento inicial.
========================= */
(function od136AttributesClean(){
  'use strict';
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const ATTRS = [
    ['forca', 'Força'], ['agilidade', 'Agilidade'], ['vigor', 'Vigor'], ['intelecto', 'Intelecto'], ['presenca', 'Presença']
  ];
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const clamp = value => Math.max(1, Math.floor(Number(value) || 1));
  const signed = value => `${Number(value) >= 0 ? '+' : ''}${Number(value) || 0}`;

  function readCharacters(){
    try { if (typeof get === 'function' && typeof STORAGE !== 'undefined') return get(STORAGE.characters, []); } catch (_) {}
    try { return JSON.parse(localStorage.getItem('od_characters') || '[]'); } catch (_) { return []; }
  }
  function writeCharacters(list){
    try { if (typeof set === 'function' && typeof STORAGE !== 'undefined') { set(STORAGE.characters, list); return; } } catch (_) {}
    localStorage.setItem('od_characters', JSON.stringify(list));
  }
  function activeId(){
    try { if (typeof currentCharacterId !== 'undefined' && currentCharacterId) return currentCharacterId; } catch (_) {}
    try { const c = typeof currentChar === 'function' ? currentChar() : null; if (c?.id) return c.id; } catch (_) {}
    return null;
  }
  function activeChar(){
    try { const c = typeof currentChar === 'function' ? currentChar() : null; if (c) return c; } catch (_) {}
    const id = activeId();
    return id ? readCharacters().find(c => c && c.id === id) || null : null;
  }
  function modelOf(char){
    const raw = String(char?.systemModel || char?.sheetModel || char?.model || char?.rulesModel || 'd20').toLowerCase();
    return raw.includes('pool') ? 'pool' : 'd20';
  }
  function attrValue(char, key){
    const attrs = char?.attrs || char?.attributes || {};
    return clamp(attrs[key] ?? char?.[key] ?? 1);
  }
  function modOf(value){ return Math.floor((clamp(value) - 10) / 2); }
  function labelOf(char){ return modelOf(char) === 'pool' ? 'Pool Dice' : 'D20'; }

  function saveAttr(key, value){
    const id = activeId();
    if (!id) return null;
    const list = readCharacters();
    const index = list.findIndex(c => c && c.id === id);
    if (index < 0) return null;
    const char = { ...list[index] };
    char.attrs = { ...(char.attrs || char.attributes || {}), [key]: clamp(value) };
    list[index] = char;
    writeCharacters(list);
    try { if (typeof updateDerivedStatsDisplay === 'function') updateDerivedStatsDisplay(char); } catch (_) {}
    try { if (typeof updateBars === 'function') updateBars(char); } catch (_) {}
    try { if (typeof updateOverlay === 'function') updateOverlay(char); } catch (_) {}
    try { if (typeof queueSave === 'function') queueSave(); } catch (_) {}
    try { if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char); } catch (_) {}
    return char;
  }

  function card(char, key, label){
    const value = attrValue(char, key);
    const pool = modelOf(char) === 'pool';
    const top = pool ? `${value}D` : signed(modOf(value));
    const el = document.createElement('article');
    el.className = `od136-attr-card ${pool ? 'is-pool' : 'is-d20'}`;
    el.dataset.attrKey = key;
    el.innerHTML = `
      <div class="od136-attr-head">
        <strong class="od136-attr-name">${esc(label)}</strong>
        <span class="od136-attr-bonus">${esc(top)}</span>
      </div>
      <div class="od136-attr-line">
        <span class="od136-attr-kind">${esc(labelOf(char))}</span>
        <button type="button" class="od136-attr-step" data-od136-step="${esc(key)}" data-dir="-1">−</button>
        <input class="od136-attr-input" data-attr="${esc(key)}" data-od136-attr="${esc(key)}" type="number" min="1" inputmode="numeric" value="${esc(value)}">
        <button type="button" class="od136-attr-step" data-od136-step="${esc(key)}" data-dir="1">+</button>
      </div>
      <button type="button" class="od136-attr-roll roll-attr" data-roll-attr="${esc(key)}">${esc(labelOf(char))}</button>
    `;
    return el;
  }

  function render(char = activeChar()){
    const grid = $('attributes-grid');
    if (!grid || !char) return;
    if (grid.dataset.od136Rendering === '1') return;
    grid.dataset.od136Rendering = '1';
    try {
      grid.className = 'attributes-grid od136-attributes-grid';
      grid.replaceChildren(...ATTRS.map(([key, label]) => card(char, key, label)));
    } finally { grid.dataset.od136Rendering = '0'; }
  }
  function delayedRender(){ [0, 80, 250, 700].forEach(ms => setTimeout(() => render(), ms)); }

  function rollPool(label, value){
    const qty = Math.max(1, Math.min(30, clamp(value)));
    const rolls = Array.from({ length: qty }, () => Math.floor(Math.random() * 20) + 1);
    const best = Math.max(...rolls);
    const text = `${label}: ${qty}D20 → [${rolls.join(', ')}] melhor = ${best}`;
    const last = $('last-roll');
    if (last) last.textContent = text;
    try { if (typeof addChat === 'function') addChat(text, 'roll'); } catch (_) {}
  }

  document.addEventListener('click', event => {
    const step = event.target.closest('[data-od136-step]');
    if (step) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const key = step.dataset.od136Step;
      const char = activeChar();
      if (!char) return;
      render(saveAttr(key, attrValue(char, key) + Number(step.dataset.dir || 0)) || activeChar());
      return;
    }
    const roll = event.target.closest('.od136-attr-roll[data-roll-attr]');
    if (roll) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const char = activeChar(); if (!char) return;
      const key = roll.dataset.rollAttr;
      const label = ATTRS.find(([k]) => k === key)?.[1] || key;
      const value = attrValue(char, key);
      if (modelOf(char) === 'pool') rollPool(label, value);
      else { try { if (typeof doRoll === 'function') doRoll(`Teste de ${label}`, 1, 20, modOf(value)); } catch (_) {} }
    }
  }, true);

  document.addEventListener('input', event => {
    const input = event.target.closest('input.od136-attr-input[data-od136-attr]');
    if (!input) return;
    event.stopPropagation();
    saveAttr(input.dataset.od136Attr, input.value);
  }, true);
  document.addEventListener('change', event => {
    const input = event.target.closest('input.od136-attr-input[data-od136-attr]');
    if (!input) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    render(saveAttr(input.dataset.od136Attr, input.value) || activeChar());
  }, true);

  const previousLoad = typeof loadCharacter === 'function' ? loadCharacter : null;
  if (previousLoad && !previousLoad.__od136Wrapped) {
    const wrapped = function od136LoadCharacterWrapper(){
      const result = previousLoad.apply(this, arguments);
      delayedRender();
      return result;
    };
    wrapped.__od136Wrapped = true;
    try { loadCharacter = wrapped; } catch (_) {}
    try { window.loadCharacter = wrapped; } catch (_) {}
  }

  window.renderAttributes = render;
  window.renderAttributesV136 = render;
  window.renderAttributesV134 = render;
  window.renderAttributesV131 = render;
  window.renderAttributesV128 = render;
  window.renderAttributesV127 = render;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', delayedRender, { once: true }); else delayedRender();
})();

/* =========================
   V137 - Correção de estabilidade da ficha/campanha
   - Defesa e Esquiva viram campos manuais e independentes.
   - Autosave não apaga perícias/itens quando a aba não está renderizada ou em modo compacto.
   - Recarregamentos da mesa não sobrescrevem a ficha aberta enquanto o usuário está editando.
   - Mesclagem online passa a ser não destrutiva para listas, perícias e links de imagem.
========================= */
(function od137SheetStabilityAndManualDefenseDodge(){
  'use strict';
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const $ = id => document.getElementById(id);
  const EDITABLE = 'input, textarea, select, [contenteditable="true"]';
  const IMAGE_KEYS = [
    'portrait','image','photo','avatar','retrato','portraitLow','portraitZero','obsIconLow','obsIconZero',
    'obsTransformPortrait','transformPortrait','discordImage','discordLink','discordAvatar','discordIcon'
  ];
  const ARRAY_KEYS = ['inventoryItems','blockInventory','abilities','spells','attacks','conditions','notes','dropItems'];
  const OBJECT_KEYS = ['skills','resistances','attrs','caster','obsIcons','portraitCrop'];
  const DIRTY_KEY = 'od137_character_dirty_until';

  function now(){ return Date.now(); }
  function num(value, fallback = 0){ const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function list(){ try { return typeof get === 'function' ? get(STORAGE.characters, []) : JSON.parse(localStorage.getItem('od_characters') || '[]'); } catch (_) { return []; } }
  function write(items){ try { if (typeof set === 'function') set(STORAGE.characters, items); else localStorage.setItem('od_characters', JSON.stringify(items)); } catch (_) {} }
  function activeId(){ try { return currentCharacterId || null; } catch (_) { return null; } }
  function current(){ try { return typeof currentChar === 'function' ? currentChar() : list().find(c => String(c.id) === String(activeId())); } catch (_) { return null; } }
  function activeEditing(){ const el = document.activeElement; return !!(el && el.matches && el.matches(EDITABLE)); }
  function dirtyMap(){ try { return JSON.parse(sessionStorage.getItem(DIRTY_KEY) || '{}'); } catch (_) { return {}; } }
  function markDirty(id = activeId(), ms = 12000){ if (!id) return; const map = dirtyMap(); map[String(id)] = now() + ms; try { sessionStorage.setItem(DIRTY_KEY, JSON.stringify(map)); } catch (_) {} }
  function isDirty(id){ const map = dirtyMap(); return Number(map[String(id)] || 0) > now(); }
  function hasValue(value){ return value !== undefined && value !== null && value !== ''; }
  function nonEmptyArray(value){ return Array.isArray(value) && value.length > 0; }
  function isPlainObject(value){ return value && typeof value === 'object' && !Array.isArray(value); }

  function mergeObjectsPreservingExisting(existing, incoming){
    if (!isPlainObject(existing)) existing = {};
    if (!isPlainObject(incoming)) return existing;
    const out = { ...existing, ...incoming };
    for (const [key, value] of Object.entries(existing)) {
      if (!hasValue(incoming[key]) && hasValue(value)) out[key] = value;
      if (isPlainObject(value) && isPlainObject(incoming[key])) out[key] = mergeObjectsPreservingExisting(value, incoming[key]);
    }
    return out;
  }

  function mergeCharacterSafe(existing = {}, incoming = {}){
    const out = { ...existing, ...incoming };

    IMAGE_KEYS.forEach(key => {
      if (!hasValue(incoming[key]) && hasValue(existing[key])) out[key] = existing[key];
    });

    ARRAY_KEYS.forEach(key => {
      if (nonEmptyArray(existing[key]) && (!Array.isArray(incoming[key]) || incoming[key].length === 0)) out[key] = existing[key];
    });

    OBJECT_KEYS.forEach(key => {
      if (isPlainObject(existing[key]) || isPlainObject(incoming[key])) out[key] = mergeObjectsPreservingExisting(existing[key], incoming[key]);
    });

    if (isPlainObject(existing.skills) || isPlainObject(incoming.skills)) {
      out.skills = mergeObjectsPreservingExisting(existing.skills || {}, incoming.skills || {});
    }

    out.updatedAt = Math.max(num(existing.updatedAt, 0), num(incoming.updatedAt, 0), out.updatedAt ? num(out.updatedAt, 0) : 0);
    return out;
  }

  function mutateActive(mutator){
    const id = activeId();
    if (!id) return null;
    const chars = list();
    const index = chars.findIndex(c => String(c.id) === String(id));
    if (index < 0) return null;
    const char = { ...chars[index] };
    mutator(char);
    char.updatedAt = now();
    chars[index] = char;
    write(chars);
    markDirty(id);
    return char;
  }

  function readInput(id, fallback, transform = v => v){
    const el = $(id);
    if (!el) return fallback;
    return transform(el.value);
  }

  function readSimpleInventorySafe(previous){
    const panel = $('simple-inventory-list');
    if (!panel || !panel.isConnected) return previous;
    const cards = [...panel.querySelectorAll('.simple-inventory-card')];
    if (cards.length === 0 && Array.isArray(previous) && previous.length > 0) return previous;
    try {
      if (typeof readSimpleInventoryFromDOM === 'function') {
        const read = readSimpleInventoryFromDOM();
        if (Array.isArray(read)) return read;
      }
    } catch (_) {}
    return cards.map(card => ({
      id: card.dataset.itemId || (typeof uid === 'function' ? uid('inv') : `inv_${now()}`),
      name: card.querySelector('[data-inv-field="name"]')?.value?.trim() || 'Item',
      weight: num(String(card.querySelector('[data-inv-field="weight"]')?.value || '0').replace(',', '.'), 0),
      uses: Math.max(0, num(card.querySelector('[data-inv-field="uses"]')?.value, 0)),
      desc: card.querySelector('[data-inv-field="desc"]')?.value?.trim() || ''
    }));
  }

  function saveSkillsSafe(char){
    char.skills = char.skills || {};
    const known = (Array.isArray(SKILLS) ? SKILLS : []).map(([name]) => name);
    known.forEach(skillName => {
      const trained = document.querySelector(`[data-skill-trained="${CSS.escape(skillName)}"], [data-od98-skill-trained="${CSS.escape(skillName)}"], [data-od88-skill-trained="${CSS.escape(skillName)}"], [data-od79-skill-trained="${CSS.escape(skillName)}"]`);
      const bonus = document.querySelector(`[data-skill-bonus="${CSS.escape(skillName)}"], [data-od98-skill-bonus="${CSS.escape(skillName)}"], [data-od88-skill-bonus="${CSS.escape(skillName)}"], [data-od79-skill-bonus="${CSS.escape(skillName)}"]`);
      const previous = char.skills[skillName] || { trained: false, bonus: 0, disadvantage: false };
      char.skills[skillName] = {
        ...previous,
        trained: trained ? !!trained.checked : !!previous.trained,
        bonus: bonus ? num(bonus.value, 0) : num(previous.bonus, 0),
        disadvantage: !!previous.disadvantage
      };
    });
  }

  function saveCardsSafe(char){
    const attackCards = [...document.querySelectorAll('.attack-card')];
    if (attackCards.length) {
      char.attacks = attackCards.map(card => ({
        name: card.querySelector('.attack-name')?.value || '',
        bonus: num(card.querySelector('.attack-bonus')?.value, 0),
        damage: card.querySelector('.attack-damage')?.value || '',
        crit: card.querySelector('.attack-crit')?.value || '',
        desc: card.querySelector('.attack-desc')?.value || ''
      }));
    }

    const spellCards = [...document.querySelectorAll('.spell-card')];
    if (spellCards.length) {
      char.spells = spellCards.map(card => ({
        name: card.querySelector('.spell-name')?.value || '',
        circle: card.querySelector('.spell-circle')?.value || '',
        exec: card.querySelector('.spell-exec')?.value || '',
        range: card.querySelector('.spell-range')?.value || '',
        cost: card.querySelector('.spell-cost')?.value || '',
        components: card.querySelector('.spell-components')?.value || '',
        description: card.querySelector('.spell-description')?.value || '',
        upgrades: card.querySelector('.spell-upgrades')?.value || ''
      }));
    }

    const abilityCards = [...document.querySelectorAll('.ability-card')];
    if (abilityCards.length) {
      char.abilities = abilityCards.map(card => {
        const costAmount = num(card.querySelector('.ability-cost-amount')?.value, 0);
        const costResource = card.querySelector('.ability-cost-resource')?.value || 'PE';
        return {
          name: card.querySelector('.ability-name')?.value || '',
          costAmount,
          costResource,
          cost: costAmount > 0 ? `${costAmount} ${costResource}` : '',
          bonus: card.querySelector('.ability-bonus')?.value || '',
          action: card.querySelector('.ability-action')?.value || 'Padrão',
          description: card.querySelector('.ability-description')?.value || ''
        };
      });
      char.abilitiesNotes = char.abilities.map(item => `${item.name || 'Habilidade'} | Custo: ${item.cost || '0 ' + (item.costResource || 'PE')} | Bônus: ${item.bonus || '-'} | Ação: ${item.action || 'Padrão'} | ${item.description || ''}`).join('\n');
    }
  }

  function saveManualDefenseDodge(char){
    char.defense = readInput('defense', char.defense ?? 10, v => num(v, char.defense ?? 10));
    char.dodge = readInput('dodge', char.dodge ?? 10, v => num(v, char.dodge ?? 10));
    char.dodgeManual = true;
    char.dodgeLocked = true;
  }

  function robustSave(){
    const before = current();
    if (!before) return;
    const char = mutateActive(c => {
      c.name = readInput('char-name', c.name || 'Ficha');
      c.race = readInput('char-race', c.race || '');
      c.className = readInput('char-class', c.className || '');
      c.origin = readInput('char-origin', c.origin || '');
      c.level = readInput('char-level', c.level || 1, v => num(v, c.level || 1));
      c.profBonus = readInput('prof-bonus', c.profBonus || 0, v => num(v, c.profBonus || 0));
      c.xp = readInput('char-xp', c.xp || 0, v => num(v, c.xp || 0));
      c.speed = readInput('char-speed', c.speed || '');
      c.portrait = readInput('portrait-url', c.portrait || c.image || c.photo || '');
      c.image = c.image || c.portrait;
      c.photo = c.photo || c.portrait;
      c.pvCurrent = readInput('pv-current', c.pvCurrent || 0, v => num(v, c.pvCurrent || 0));
      c.pvMax = readInput('pv-max', c.pvMax || 1, v => num(v, c.pvMax || 1));
      c.peCurrent = readInput('pe-current', c.peCurrent || 0, v => num(v, c.peCurrent || 0));
      c.peMax = readInput('pe-max', c.peMax || 1, v => num(v, c.peMax || 1));
      saveManualDefenseDodge(c);
      c.money = readInput('money', c.money || '0');
      c.weightMax = readInput('weight-max', c.weightMax || 0, v => num(v, c.weightMax || 0));

      const items = readSimpleInventorySafe(c.inventoryItems || []);
      c.inventoryItems = items;
      c.weightCurrent = items.reduce((sum, item) => sum + num(item.weight, 0), 0);
      c.equipmentNotes = items.map(item => `${item.name || 'Item'} | Peso: ${item.weight || 0} | Usos: ${item.uses || 0} | ${item.desc || ''}`).join('\n');
      const blockPanel = $('block-inventory-panel');
      if (blockPanel) c.blockInventoryMode = blockPanel.classList.contains('active');

      c.attrs = c.attrs || {};
      document.querySelectorAll('input[data-attr]').forEach(input => { if (input.dataset.attr) c.attrs[input.dataset.attr] = num(input.value, c.attrs[input.dataset.attr] || 1); });
      c.resistances = c.resistances || {};
      document.querySelectorAll('[data-resistance]').forEach(input => { if (input.dataset.resistance) c.resistances[input.dataset.resistance] = num(input.value, c.resistances[input.dataset.resistance] || 0); });
      saveSkillsSafe(c);
      saveCardsSafe(c);

      const casterClass = $('caster-class');
      if (casterClass) {
        c.caster = {
          ...(c.caster || {}),
          className: casterClass.value,
          identity: $('caster-identity')?.value || '',
          primary: $('affinity-primary')?.value || '',
          secondary: $('affinity-secondary')?.value || '',
          key: $('key-attribute')?.value || '',
          bonus: num($('power-bonus')?.value, 0),
          dc: num($('spell-dc')?.value, 10),
          limit: num($('power-limit')?.value, 0)
        };
      }
    });

    if (!char) return;
    try { if (typeof renderPortrait === 'function') renderPortrait(char); } catch (_) {}
    try { if (typeof updateBars === 'function') updateBars(char); } catch (_) {}
    try { if (typeof updateOverlay === 'function') updateOverlay(char); } catch (_) {}
    try { if (typeof updateDerivedStatsDisplay === 'function') updateDerivedStatsDisplay(char); } catch (_) {}
    try { if (typeof renderCharacterList === 'function') renderCharacterList(); } catch (_) {}
    try { if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char); } catch (_) {}
    return char;
  }

  function syncManualFields(char = current()){
    if (!char) return;
    const defense = $('defense');
    const dodge = $('dodge');
    if (defense && document.activeElement !== defense) defense.value = num(char.defense, 10);
    if (dodge) {
      dodge.removeAttribute('readonly');
      dodge.title = 'Campo manual independente. Não é calculado automaticamente.';
      if (document.activeElement !== dodge) dodge.value = num(char.dodge, 10);
    }
    const defenseNote = $('defense-effective-note');
    if (defenseNote) {
      defenseNote.textContent = 'Manual';
      defenseNote.classList.remove('danger');
    }
    const dodgeNote = $('dodge-formula-note');
    if (dodgeNote) {
      dodgeNote.textContent = 'Manual';
      dodgeNote.classList.remove('danger');
    }
  }

  try { calculatedDodge = function od137CalculatedDodge(char = current()){ return num(char?.dodge, 10); }; } catch (_) {}
  try { syncDodgeField = function od137SyncDodgeField(char = current()){ syncManualFields(char); }; } catch (_) {}
  window.od137SyncManualFields = syncManualFields;

  const previousUpdateDerived = typeof updateDerivedStatsDisplay === 'function' ? updateDerivedStatsDisplay : null;
  if (previousUpdateDerived && !previousUpdateDerived.__od137Manual) {
    updateDerivedStatsDisplay = function od137UpdateDerivedStatsDisplay(char = current()){
      try { previousUpdateDerived.apply(this, arguments); } catch (_) {}
      syncManualFields(char || current());
    };
    updateDerivedStatsDisplay.__od137Manual = true;
  }

  const previousSave = typeof saveCurrentCharacter === 'function' ? saveCurrentCharacter : null;
  saveCurrentCharacter = function od137SaveCurrentCharacter(){ return robustSave(); };
  saveCurrentCharacter.__od137Robust = true;
  window.saveCurrentCharacter = saveCurrentCharacter;

  if (typeof queueSave === 'function') {
    queueSave = function od137QueueSave(){
      try { clearTimeout(saveTimer); } catch (_) {}
      try { saveTimer = setTimeout(saveCurrentCharacter, 350); } catch (_) { setTimeout(saveCurrentCharacter, 350); }
    };
    window.queueSave = queueSave;
  }

  const previousLoad = typeof loadCharacter === 'function' ? loadCharacter : null;
  if (previousLoad && !previousLoad.__od137Stable) {
    loadCharacter = function od137LoadCharacter(id){
      const same = String(id || '') === String(activeId() || '');
      if (same && activeEditing()) {
        const c = current();
        try { if (typeof updateBars === 'function') updateBars(c); } catch (_) {}
        try { if (typeof updateOverlay === 'function') updateOverlay(c); } catch (_) {}
        syncManualFields(c);
        return;
      }
      const result = previousLoad.apply(this, arguments);
      setTimeout(() => syncManualFields(current()), 0);
      setTimeout(() => syncManualFields(current()), 120);
      return result;
    };
    loadCharacter.__od137Stable = true;
    window.loadCharacter = loadCharacter;
  }

  if (typeof od42MergeById === 'function' && !od42MergeById.__od137Safe) {
    const previousMerge = od42MergeById;
    od42MergeById = function od137MergeById(storageKey, items){
      if (storageKey !== STORAGE.characters) return previousMerge.apply(this, arguments);
      const currentList = list();
      const byId = new Map(currentList.map(item => [String(item.id), item]));
      (items || []).filter(Boolean).forEach(incoming => {
        const id = String(incoming.id || '');
        const existing = byId.get(id) || {};
        const editingThis = id && String(activeId() || '') === id && (activeEditing() || isDirty(id));
        if (editingThis) {
          byId.set(id, mergeCharacterSafe(incoming, existing));
        } else {
          byId.set(id, mergeCharacterSafe(existing, incoming));
        }
      });
      write([...byId.values()]);
    };
    od42MergeById.__od137Safe = true;
    window.od42MergeById = od42MergeById;
  }

  document.addEventListener('input', event => {
    if (event.target.closest('#defense,#dodge')) {
      const char = mutateActive(c => saveManualDefenseDodge(c));
      syncManualFields(char);
      try { if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char); } catch (_) {}
      event.stopPropagation();
    } else if (event.target.closest(EDITABLE)) {
      markDirty();
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target.closest('#defense,#dodge')) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const char = robustSave();
      syncManualFields(char);
    }
  }, true);

  function boot(){
    const dodge = $('dodge');
    if (dodge) dodge.removeAttribute('readonly');
    syncManualFields(current());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  [100, 500, 1200].forEach(ms => setTimeout(boot, ms));
})();


/* =========================
   V138 - auditoria/limpeza segura e botão global de duplicar ficha
   - Consolida a duplicação de ficha em uma função única.
   - Adiciona botão Duplicar nas telas novas de personagens onde ele não aparecia.
   - Evita que handlers antigos de duplicação concorram entre si.
   - Mantém compatibilidade online/offline sem depender das camadas antigas.
========================= */
(function od138AuditAndDuplicateSheet(){
  'use strict';
  if (window.__od138AuditAndDuplicateSheetInstalled) return;
  window.__od138AuditAndDuplicateSheetInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const DUP_SELECTOR = '[data-od138-duplicate-character], [data-od71-copy-character], [data-copy-account-character]';

  function $(id) { return document.getElementById(id); }
  function safeText(value, fallback = '') { return value === undefined || value === null ? fallback : String(value); }
  function safeEscape(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(safeText(value));
    return safeText(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function characters() {
    try { return typeof get === 'function' ? get(STORAGE.characters, []) : JSON.parse(localStorage.getItem('od_characters') || '[]'); }
    catch (_) { return []; }
  }
  function setCharacters(list) {
    try { if (typeof set === 'function') set(STORAGE.characters, list); else localStorage.setItem('od_characters', JSON.stringify(list)); }
    catch (_) {}
  }
  function activeUserId() { return currentUser?.id || window.currentUser?.id || null; }
  function newId(prefix = 'char') { return typeof uid === 'function' ? uid(prefix) : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
  function canUseOnline() {
    try { return typeof od42Api === 'function' && typeof od42Token === 'function' && !!od42Token(); }
    catch (_) { return false; }
  }
  function cloneDeep(value) {
    try { return structuredClone(value); } catch (_) { return JSON.parse(JSON.stringify(value)); }
  }
  function refreshMenus() {
    try { if (typeof renderAccountCharacterMenu === 'function') renderAccountCharacterMenu(); } catch (_) {}
    try { if (typeof renderAccountCharacterSidebar === 'function') renderAccountCharacterSidebar(); } catch (_) {}
    try { if (typeof renderCampaignMenu === 'function') renderCampaignMenu(); } catch (_) {}
    try { if (typeof od71RenderContent === 'function') od71RenderContent(); } catch (_) {}
    scheduleDecorate();
  }
  function scrubInternalIds(value, prefix = 'copy') {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object') {
          if ('id' in item) item.id = newId(prefix);
          scrubInternalIds(item, prefix);
        }
      });
      return;
    }
    Object.keys(value).forEach(key => {
      const child = value[key];
      if (child && typeof child === 'object') scrubInternalIds(child, prefix);
    });
  }
  function normalizeCopy(original) {
    const copy = cloneDeep(original || {});
    const oldName = safeText(original?.name || original?.characterName || 'Ficha').trim() || 'Ficha';
    copy.id = newId('char');
    copy.name = `${oldName} Cópia`;
    copy.ownerId = activeUserId() || original?.ownerId || original?.owner_id || null;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.baseCharacterId = null;
    copy.isTransformation = false;
    copy._duplicatedFrom = original?.id || null;
    delete copy.owner_id;
    delete copy.character_id;
    delete copy.table_id;
    delete copy.campaignId;
    delete copy.deletedAt;
    delete copy.deleted;
    ['inventoryItems','blockInventory','abilities','spells','attacks','conditions','dropItems'].forEach(key => scrubInternalIds(copy[key], key));
    return copy;
  }

  async function duplicateCharacter(id, options = {}) {
    const original = characters().find(c => String(c.id) === String(id));
    if (!original) return alert('Ficha não encontrada para duplicar.');
    try { if (typeof saveCurrentCharacter === 'function' && String(currentCharacterId || '') === String(id)) saveCurrentCharacter(); } catch (_) {}

    const copy = normalizeCopy(original);
    if (canUseOnline()) {
      try {
        const payload = { ...copy };
        delete payload.id; // o servidor define o ID oficial
        const data = await od42Api('/api/characters', {
          method: 'POST',
          body: JSON.stringify({ name: copy.name, data: payload })
        });
        const saved = typeof od42CharacterFromRow === 'function' ? od42CharacterFromRow(data.character) : (data.character?.data || data.character || copy);
        if (typeof od42MergeById === 'function') od42MergeById(STORAGE.characters, [saved]);
        else {
          const list = characters().filter(c => String(c.id) !== String(saved.id));
          list.push(saved);
          setCharacters(list);
        }
        if (options.open !== false) {
          currentCharacterId = saved.id;
          try { if (typeof initAccountCharacterEditor === 'function') initAccountCharacterEditor(saved.id); else if (typeof loadCharacter === 'function') loadCharacter(saved.id); } catch (_) {}
        }
        refreshMenus();
        return saved;
      } catch (error) {
        console.warn('Falha ao duplicar online; tentando cópia local:', error);
      }
    }

    const list = characters();
    list.push(copy);
    setCharacters(list);
    if (options.open !== false) {
      currentCharacterId = copy.id;
      try { if (typeof initAccountCharacterEditor === 'function') initAccountCharacterEditor(copy.id); else if (typeof loadCharacter === 'function') loadCharacter(copy.id); } catch (_) {}
    }
    refreshMenus();
    return copy;
  }

  window.od138DuplicateCharacter = duplicateCharacter;
  duplicateAccountCharacter = function od138DuplicateAccountCharacter(id) { return duplicateCharacter(id, { open: true }); };

  function addDuplicateButtonToCard(card) {
    if (!card || card.querySelector('[data-od138-duplicate-character]')) return;
    const open = card.querySelector('[data-od71-open-character], [data-open-account-character], [data-edit-account-character]');
    const del = card.querySelector('[data-od71-delete-character], [data-delete-account-character]');
    const id = open?.dataset?.od71OpenCharacter || open?.dataset?.openAccountCharacter || open?.dataset?.editAccountCharacter || del?.dataset?.od71DeleteCharacter || del?.dataset?.deleteAccountCharacter;
    if (!id) return;
    const actions = card.querySelector('.od85-card-actions, .od71-card-row.end, .account-character-actions') || del?.parentElement || open?.parentElement;
    if (!actions) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = del?.classList?.contains('od71-card-btn') ? 'od71-card-btn' : 'ghost-btn small';
    btn.dataset.od138DuplicateCharacter = id;
    btn.textContent = 'Duplicar';
    if (del && del.parentElement === actions) actions.insertBefore(btn, del);
    else actions.appendChild(btn);
  }

  function decorateDuplicateButtons() {
    document.querySelectorAll('.od71-character-card, .od85-character-card, .account-character-card').forEach(addDuplicateButtonToCard);
    document.querySelectorAll('[data-copy-account-character]').forEach(btn => {
      btn.dataset.od138DuplicateCharacter = btn.dataset.copyAccountCharacter;
      btn.removeAttribute('data-copy-account-character');
    });
  }
  let decorateTimer = null;
  function scheduleDecorate() {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(decorateDuplicateButtons, 0);
  }

  document.addEventListener('click', event => {
    const btn = event.target.closest(DUP_SELECTOR);
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const id = btn.dataset.od138DuplicateCharacter || btn.dataset.od71CopyCharacter || btn.dataset.copyAccountCharacter;
    duplicateCharacter(id, { open: true });
  }, true);

  ['renderAccountCharacterMenu','renderAccountCharacterSidebar','renderCampaignMenu'].forEach(name => {
    try {
      if (typeof globalThis[name] !== 'function' || globalThis[name].__od138Decorated) return;
      const old = globalThis[name];
      const wrapped = function(...args) {
        const out = old.apply(this, args);
        scheduleDecorate();
        return out;
      };
      wrapped.__od138Decorated = true;
      globalThis[name] = wrapped;
    } catch (_) {}
  });

  const observer = new MutationObserver(scheduleDecorate);
  function boot() {
    decorateDuplicateButtons();
    const root = $('sessions-screen') || document.body;
    if (root) observer.observe(root, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  setTimeout(boot, 250);
})();


/* =========================
   V139 - Auditoria extra: salvamento online e dados vindos da API
   - Substitui o autosave online global por timers por ficha.
   - Evita que salvar uma ficha cancele o salvamento pendente de outra.
   - Preserva createdAt/updatedAt do servidor e compara datas ISO corretamente.
   - Não deixa atualizações antigas ou incompletas apagarem arrays, perícias e imagens.
========================= */
(function od139ExtraErrorFixes(){
  'use strict';
  if (window.__od139ExtraErrorFixesInstalled) return;
  window.__od139ExtraErrorFixesInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const IMAGE_KEYS = [
    'portrait','portraitUrl','image','imageUrl','photo','photoUrl','avatar','avatarUrl','retrato','foto',
    'portraitLow','portraitZero','obsIconNormal','obsIconLow','obsIconZero','obsTransformPortrait',
    'transformPortrait','discordImage','discordLink','discordAvatar','discordIcon','logoUrl','logo_url'
  ];
  const ARRAY_KEYS = ['inventoryItems','blockInventory','abilities','spells','attacks','conditions','notes','dropItems','transformations'];
  const OBJECT_KEYS = ['skills','resistances','attrs','caster','obsIcons','portraitCrop','settings'];
  const saveTimers = new Map();

  function hasValue(value){ return value !== undefined && value !== null && value !== ''; }
  function isObj(value){ return value && typeof value === 'object' && !Array.isArray(value); }
  function toTime(value){
    if (value instanceof Date) return value.getTime() || 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const asNumber = Number(value);
      if (Number.isFinite(asNumber) && value.trim() !== '') return asNumber;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
  function list(){
    try { return typeof get === 'function' ? get(STORAGE.characters, []) : JSON.parse(localStorage.getItem('od_characters') || '[]'); }
    catch (_) { return []; }
  }
  function write(items){
    try { if (typeof set === 'function') set(STORAGE.characters, items); else localStorage.setItem('od_characters', JSON.stringify(items)); }
    catch (_) {}
  }
  function currentId(){ try { return currentCharacterId || null; } catch (_) { return null; } }
  function activeEditing(){
    const el = document.activeElement;
    return !!(el && el.matches && el.matches('input, textarea, select, [contenteditable="true"]'));
  }
  function mergeObject(existing, incoming){
    if (!isObj(existing)) existing = {};
    if (!isObj(incoming)) return existing;
    const out = { ...existing, ...incoming };
    for (const [key, value] of Object.entries(existing)) {
      if (!hasValue(incoming[key]) && hasValue(value)) out[key] = value;
      if (isObj(value) && isObj(incoming[key])) out[key] = mergeObject(value, incoming[key]);
    }
    return out;
  }
  function mergeCharacter(existing = {}, incoming = {}){
    const existingTime = toTime(existing.updatedAt || existing.updated_at);
    const incomingTime = toTime(incoming.updatedAt || incoming.updated_at);
    const incomingOlder = existingTime && incomingTime && incomingTime < existingTime;
    const out = incomingOlder ? { ...incoming, ...existing } : { ...existing, ...incoming };

    IMAGE_KEYS.forEach(key => {
      if (!hasValue(incoming[key]) && hasValue(existing[key])) out[key] = existing[key];
      if (incomingOlder && hasValue(existing[key])) out[key] = existing[key];
    });
    ARRAY_KEYS.forEach(key => {
      if (Array.isArray(existing[key]) && existing[key].length && (!Array.isArray(incoming[key]) || incoming[key].length === 0 || incomingOlder)) out[key] = existing[key];
    });
    OBJECT_KEYS.forEach(key => {
      if (isObj(existing[key]) || isObj(incoming[key])) out[key] = mergeObject(existing[key], incoming[key]);
    });
    out.updatedAt = Math.max(existingTime, incomingTime, Date.now());
    return out;
  }
  function latestCharacterSnapshot(char){
    const id = String(char?.id || '');
    if (!id) return null;
    const fromStore = list().find(c => String(c.id) === id);
    return mergeCharacter(char, fromStore || {});
  }

  if (typeof od42CharacterFromRow === 'function' && !od42CharacterFromRow.__od139Dates) {
    const previous = od42CharacterFromRow;
    od42CharacterFromRow = function od139CharacterFromRow(row){
      const char = previous.apply(this, arguments);
      if (row) {
        char.id = row.id || row.character_id || char.id;
        char.ownerId = row.owner_id || row.user_id || row.ownerId;
        char.createdAt = row.created_at || row.createdAt || char.createdAt;
        char.updatedAt = row.updated_at || row.updatedAt || char.updatedAt || Date.now();
        char.name = row.name || row.character_name || char.name;
      }
      return char;
    };
    od42CharacterFromRow.__od139Dates = true;
    window.od42CharacterFromRow = od42CharacterFromRow;
  }

  if (typeof od42MergeById === 'function' && !od42MergeById.__od139SafeMerge) {
    const previousMerge = od42MergeById;
    od42MergeById = function od139MergeById(storageKey, items){
      if (storageKey !== STORAGE.characters) return previousMerge.apply(this, arguments);
      const current = list();
      const byId = new Map(current.map(c => [String(c.id), c]));
      (items || []).filter(Boolean).forEach(incoming => {
        const id = String(incoming.id || '');
        if (!id) return;
        const existing = byId.get(id) || {};
        const editingThis = String(currentId() || '') === id && activeEditing();
        byId.set(id, editingThis ? mergeCharacter(incoming, existing) : mergeCharacter(existing, incoming));
      });
      write([...byId.values()]);
    };
    od42MergeById.__od139SafeMerge = true;
    window.od42MergeById = od42MergeById;
  }

  if (typeof od42ScheduleCharacterSave === 'function' && !od42ScheduleCharacterSave.__od139PerCharacter) {
    od42ScheduleCharacterSave = function od139ScheduleCharacterSave(char){
      try {
        const snapshot = latestCharacterSnapshot(char);
        if (!snapshot || !snapshot.id) return;
        if (typeof currentUser !== 'undefined' && currentUser?.id && snapshot.ownerId && String(snapshot.ownerId) !== String(currentUser.id)) return;
        const id = String(snapshot.id);
        clearTimeout(saveTimers.get(id));
        saveTimers.set(id, setTimeout(async () => {
          const latest = latestCharacterSnapshot(snapshot);
          if (!latest || !latest.id) return;
          try {
            const data = await od42Api(`/api/characters/${encodeURIComponent(latest.id)}`, {
              method: 'PUT',
              body: JSON.stringify({ name: latest.name || 'Ficha', data: latest })
            });
            if (data?.character && typeof od42CharacterFromRow === 'function' && typeof od42MergeById === 'function') {
              od42MergeById(STORAGE.characters, [od42CharacterFromRow(data.character)]);
            }
          } catch (error) {
            console.warn('Falha ao salvar ficha online:', error);
          } finally {
            saveTimers.delete(id);
          }
        }, 500));
      } catch (error) {
        console.warn('Falha ao agendar salvamento da ficha:', error);
      }
    };
    od42ScheduleCharacterSave.__od139PerCharacter = true;
    window.od42ScheduleCharacterSave = od42ScheduleCharacterSave;
  }
})();

/* =========================
   V140 - melhorias gerais de interface, backup e produtividade
   - Barra rápida da ficha: salvar, duplicar, exportar, backup, restaurar e busca.
   - Backups locais automáticos por ficha antes/depois de salvar.
   - Importar/exportar fichas em JSON sem alterar banco.
   - Paleta rápida Ctrl+K para navegar entre abas e executar ações comuns.
   - Indicador visual de salvamento e toasts não bloqueantes.
========================= */
(function od140GeneralImprovements(){
  'use strict';
  if (window.__od140GeneralImprovementsInstalled) return;
  window.__od140GeneralImprovementsInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const VERSION = '1.77.1';
  const BACKUP_KEY = 'od_sheet_backups_v140';
  const IMPORT_INPUT_ID = 'od140-import-json-input';
  const MAX_BACKUPS_PER_CHAR = 5;
  const TEXT_FIELDS = 'input:not([type="hidden"]), textarea, select';

  function $(id){ return document.getElementById(id); }
  function nowLabel(){ return new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }
  function safeJsonParse(raw, fallback){ try { return JSON.parse(raw); } catch (_) { return fallback; } }
  function clone(value){ try { return structuredClone(value); } catch (_) { return JSON.parse(JSON.stringify(value)); } }
  function safeEscape(value){
    if (typeof escapeHtml === 'function') return escapeHtml(value == null ? '' : String(value));
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function chars(){
    try { return typeof get === 'function' ? get(STORAGE.characters, []) : safeJsonParse(localStorage.getItem('od_characters') || '[]', []); }
    catch (_) { return []; }
  }
  function saveChars(list){
    try { if (typeof set === 'function') set(STORAGE.characters, list); else localStorage.setItem('od_characters', JSON.stringify(list)); }
    catch (_) {}
  }
  function activeChar(){
    try { return typeof currentChar === 'function' ? currentChar() : chars().find(c => String(c.id) === String(currentCharacterId || '')); }
    catch (_) { return null; }
  }
  function activeCharId(){ try { return currentCharacterId || activeChar()?.id || null; } catch (_) { return null; } }
  function newId(prefix = 'char'){ return typeof uid === 'function' ? uid(prefix) : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
  function isAppOpen(){ return $('app-screen')?.classList.contains('active'); }
  function isSessionsOpen(){ return $('sessions-screen')?.classList.contains('active'); }
  function downloadText(filename, text, type = 'application/json'){
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function notify(message, type = 'ok'){
    let wrap = $('od140-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'od140-toast-wrap';
      document.body.appendChild(wrap);
    }
    const item = document.createElement('div');
    item.className = `od140-toast ${type}`;
    item.textContent = message;
    wrap.appendChild(item);
    requestAnimationFrame(() => item.classList.add('show'));
    setTimeout(() => {
      item.classList.remove('show');
      setTimeout(() => item.remove(), 260);
    }, 2800);
  }

  function readBackupStore(){ return safeJsonParse(localStorage.getItem(BACKUP_KEY) || '{}', {}); }
  function writeBackupStore(store){
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(store)); }
    catch (error) {
      // Se estourar limite do navegador, reduz para os 3 últimos por ficha.
      try {
        Object.keys(store || {}).forEach(id => { store[id] = (store[id] || []).slice(0, 3); });
        localStorage.setItem(BACKUP_KEY, JSON.stringify(store));
      } catch (_) {}
    }
  }
  function makeBackup(char, reason = 'manual'){
    if (!char?.id) return false;
    const store = readBackupStore();
    const id = String(char.id);
    const list = Array.isArray(store[id]) ? store[id] : [];
    const clean = clone(char);
    // V141: a assinatura de backup não deve usar updatedAt/createdAt.
    // O autosave altera datas com frequência e isso criava vários backups iguais,
    // causando lentidão e risco de estourar o limite do localStorage.
    const signaturePayload = {
      name: clean.name,
      pv: clean.pvCurrent,
      pe: clean.peCurrent,
      defense: clean.defense,
      dodge: clean.dodge,
      items: clean.inventoryItems,
      skills: clean.skills,
      spells: clean.spells,
      abilities: clean.abilities,
      attacks: clean.attacks,
      conditions: clean.conditions,
      notes: clean.notes
    };
    const signature = JSON.stringify(signaturePayload);
    if (list[0]?.signature === signature && reason !== 'manual') return true;
    if (reason !== 'manual' && list[0]?.at && Date.now() - Number(list[0].at) < 1200) return true;
    list.unshift({ at: Date.now(), label: nowLabel(), reason, signature, character: clean });
    store[id] = list.slice(0, MAX_BACKUPS_PER_CHAR);
    writeBackupStore(store);
    refreshSaveStatus(`Backup salvo às ${nowLabel()}`);
    return true;
  }
  function backupsFor(id){ return (readBackupStore()[String(id || '')] || []).filter(b => b?.character); }
  function restoreBackup(id, index){
    const backups = backupsFor(id);
    const selected = backups[Number(index)];
    if (!selected?.character) return notify('Backup não encontrado.', 'warn');
    const list = chars();
    const pos = list.findIndex(c => String(c.id) === String(id));
    if (pos < 0) return notify('Ficha atual não encontrada.', 'warn');
    makeBackup(list[pos], 'antes de restaurar');
    const restored = clone(selected.character);
    restored.updatedAt = Date.now();
    list[pos] = restored;
    saveChars(list);
    try { if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(restored); } catch (_) {}
    try { if (String(activeCharId() || '') === String(id) && typeof loadCharacter === 'function') loadCharacter(id); } catch (_) {}
    try { if (typeof renderCharacterList === 'function') renderCharacterList(); } catch (_) {}
    try { if (typeof renderAccountCharacterMenu === 'function') renderAccountCharacterMenu(); } catch (_) {}
    notify('Backup restaurado.');
  }

  function refreshSaveStatus(text){
    const el = $('od140-save-status');
    if (el) el.textContent = text || `Salvo às ${nowLabel()}`;
  }
  function setSaving(){ refreshSaveStatus('Salvando...'); }
  let statusTimer = null;
  document.addEventListener('input', event => {
    if (!isAppOpen() || !event.target?.matches?.(TEXT_FIELDS)) return;
    setSaving();
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => refreshSaveStatus(`Editado às ${nowLabel()}`), 900);
  }, true);

  function exportCurrent(){
    const char = activeChar();
    if (!char?.id) return notify('Abra uma ficha para exportar.', 'warn');
    try { if (typeof saveCurrentCharacter === 'function') saveCurrentCharacter(); } catch (_) {}
    const fresh = activeChar() || char;
    makeBackup(fresh, 'exportação');
    const filename = `one-dice-ficha-${String(fresh.name || 'personagem').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'personagem'}.json`;
    downloadText(filename, JSON.stringify({ type:'one-dice-character', version: VERSION, exportedAt: new Date().toISOString(), character: fresh }, null, 2));
    notify('Ficha exportada.');
  }
  function exportAll(){
    const list = chars();
    if (!list.length) return notify('Não há fichas para exportar.', 'warn');
    downloadText(`one-dice-fichas-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ type:'one-dice-character-list', version: VERSION, exportedAt: new Date().toISOString(), characters: list }, null, 2));
    notify(`${list.length} ficha(s) exportada(s).`);
  }
  function normalizeImportedCharacter(raw){
    const char = raw?.character || raw;
    if (!char || typeof char !== 'object') return null;
    const copy = clone(char);
    const oldName = String(copy.name || copy.characterName || 'Ficha Importada').trim() || 'Ficha Importada';
    copy.id = newId('char');
    copy.name = oldName.endsWith('Importada') ? oldName : `${oldName} Importada`;
    copy.ownerId = currentUser?.id || copy.ownerId || null;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    delete copy.table_id;
    delete copy.campaignId;
    return copy;
  }
  function importJsonFile(file){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        const incoming = Array.isArray(data?.characters) ? data.characters : Array.isArray(data) ? data : [data?.character || data];
        const normalized = incoming.map(normalizeImportedCharacter).filter(Boolean);
        if (!normalized.length) return notify('Arquivo sem ficha válida.', 'warn');
        const list = chars();
        saveChars(list.concat(normalized));
        try { if (typeof renderCharacterList === 'function') renderCharacterList(); } catch (_) {}
        try { if (typeof renderAccountCharacterMenu === 'function') renderAccountCharacterMenu(); } catch (_) {}
        try { if (typeof renderAccountCharacterSidebar === 'function') renderAccountCharacterSidebar(); } catch (_) {}
        notify(`${normalized.length} ficha(s) importada(s).`);
      } catch (error) {
        notify('Não foi possível importar o JSON.', 'warn');
      } finally {
        const input = $(IMPORT_INPUT_ID);
        if (input) input.value = '';
      }
    };
    reader.readAsText(file);
  }

  function ensureImportInput(){
    let input = $(IMPORT_INPUT_ID);
    if (input) return input;
    input = document.createElement('input');
    input.id = IMPORT_INPUT_ID;
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.hidden = true;
    input.addEventListener('change', () => importJsonFile(input.files?.[0]));
    document.body.appendChild(input);
    return input;
  }

  function buildRestoreDialog(){
    let dialog = $('od140-restore-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'od140-restore-dialog';
    dialog.className = 'od-modal od140-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="modal-card od140-modal-card">
        <h2>Restaurar backup da ficha</h2>
        <p class="modal-hint">Escolha uma cópia local recente. A ficha atual será guardada antes da restauração.</p>
        <div id="od140-restore-list" class="od140-restore-list"></div>
        <div class="modal-actions">
          <button class="ghost-btn" value="cancel" type="submit">Fechar</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }
  function openRestoreDialog(){
    const char = activeChar();
    if (!char?.id) return notify('Abra uma ficha para restaurar backup.', 'warn');
    const dialog = buildRestoreDialog();
    const list = $('od140-restore-list');
    const backups = backupsFor(char.id);
    list.innerHTML = backups.length ? backups.map((b, index) => `
      <button class="od140-backup-row" type="button" data-od140-restore-index="${index}">
        <strong>${safeEscape(b.label || new Date(b.at).toLocaleString('pt-BR'))}</strong>
        <span>${safeEscape(b.reason || 'backup')} • ${safeEscape(b.character?.name || 'Ficha')}</span>
      </button>`).join('') : '<div class="od140-empty">Nenhum backup local encontrado para esta ficha ainda.</div>';
    try { dialog.showModal(); } catch (_) { dialog.setAttribute('open',''); }
  }

  function ensureQuickBar(){
    let bar = $('od140-quickbar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'od140-quickbar';
    bar.className = 'od140-quickbar hidden';
    bar.innerHTML = `
      <div class="od140-quickbar-main">
        <span id="od140-save-status" class="od140-save-status">Pronto</span>
        <button type="button" class="ghost-btn small" data-od140-action="save">Salvar</button>
        <button type="button" class="ghost-btn small" data-od140-action="duplicate">Duplicar</button>
        <button type="button" class="ghost-btn small" data-od140-action="export">Exportar</button>
        <button type="button" class="ghost-btn small" data-od140-action="backup">Backup</button>
        <button type="button" class="ghost-btn small" data-od140-action="restore">Restaurar</button>
        <button type="button" class="primary-btn small" data-od140-action="palette">Buscar / Ações</button>
      </div>`;
    document.body.appendChild(bar);
    return bar;
  }

  function ensureSessionTools(){
    const panel = $('account-sheets-panel') || $('sessions-screen');
    if (!panel || $('od140-session-tools')) return;
    const tools = document.createElement('div');
    tools.id = 'od140-session-tools';
    tools.className = 'od140-session-tools';
    tools.innerHTML = `
      <button class="ghost-btn small" type="button" data-od140-action="export-all">Exportar Fichas</button>
      <button class="ghost-btn small" type="button" data-od140-action="import">Importar JSON</button>
      <button class="ghost-btn small" type="button" data-od140-action="palette">Buscar / Ações</button>`;
    const head = panel.querySelector('.account-sheets-head') || panel.querySelector('.sessions-head') || panel;
    head.appendChild(tools);
  }

  function buildPalette(){
    let dialog = $('od140-palette-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'od140-palette-dialog';
    dialog.className = 'od140-palette od-modal';
    dialog.innerHTML = `
      <div class="od140-palette-card">
        <input id="od140-palette-input" type="search" placeholder="Buscar ação, aba ou campo..." autocomplete="off" />
        <div id="od140-palette-results" class="od140-palette-results"></div>
        <small>Atalho: Ctrl + K • Esc fecha</small>
      </div>`;
    document.body.appendChild(dialog);
    const input = $('od140-palette-input');
    input.addEventListener('input', renderPaletteResults);
    input.addEventListener('keydown', event => {
      const active = dialog.querySelector('.od140-palette-item.active');
      const items = [...dialog.querySelectorAll('.od140-palette-item')];
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const current = Math.max(0, items.indexOf(active));
        const next = event.key === 'ArrowDown' ? Math.min(items.length - 1, current + 1) : Math.max(0, current - 1);
        items.forEach(i => i.classList.remove('active'));
        items[next]?.classList.add('active');
        items[next]?.scrollIntoView({ block:'nearest' });
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        (active || items[0])?.click();
      }
    });
    return dialog;
  }
  function paletteActions(){
    const actions = [
      { label:'Salvar ficha agora', hint:'grava os campos abertos', run: () => performAction('save') },
      { label:'Duplicar ficha atual', hint:'cria uma cópia independente', run: () => performAction('duplicate') },
      { label:'Exportar ficha atual', hint:'baixa JSON da ficha', run: () => performAction('export') },
      { label:'Exportar todas as fichas', hint:'backup geral em JSON', run: () => performAction('export-all') },
      { label:'Importar fichas JSON', hint:'adiciona fichas sem apagar as atuais', run: () => performAction('import') },
      { label:'Criar backup local', hint:'guarda cópia rápida no navegador', run: () => performAction('backup') },
      { label:'Restaurar backup local', hint:'volta uma cópia recente', run: () => performAction('restore') }
    ];
    document.querySelectorAll('.sheet-tab').forEach(btn => {
      actions.push({ label:`Abrir aba: ${btn.textContent.trim()}`, hint:'navegação da ficha', run: () => btn.click() });
    });
    if (isAppOpen()) {
      document.querySelectorAll('label').forEach(label => {
        const text = label.childNodes?.[0]?.textContent?.trim?.() || label.textContent?.trim?.();
        const field = label.querySelector?.(TEXT_FIELDS);
        if (text && field) actions.push({ label:`Ir para campo: ${text}`, hint:'campo da ficha', run: () => { field.focus(); field.select?.(); } });
      });
    }
    return actions;
  }
  function renderPaletteResults(){
    const input = $('od140-palette-input');
    const out = $('od140-palette-results');
    if (!input || !out) return;
    const q = input.value.trim().toLowerCase();
    const items = paletteActions().filter(a => !q || `${a.label} ${a.hint}`.toLowerCase().includes(q)).slice(0, 24);
    out.innerHTML = items.length ? items.map((a, index) => `
      <button type="button" class="od140-palette-item ${index === 0 ? 'active' : ''}" data-od140-palette-index="${index}">
        <strong>${safeEscape(a.label)}</strong><span>${safeEscape(a.hint)}</span>
      </button>`).join('') : '<div class="od140-empty">Nada encontrado.</div>';
    out.__od140Items = items;
  }
  function openPalette(){
    const dialog = buildPalette();
    const input = $('od140-palette-input');
    if (input) input.value = '';
    renderPaletteResults();
    try { dialog.showModal(); } catch (_) { dialog.setAttribute('open',''); }
    setTimeout(() => input?.focus(), 30);
  }
  function closePalette(){ const d = $('od140-palette-dialog'); try { d?.close(); } catch (_) { d?.removeAttribute('open'); } }

  function performAction(action){
    ensureImportInput();
    const char = activeChar();
    if (action === 'save') {
      try { if (char) makeBackup(char, 'antes de salvar'); if (typeof saveCurrentCharacter === 'function') saveCurrentCharacter(); } catch (_) {}
      const fresh = activeChar();
      if (fresh) makeBackup(fresh, 'salvamento');
      refreshSaveStatus(`Salvo às ${nowLabel()}`);
      notify('Ficha salva.');
      return;
    }
    if (action === 'duplicate') {
      if (!char?.id) return notify('Abra uma ficha para duplicar.', 'warn');
      if (typeof window.od138DuplicateCharacter === 'function') window.od138DuplicateCharacter(char.id, { open: true });
      else notify('Duplicação indisponível nesta tela.', 'warn');
      return;
    }
    if (action === 'export') return exportCurrent();
    if (action === 'export-all') return exportAll();
    if (action === 'import') return $(IMPORT_INPUT_ID)?.click();
    if (action === 'backup') {
      if (!char?.id) return notify('Abra uma ficha para criar backup.', 'warn');
      try { if (typeof saveCurrentCharacter === 'function') saveCurrentCharacter(); } catch (_) {}
      makeBackup(activeChar() || char, 'manual');
      notify('Backup local criado.');
      return;
    }
    if (action === 'restore') return openRestoreDialog();
    if (action === 'palette') return openPalette();
  }

  function refreshUi(){
    const bar = ensureQuickBar();
    bar.classList.toggle('hidden', !isAppOpen());
    if (isSessionsOpen()) ensureSessionTools();
  }

  // Backups automáticos: envolve saveCurrentCharacter sem alterar a regra original de salvamento.
  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od140Backups) {
    const previousSave = saveCurrentCharacter;
    saveCurrentCharacter = function od140SaveCurrentCharacterWithBackup(...args){
      const before = activeChar();
      if (before?.id) makeBackup(before, 'antes de salvar');
      const result = previousSave.apply(this, args);
      const after = activeChar();
      if (after?.id) makeBackup(after, 'salvamento');
      refreshSaveStatus(`Salvo às ${nowLabel()}`);
      return result;
    };
    saveCurrentCharacter.__od140Backups = true;
    window.saveCurrentCharacter = saveCurrentCharacter;
  }

  // Garante que a interface reapareça depois de renders antigos.
  ['showApp','showSessions','renderAccountCharacterMenu','renderAccountCharacterSidebar','renderCharacterList','loadCharacter'].forEach(name => {
    try {
      if (typeof globalThis[name] !== 'function' || globalThis[name].__od140UiRefresh) return;
      const old = globalThis[name];
      const wrapped = function(...args){
        const out = old.apply(this, args);
        setTimeout(refreshUi, 0);
        return out;
      };
      wrapped.__od140UiRefresh = true;
      globalThis[name] = wrapped;
    } catch (_) {}
  });

  document.addEventListener('click', event => {
    const actionBtn = event.target.closest('[data-od140-action]');
    if (actionBtn) {
      event.preventDefault();
      performAction(actionBtn.dataset.od140Action);
      return;
    }
    const restoreBtn = event.target.closest('[data-od140-restore-index]');
    if (restoreBtn) {
      event.preventDefault();
      const id = activeCharId();
      restoreBackup(id, restoreBtn.dataset.od140RestoreIndex);
      try { $('od140-restore-dialog')?.close(); } catch (_) {}
      return;
    }
    const paletteBtn = event.target.closest('[data-od140-palette-index]');
    if (paletteBtn) {
      const items = $('od140-palette-results')?.__od140Items || [];
      const item = items[Number(paletteBtn.dataset.od140PaletteIndex)];
      closePalette();
      setTimeout(() => item?.run?.(), 0);
    }
  }, true);

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
      event.preventDefault();
      openPalette();
    }
  });

  window.addEventListener('beforeunload', () => {
    const char = activeChar();
    if (char?.id) makeBackup(char, 'ao sair');
  });

  const observer = new MutationObserver(() => refreshUi());
  let observerStarted = false;
  function boot(){
    ensureImportInput();
    ensureQuickBar();
    ensureSessionTools();
    refreshUi();
    if (!observerStarted && document.body) {
      observerStarted = true;
      observer.observe(document.body, { childList:true, subtree:true });
    }
    refreshSaveStatus(`One Dice ${VERSION}`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  setTimeout(boot, 400);
  setTimeout(boot, 1400);
})();


/* =========================
   V141 - correções de auditoria da v140
   - Diagnóstico único de versão.
   - Limpeza preventiva de backups antigos em excesso.
   - Avisos leves no console para campos duplicados críticos.
========================= */
(function od141AuditHardening(){
  'use strict';
  if (window.__od141AuditHardeningInstalled) return;
  window.__od141AuditHardeningInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  function pruneBackups(){
    try {
      const key = 'od_sheet_backups_v140';
      const store = JSON.parse(localStorage.getItem(key) || '{}');
      let changed = false;
      Object.keys(store || {}).forEach(id => {
        const list = Array.isArray(store[id]) ? store[id] : [];
        const seen = new Set();
        const clean = [];
        for (const item of list) {
          const sig = item?.signature || JSON.stringify({ at:item?.at, name:item?.character?.name });
          if (seen.has(sig)) continue;
          seen.add(sig);
          clean.push(item);
        }
        if (clean.length !== list.length || clean.length > 8) changed = true;
        store[id] = clean.slice(0, 8);
      });
      if (changed) localStorage.setItem(key, JSON.stringify(store));
    } catch (_) {}
  }

  function diagnoseDom(){
    try {
      ['defense','dodge'].forEach(id => {
        const nodes = document.querySelectorAll(`#${CSS.escape(id)}`);
        if (nodes.length > 1) console.warn(`[One Dice v1.42] Campo duplicado no DOM: #${id} (${nodes.length}).`);
      });
    } catch (_) {}
  }

  function boot(){
    pruneBackups();
    diagnoseDom();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  setTimeout(boot, 1000);
})();

/* =========================
   V142 - limpeza final e integridade
   - Remove duplicatas visuais criadas por renders antigos.
   - Unifica o rótulo de versão.
   - Evita restauração/diagnóstico repetido no mesmo ciclo.
========================= */
(function od142FinalCleanup(){
  'use strict';
  if (window.__od142FinalCleanupInstalled) return;
  window.__od142FinalCleanupInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  function keepFirst(selector){
    const nodes = Array.from(document.querySelectorAll(selector));
    nodes.slice(1).forEach(node => node.remove());
  }

  function cleanupUiDuplicates(){
    try {
      keepFirst('#od140-quickbar');
      keepFirst('#od140-command-palette');
      keepFirst('#od140-restore-dialog');
      keepFirst('#od140-import-file');
      keepFirst('#obs-copy-link-btn');
    } catch (_) {}
  }

  function normalizeDuplicateButtons(){
    try {
      document.querySelectorAll('[data-copy-account-character]').forEach(button => {
        if (!button.dataset.od138DuplicateCharacter) button.dataset.od138DuplicateCharacter = button.dataset.copyAccountCharacter;
        button.removeAttribute('data-copy-account-character');
      });
      document.querySelectorAll('[data-od138-duplicate-character]').forEach(button => {
        button.textContent = button.textContent?.trim() || 'Duplicar';
        button.type = 'button';
      });
    } catch (_) {}
  }

  function normalizeCriticalInputs(){
    try {
      ['defense', 'dodge'].forEach(id => {
        const inputs = Array.from(document.querySelectorAll(`#${CSS.escape(id)}`));
        inputs.slice(1).forEach(input => {
          input.removeAttribute('id');
          input.dataset.od142RemovedDuplicateId = id;
        });
        if (inputs[0]) {
          inputs[0].removeAttribute('readonly');
          inputs[0].dataset.manualOnly = 'true';
        }
      });
    } catch (_) {}
  }

  let cleanupPending = false;
  function cleanup(){
    if (cleanupPending) return;
    cleanupPending = true;
    requestAnimationFrame(() => {
      cleanupPending = false;
      cleanupUiDuplicates();
      normalizeDuplicateButtons();
      normalizeCriticalInputs();
    });
  }

  const observer = new MutationObserver(cleanup);
  function boot(){
    cleanup();
    if (document.body && !observer.__od142Started) {
      observer.__od142Started = true;
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  setTimeout(boot, 300);
  setTimeout(boot, 1200);
})();


/* =========================
   V148 - rollback seguro pós-V143
   Base: V142 estável.
   Mantém apenas correções de baixo risco:
   - Oculta textos auxiliares de Defesa/Esquiva.
   - Garante limite de 5 backups por ficha.
   - Não mexe em initApp/showApp/enterCampaign/initAccountCharacterEditor.
========================= */
(function od148SafeRollbackPatch(){
  'use strict';
  if (window.__od148SafeRollbackPatchInstalled) return;
  window.__od148SafeRollbackPatchInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';
  const BACKUP_KEY = 'od_sheet_backups_v140';
  function hideManualNotes(){
    ['defense-effective-note','dodge-formula-note'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = '';
      el.classList.remove('danger');
      el.setAttribute('aria-hidden','true');
      el.style.display = 'none';
    });
  }
  function pruneBackups(){
    try {
      const store = JSON.parse(localStorage.getItem(BACKUP_KEY) || '{}');
      let changed = false;
      Object.keys(store || {}).forEach(id => {
        const list = Array.isArray(store[id]) ? store[id] : [];
        const clean = [];
        const seen = new Set();
        for (const item of list) {
          const sig = item && (item.signature || JSON.stringify(item.character || {}));
          if (sig && seen.has(sig)) continue;
          if (sig) seen.add(sig);
          clean.push(item);
        }
        if (clean.length !== list.length || clean.length > 5) changed = true;
        store[id] = clean.slice(0, 5);
      });
      if (changed) localStorage.setItem(BACKUP_KEY, JSON.stringify(store));
    } catch (_) {}
  }
  function boot(){ hideManualNotes(); pruneBackups(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  [80, 300, 1000, 2000].forEach(ms => setTimeout(boot, ms));
  try { new MutationObserver(hideManualNotes).observe(document.body, {childList:true, subtree:true}); } catch (_) {}
})();


/* =========================
   V152 - estabilização pós-rebuild
   Base: v1.48 estável. Não troca o layout.
   - Mantém o layout aprovado do index/style antigos.
   - Defesa e Esquiva ficam realmente independentes, sem espelhamento posterior.
   - Ficha aberta em Personagens força modo de ficha avulsa.
   - Barra rápida fica recolhida por padrão e pode ser alternada pelo menu.
   - Perfil da sessão passa a abrir configurações da conta.
   - Reduz flicker evitando redesenho da lista lateral enquanto campos da ficha estão ativos.
========================= */
(function od152StableLayoutFixes(){
  'use strict';
  if (window.__od152StableLayoutFixesInstalled) return;
  window.__od152StableLayoutFixesInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const $ = id => document.getElementById(id);
  const n = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const readChars = () => {
    try { return typeof get === 'function' ? get(STORAGE.characters, []) : JSON.parse(localStorage.getItem(STORAGE.characters) || '[]'); }
    catch (_) { return []; }
  };
  const writeChars = chars => {
    try { if (typeof set === 'function') set(STORAGE.characters, chars); else localStorage.setItem(STORAGE.characters, JSON.stringify(chars)); }
    catch (_) {}
  };
  const activeCharId = () => {
    try { return typeof activeId === 'function' ? activeId() : currentCharacterId; }
    catch (_) { return window.currentCharacterId || null; }
  };
  const activeChar = () => {
    try { return typeof current === 'function' ? current() : readChars().find(c => String(c.id) === String(activeCharId())); }
    catch (_) { return null; }
  };
  const setActiveManualValues = (changes = {}) => {
    const id = activeCharId();
    if (!id) return activeChar();
    const chars = readChars();
    const index = chars.findIndex(c => String(c.id) === String(id));
    if (index < 0) return activeChar();
    const char = { ...chars[index], ...changes, dodgeManual: true, dodgeLocked: true };
    chars[index] = char;
    writeChars(chars);
    try { if (typeof markDirty === 'function') markDirty(id); } catch (_) {}
    return char;
  };

  function hideManualNotes(){
    ['defense-effective-note','dodge-formula-note'].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.textContent = '';
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
      el.classList.remove('danger');
    });
  }

  function syncDefenseDodgeFromCharacter(char = activeChar()){
    if (!char) return;
    const defense = $('defense');
    const dodge = $('dodge');
    if (defense) {
      defense.removeAttribute('readonly');
      defense.dataset.manualOnly = 'true';
      if (document.activeElement !== defense) defense.value = n(char.defense ?? char.defesa, 10);
    }
    if (dodge) {
      dodge.removeAttribute('readonly');
      dodge.dataset.manualOnly = 'true';
      if (document.activeElement !== dodge) dodge.value = n(char.dodge, 10);
    }
    hideManualNotes();
  }

  try { calculatedDodge = function od152CalculatedDodge(char = activeChar()){ return n(char?.dodge, 10); }; } catch (_) {}
  try { syncDodgeField = function od152SyncDodgeField(char = activeChar()){ syncDefenseDodgeFromCharacter(char); }; } catch (_) {}
  try { window.calculatedDodge = calculatedDodge; window.syncDodgeField = syncDodgeField; } catch (_) {}
  window.od152SyncDefenseDodge = syncDefenseDodgeFromCharacter;

  let manualEditLock = false;
  function handleDefenseDodgeInput(event){
    const target = event.target;
    if (!target || (target.id !== 'defense' && target.id !== 'dodge')) return;
    const before = activeChar() || {};
    const currentDefense = before.defense ?? before.defesa ?? $('defense')?.value ?? 10;
    const currentDodge = before.dodge ?? $('dodge')?.value ?? 10;
    const changes = target.id === 'defense'
      ? { defense: n(target.value, n(currentDefense, 10)), dodge: n(currentDodge, 10) }
      : { defense: n(currentDefense, 10), dodge: n(target.value, n(currentDodge, 10)) };
    manualEditLock = true;
    const char = setActiveManualValues(changes);
    // Restaura o campo oposto depois dos handlers legados que rodam via setTimeout.
    setTimeout(() => {
      syncDefenseDodgeFromCharacter(char || activeChar());
      manualEditLock = false;
      try { if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(char || activeChar()); }
      catch (_) {}
    }, 0);
    setTimeout(() => syncDefenseDodgeFromCharacter(activeChar()), 80);
  }
  document.addEventListener('input', handleDefenseDodgeInput, true);
  document.addEventListener('change', handleDefenseDodgeInput, true);

  // Evita flicker: enquanto há edição em campo da ficha, não redesenha lista lateral inteira.
  if (typeof renderCharacterList === 'function' && !renderCharacterList.__od152NoFlicker) {
    const baseRenderCharacterList = renderCharacterList;
    renderCharacterList = function od152RenderCharacterList(){
      const active = document.activeElement;
      if (manualEditLock || active?.matches?.('input, textarea, select, [contenteditable="true"]')) {
        const sidebar = $('character-list');
        if (sidebar && sidebar.children.length) return;
      }
      return baseRenderCharacterList.apply(this, arguments);
    };
    renderCharacterList.__od152NoFlicker = true;
    try { window.renderCharacterList = renderCharacterList; } catch (_) {}
  }

  // Abrir ficha pela aba Personagens nunca deve manter a mesa ativa.
  if (typeof initAccountCharacterEditor === 'function' && !initAccountCharacterEditor.__od152AccountOnly) {
    const baseInitAccountCharacterEditor = initAccountCharacterEditor;
    initAccountCharacterEditor = function od152InitAccountCharacterEditor(charId = null){
      try { accountSheetMode = true; } catch (_) {}
      try { currentCampaignId = null; } catch (_) {}
      try { localStorage.removeItem(STORAGE.activeCampaign); } catch (_) {}
      const result = baseInitAccountCharacterEditor.apply(this, arguments);
      setTimeout(() => {
        try { accountSheetMode = true; currentCampaignId = null; localStorage.removeItem(STORAGE.activeCampaign); } catch (_) {}
        try { $('current-user-label').textContent = `${userDisplayName(currentUser)} • Minhas Fichas`; } catch (_) {}
        try { const title = $('sidebar-title'); if (title) title.textContent = 'Minhas Fichas'; } catch (_) {}
        try { if (typeof renderAccountCharacterSidebar === 'function') renderAccountCharacterSidebar(); } catch (_) {}
        try { if (charId && String(activeCharId()) !== String(charId) && typeof loadCharacter === 'function') loadCharacter(charId); } catch (_) {}
        syncDefenseDodgeFromCharacter(activeChar());
      }, 0);
      return result;
    };
    initAccountCharacterEditor.__od152AccountOnly = true;
    try { window.initAccountCharacterEditor = initAccountCharacterEditor; } catch (_) {}
  }

  function setupQuickbar(){
    const bar = $('od140-quickbar');
    const visible = localStorage.getItem('od154_quickbar_visible') === '1';
    if (bar) {
      bar.classList.toggle('hidden', !visible);
      bar.classList.toggle('od154-open', visible);
      bar.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }
    const panel = $('sessions-menu-panel');
    if (panel && !$('od154-toggle-quickbar')) {
      const btn = document.createElement('button');
      btn.id = 'od154-toggle-quickbar';
      btn.type = 'button';
      btn.className = 'ghost-btn menu-entry';
      btn.textContent = visible ? 'Ocultar barra de ações' : 'Mostrar barra de ações';
      btn.addEventListener('click', () => {
        const targetBar = $('od140-quickbar');
        const willShow = !(targetBar && targetBar.classList.contains('od154-open'));
        if (targetBar) {
          targetBar.classList.toggle('hidden', !willShow);
          targetBar.classList.toggle('od154-open', willShow);
          targetBar.setAttribute('aria-hidden', willShow ? 'false' : 'true');
        }
        localStorage.setItem('od154_quickbar_visible', willShow ? '1' : '0');
        btn.textContent = willShow ? 'Ocultar barra de ações' : 'Mostrar barra de ações';
      });
      const logout = $('sessions-logout');
      if (logout) panel.insertBefore(btn, logout); else panel.appendChild(btn);
    }
  }

  function setupSessionProfile(){
    const label = $('current-user-label');
    if (!label || label.__od152ProfileClickable) return;
    label.__od152ProfileClickable = true;
    label.style.cursor = 'pointer';
    label.title = 'Abrir configurações da conta';
    label.addEventListener('click', () => {
      const btn = $('open-account-settings-btn') || $('od71-account-btn');
      if (btn) btn.click();
    });
  }

  function boot(){
    hideManualNotes();
    setupQuickbar();
    setupSessionProfile();
    syncDefenseDodgeFromCharacter(activeChar());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  [100, 400, 1200, 2500].forEach(ms => setTimeout(boot, ms));
})();


/* =========================
   V155 - Estabilidade visual da sessão
   - Personagens da mesa podem ser recolhidos.
   - Evita re-render/flicker quando os dados da mesa não mudaram.
   - Não altera boot, login, ficha, defesa/esquiva ou layout base.
========================= */
(function od155SessionDashboardStability(){
  'use strict';
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const STORE_PREFIX = 'od155_dashboard_collapsed_';
  const lastSig = { player: '', master: '' };
  const lastAt = { player: 0, master: 0 };
  const MIN_RERENDER_MS = 900;

  function esc(value){
    try { return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? ''); }
    catch (_) { return String(value ?? ''); }
  }
  function campaignKey(){
    try { return String(currentCampaignId || 'global'); } catch (_) { return 'global'; }
  }
  function storeKey(kind){ return STORE_PREFIX + kind + '_' + campaignKey(); }
  function collapsed(kind){
    try { return localStorage.getItem(storeKey(kind)) === '1'; } catch (_) { return false; }
  }
  function setCollapsed(kind, value){
    try { localStorage.setItem(storeKey(kind), value ? '1' : '0'); } catch (_) {}
  }
  function getCampaignChars(){
    try { return typeof charactersInCurrentCampaign === 'function' ? charactersInCurrentCampaign() : []; }
    catch (_) { return []; }
  }
  function charCondition(c){
    try { return typeof v35CharCondition === 'function' ? v35CharCondition(c) : (c?.condition || c?.status || 'Normal'); }
    catch (_) { return c?.condition || c?.status || 'Normal'; }
  }
  function signature(){
    return getCampaignChars().map(c => [
      c?.id, c?.name, c?.portrait, c?.race, c?.className, c?.level,
      c?.pvCurrent, c?.pvMax, c?.peCurrent, c?.peMax, charCondition(c),
      Array.isArray(c?.conditions) ? c.conditions.join('|') : ''
    ].join('~')).join('||');
  }
  function panelFor(kind){
    return document.getElementById(kind === 'master' ? 'master-dashboard' : 'player-dashboard');
  }
  function gridFor(kind){
    return document.getElementById(kind === 'master' ? 'master-characters-grid' : 'public-party-grid');
  }
  function ensureButton(kind){
    const panel = panelFor(kind);
    if (!panel) return;
    const head = panel.querySelector('.dashboard-head') || panel.firstElementChild;
    if (!head) return;
    let actions = head.querySelector('.od155-dashboard-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'od155-dashboard-actions';
      head.appendChild(actions);
    }
    let btn = actions.querySelector(`[data-od155-dashboard-toggle="${kind}"]`);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ghost-btn small od155-dashboard-toggle';
      btn.dataset.od155DashboardToggle = kind;
      actions.appendChild(btn);
    }
    const isCollapsed = collapsed(kind);
    btn.textContent = isCollapsed ? 'Mostrar personagens' : 'Reduzir aba';
    btn.setAttribute('aria-expanded', String(!isCollapsed));
    btn.title = isCollapsed ? 'Mostrar personagens da mesa' : 'Recolher personagens da mesa';
  }
  function applyCollapsed(kind){
    const panel = panelFor(kind);
    const grid = gridFor(kind);
    if (!panel) return;
    const isCollapsed = collapsed(kind);
    panel.classList.toggle('od155-dashboard-collapsed', isCollapsed);
    if (grid) grid.hidden = isCollapsed;
    ensureButton(kind);
  }
  function canSkip(kind, sig){
    const now = Date.now();
    if (lastSig[kind] !== sig) return false;
    if (now - lastAt[kind] < MIN_RERENDER_MS) return true;
    // Se nada mudou, não re-renderiza. Isso impede a piscada de atualizações online repetidas.
    return true;
  }
  function mark(kind, sig){
    lastSig[kind] = sig;
    lastAt[kind] = Date.now();
  }
  function wrapDashboard(kind, fnName){
    const previous = window[fnName] || (typeof globalThis !== 'undefined' ? globalThis[fnName] : null);
    if (typeof previous !== 'function' || previous.__od155Wrapped) return;
    const wrapped = function od155DashboardWrapper(){
      const sig = signature();
      const panel = panelFor(kind);
      const grid = gridFor(kind);
      if (panel && grid && canSkip(kind, sig)) {
        applyCollapsed(kind);
        return;
      }
      const result = previous.apply(this, arguments);
      mark(kind, sig);
      applyCollapsed(kind);
      return result;
    };
    wrapped.__od155Wrapped = true;
    try { window[fnName] = wrapped; } catch (_) {}
    try { eval(fnName + ' = wrapped'); } catch (_) {}
  }

  wrapDashboard('player', 'renderPlayerDashboard');
  wrapDashboard('master', 'renderMasterDashboard');

  document.addEventListener('click', function(event){
    const btn = event.target.closest('[data-od155-dashboard-toggle]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const kind = btn.dataset.od155DashboardToggle || 'player';
    setCollapsed(kind, !collapsed(kind));
    applyCollapsed(kind);
  }, true);

  const previousRenderTableExperience = typeof renderTableExperience === 'function' ? renderTableExperience : null;
  if (previousRenderTableExperience && !previousRenderTableExperience.__od155Wrapped) {
    const wrappedTable = function od155RenderTableExperienceWrapper(){
      const before = signature();
      const result = previousRenderTableExperience.apply(this, arguments);
      applyCollapsed('player');
      applyCollapsed('master');
      const after = signature();
      if (before === after) {
        // Mantém a assinatura para evitar outro re-render idêntico logo em seguida.
        mark('player', after);
        mark('master', after);
      }
      return result;
    };
    wrappedTable.__od155Wrapped = true;
    try { renderTableExperience = wrappedTable; window.renderTableExperience = wrappedTable; } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', function(){
    applyCollapsed('player');
    applyCollapsed('master');
  });
  setTimeout(function(){ applyCollapsed('player'); applyCollapsed('master'); }, 250);
})();

/* =========================
   V156 - proteção contra perda de dados de outros jogadores
   - O cliente do mestre não faz autosave de fichas que não pertencem a ele.
   - Atualizações online recebidas preservam perícias/habilidades/listas existentes quando o pacote vem incompleto.
   - O servidor também faz merge não destrutivo, mas esta camada evita disparos perigosos do navegador.
========================= */
(function od156ProtectOtherPlayersSheets(){
  'use strict';
  if (window.__od156ProtectOtherPlayersSheetsInstalled) return;
  window.__od156ProtectOtherPlayersSheetsInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const PROTECTED_ARRAYS = ['inventoryItems','blockInventory','abilities','spells','attacks','conditions','transformations','dropItems'];
  const PROTECTED_OBJECTS = ['skills','resistances','attrs','caster','obsIcons','portraitCrop','settings'];
  const PROTECTED_TEXTS = ['abilitiesNotes','equipmentNotes'];

  function isObj(value){ return value && typeof value === 'object' && !Array.isArray(value); }
  function hasArray(value){ return Array.isArray(value) && value.length > 0; }
  function hasObj(value){ return isObj(value) && Object.keys(value).length > 0; }
  function currentUserId(){ try { return currentUser?.id || window.currentUser?.id || null; } catch (_) { return null; } }
  function charOwnerId(char){ return char?.ownerId || char?.owner_id || char?.userId || char?.user_id || null; }
  function isOwnedByMe(char){
    const me = currentUserId();
    const owner = charOwnerId(char);
    return !!(char && me && owner && String(owner) === String(me));
  }
  function characters(){
    try { return typeof get === 'function' ? get(STORAGE.characters, []) : JSON.parse(localStorage.getItem('od_characters') || '[]'); }
    catch (_) { return []; }
  }
  function setCharacters(list){
    try { if (typeof set === 'function') set(STORAGE.characters, list); else localStorage.setItem('od_characters', JSON.stringify(list)); }
    catch (_) {}
  }
  function mergeObj(existing = {}, incoming = {}){
    const out = { ...(isObj(existing) ? existing : {}), ...(isObj(incoming) ? incoming : {}) };
    if (isObj(existing) && isObj(incoming)) {
      for (const [key, value] of Object.entries(existing)) {
        if (isObj(value) && isObj(incoming[key])) out[key] = mergeObj(value, incoming[key]);
        else if ((incoming[key] === undefined || incoming[key] === null || incoming[key] === '') && value !== undefined && value !== null && value !== '') out[key] = value;
      }
    }
    return out;
  }
  function mergeChar(existing = {}, incoming = {}){
    const out = { ...existing, ...incoming };
    PROTECTED_ARRAYS.forEach(key => {
      if (hasArray(existing[key]) && !hasArray(incoming[key])) out[key] = existing[key];
    });
    PROTECTED_OBJECTS.forEach(key => {
      if (hasObj(existing[key]) || hasObj(incoming[key])) out[key] = mergeObj(existing[key] || {}, incoming[key] || {});
    });
    PROTECTED_TEXTS.forEach(key => {
      if (typeof existing[key] === 'string' && existing[key].trim() && !(typeof incoming[key] === 'string' && incoming[key].trim())) out[key] = existing[key];
    });
    return out;
  }

  // Impede que qualquer chamada automática salve ficha de outro jogador pelo navegador do mestre.
  if (typeof od44SaveCharacterOnline === 'function' && !od44SaveCharacterOnline.__od156OwnerOnly) {
    const previous = od44SaveCharacterOnline;
    od44SaveCharacterOnline = async function od156SaveCharacterOnlineOwnerOnly(char){
      if (!char?.id) return;
      if (!isOwnedByMe(char)) {
        console.warn('[One Dice v156] Autosave bloqueado em ficha de outro jogador:', char.name || char.id);
        return;
      }
      return previous.apply(this, arguments);
    };
    od44SaveCharacterOnline.__od156OwnerOnly = true;
    window.od44SaveCharacterOnline = od44SaveCharacterOnline;
  }

  if (typeof od42ScheduleCharacterSave === 'function' && !od42ScheduleCharacterSave.__od156OwnerOnly) {
    const previous = od42ScheduleCharacterSave;
    od42ScheduleCharacterSave = function od156ScheduleCharacterSaveOwnerOnly(char){
      if (!char?.id) return;
      if (!isOwnedByMe(char)) return;
      return previous.apply(this, arguments);
    };
    od42ScheduleCharacterSave.__od156OwnerOnly = true;
    window.od42ScheduleCharacterSave = od42ScheduleCharacterSave;
  }

  // Merge local não destrutivo para fichas recebidas via mesa/socket.
  if (typeof od42MergeById === 'function' && !od42MergeById.__od156ProtectedMerge) {
    const previousMerge = od42MergeById;
    od42MergeById = function od156MergeById(storageKey, items){
      if (storageKey !== STORAGE.characters) return previousMerge.apply(this, arguments);
      const current = characters();
      const byId = new Map(current.map(c => [String(c.id), c]));
      (items || []).filter(Boolean).forEach(incoming => {
        const id = String(incoming.id || '');
        if (!id) return;
        const existing = byId.get(id) || {};
        byId.set(id, mergeChar(existing, incoming));
      });
      setCharacters([...byId.values()]);
    };
    od42MergeById.__od156ProtectedMerge = true;
    window.od42MergeById = od42MergeById;
  }
})();


/* =========================
   V157 - proteção definitiva contra perda de perícias e habilidades
   - Corrige apagamento também fora de sessão.
   - Preserva dados quando a aba/DOM não está renderizada no momento do autosave.
   - Marca quais perícias estavam realmente presentes na tela para o servidor não interpretar ausência como zerar tudo.
========================= */
(function od157ProtectOwnSheetPartialAutosave(){
  'use strict';
  if (window.__od157ProtectOwnSheetPartialAutosaveInstalled) return;
  window.__od157ProtectOwnSheetPartialAutosaveInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  function clone(value){
    try { return structuredClone(value); } catch (_) {
      try { return JSON.parse(JSON.stringify(value)); } catch (__) { return value; }
    }
  }
  function getChars(){
    try { return (typeof get === 'function' && typeof STORAGE !== 'undefined') ? get(STORAGE.characters, []) : []; }
    catch (_) { return []; }
  }
  function findChar(id){ return getChars().find(c => String(c?.id) === String(id)); }
  function hasMeaningfulSkill(skill){
    if (!skill || typeof skill !== 'object') return false;
    if (skill.trained === true || skill.disadvantage === true) return true;
    if (Number(skill.bonus || 0) !== 0) return true;
    if (typeof skill.notes === 'string' && skill.notes.trim()) return true;
    return false;
  }
  function hasMeaningfulObject(obj){
    return obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length > 0;
  }
  function hasMeaningfulArray(arr){ return Array.isArray(arr) && arr.length > 0; }
  function activeTabName(){
    const active = document.querySelector('.sheet-tab.active[data-tab], .tab-btn.active[data-tab], [data-tab].active');
    return active?.dataset?.tab || '';
  }
  function isPanelActive(id){
    const panel = document.getElementById(id);
    return !!panel && panel.classList.contains('active');
  }
  function presentSkillNames(){
    return new Set([...document.querySelectorAll('[data-skill-trained], [data-skill-bonus]')]
      .map(el => el.dataset.skillTrained || el.dataset.skillBonus)
      .filter(Boolean));
  }
  function restoreSkills(target, before, present){
    if (!target || !before?.skills) return;
    target.skills = target.skills || {};
    const keys = new Set([...Object.keys(before.skills || {}), ...Object.keys(target.skills || {})]);
    const activePericias = activeTabName() === 'pericias' || isPanelActive('tab-pericias');

    // Se a aba de perícias nem estava renderizada, nenhum autosave pode zerar perícias.
    if (!present.size && !activePericias) {
      target.skills = clone(before.skills);
      return;
    }

    keys.forEach(name => {
      const oldSkill = before.skills?.[name];
      const newSkill = target.skills?.[name];
      if (!oldSkill) return;
      if (!present.has(name)) {
        target.skills[name] = clone(oldSkill);
        return;
      }
      // Proteção extra: se uma perícia que tinha valor real voltou para padrão sem a aba estar ativa, preserva.
      const newLooksDefault = newSkill && newSkill.trained !== true && newSkill.disadvantage !== true && Number(newSkill.bonus || 0) === 0;
      if (!activePericias && hasMeaningfulSkill(oldSkill) && newLooksDefault) target.skills[name] = clone(oldSkill);
    });
  }
  function restoreListIfTabWasNotActive(target, before, key, panelId, tabName){
    if (!target || !before) return;
    const active = activeTabName() === tabName || isPanelActive(panelId);
    if (active) return;
    if (hasMeaningfulArray(before[key]) && !hasMeaningfulArray(target[key])) target[key] = clone(before[key]);
  }
  function restoreTextIfTabWasNotActive(target, before, key, panelId, tabName){
    if (!target || !before) return;
    const active = activeTabName() === tabName || isPanelActive(panelId);
    if (active) return;
    if (typeof before[key] === 'string' && before[key].trim() && !(typeof target[key] === 'string' && target[key].trim())) target[key] = before[key];
  }
  function repairCurrentAfterPartialSave(before, present){
    if (!before?.id || typeof updateChar !== 'function') return;
    try {
      updateChar(char => {
        if (!char || String(char.id) !== String(before.id)) return;
        restoreSkills(char, before, present);
        restoreListIfTabWasNotActive(char, before, 'abilities', 'tab-habilidades', 'habilidades');
        restoreTextIfTabWasNotActive(char, before, 'abilitiesNotes', 'tab-habilidades', 'habilidades');
        restoreListIfTabWasNotActive(char, before, 'spells', 'tab-magias', 'magias');
        restoreListIfTabWasNotActive(char, before, 'attacks', 'tab-combate', 'combate');
        restoreListIfTabWasNotActive(char, before, 'inventoryItems', 'tab-equipamentos', 'equipamentos');
        restoreTextIfTabWasNotActive(char, before, 'equipmentNotes', 'tab-equipamentos', 'equipamentos');
        if (hasMeaningfulObject(before.caster) && !hasMeaningfulObject(char.caster)) char.caster = clone(before.caster);
        char._presentSkills = [...present];
        char._saveSourceVersion = '1.60.0';
      });
    } catch (error) {
      console.warn('[One Dice v157] Falha ao reparar autosave parcial:', error);
    }
  }

  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od157PartialSafe) {
    const previousSave = saveCurrentCharacter;
    saveCurrentCharacter = function od157SaveCurrentCharacter(){
      let before = null;
      let present = new Set();
      try {
        const current = typeof currentChar === 'function' ? currentChar() : null;
        before = current ? clone(current) : null;
        present = presentSkillNames();
      } catch (_) {}
      const result = previousSave.apply(this, arguments);
      repairCurrentAfterPartialSave(before, present);
      return result;
    };
    saveCurrentCharacter.__od157PartialSafe = true;
    try { window.saveCurrentCharacter = saveCurrentCharacter; } catch (_) {}
  }

  // Última trava antes do PUT online: nunca envie uma versão parcial que zere perícias/habilidades salvas.
  if (typeof od42Api === 'function' && !od42Api.__od157PayloadSafe) {
    const previousApi = od42Api;
    od42Api = function od157Api(path, options = {}){
      try {
        const isCharacterPut = String(path || '').startsWith('/api/characters/') && String(options?.method || '').toUpperCase() === 'PUT';
        if (isCharacterPut && options.body) {
          const payload = JSON.parse(options.body);
          const incoming = payload?.data;
          const existing = incoming?.id ? findChar(incoming.id) : null;
          if (incoming && existing) {
            const present = new Set(Array.isArray(incoming._presentSkills) ? incoming._presentSkills : []);
            restoreSkills(incoming, existing, present);
            ['abilities','spells','attacks','inventoryItems','blockInventory','conditions','transformations'].forEach(key => {
              if (hasMeaningfulArray(existing[key]) && !hasMeaningfulArray(incoming[key])) incoming[key] = clone(existing[key]);
            });
            ['abilitiesNotes','equipmentNotes'].forEach(key => {
              if (typeof existing[key] === 'string' && existing[key].trim() && !(typeof incoming[key] === 'string' && incoming[key].trim())) incoming[key] = existing[key];
            });
            incoming._saveSourceVersion = '1.60.0';
            options = { ...options, body: JSON.stringify({ ...payload, data: incoming }) };
          }
        }
      } catch (error) {
        console.warn('[One Dice v157] Falha ao proteger payload de ficha:', error);
      }
      return previousApi.call(this, path, options);
    };
    od42Api.__od157PayloadSafe = true;
    try { window.od42Api = od42Api; } catch (_) {}
  }
})();


/* =========================
   V159 - estabilidade da tela da mesa
   - Remove piscadas de layout ao entrar na campanha.
   - Debounce final do render da mesa, sem mexer em ficha, login ou banco.
   - Evita redesenho da aba Personagens da Mesa quando os dados não mudaram.
========================= */
(function od159StableSessionRender(){
  'use strict';
  if (window.__od159StableSessionRenderInstalled) return;
  window.__od159StableSessionRenderInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const $ = id => document.getElementById(id);
  const last = { tableSig: '', tableAt: 0, playerSig: '', masterSig: '' };
  const MIN_REPEAT_MS = 350;

  function safe(fn, fallback){ try { return fn(); } catch (_) { return fallback; } }
  function chars(){ return safe(() => typeof charactersInCurrentCampaign === 'function' ? charactersInCurrentCampaign() : [], []); }
  function isMaster(){ return safe(() => typeof v35IsMaster === 'function' ? !!v35IsMaster() : false, false); }
  function cond(c){ return safe(() => typeof v35CharCondition === 'function' ? v35CharCondition(c) : (c?.condition || c?.status || 'Normal'), c?.condition || c?.status || 'Normal'); }
  function sig(){
    const cid = safe(() => currentCampaignId || '', '');
    const currentId = safe(() => currentCharacterId || '', '');
    const role = isMaster() ? 'mestre' : 'jogador';
    const bodyState = document.body.classList.contains('master-sheet-open') ? 'sheet' : 'dash';
    const data = chars().map(c => [
      c?.id, c?.ownerId || c?.owner_id || c?.userId || c?.user_id, c?.name, c?.portrait,
      c?.race, c?.className, c?.level, c?.pvCurrent, c?.pvMax, c?.peCurrent, c?.peMax,
      cond(c), Array.isArray(c?.conditions) ? c.conditions.join(',') : ''
    ].join('~')).join('||');
    return [cid, currentId, role, bodyState, data].join('::');
  }
  function isTyping(){
    const active = document.activeElement;
    return !!active?.matches?.('input, textarea, select, [contenteditable="true"]');
  }
  function applyCollapseButtons(){
    try {
      if (typeof localStorage === 'undefined') return;
      ['player','master'].forEach(kind => {
        const cid = safe(() => currentCampaignId || 'global', 'global');
        const collapsed = localStorage.getItem(`od155_dashboard_collapsed_${kind}_${cid}`) === '1';
        const panel = $(kind === 'master' ? 'master-dashboard' : 'player-dashboard');
        const grid = $(kind === 'master' ? 'master-characters-grid' : 'public-party-grid');
        if (!panel) return;
        panel.classList.toggle('od155-dashboard-collapsed', collapsed);
        if (grid) grid.hidden = collapsed;
        let head = panel.querySelector('.dashboard-head') || panel.firstElementChild;
        if (!head) return;
        let actions = head.querySelector('.od155-dashboard-actions');
        if (!actions) {
          actions = document.createElement('div');
          actions.className = 'od155-dashboard-actions';
          head.appendChild(actions);
        }
        let btn = actions.querySelector(`[data-od155-dashboard-toggle="${kind}"]`);
        if (!btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ghost-btn small od155-dashboard-toggle';
          btn.dataset.od155DashboardToggle = kind;
          actions.appendChild(btn);
        }
        btn.textContent = collapsed ? 'Mostrar personagens' : 'Reduzir aba';
        btn.setAttribute('aria-expanded', String(!collapsed));
      });
    } catch (_) {}
  }

  // Trava visual: não deixa renderizações repetidas reconstruírem o layout em sequência.
  if (typeof renderTableExperience === 'function' && !renderTableExperience.__od159Stable) {
    const previous = renderTableExperience;
    renderTableExperience = function od159RenderTableExperience(){
      const now = Date.now();
      const currentSig = sig();
      const playerPanel = $('player-dashboard');
      const masterPanel = $('master-dashboard');
      const hasDashboard = !!(playerPanel || masterPanel);
      if (hasDashboard && currentSig === last.tableSig && (now - last.tableAt) < MIN_REPEAT_MS) {
        applyCollapseButtons();
        return;
      }
      // Durante digitação na ficha, render repetido de mesa é adiado para não mexer na escala/layout.
      if (hasDashboard && isTyping() && currentSig === last.tableSig) {
        applyCollapseButtons();
        return;
      }
      last.tableSig = currentSig;
      last.tableAt = now;
      const result = previous.apply(this, arguments);
      applyCollapseButtons();
      return result;
    };
    renderTableExperience.__od159Stable = true;
    try { window.renderTableExperience = renderTableExperience; } catch (_) {}
  }

  // Se uma camada antiga chamar os dashboards diretamente, impede re-render idêntico.
  [['renderPlayerDashboard','playerSig'], ['renderMasterDashboard','masterSig']].forEach(([name, key]) => {
    const fn = safe(() => eval(name), null);
    if (typeof fn !== 'function' || fn.__od159Stable) return;
    const wrapped = function(){
      const currentSig = sig();
      const panel = $(name.includes('Master') ? 'master-dashboard' : 'player-dashboard');
      const grid = $(name.includes('Master') ? 'master-characters-grid' : 'public-party-grid');
      if (panel && grid && last[key] === currentSig) {
        applyCollapseButtons();
        return;
      }
      last[key] = currentSig;
      const result = fn.apply(this, arguments);
      applyCollapseButtons();
      return result;
    };
    wrapped.__od159Stable = true;
    try { eval(name + ' = wrapped'); } catch (_) {}
    try { window[name] = wrapped; } catch (_) {}
  });

  document.addEventListener('click', function(event){
    const btn = event.target.closest?.('[data-od155-dashboard-toggle]');
    if (!btn) return;
    setTimeout(applyCollapseButtons, 0);
  }, true);

  function boot(){
    document.documentElement.classList.add('od159-stable-session');
    applyCollapseButtons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  [100, 400, 1000, 2000].forEach(ms => setTimeout(boot, ms));
})();

/* =========================
   V160 - isolamento da ficha avulsa
   - Abrir por Personagens > Acessar Ficha nunca mantém contexto de mesa.
   - Se a ficha não foi aberta pela campanha, não mostra Grupo/Personagens da Mesa.
   - Não altera layout, banco, login, perícias ou salvamento.
========================= */
(function od160AccountSheetIsolation(){
  'use strict';
  if (window.__od160AccountSheetIsolationInstalled) return;
  window.__od160AccountSheetIsolationInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const $ = id => document.getElementById(id);

  function safe(fn, fallback){
    try { return fn(); } catch (_) { return fallback; }
  }

  function inAccountSheet(){
    return safe(() => !!accountSheetMode, false);
  }

  function hasActiveCampaign(){
    return safe(() => !!currentCampaignId, false);
  }

  function clearActiveCampaignContext(){
    try { accountSheetMode = true; } catch (_) {}
    try { currentCampaignId = null; } catch (_) {}
    try { localStorage.removeItem(STORAGE.activeCampaign); } catch (_) {}
    try { sessionStorage.removeItem(STORAGE.activeCampaign); } catch (_) {}
    try { document.body.classList.remove('master-dashboard-mode', 'table-mode', 'campaign-mode'); } catch (_) {}
  }

  function hidePanel(id){
    const panel = $(id);
    if (!panel) return;
    panel.classList.add('hidden');
    panel.classList.remove('active', 'od155-dashboard-collapsed');
    panel.setAttribute('aria-hidden', 'true');
  }

  function clearGrid(id){
    const grid = $(id);
    if (grid) grid.innerHTML = '';
  }

  function hideTableOnlyAreas(){
    hidePanel('master-dashboard');
    hidePanel('player-dashboard');
    hidePanel('initiative-panel');
    clearGrid('master-characters-grid');
    clearGrid('public-party-grid');
    try { document.body.classList.remove('master-dashboard-mode'); } catch (_) {}
  }

  function markAccountHeader(){
    try {
      const label = $('current-user-label');
      if (label && typeof currentUser !== 'undefined' && currentUser && typeof userDisplayName === 'function') {
        label.textContent = `${userDisplayName(currentUser)} • Minhas Fichas`;
      }
    } catch (_) {}
    try {
      const title = $('sidebar-title');
      if (title) title.textContent = 'Minhas Fichas';
    } catch (_) {}
  }

  function afterOpenAccountSheet(charId){
    clearActiveCampaignContext();
    hideTableOnlyAreas();
    markAccountHeader();
    try { if (typeof renderAccountCharacterSidebar === 'function') renderAccountCharacterSidebar(); } catch (_) {}
    try {
      if (charId && typeof activeCharId === 'function' && String(activeCharId() || '') !== String(charId) && typeof loadCharacter === 'function') {
        loadCharacter(charId);
      }
    } catch (_) {}
  }

  if (typeof initAccountCharacterEditor === 'function' && !initAccountCharacterEditor.__od160AccountIsolated) {
    const previousInitAccountCharacterEditor = initAccountCharacterEditor;
    initAccountCharacterEditor = function od160InitAccountCharacterEditor(charId = null){
      clearActiveCampaignContext();
      const result = previousInitAccountCharacterEditor.apply(this, arguments);
      afterOpenAccountSheet(charId);
      return result;
    };
    initAccountCharacterEditor.__od160AccountIsolated = true;
    try { window.initAccountCharacterEditor = initAccountCharacterEditor; } catch (_) {}
  }

  if (typeof renderTableExperience === 'function' && !renderTableExperience.__od160AccountGuard) {
    const previousRenderTableExperience = renderTableExperience;
    renderTableExperience = function od160RenderTableExperience(){
      if (inAccountSheet() || !hasActiveCampaign()) {
        hideTableOnlyAreas();
        return;
      }
      return previousRenderTableExperience.apply(this, arguments);
    };
    renderTableExperience.__od160AccountGuard = true;
    try { window.renderTableExperience = renderTableExperience; } catch (_) {}
  }

  if (typeof renderMasterDashboard === 'function' && !renderMasterDashboard.__od160AccountGuard) {
    const previousRenderMasterDashboard = renderMasterDashboard;
    renderMasterDashboard = function od160RenderMasterDashboard(){
      if (inAccountSheet() || !hasActiveCampaign()) {
        hidePanel('master-dashboard');
        clearGrid('master-characters-grid');
        try { document.body.classList.remove('master-dashboard-mode'); } catch (_) {}
        return;
      }
      return previousRenderMasterDashboard.apply(this, arguments);
    };
    renderMasterDashboard.__od160AccountGuard = true;
    try { window.renderMasterDashboard = renderMasterDashboard; } catch (_) {}
  }

  if (typeof renderPlayerDashboard === 'function' && !renderPlayerDashboard.__od160AccountGuard) {
    const previousRenderPlayerDashboard = renderPlayerDashboard;
    renderPlayerDashboard = function od160RenderPlayerDashboard(){
      if (inAccountSheet() || !hasActiveCampaign()) {
        hidePanel('player-dashboard');
        clearGrid('public-party-grid');
        return;
      }
      return previousRenderPlayerDashboard.apply(this, arguments);
    };
    renderPlayerDashboard.__od160AccountGuard = true;
    try { window.renderPlayerDashboard = renderPlayerDashboard; } catch (_) {}
  }

  document.addEventListener('click', function(event){
    const open = event.target.closest?.('[data-od71-open-character], [data-open-account-character], [data-edit-account-character]');
    if (!open) return;
    clearActiveCampaignContext();
    setTimeout(() => afterOpenAccountSheet(open.dataset.od71OpenCharacter || open.dataset.openAccountCharacter || open.dataset.editAccountCharacter || null), 0);
  }, true);

  function boot(){
    if (inAccountSheet() || !hasActiveCampaign()) hideTableOnlyAreas();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();


/* =========================
   V161 - Proficiências de equipamentos
   - Adiciona bolinhas clicáveis no menu Equipamentos, junto de Dinheiro/Peso.
   - Divide proficiências entre Armas e Proteções.
   - Salva em character.equipmentProficiencies sem alterar layout/boot da mesa.
========================= */
(function od161EquipmentProficiencies(){
  'use strict';
  if (window.__od161EquipmentProficienciesInstalled) return;
  window.__od161EquipmentProficienciesInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const GROUPS = {
    weapons: [
      ['simple', 'Simples'],
      ['tacticalMelee', 'Táticas Corpo a Corpo'],
      ['tacticalRanged', 'Táticas a Distância'],
      ['heavy', 'Pesadas']
    ],
    protections: [
      ['light', 'Leves'],
      ['medium', 'Médias'],
      ['heavy', 'Pesadas'],
      ['shield', 'Escudo']
    ]
  };

  function $(id){ return document.getElementById(id); }
  function safe(fn, fallback){ try { return fn(); } catch (_) { return fallback; } }
  function current(){
    return safe(() => typeof currentChar === 'function' ? currentChar() : null, null);
  }
  function defaults(){
    return {
      weapons: { simple:false, tacticalMelee:false, tacticalRanged:false, heavy:false },
      protections: { light:false, medium:false, heavy:false, shield:false }
    };
  }
  function normalize(value){
    const base = defaults();
    const src = value && typeof value === 'object' ? value : {};
    for (const group of Object.keys(base)) {
      const incoming = src[group] && typeof src[group] === 'object' ? src[group] : {};
      for (const key of Object.keys(base[group])) base[group][key] = !!incoming[key];
    }
    return base;
  }
  function escapeText(value){
    if (typeof escapeHtml === 'function') return escapeHtml(String(value ?? ''));
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function ensurePanel(){
    if ($('equipment-proficiency-panel')) return $('equipment-proficiency-panel');
    const summary = document.querySelector('#tab-equipamentos .inventory-summary-grid');
    if (!summary) return null;
    const panel = document.createElement('section');
    panel.id = 'equipment-proficiency-panel';
    panel.className = 'equipment-prof-panel';
    panel.innerHTML = `
      <div class="equipment-prof-head">
        <div>
          <h3>Proficiências com Equipamentos</h3>
          <p class="helper-text">Marque as bolinhas para registrar quais armas e proteções o personagem sabe usar.</p>
        </div>
      </div>
      <div class="equipment-prof-grid">
        <fieldset class="equipment-prof-card">
          <legend>Armas</legend>
          <div class="equipment-prof-options" data-equipment-prof-group="weapons"></div>
        </fieldset>
        <fieldset class="equipment-prof-card">
          <legend>Proteções</legend>
          <div class="equipment-prof-options" data-equipment-prof-group="protections"></div>
        </fieldset>
      </div>`;
    summary.insertAdjacentElement('afterend', panel);
    for (const [group, items] of Object.entries(GROUPS)) {
      const wrap = panel.querySelector(`[data-equipment-prof-group="${group}"]`);
      if (!wrap) continue;
      wrap.innerHTML = items.map(([key, label]) => `
        <label class="equipment-prof-option">
          <input type="checkbox" data-equipment-prof="${group}.${key}" />
          <span class="equipment-prof-dot" aria-hidden="true"></span>
          <span class="equipment-prof-label">${escapeText(label)}</span>
        </label>`).join('');
    }
    return panel;
  }

  function render(char = current()){
    const panel = ensurePanel();
    if (!panel || !char) return;
    const data = normalize(char.equipmentProficiencies);
    panel.querySelectorAll('[data-equipment-prof]').forEach(input => {
      const [group, key] = String(input.dataset.equipmentProf || '').split('.');
      input.checked = !!data[group]?.[key];
    });
  }

  function read(previous){
    const panel = ensurePanel();
    const data = normalize(previous);
    if (!panel) return data;
    panel.querySelectorAll('[data-equipment-prof]').forEach(input => {
      const [group, key] = String(input.dataset.equipmentProf || '').split('.');
      if (!group || !key) return;
      data[group] = data[group] || {};
      data[group][key] = !!input.checked;
    });
    return data;
  }

  window.od161RenderEquipmentProficiencies = render;
  window.od161ReadEquipmentProficiencies = read;
  window.od161NormalizeEquipmentProficiencies = normalize;

  const previousSave = typeof saveCurrentCharacter === 'function' ? saveCurrentCharacter : null;
  if (previousSave && !previousSave.__od161EquipmentProficiencies) {
    saveCurrentCharacter = function od161SaveCurrentCharacter(){
      const result = previousSave.apply(this, arguments);
      const char = current();
      if (char) {
        const data = read(char.equipmentProficiencies);
        if (typeof updateChar === 'function') {
          updateChar(c => { c.equipmentProficiencies = data; });
        } else {
          char.equipmentProficiencies = data;
          try {
            const list = get(STORAGE.characters, []);
            const idx = list.findIndex(c => String(c.id) === String(char.id));
            if (idx >= 0) { list[idx] = char; set(STORAGE.characters, list); }
          } catch (_) {}
        }
      }
      return result;
    };
    saveCurrentCharacter.__od161EquipmentProficiencies = true;
    try { window.saveCurrentCharacter = saveCurrentCharacter; } catch (_) {}
  }

  const previousLoad = typeof loadCharacter === 'function' ? loadCharacter : null;
  if (previousLoad && !previousLoad.__od161EquipmentProficiencies) {
    loadCharacter = function od161LoadCharacter(){
      const result = previousLoad.apply(this, arguments);
      render(current());
      return result;
    };
    loadCharacter.__od161EquipmentProficiencies = true;
    try { window.loadCharacter = loadCharacter; } catch (_) {}
  }

  document.addEventListener('change', function(event){
    if (!event.target.closest?.('[data-equipment-prof]')) return;
    const char = current();
    if (!char) return;
    const data = read(char.equipmentProficiencies);
    if (typeof updateChar === 'function') updateChar(c => { c.equipmentProficiencies = data; });
    else char.equipmentProficiencies = data;
    try { if (typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(current()); } catch (_) {}
  }, true);

  function boot(){ ensurePanel(); render(current()); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();


/* =========================
   V164 - Rollback visual seguro + URLs limpas
   - Remove o redesign quebrado da v163 ao partir da base estável v162.
   - Mantém URLs legíveis sem UUID e sem ?aba=.
   - Não cria barras novas, não altera layout e não mexe no salvamento da ficha.
========================= */
(function od164StableCleanRoutes(){
  'use strict';
  if (window.__od164StableCleanRoutesInstalled) return;
  window.__od164StableCleanRoutesInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const VERSION = '1.77.1';
  let applyingRoute = false;
  let routeTimer = null;

  function $(id){ return document.getElementById(id); }
  function safeText(value){ return String(value ?? '').trim(); }
  function slugify(value, fallback){
    const base = safeText(value) || fallback || 'one-dice';
    return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72) || fallback || 'one-dice';
  }
  function fromStore(key, fallback){
    try { return typeof get === 'function' ? (get(key, fallback) || fallback) : fallback; } catch (_) { return fallback; }
  }
  function allChars(){
    try { return fromStore(STORAGE?.characters, []); } catch (_) { return []; }
  }
  function allCampaigns(){
    try { return typeof getCampaigns === 'function' ? (getCampaigns() || []) : fromStore(STORAGE?.campaigns, []); } catch (_) { return []; }
  }
  function getCurrentChar(){
    try {
      if (typeof currentChar === 'function') return currentChar();
      return allChars().find(c => String(c.id) === String(currentCharacterId)) || null;
    } catch (_) { return null; }
  }
  function getCurrentCampaign(){
    try {
      const id = typeof currentCampaignId !== 'undefined' ? currentCampaignId : null;
      return allCampaigns().find(c => String(c.id) === String(id)) || (typeof activeCampaign === 'function' ? activeCampaign() : null);
    } catch (_) { return null; }
  }
  function charName(char){ return safeText(char?.name || char?.nome || char?.title) || 'personagem'; }
  function campaignName(campaign){ return safeText(campaign?.name || campaign?.title || campaign?.nome) || 'mesa'; }
  function cleanCharPath(char){ return char?.id ? `/personagem/${slugify(charName(char), 'personagem')}` : '/personagens'; }
  function cleanCampaignPath(campaign){ return campaign?.id ? `/mesa/${slugify(campaignName(campaign), 'mesa')}` : '/campanhas'; }
  function cleanCampaignCharPath(campaign, char){
    if (!campaign?.id) return cleanCharPath(char);
    if (!char?.id) return cleanCampaignPath(campaign);
    return `/mesa/${slugify(campaignName(campaign), 'mesa')}/personagem/${slugify(charName(char), 'personagem')}`;
  }
  function isActive(id){ return $(id)?.classList.contains('active'); }
  function sessionsTab(){
    try { return localStorage.getItem('od71_tab') || 'home'; } catch (_) { return 'home'; }
  }
  function desiredPath(){
    if (isActive('auth-screen')) return '/login';
    if (isActive('sessions-screen')) {
      const tab = sessionsTab();
      if (tab === 'characters') return '/personagens';
      if (tab === 'campaigns') return '/campanhas';
      return '/inicio';
    }
    if (isActive('app-screen')) {
      const campaign = getCurrentCampaign();
      const char = getCurrentChar();
      const accountMode = !!(typeof accountSheetMode !== 'undefined' && accountSheetMode);
      const hasCampaignContext = typeof currentCampaignId !== 'undefined' && !!currentCampaignId;
      if (accountMode || !campaign || !hasCampaignContext) return cleanCharPath(char);
      return cleanCampaignCharPath(campaign, char);
    }
    return '/inicio';
  }
  function updateTitle(){
    try {
      let title = 'One Dice';
      if (isActive('auth-screen')) title = 'Entrar • One Dice';
      else if (isActive('sessions-screen')) {
        const tab = sessionsTab();
        title = `${tab === 'characters' ? 'Personagens' : tab === 'campaigns' ? 'Campanhas' : 'Início'} • One Dice`;
      } else if (isActive('app-screen')) {
        const campaign = getCurrentCampaign();
        const char = getCurrentChar();
        const accountMode = !!(typeof accountSheetMode !== 'undefined' && accountSheetMode);
        const hasCampaignContext = typeof currentCampaignId !== 'undefined' && !!currentCampaignId;
        if (accountMode || !campaign || !hasCampaignContext) title = `${charName(char)} • One Dice`;
        else title = `${campaignName(campaign)}${char?.id ? ' / ' + charName(char) : ''} • One Dice`;
      }
      document.title = title;
    } catch (_) {}
  }
  function setCleanRoute(path, replace){
    if (!path || applyingRoute) return;
    const current = location.pathname + location.search;
    if (current === path) return;
    try { history[replace ? 'replaceState' : 'pushState']({ od164: true, path }, '', path); } catch (_) {}
  }
  function syncRoute(delay){
    clearTimeout(routeTimer);
    routeTimer = setTimeout(() => {
      try { updateTitle(); setCleanRoute(desiredPath(), true); } catch (_) {}
    }, delay == null ? 120 : delay);
  }
  function findBySlug(items, slug, nameFn){
    const wanted = slugify(decodeURIComponent(String(slug || '')), '');
    if (!wanted) return null;
    return items.find(item => slugify(nameFn(item), '') === wanted)
      || items.find(item => String(item.id) === String(slug))
      || null;
  }
  function forceSessionsTab(tab){
    try { localStorage.setItem('od71_tab', tab); } catch (_) {}
    if (typeof showSessions === 'function') showSessions();
    setTimeout(() => {
      try {
        const btn = document.querySelector(`[data-od71-tab="${tab}"]`) || document.querySelector(`[data-od75-tab="${tab}"]`);
        btn?.click?.();
      } catch (_) {}
      syncRoute(40);
    }, 80);
  }
  function openCleanRouteFromLocation(attempt){
    if (applyingRoute) return false;
    const parts = location.pathname.split('/').filter(Boolean).map(p => decodeURIComponent(p));
    if (!parts.length || !['login','entrar','inicio','personagens','campanhas','mesas','personagem','ficha','mesa','campanha'].includes(parts[0])) return false;
    applyingRoute = true;
    try {
      const first = parts[0];
      if (first === 'login' || first === 'entrar') { if (typeof showAuth === 'function') showAuth(); return true; }
      if (first === 'inicio') { forceSessionsTab('home'); return true; }
      if (first === 'personagens') { forceSessionsTab('characters'); return true; }
      if (first === 'campanhas' || first === 'mesas') { forceSessionsTab('campaigns'); return true; }
      if (!currentUser) {
        try { sessionStorage.setItem('od164_pending_path', location.pathname); } catch (_) {}
        if (typeof showAuth === 'function') showAuth();
        return true;
      }
      if (first === 'personagem' || first === 'ficha') {
        const char = findBySlug(allChars(), parts[1], charName);
        if (char?.id && typeof initAccountCharacterEditor === 'function') initAccountCharacterEditor(char.id);
        else if ((attempt || 0) < 8) setTimeout(() => openCleanRouteFromLocation((attempt || 0) + 1), 250);
        else forceSessionsTab('characters');
        return true;
      }
      if (first === 'mesa' || first === 'campanha') {
        const campaign = findBySlug(allCampaigns(), parts[1], campaignName);
        if (!campaign?.id) {
          if ((attempt || 0) < 8) setTimeout(() => openCleanRouteFromLocation((attempt || 0) + 1), 250);
          else forceSessionsTab('campaigns');
          return true;
        }
        const charMarker = parts.findIndex(p => p === 'personagem' || p === 'ficha');
        const charSlug = charMarker >= 0 ? parts[charMarker + 1] : '';
        if (typeof enterCampaign === 'function') {
          Promise.resolve(enterCampaign(campaign.id)).then(() => {
            if (charSlug) {
              const char = findBySlug(allChars(), charSlug, charName);
              if (char?.id && typeof loadCharacter === 'function') loadCharacter(char.id);
            }
            syncRoute(120);
          }).catch(() => forceSessionsTab('campaigns'));
        }
        return true;
      }
    } catch (_) {
      return false;
    } finally {
      setTimeout(() => { applyingRoute = false; }, 220);
    }
    return false;
  }
  function wrapFunction(name, delay){
    try {
      const fn = window[name] || (typeof eval === 'function' ? eval(name) : null);
      if (typeof fn !== 'function' || fn.__od164CleanRoute) return;
      const wrapped = function od164WrappedRoute(){
        const result = fn.apply(this, arguments);
        if (result && typeof result.then === 'function') result.finally(() => syncRoute(delay));
        else syncRoute(delay);
        return result;
      };
      wrapped.__od164CleanRoute = true;
      try { window[name] = wrapped; } catch (_) {}
      try { eval(`${name} = wrapped`); } catch (_) {}
    } catch (_) {}
  }
  function install(){
    ['showAuth','showSessions','initAccountCharacterEditor','enterCampaign','initApp','loadCharacter','renderAccountCharacterMenu','renderCampaignMenu'].forEach(name => wrapFunction(name, 140));
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-od71-tab], [data-od75-tab], [data-edit-account-character], [data-open-account-character], [data-enter-campaign], #back-to-sessions-btn, #campaign-character-btn, .sheet-tab')) syncRoute(180);
    }, true);
    window.addEventListener('popstate', () => setTimeout(() => openCleanRouteFromLocation(0), 40));
    setTimeout(() => {
      const pending = (() => { try { const p = sessionStorage.getItem('od164_pending_path'); sessionStorage.removeItem('od164_pending_path'); return p; } catch (_) { return ''; } })();
      if (pending && location.pathname === '/login') { try { history.replaceState({ od164: true }, '', pending); } catch (_) {} }
      const applied = openCleanRouteFromLocation(0);
      if (!applied) syncRoute(40);
    }, 650);
    setInterval(() => updateTitle(), 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
  window.od164CleanRoutes = { version: VERSION, syncRoute, slugify };
})();


/* =========================
   V165 - Retrato: recorte exato da prévia na ficha
   - Reaplica o crop salvo com prioridade máxima após renders antigos.
   - Evita que CSS legado volte para object-position:center.
   - Não mexe em layout, mesa, salvamento de perícias ou boot.
========================= */
(function od165ExactPortraitCrop(){
  'use strict';
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';
  if (window.__od165ExactPortraitCropInstalled) return;
  window.__od165ExactPortraitCropInstalled = true;

  const FALLBACK = 'assets/logo.jpg';
  const $ = id => document.getElementById(id);
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clean = value => String(value || '').trim();

  function readCharacters(){
    try { if (typeof get === 'function' && typeof STORAGE !== 'undefined') return get(STORAGE.characters, []); } catch (_) {}
    try { return JSON.parse(localStorage.getItem('od_characters') || '[]'); } catch (_) { return []; }
  }
  function activeId(){
    try { if (typeof currentCharacterId !== 'undefined' && currentCharacterId) return currentCharacterId; } catch (_) {}
    try { const c = typeof currentChar === 'function' ? currentChar() : null; if (c?.id) return c.id; } catch (_) {}
    return null;
  }
  function activeChar(){
    const id = activeId();
    if (!id) return null;
    return readCharacters().find(c => String(c.id) === String(id)) || null;
  }
  function statePortrait(char){
    if (!char) return FALLBACK;
    const icons = char.obsIcons || {};
    const pv = num(char.pvCurrent ?? char.pvAtual ?? char.pv ?? char.hpCurrent ?? char.hp, 1);
    const max = Math.max(1, num(char.pvMax ?? char.pvTotal ?? char.pv_max ?? char.hpMax ?? char.hpTotal, 1));
    const activeForm = Array.isArray(char.transformations) ? char.transformations.find(f => f && f.active) : null;
    if (activeForm && clean(activeForm.portrait || activeForm.image || activeForm.photo)) return clean(activeForm.portrait || activeForm.image || activeForm.photo);
    if (pv === 0 && clean(char.portraitZero || icons.zero || char.obsIconZero)) return clean(char.portraitZero || icons.zero || char.obsIconZero);
    if (pv > 0 && pv / max < 0.5 && clean(char.portraitLow || icons.low || char.obsIconLow)) return clean(char.portraitLow || icons.low || char.obsIconLow);
    return clean(char.portrait || char.image || char.photo || char.avatar || char.retrato) || FALLBACK;
  }
  function cropOf(char){
    const raw = (char && char.portraitCrop && typeof char.portraitCrop === 'object') ? char.portraitCrop : {};
    return {
      x: clamp(num(raw.x, 50), 0, 100),
      y: clamp(num(raw.y, 50), 0, 100),
      scale: clamp(num(raw.scale, 1), 1, 3)
    };
  }
  function applyToImage(img, char){
    if (!img || !char) return;
    const crop = cropOf(char);
    const src = statePortrait(char);
    if (src && img.getAttribute('src') !== src) img.setAttribute('src', src);
    img.onerror = () => { img.onerror = null; if (img.getAttribute('src') !== FALLBACK) img.setAttribute('src', FALLBACK); };
    img.style.setProperty('width', '100%', 'important');
    img.style.setProperty('height', '100%', 'important');
    img.style.setProperty('max-width', 'none', 'important');
    img.style.setProperty('max-height', 'none', 'important');
    img.style.setProperty('display', 'block', 'important');
    img.style.setProperty('object-fit', 'cover', 'important');
    img.style.setProperty('object-position', `${crop.x}% ${crop.y}%`, 'important');
    img.style.setProperty('transform-origin', `${crop.x}% ${crop.y}%`, 'important');
    img.style.setProperty('transform', `scale(${crop.scale})`, 'important');
    img.style.setProperty('opacity', '1', 'important');
    img.style.setProperty('filter', 'none', 'important');
    img.dataset.od165CropApplied = `${crop.x},${crop.y},${crop.scale}`;
  }
  function applyPortraitCrop(char = activeChar()){
    if (!char) return;
    const main = $('char-portrait-preview');
    applyToImage(main, char);
    const wrapper = main?.closest?.('.portrait-button, .portrait-wrap, #od134-portrait-button');
    if (wrapper) {
      wrapper.style.setProperty('overflow', 'hidden', 'important');
      wrapper.style.setProperty('aspect-ratio', '1 / 1', 'important');
    }
  }
  function scheduleApply(char){
    applyPortraitCrop(char || activeChar());
    requestAnimationFrame(() => applyPortraitCrop(char || activeChar()));
    setTimeout(() => applyPortraitCrop(char || activeChar()), 60);
  }
  function wrap(name){
    try {
      const fn = globalThis[name];
      if (typeof fn !== 'function' || fn.__od165PortraitWrapped) return;
      const wrapped = function(...args){
        const out = fn.apply(this, args);
        scheduleApply(args[0] && typeof args[0] === 'object' ? args[0] : activeChar());
        return out;
      };
      wrapped.__od165PortraitWrapped = true;
      globalThis[name] = wrapped;
      try { window[name] = wrapped; } catch (_) {}
    } catch (_) {}
  }

  ['renderPortrait','updateDerivedStatsDisplay','loadCharacter','saveCurrentCharacter','renderAccountCharacterMenu','renderCharacterList','initApp','initAccountCharacterEditor'].forEach(wrap);

  document.addEventListener('click', event => {
    if (event.target.closest('#od134-photo-save,#od102-photo-save,#od101-photo-save,#od100-crop-save,#od99-crop-save')) {
      setTimeout(() => scheduleApply(activeChar()), 80);
      setTimeout(() => scheduleApply(activeChar()), 350);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => scheduleApply(activeChar()), { once: true });
  setTimeout(() => scheduleApply(activeChar()), 250);
  setTimeout(() => scheduleApply(activeChar()), 1000);
  window.od165ApplyPortraitCrop = applyPortraitCrop;
})();


/* =========================
   V168.5 - Organização de áreas e navegação segura
   Patch de auditoria:
   - remove observer contínuo da v168 para evitar correção repetida de contexto;
   - remove eval do wrapper;
   - mantém separação Ficha Avulsa/Mesa por eventos e funções principais.
========================= */
(function od1685AreaSeparation(){
  'use strict';
  if (window.__od1685AreaSeparationInstalled) return;
  window.__od1685AreaSeparationInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const AREA = {
    AUTH: 'login',
    HOME: 'inicio',
    CHARACTERS: 'personagens',
    CAMPAIGNS: 'campanhas',
    CHARACTER: 'ficha',
    TABLE: 'mesa',
    SETTINGS: 'configuracoes'
  };

  let syncTimer = null;

  function $(id){ return document.getElementById(id); }
  function safe(fn, fallback){ try { return fn(); } catch (_) { return fallback; } }
  function currentCharacter(){ return safe(() => typeof currentChar === 'function' ? currentChar() : null, null); }
  function currentCampaign(){ return safe(() => typeof activeCampaign === 'function' ? activeCampaign() : null, null); }
  function cleanText(value, fallback){ return String(value || '').trim() || fallback || ''; }

  function activeSessionsTab(){
    return safe(() => localStorage.getItem('od71_tab') || localStorage.getItem('od75_tab') || 'home', 'home');
  }

  function setArea(area, detail){
    if (!document.body) return;
    document.documentElement.dataset.odArea = area;
    document.body.dataset.odArea = area;
    if (detail) document.body.dataset.odAreaDetail = detail;
    else delete document.body.dataset.odAreaDetail;
    updateAreaChrome(area);
  }

  function detectSessionsArea(){
    const tab = activeSessionsTab();
    if (tab === 'characters') return AREA.CHARACTERS;
    if (tab === 'campaigns') return AREA.CAMPAIGNS;
    return AREA.HOME;
  }

  function updateAreaChrome(area){
    const label = $('current-user-label');
    const topbar = $('main-topbar');
    const campaignButton = $('campaign-character-btn');
    const sidebarTitle = $('sidebar-title');
    const mini = $('campaign-mini-card');

    if (topbar) {
      topbar.classList.toggle('od168-table-context', area === AREA.TABLE);
      topbar.classList.toggle('od168-character-context', area === AREA.CHARACTER);
    }

    if (area === AREA.CHARACTER) {
      const char = currentCharacter();
      if (label) label.textContent = `Ficha Avulsa • ${cleanText(char?.name, 'Personagem')}`;
      if (campaignButton) campaignButton.textContent = 'Vincular em Mesa';
      if (sidebarTitle) sidebarTitle.textContent = 'Minhas Fichas';
      if (mini) mini.classList.add('hidden');
      hideTableOnlyPanels();
    }

    if (area === AREA.TABLE) {
      const camp = currentCampaign();
      const char = currentCharacter();
      if (label) label.textContent = `${cleanText(camp?.name, 'Mesa')} • ${cleanText(char?.name, 'Sem ficha')}`;
      if (campaignButton) campaignButton.textContent = 'Minha Ficha na Mesa';
    }

    if (area === AREA.HOME || area === AREA.CHARACTERS || area === AREA.CAMPAIGNS) {
      document.body.classList.remove('readonly-character');
    }
  }

  function hideTableOnlyPanels(){
    ['master-dashboard','player-dashboard','initiative-panel'].forEach(id => $(id)?.classList.add('hidden'));
    $('campaign-mini-card')?.classList.add('hidden');
  }

  function forceCharacterContext(){
    safe(() => { accountSheetMode = true; }, null);
    safe(() => { currentCampaignId = null; }, null);
    safe(() => { if (typeof STORAGE !== 'undefined') localStorage.removeItem(STORAGE.activeCampaign); }, null);
    setArea(AREA.CHARACTER, 'avulsa');
  }

  function forceTableContext(){
    safe(() => { accountSheetMode = false; }, null);
    setArea(AREA.TABLE, 'campanha');
  }

  function syncAreaFromScreen(){
    const auth = $('auth-screen')?.classList.contains('active');
    const sessions = $('sessions-screen')?.classList.contains('active');
    const app = $('app-screen')?.classList.contains('active');

    if (auth) return setArea(AREA.AUTH);
    if (sessions) return setArea(detectSessionsArea());

    if (app) {
      const account = safe(() => !!accountSheetMode, false);
      const campaignId = safe(() => currentCampaignId, null);
      if (account || !campaignId) setArea(AREA.CHARACTER, 'avulsa');
      else setArea(AREA.TABLE, 'campanha');
    }
  }

  function scheduleSync(delay = 40){
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncAreaFromScreen, delay);
  }

  function wrapFunction(name, before, after){
    const fn = window[name];
    if (typeof fn !== 'function' || fn.__od1685AreaWrapped) return;
    const wrapped = function od1685WrappedArea(){
      if (typeof before === 'function') before.apply(this, arguments);
      const result = fn.apply(this, arguments);
      const done = () => {
        if (typeof after === 'function') after.apply(this, arguments);
        scheduleSync(30);
      };
      if (result && typeof result.then === 'function') result.finally(done);
      else setTimeout(done, 0);
      return result;
    };
    wrapped.__od1685AreaWrapped = true;
    try { window[name] = wrapped; } catch (_) {}
  }

  function fixMenuLabels(){
    document.querySelectorAll('[data-edit-account-character]').forEach(btn => {
      if (btn.textContent.trim() === 'Editar') btn.textContent = 'Acessar Ficha';
    });
    document.querySelectorAll('[data-enter-campaign]').forEach(btn => {
      if (btn.textContent.trim() === 'Entrar') btn.textContent = 'Entrar na Mesa';
    });
  }

  function installWrappers(){
    wrapFunction('showAuth', null, () => setArea(AREA.AUTH));
    wrapFunction('showSessions', null, () => setArea(detectSessionsArea()));
    wrapFunction('initAccountCharacterEditor', forceCharacterContext, () => { forceCharacterContext(); fixMenuLabels(); });
    wrapFunction('enterCampaign', null, () => { forceTableContext(); fixMenuLabels(); });
    wrapFunction('initApp', null, forceTableContext);
    wrapFunction('loadCharacter', null, () => {
      if (safe(() => !!accountSheetMode, false) || !safe(() => currentCampaignId, null)) setArea(AREA.CHARACTER, 'avulsa');
      else setArea(AREA.TABLE, 'campanha');
    });
    wrapFunction('renderAccountCharacterMenu', null, fixMenuLabels);
    wrapFunction('renderCampaignMenu', null, fixMenuLabels);
  }

  function installClickGuards(){
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-edit-account-character]')) return forceCharacterContext();
      if (event.target.closest?.('[data-enter-campaign]')) return setArea(AREA.TABLE, 'entrando');
      if (event.target.closest?.('#back-to-sessions-btn')) return setArea(AREA.CAMPAIGNS);
      if (event.target.closest?.('[data-od71-tab], [data-od75-tab], #home-tab, #characters-tab, #campaigns-tab')) scheduleSync(80);
      if (event.target.closest?.('#account-settings-open, #account-settings-btn, [data-open-settings], #settings-btn')) setArea(AREA.SETTINGS);
    }, true);
  }

  function boot(){
    installWrappers();
    installClickGuards();
    fixMenuLabels();
    scheduleSync(30);
    setTimeout(() => { fixMenuLabels(); syncAreaFromScreen(); }, 450);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.od168AreaSeparation = { setArea, syncAreaFromScreen, forceCharacterContext, forceTableContext, fixMenuLabels };
})();


/* =========================
   V169.9 - Patch: destreinar perícias não volta sozinho
   Motivo:
   - A tela de perícias renderiza só a aba Treinadas ou Não Treinadas.
   - Ao destreinar uma perícia na aba Treinadas, o card sai da tela imediatamente.
   - Salvamentos genéricos que leem somente o DOM podiam tratar a ausência como "não foi mexido"
     e proteções antigas podiam restaurar o estado anterior.
========================= */
(function od1699StableSkillUntrain(){
  'use strict';
  if (window.__od1699StableSkillUntrainInstalled) return;
  window.__od1699StableSkillUntrainInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const pending = new Map();
  let flushTimer = null;

  function safe(fn, fallback){ try { return fn(); } catch (_) { return fallback; } }
  function clone(value){
    try { return structuredClone(value); } catch (_) {
      try { return JSON.parse(JSON.stringify(value)); } catch (__) { return value; }
    }
  }
  function allSkillNames(){
    return safe(() => Array.isArray(SKILLS) ? SKILLS.map(([name]) => name) : [], []);
  }
  function current(){
    return safe(() => typeof currentChar === 'function' ? currentChar() : null, null);
  }
  function ensureSkill(char, name){
    if (!char || !name) return null;
    char.skills = char.skills || {};
    char.skills[name] = char.skills[name] || { trained: false, bonus: 0, disadvantage: false };
    if (typeof char.skills[name].trained !== 'boolean') char.skills[name].trained = !!char.skills[name].trained;
    if (!Number.isFinite(Number(char.skills[name].bonus))) char.skills[name].bonus = 0;
    return char.skills[name];
  }
  function presentSkillNames(){
    return new Set([...document.querySelectorAll('[data-skill-trained], [data-skill-bonus]')]
      .map(el => el.dataset.skillTrained || el.dataset.skillBonus)
      .filter(Boolean));
  }
  function rowBonusFor(input, name){
    const card = input.closest?.('.od79-skill-card, tr, article, .skill-card') || document;
    const local = card.querySelector?.(`[data-skill-bonus="${CSS.escape ? CSS.escape(name) : name}"]`);
    if (local) return Number(local.value || 0);
    const char = current();
    return Number(char?.skills?.[name]?.bonus || 0);
  }
  function rememberSkillChange(input){
    if (!input) return;
    const trainedName = input.dataset.skillTrained;
    const bonusName = input.dataset.skillBonus;
    const name = trainedName || bonusName;
    if (!name) return;

    const existing = pending.get(name) || {};
    const next = { ...existing };

    if (trainedName) {
      next.trained = !!input.checked;
      next.bonus = rowBonusFor(input, name);
      next.touchedTrained = true;
    }
    if (bonusName) {
      next.bonus = Number(input.value || 0);
      next.touchedBonus = true;
    }

    pending.set(name, next);

    // Aplica no armazenamento local imediatamente, antes do card sumir da aba Treinadas.
    if (typeof updateChar === 'function') {
      updateChar(char => {
        const skill = ensureSkill(char, name);
        if (!skill) return;
        if ('trained' in next) skill.trained = !!next.trained;
        if ('bonus' in next) skill.bonus = Number(next.bonus || 0);
        skill.disadvantage = !!skill.disadvantage;
        char._explicitSkillChanges = char._explicitSkillChanges || {};
        char._explicitSkillChanges[name] = {
          trained: skill.trained,
          bonus: Number(skill.bonus || 0),
          at: Date.now(),
          source: 'v1.69.9'
        };
      });
    }

    scheduleFlush();
  }
  function applyPendingTo(char){
    if (!char || !pending.size) return false;
    let changed = false;
    for (const [name, data] of pending.entries()) {
      const skill = ensureSkill(char, name);
      if (!skill) continue;
      if ('trained' in data && skill.trained !== !!data.trained) {
        skill.trained = !!data.trained;
        changed = true;
      }
      if ('bonus' in data && Number(skill.bonus || 0) !== Number(data.bonus || 0)) {
        skill.bonus = Number(data.bonus || 0);
        changed = true;
      }
      skill.disadvantage = !!skill.disadvantage;
      char._explicitSkillChanges = char._explicitSkillChanges || {};
      char._explicitSkillChanges[name] = {
        trained: !!skill.trained,
        bonus: Number(skill.bonus || 0),
        at: Date.now(),
        source: 'v1.69.9'
      };
    }
    return changed;
  }
  function restoreAbsentSkillsFromBefore(char, before, present){
    if (!char || !before?.skills) return false;
    char.skills = char.skills || {};
    let changed = false;
    const keys = new Set([...allSkillNames(), ...Object.keys(before.skills || {}), ...Object.keys(char.skills || {})]);

    keys.forEach(name => {
      if (!name) return;
      if (pending.has(name)) return; // alteração explícita do usuário ganha da proteção antiga
      if (present.has(name)) return; // se estava na tela, o DOM pode salvar normalmente
      if (!before.skills[name]) return;

      const currentSkill = char.skills[name];
      const oldSkill = before.skills[name];
      const different = JSON.stringify(currentSkill || {}) !== JSON.stringify(oldSkill || {});
      if (different) {
        char.skills[name] = clone(oldSkill);
        changed = true;
      }
    });

    return changed;
  }
  function flush(){
    flushTimer = null;
    if (!pending.size) return;

    let updated = null;
    if (typeof updateChar === 'function') {
      updateChar(char => {
        applyPendingTo(char);
        updated = char;
      });
    }
    const char = updated || current();

    if (char && typeof od42ScheduleCharacterSave === 'function') {
      od42ScheduleCharacterSave(char);
    }

    // Mantém por alguns instantes para proteger o próximo autosave gerado pelo mesmo clique.
    setTimeout(() => pending.clear(), 900);
  }
  function scheduleFlush(){
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 80);
  }

  document.addEventListener('change', event => {
    const input = event.target?.closest?.('[data-skill-trained], [data-skill-bonus]');
    if (!input) return;
    rememberSkillChange(input);
  }, true);

  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od1699StableSkillUntrain) {
    const previousSave = saveCurrentCharacter;
    saveCurrentCharacter = function od1699SaveCurrentCharacter(){
      const before = clone(current());
      const present = presentSkillNames();

      const result = previousSave.apply(this, arguments);

      try {
        if (typeof updateChar === 'function') {
          let patched = null;
          updateChar(char => {
            if (!char || (before?.id && String(char.id) !== String(before.id))) return;
            restoreAbsentSkillsFromBefore(char, before, present);
            applyPendingTo(char);
            char._presentSkills = [...present];
            char._saveSourceVersion = '1.69.9';
            patched = char;
          });
          if (patched && typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(patched);
        }
      } catch (error) {
        console.warn('[One Dice v1.69.9] Falha ao estabilizar perícias:', error);
      }

      return result;
    };
    saveCurrentCharacter.__od1699StableSkillUntrain = true;
    try { window.saveCurrentCharacter = saveCurrentCharacter; } catch (_) {}
  }

  // Proteção final do payload online: se o usuário acabou de destreinar, o PUT não pode restaurar true.
  if (typeof od42Api === 'function' && !od42Api.__od1699SkillPayloadSafe) {
    const previousApi = od42Api;
    od42Api = function od1699Api(path, options = {}){
      try {
        const isPut = String(path || '').startsWith('/api/characters/') && String(options?.method || '').toUpperCase() === 'PUT';
        if (isPut && options.body && pending.size) {
          const payload = JSON.parse(options.body);
          if (payload?.data) {
            payload.data.skills = payload.data.skills || {};
            applyPendingTo(payload.data);
            payload.data._saveSourceVersion = '1.69.9';
            options = { ...options, body: JSON.stringify(payload) };
          }
        }
      } catch (error) {
        console.warn('[One Dice v1.69.9] Falha ao proteger payload de perícias:', error);
      }
      return previousApi.call(this, path, options);
    };
    od42Api.__od1699SkillPayloadSafe = true;
    try { window.od42Api = od42Api; } catch (_) {}
  }

  window.od1699SkillPatch = { pending, flush };
})();


/* =========================
   V169.10 - Correção definitiva: salvar perícias por merge, não por DOM completo
   Causa do bug:
   - O salvamento base recalculava TODAS as perícias com querySelector.
   - Como a aba mostra só Treinadas ou Não Treinadas, muitas perícias não existem no DOM.
   - Ao destreinar, o card some; no save seguinte, a leitura incompleta podia restaurar/alternar estados.
========================= */
(function od16910SkillSaveMerge(){
  'use strict';
  if (window.__od16910SkillSaveMergeInstalled) return;
  window.__od16910SkillSaveMergeInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  let lastExplicit = {};
  let lastExplicitAt = 0;
  let suppressRenderUntil = 0;

  function safe(fn, fallback){ try { return fn(); } catch (_) { return fallback; } }
  function clone(value){
    try { return structuredClone(value); } catch (_) {
      try { return JSON.parse(JSON.stringify(value)); } catch (__) { return value; }
    }
  }
  function current(){
    return safe(() => typeof currentChar === 'function' ? currentChar() : null, null);
  }
  function allSkillNames(){
    return safe(() => Array.isArray(SKILLS) ? SKILLS.map(([name]) => name) : [], []);
  }
  function currentSkillMap(){
    const char = current();
    return clone(char?.skills || {});
  }
  function normalizeSkill(value){
    return {
      trained: !!value?.trained,
      bonus: Number(value?.bonus || 0),
      disadvantage: !!value?.disadvantage
    };
  }
  function readVisibleSkillChanges(baseSkills){
    const next = clone(baseSkills || {});
    const visible = new Set();

    document.querySelectorAll('[data-skill-trained]').forEach(input => {
      const name = input.dataset.skillTrained;
      if (!name) return;
      visible.add(name);
      next[name] = normalizeSkill(next[name]);
      next[name].trained = !!input.checked;
    });

    document.querySelectorAll('[data-skill-bonus]').forEach(input => {
      const name = input.dataset.skillBonus;
      if (!name) return;
      visible.add(name);
      next[name] = normalizeSkill(next[name]);
      next[name].bonus = Number(input.value || 0);
    });

    for (const name of allSkillNames()) {
      next[name] = normalizeSkill(next[name]);
    }

    return { skills: next, visible };
  }
  function applySkillsToCurrent(skills){
    if (!skills || typeof updateChar !== 'function') return null;
    let patched = null;
    updateChar(char => {
      if (!char) return;
      char.skills = clone(skills);
      char._presentSkills = [...Object.keys(skills)];
      char._explicitSkillChanges = {
        ...(char._explicitSkillChanges || {}),
        ...lastExplicit
      };
      char._saveSourceVersion = '1.69.10';
      patched = char;
    });
    return patched;
  }
  function immediateOnlineSave(char){
    if (!char || typeof od42Api !== 'function') return;
    clearTimeout(window.__od16910OnlineSkillTimer);
    const payload = clone(char);
    window.__od16910OnlineSkillTimer = setTimeout(() => {
      od42Api(`/api/characters/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: payload.name || 'Ficha', data: payload })
      }).catch(error => console.warn('[One Dice v1.69.10] Falha ao salvar perícia online:', error));
    }, 120);
  }
  function forceSkillState(name, patch){
    if (!name) return;
    const before = currentSkillMap();
    const next = clone(before || {});
    next[name] = normalizeSkill(next[name]);
    if ('trained' in patch) next[name].trained = !!patch.trained;
    if ('bonus' in patch) next[name].bonus = Number(patch.bonus || 0);
    next[name].disadvantage = !!next[name].disadvantage;

    lastExplicit[name] = { ...next[name], at: Date.now(), source: 'v1.69.10' };
    lastExplicitAt = Date.now();
    suppressRenderUntil = Date.now() + 250;

    const patched = applySkillsToCurrent(next);
    immediateOnlineSave(patched || current());
  }

  // Captura a alteração ANTES de qualquer render remover o card da tela.
  document.addEventListener('change', event => {
    const trained = event.target?.closest?.('[data-skill-trained]');
    if (trained) {
      forceSkillState(trained.dataset.skillTrained, { trained: trained.checked });
      return;
    }
    const bonus = event.target?.closest?.('[data-skill-bonus]');
    if (bonus) {
      forceSkillState(bonus.dataset.skillBonus, { bonus: Number(bonus.value || 0) });
    }
  }, true);

  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od16910SkillMerge) {
    const previousSave = saveCurrentCharacter;
    saveCurrentCharacter = function od16910SaveCurrentCharacter(){
      const beforeSkills = currentSkillMap();

      const result = previousSave.apply(this, arguments);

      // Depois do save antigo, corrige somente skills usando merge:
      // - o que estava visível pode mudar;
      // - o que não estava visível é preservado;
      // - a alteração explícita recente ganha prioridade.
      try {
        const afterBase = current();
        const merged = clone(beforeSkills || {});
        const visibleRead = readVisibleSkillChanges(beforeSkills);

        Object.assign(merged, visibleRead.skills);

        // Se uma perícia não estava visível, não deixa o save antigo inventar valor novo.
        for (const name of allSkillNames()) {
          if (!visibleRead.visible.has(name)) {
            merged[name] = normalizeSkill(beforeSkills[name]);
          }
        }

        // Alterações recentes do usuário sempre vencem.
        if (Date.now() - lastExplicitAt < 3000) {
          for (const [name, data] of Object.entries(lastExplicit)) {
            merged[name] = normalizeSkill(data);
          }
        }

        const patched = applySkillsToCurrent(merged);
        if (patched && typeof od42ScheduleCharacterSave === 'function') od42ScheduleCharacterSave(patched);
      } catch (error) {
        console.warn('[One Dice v1.69.10] Falha ao fazer merge de perícias no save:', error);
      }

      return result;
    };
    saveCurrentCharacter.__od16910SkillMerge = true;
    try { window.saveCurrentCharacter = saveCurrentCharacter; } catch (_) {}
  }

  // Se alguma camada renderizar logo depois do clique, reaplica o estado explícito.
  if (typeof renderSkills === 'function' && !renderSkills.__od16910SkillMerge) {
    const previousRenderSkills = renderSkills;
    renderSkills = function od16910RenderSkills(char){
      if (char && Date.now() - lastExplicitAt < 3000) {
        char.skills = char.skills || {};
        for (const [name, data] of Object.entries(lastExplicit)) {
          char.skills[name] = normalizeSkill(data);
        }
      }
      return previousRenderSkills.apply(this, arguments);
    };
    renderSkills.__od16910SkillMerge = true;
    try { window.renderSkills = renderSkills; } catch (_) {}
  }

  // Proteção final: qualquer PUT de ficha recebe a versão explícita recente.
  if (typeof od42Api === 'function' && !od42Api.__od16910SkillMergePayload) {
    const previousApi = od42Api;
    od42Api = function od16910Api(path, options = {}){
      try {
        const isPut = String(path || '').startsWith('/api/characters/') && String(options?.method || '').toUpperCase() === 'PUT';
        if (isPut && options.body && Date.now() - lastExplicitAt < 3000) {
          const payload = JSON.parse(options.body);
          if (payload?.data) {
            payload.data.skills = payload.data.skills || {};
            for (const [name, data] of Object.entries(lastExplicit)) {
              payload.data.skills[name] = normalizeSkill(data);
            }
            payload.data._saveSourceVersion = '1.69.10';
            options = { ...options, body: JSON.stringify(payload) };
          }
        }
      } catch (error) {
        console.warn('[One Dice v1.69.10] Falha ao proteger payload de perícias:', error);
      }
      return previousApi.call(this, path, options);
    };
    od42Api.__od16910SkillMergePayload = true;
    try { window.od42Api = od42Api; } catch (_) {}
  }

  window.od16910SkillSaveMerge = {
    get lastExplicit(){ return lastExplicit; },
    clear(){ lastExplicit = {}; lastExplicitAt = 0; }
  };
})();


/* =========================
   V169.11 - Retrato estável ao editar PV/PE
   Causa:
   - PV/PE dispara autosave, updateBars, updateOverlay, renderPortrait e reaplicações de crop.
   - Como existem camadas antigas de retrato por estado de vida, a imagem podia resetar e depois receber o crop de novo.
   - Visualmente isso parecia a foto mudando de posição/flicando enquanto digitava vida ou PE.
========================= */
(function od16911StablePortraitDuringResources(){
  'use strict';
  if (window.__od16911StablePortraitDuringResourcesInstalled) return;
  window.__od16911StablePortraitDuringResourcesInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const RESOURCE_SELECTOR = '#pv-current, #pv-max, #pe-current, #pe-max';
  const MAIN_SELECTOR = '#char-portrait-preview';
  let lockUntil = 0;
  let lastSnapshot = null;
  let unlockTimer = null;

  function $(id){ return document.getElementById(id); }
  function mainImg(){ return document.querySelector(MAIN_SELECTOR); }
  function current(){
    try { return typeof currentChar === 'function' ? currentChar() : null; } catch (_) { return null; }
  }
  function isResourceTarget(target){
    return !!target?.matches?.(RESOURCE_SELECTOR);
  }
  function isLocked(){
    return Date.now() < lockUntil || isResourceTarget(document.activeElement);
  }
  function lock(ms = 900){
    lockUntil = Math.max(lockUntil, Date.now() + ms);
    if (!lastSnapshot) lastSnapshot = snapshot(mainImg());
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      if (Date.now() >= lockUntil && !isResourceTarget(document.activeElement)) {
        const char = current();
        try { if (typeof renderPortrait === 'function') renderPortrait(char); } catch (_) {}
        lastSnapshot = null;
      }
    }, ms + 80);
  }
  function snapshot(img){
    if (!img) return null;
    return {
      src: img.getAttribute('src') || '',
      width: img.style.getPropertyValue('width'),
      height: img.style.getPropertyValue('height'),
      maxWidth: img.style.getPropertyValue('max-width'),
      maxHeight: img.style.getPropertyValue('max-height'),
      display: img.style.getPropertyValue('display'),
      objectFit: img.style.getPropertyValue('object-fit'),
      objectPosition: img.style.getPropertyValue('object-position'),
      transformOrigin: img.style.getPropertyValue('transform-origin'),
      transform: img.style.getPropertyValue('transform'),
      opacity: img.style.getPropertyValue('opacity'),
      filter: img.style.getPropertyValue('filter'),
      visibility: img.style.getPropertyValue('visibility'),
      cropApplied: img.dataset.od165CropApplied || ''
    };
  }
  function setImportant(img, prop, value){
    if (!img || value === undefined || value === null || value === '') return;
    img.style.setProperty(prop, value, 'important');
  }
  function restore(img = mainImg(), snap = lastSnapshot){
    if (!img || !snap) return;
    if (snap.src && img.getAttribute('src') !== snap.src) img.setAttribute('src', snap.src);
    setImportant(img, 'width', snap.width || '100%');
    setImportant(img, 'height', snap.height || '100%');
    setImportant(img, 'max-width', snap.maxWidth || 'none');
    setImportant(img, 'max-height', snap.maxHeight || 'none');
    setImportant(img, 'display', snap.display || 'block');
    setImportant(img, 'object-fit', snap.objectFit || 'cover');
    setImportant(img, 'object-position', snap.objectPosition || '50% 50%');
    setImportant(img, 'transform-origin', snap.transformOrigin || snap.objectPosition || '50% 50%');
    setImportant(img, 'transform', snap.transform || 'scale(1)');
    setImportant(img, 'opacity', snap.opacity || '1');
    setImportant(img, 'filter', snap.filter || 'none');
    if (snap.visibility) setImportant(img, 'visibility', snap.visibility);
    if (snap.cropApplied) img.dataset.od165CropApplied = snap.cropApplied;
    img.dataset.od16911Frozen = '1';
  }
  function restoreRepeated(){
    if (!isLocked() || !lastSnapshot) return;
    restore();
    requestAnimationFrame(() => restore());
    setTimeout(() => { if (isLocked()) restore(); }, 40);
    setTimeout(() => { if (isLocked()) restore(); }, 120);
    setTimeout(() => { if (isLocked()) restore(); }, 260);
  }
  function wrapFreeze(fn, args){
    if (!isLocked()) return fn.apply(this, args);
    if (!lastSnapshot) lastSnapshot = snapshot(mainImg());
    const out = fn.apply(this, args);
    restoreRepeated();
    return out;
  }

  document.addEventListener('focusin', event => {
    if (isResourceTarget(event.target)) lock(1400);
  }, true);

  document.addEventListener('input', event => {
    if (isResourceTarget(event.target)) {
      lock(1400);
      restoreRepeated();
    }
  }, true);

  document.addEventListener('change', event => {
    if (isResourceTarget(event.target)) {
      lock(900);
      restoreRepeated();
    }
  }, true);

  document.addEventListener('focusout', event => {
    if (!isResourceTarget(event.target)) return;
    lockUntil = Date.now() + 450;
    setTimeout(() => {
      if (!isResourceTarget(document.activeElement)) {
        lastSnapshot = null;
        try { if (typeof renderPortrait === 'function') renderPortrait(current()); } catch (_) {}
      }
    }, 520);
  }, true);

  if (typeof renderPortrait === 'function' && !renderPortrait.__od16911StablePortrait) {
    const previous = renderPortrait;
    renderPortrait = function od16911RenderPortrait(char){
      if (isLocked() && lastSnapshot) {
        restoreRepeated();
        return;
      }
      return previous.apply(this, arguments);
    };
    renderPortrait.__od16911StablePortrait = true;
    try { window.renderPortrait = renderPortrait; } catch (_) {}
  }

  if (typeof saveCurrentCharacter === 'function' && !saveCurrentCharacter.__od16911StablePortrait) {
    const previous = saveCurrentCharacter;
    saveCurrentCharacter = function od16911SaveCurrentCharacter(){
      return wrapFreeze.call(this, previous, arguments);
    };
    saveCurrentCharacter.__od16911StablePortrait = true;
    try { window.saveCurrentCharacter = saveCurrentCharacter; } catch (_) {}
  }

  if (typeof updateDerivedStatsDisplay === 'function' && !updateDerivedStatsDisplay.__od16911StablePortrait) {
    const previous = updateDerivedStatsDisplay;
    updateDerivedStatsDisplay = function od16911UpdateDerivedStatsDisplay(){
      return wrapFreeze.call(this, previous, arguments);
    };
    updateDerivedStatsDisplay.__od16911StablePortrait = true;
    try { window.updateDerivedStatsDisplay = updateDerivedStatsDisplay; } catch (_) {}
  }

  if (typeof updateOverlay === 'function' && !updateOverlay.__od16911StablePortrait) {
    const previous = updateOverlay;
    updateOverlay = function od16911UpdateOverlay(){
      return wrapFreeze.call(this, previous, arguments);
    };
    updateOverlay.__od16911StablePortrait = true;
    try { window.updateOverlay = updateOverlay; } catch (_) {}
  }

  window.od16911StablePortrait = { lock, restore, snapshot: () => snapshot(mainImg()) };
})();


/* =========================
   V170 - Ficha modular e reduzível
   Foco:
   - transformar blocos grandes da ficha em módulos recolhíveis;
   - reduzir poluição visual;
   - melhorar desempenho com módulos fechados sem mexer em salvamento/banco/mesa.
========================= */
(function od170ModularSheet(){
  'use strict';
  if (window.__od170ModularSheetInstalled) return;
  window.__od170ModularSheetInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const STORE_KEY = 'od170_modules_state_v1';
  const DENSE_KEY = 'od170_dense_sheet_v1';
  let booted = false;

  function $(id){ return document.getElementById(id); }
  function readState(){
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (_) { return {}; }
  }
  function writeState(state){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state || {})); } catch (_) {}
  }
  function isDense(){
    try { return localStorage.getItem(DENSE_KEY) === '1'; } catch (_) { return false; }
  }
  function setDense(value){
    try { localStorage.setItem(DENSE_KEY, value ? '1' : '0'); } catch (_) {}
    document.body.classList.toggle('od170-dense-sheet', !!value);
    const btn = $('od170-dense-toggle');
    if (btn) btn.textContent = value ? 'Modo confortável' : 'Modo denso';
  }
  function titleOf(header, fallback){
    const h = header?.querySelector?.('h1,h2,h3,h4,strong') || (header?.matches?.('h1,h2,h3,h4,strong') ? header : null);
    return String(h?.textContent || fallback || 'Módulo').trim();
  }
  function createHeader(title){
    const header = document.createElement('div');
    header.className = 'od170-module-head od170-generated-head';
    header.innerHTML = `<div><h3>${escapeText(title)}</h3></div>`;
    return header;
  }
  function escapeText(value){
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function ensureToggle(module, key, title){
    const header = module.querySelector(':scope > .od170-module-head, :scope > .section-title-row, :scope > .table-tools, :scope > h3, :scope > h2, :scope > header');
    if (!header) return;
    header.classList.add('od170-module-head');
    if (!header.querySelector(':scope > .od170-module-toggle')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ghost-btn small od170-module-toggle';
      btn.dataset.od170Toggle = key;
      btn.setAttribute('aria-label', `Reduzir ${title}`);
      btn.textContent = 'Reduzir';
      header.appendChild(btn);
    }
  }
  function setCollapsed(module, collapsed){
    if (!module) return;
    const key = module.dataset.od170Key;
    module.classList.toggle('od170-collapsed', !!collapsed);
    const btn = module.querySelector(':scope > .od170-module-head .od170-module-toggle');
    if (btn) {
      btn.textContent = collapsed ? 'Expandir' : 'Reduzir';
      btn.setAttribute('aria-expanded', String(!collapsed));
    }
    if (key) {
      const state = readState();
      state[key] = !!collapsed;
      writeState(state);
    }
  }
  function collapseAll(value){
    document.querySelectorAll('.od170-module').forEach(module => setCollapsed(module, value));
  }
  function wrapModule(key, title, headerEl, bodyEls, options = {}){
    const bodies = (Array.isArray(bodyEls) ? bodyEls : [bodyEls]).filter(Boolean);
    if (!bodies.length) return null;
    if (bodies[0].closest?.('.od170-module')) return bodies[0].closest('.od170-module');

    const first = headerEl || bodies[0];
    const parent = first.parentElement;
    if (!parent) return null;

    const module = document.createElement('section');
    module.className = 'od170-module';
    module.dataset.od170Key = key;
    module.dataset.od170Title = title;

    parent.insertBefore(module, first);

    let header = headerEl;
    if (!header) header = createHeader(title);
    module.appendChild(header);
    header.classList.add('od170-module-head');

    bodies.forEach(body => {
      body.classList.add('od170-module-body');
      module.appendChild(body);
    });

    ensureToggle(module, key, title);

    const state = readState();
    const collapsed = key in state ? !!state[key] : !!options.defaultCollapsed;
    setCollapsed(module, collapsed);

    return module;
  }
  function wrapByBody(key, title, bodySelector, options = {}){
    const body = document.querySelector(bodySelector);
    if (!body) return null;
    let header = null;
    const prev = body.previousElementSibling;
    if (prev && (prev.matches('h2,h3,h4,.section-title-row,.table-tools,.inventory-text-head,.equipment-prof-head'))) {
      header = prev;
    }
    return wrapModule(key, title, header, body, options);
  }
  function wrapResumo(){
    const tab = $('tab-resumo');
    if (!tab) return;
    const attrs = $('attributes-grid');
    const res = $('resistances-grid');
    if (attrs) wrapModule('resumo-atributos', 'Atributos', attrs.previousElementSibling?.matches('h3') ? attrs.previousElementSibling : null, attrs);
    if (res) wrapModule('resumo-resistencias', 'Resistências', res.previousElementSibling?.matches('h3') ? res.previousElementSibling : null, res);
  }
  function wrapEquipamentos(){
    const summary = document.querySelector('#tab-equipamentos .inventory-summary-grid');
    const weight = $('weight-status');
    if (summary && !summary.closest('.od170-module')) {
      wrapModule('equip-resumo', 'Resumo do Inventário', null, weight ? [summary, weight] : summary);
    }
    const profPanel = $('equipment-proficiency-panel');
    if (profPanel && !profPanel.closest('.od170-module')) {
      const head = profPanel.querySelector('.equipment-prof-head');
      const body = profPanel.querySelector('.equipment-prof-grid');
      if (head && body) wrapModule('equip-proficiencias', 'Proficiências', head, body);
    }
    const simple = $('simple-inventory-panel');
    if (simple && !simple.closest('.od170-module')) {
      const head = simple.querySelector('.inventory-text-head');
      const body = $('simple-inventory-list');
      if (head && body) wrapModule('equip-lista-simples', 'Inventário em Texto', head, body);
    }
    const block = $('block-inventory-panel');
    if (block && !block.closest('.od170-module')) {
      wrapModule('equip-modular', 'Inventário Modular', null, block, { defaultCollapsed: true });
    }
  }
  function wrapGenericTabs(){
    wrapByBody('ficha-vitais', 'Vida, Esforço e Defesa', '.vitals-grid');
    wrapByBody('pericias-lista', 'Perícias', '#skills-wrap');
    wrapByBody('combate-ataques', 'Ataques', '#attacks-list');
    wrapByBody('magias-conjurador', 'Conjurador', '#tab-magias .magic-grid');
    wrapByBody('magias-lista', 'Magias', '#spells-list');
    wrapByBody('habilidades-lista', 'Habilidades', '#abilities-list');
    const abilityTools = document.querySelector('#tab-habilidades .ability-tools');
    const abilityList = $('abilities-list');
    if (abilityTools && abilityList && abilityList.closest('.od170-module') && !abilityTools.closest('.od170-module')) {
      abilityList.closest('.od170-module').insertBefore(abilityTools, abilityList);
      abilityTools.classList.add('od170-module-body');
    }
    const banner = $('active-form-banner');
    const forms = $('transformations-list');
    if (forms) wrapModule('transformacoes-lista', 'Transformações', forms.previousElementSibling?.matches('.section-title-row') ? forms.previousElementSibling : null, banner ? [banner, forms] : forms);
  }
  function ensureToolbar(){
    const sheet = document.querySelector('.sheet');
    const tabs = document.querySelector('.sheet .tabs');
    if (!sheet || !tabs || $('od170-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'od170-toolbar';
    toolbar.className = 'od170-toolbar';
    toolbar.innerHTML = `
      <div>
        <strong>Organização da ficha</strong>
        <span>Reduza blocos para navegar mais rápido.</span>
      </div>
      <div class="od170-toolbar-actions">
        <button id="od170-expand-all" class="ghost-btn small" type="button">Expandir tudo</button>
        <button id="od170-collapse-all" class="ghost-btn small" type="button">Reduzir tudo</button>
        <button id="od170-dense-toggle" class="ghost-btn small" type="button">Modo denso</button>
      </div>`;
    sheet.insertBefore(toolbar, tabs);

    $('od170-expand-all')?.addEventListener('click', () => collapseAll(false));
    $('od170-collapse-all')?.addEventListener('click', () => collapseAll(true));
    $('od170-dense-toggle')?.addEventListener('click', () => setDense(!isDense()));
    setDense(isDense());
  }
  function installEvents(){
    if (document.body.dataset.od170Events === '1') return;
    document.body.dataset.od170Events = '1';

    document.addEventListener('click', event => {
      const btn = event.target.closest?.('[data-od170-toggle]');
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      const module = btn.closest('.od170-module');
      setCollapsed(module, !module.classList.contains('od170-collapsed'));
    }, true);
  }
  function boot(){
    ensureToolbar();
    wrapGenericTabs();
    wrapResumo();
    wrapEquipamentos();
    installEvents();
    document.body.classList.toggle('od170-dense-sheet', isDense());
    booted = true;
  }
  function scheduleBoot(){
    clearTimeout(window.__od170BootTimer);
    window.__od170BootTimer = setTimeout(boot, 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  ['loadCharacter','renderSkills','renderSimpleInventory','od161RenderEquipmentProficiencies','applyInventoryMode'].forEach(name => {
    try {
      const fn = window[name];
      if (typeof fn !== 'function' || fn.__od170Modular) return;
      const wrapped = function od170WrappedModule(){
        const result = fn.apply(this, arguments);
        scheduleBoot();
        return result;
      };
      wrapped.__od170Modular = true;
      window[name] = wrapped;
      try { eval(`${name} = wrapped`); } catch (_) {}
    } catch (_) {}
  });

  window.od170ModularSheet = { boot, collapseAll, setDense };
})();


/* =========================
   V171 - Navegação e rolagem das listas do hub
   Foco:
   - corrigir aba Personagens sem rolagem quando há muitas fichas;
   - marcar a rota atual no body para CSS específico;
   - melhorar fluxo com botão Voltar ao Início nas listas.
========================= */
(function od171HubNavigationAndScroll(){
  'use strict';
  if (window.__od171HubNavigationAndScrollInstalled) return;
  window.__od171HubNavigationAndScrollInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  let pending = false;

  function routeFromDOM(){
    if (document.getElementById('od71-character-list')) return 'characters';
    if (document.getElementById('od71-campaign-list')) return 'campaigns';
    if (document.querySelector('#od71-content .od71-home-hero')) return 'home';

    const path = String(location.pathname || '').toLowerCase();
    if (path.includes('personagens')) return 'characters';
    if (path.includes('campanhas')) return 'campaigns';
    return 'home';
  }

  function syncRoute(){
    const route = routeFromDOM();
    document.body.dataset.od171Route = route;
    document.documentElement.dataset.od171Route = route;
    document.getElementById('od71-shell')?.setAttribute('data-od171-route', route);

    document.querySelectorAll('.od71-nav-btn').forEach(btn => {
      const target = btn.dataset.od71Tab || btn.dataset.od75Tab;
      btn.classList.toggle('active', target === route || (route === 'characters' && target === 'characters') || (route === 'campaigns' && target === 'campaigns'));
    });

    enhanceLists(route);
    ensureBackHome(route);
  }

  function scheduleSync(){
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      syncRoute();
    });
  }

  function enhanceLists(route){
    const characterList = document.getElementById('od71-character-list');
    if (characterList) {
      characterList.classList.add('od171-scroll-list', 'od171-character-scroll-list');
      characterList.setAttribute('tabindex', '0');
      characterList.setAttribute('aria-label', 'Lista de personagens');
    }

    const campaignList = document.getElementById('od71-campaign-list');
    if (campaignList) {
      campaignList.classList.add('od171-scroll-list', 'od171-campaign-scroll-list');
      campaignList.setAttribute('tabindex', '0');
      campaignList.setAttribute('aria-label', 'Lista de campanhas');
    }

    const content = document.getElementById('od71-content');
    if (content && (route === 'characters' || route === 'campaigns')) {
      content.classList.add('od171-scroll-content');
    } else {
      content?.classList.remove('od171-scroll-content');
    }
  }

  function ensureBackHome(route){
    const head = document.querySelector('#od71-content .od71-page-head');
    if (!head) return;
    let actions = head.querySelector('.od71-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'od71-actions';
      head.appendChild(actions);
    }

    let btn = actions.querySelector('[data-od171-back-home]');
    if (route === 'home') {
      btn?.remove();
      return;
    }

    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'od71-action od171-back-home';
      btn.dataset.od171BackHome = '1';
      btn.dataset.od71Tab = 'home';
      btn.textContent = '← Início';
      actions.prepend(btn);
    }
  }

  document.addEventListener('click', event => {
    const nav = event.target.closest?.('[data-od71-tab], [data-od171-back-home]');
    if (nav) setTimeout(scheduleSync, 0);
  }, true);

  window.addEventListener('popstate', () => setTimeout(scheduleSync, 0));
  window.addEventListener('resize', scheduleSync);

  const contentObserver = new MutationObserver(scheduleSync);
  contentObserver.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncRoute, { once: true });
  } else {
    syncRoute();
  }

  setTimeout(syncRoute, 120);
  setTimeout(syncRoute, 600);

  window.od171SyncHubRoute = syncRoute;
})();


/* =========================
   V171.5 - Ajustes de scroll e redução inteligente
   Foco:
   - scroll real em Personagens/Campanhas;
   - módulos reduzidos com resumo útil;
   - cards de personagens com visual mais limpo.
========================= */
(function od1715ScrollAndSmartCollapse(){
  'use strict';
  if (window.__od1715ScrollAndSmartCollapseInstalled) return;
  window.__od1715ScrollAndSmartCollapseInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  let scheduled = false;

  function safe(fn, fallback){ try { return fn(); } catch (_) { return fallback; } }
  function $(id){ return document.getElementById(id); }
  function current(){ return safe(() => typeof currentChar === 'function' ? currentChar() : null, null); }
  function esc(value){
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function mod(value){
    if (typeof formatMod === 'function') return formatMod(Number(value || 0));
    const n = Number(value || 0);
    return n >= 0 ? `+${n}` : String(n);
  }
  function attrBonus(char, key){
    if (typeof attrMod === 'function') return attrMod(Number(char?.attrs?.[key] ?? 1));
    return Math.floor((Number(char?.attrs?.[key] ?? 10) - 10) / 2);
  }
  function route(){
    if ($('od71-character-list')) return 'characters';
    if ($('od71-campaign-list')) return 'campaigns';
    if (document.querySelector('#od71-content .od71-home-hero')) return 'home';
    const path = String(location.pathname || '').toLowerCase();
    if (path.includes('personagens')) return 'characters';
    if (path.includes('campanhas')) return 'campaigns';
    return 'home';
  }

  function forceHubScroll(){
    const r = route();
    document.body.dataset.od171Route = r;
    document.documentElement.dataset.od171Route = r;
    $('od71-shell')?.setAttribute('data-od171-route', r);

    const content = $('od71-content');
    const screen = $('sessions-screen');
    const shell = $('od71-shell');

    if (r === 'characters' || r === 'campaigns') {
      document.body.classList.remove('od84-session-home');
      document.body.style.setProperty('overflow', 'hidden', 'important');
      screen?.style.setProperty('height', '100dvh', 'important');
      screen?.style.setProperty('overflow', 'hidden', 'important');
      shell?.style.setProperty('height', '100dvh', 'important');
      shell?.style.setProperty('overflow', 'hidden', 'important');
      content?.style.setProperty('height', 'calc(100dvh - 118px)', 'important');
      content?.style.setProperty('max-height', 'calc(100dvh - 118px)', 'important');
      content?.style.setProperty('overflow-y', 'auto', 'important');
      content?.style.setProperty('overflow-x', 'hidden', 'important');
      content?.style.setProperty('-webkit-overflow-scrolling', 'touch');
      content?.classList.add('od1715-force-scroll');
    } else {
      content?.classList.remove('od1715-force-scroll');
      ['height','max-height','overflow-y','overflow-x','-webkit-overflow-scrolling'].forEach(prop => content?.style.removeProperty(prop));
      screen?.style.removeProperty('height');
      screen?.style.removeProperty('overflow');
      shell?.style.removeProperty('height');
      shell?.style.removeProperty('overflow');
      document.body.style.removeProperty('overflow');
    }

    const charList = $('od71-character-list');
    if (charList) {
      charList.classList.add('od1715-character-list');
      charList.setAttribute('tabindex', '0');
    }

    const campaignList = $('od71-campaign-list');
    if (campaignList) {
      campaignList.classList.add('od1715-campaign-list');
      campaignList.setAttribute('tabindex', '0');
    }
  }

  function moduleByKey(key){
    return document.querySelector(`.od170-module[data-od170-key="${key}"]`);
  }
  function setSummary(module, className, html){
    if (!module) return;
    let box = module.querySelector(`:scope > .${className}`);
    const head = module.querySelector(':scope > .od170-module-head');
    if (!box) {
      box = document.createElement('div');
      box.className = `od1715-collapse-summary ${className}`;
      if (head && head.nextSibling) module.insertBefore(box, head.nextSibling);
      else module.appendChild(box);
    }
    box.innerHTML = html;
  }
  function empty(label){
    return `<div class="od1715-summary-empty">${esc(label)}</div>`;
  }

  function renderAttrSummary(char = current()){
    const module = moduleByKey('resumo-atributos');
    if (!module || !char) return;
    const keys = safe(() => Array.isArray(ATTRIBUTE_KEYS) ? ATTRIBUTE_KEYS : [], []);
    const html = keys.map(([key, label]) => {
      const value = Number(char?.attrs?.[key] ?? 1);
      const bonus = attrBonus(char, key);
      return `<div class="od1715-attr-mini">
        <small>${esc(label)}</small>
        <strong>${esc(value)}</strong>
        <span>${esc(mod(bonus))}</span>
      </div>`;
    }).join('');
    setSummary(module, 'od1715-attr-summary', html || empty('Sem atributos.'));
  }

  function renderSkillSummary(char = current()){
    const module = moduleByKey('pericias-lista');
    if (!module || !char) return;
    const skills = safe(() => Array.isArray(SKILLS) ? SKILLS : [], []);
    const trained = skills.filter(([name]) => !!char.skills?.[name]?.trained);
    const rows = trained.length ? trained : skills.filter(([name]) => Number(char.skills?.[name]?.bonus || 0) !== 0).slice(0, 8);
    const html = rows.map(([name, attr]) => {
      const total = typeof skillTotal === 'function'
        ? skillTotal(char, name, attr)
        : (attrBonus(char, attr) + (char.skills?.[name]?.trained ? Number(char.profBonus || 0) : 0) + Number(char.skills?.[name]?.bonus || 0));
      return `<div class="od1715-skill-mini">
        <span>${esc(name)}</span>
        <strong>${esc(mod(total))}</strong>
      </div>`;
    }).join('');
    setSummary(module, 'od1715-skill-summary', html || empty('Nenhuma perícia treinada.'));
  }

  function renderAttackSummary(char = current()){
    const module = moduleByKey('combate-ataques');
    if (!module || !char) return;
    const attacks = Array.isArray(char.attacks) ? char.attacks : [];
    const html = attacks.map(atk => `<article class="od1715-card-mini od1715-attack-mini">
      <strong>${esc(atk.name || 'Ataque')}</strong>
      <span>Bônus ${esc(mod(Number(atk.bonus || 0)))} • Dano ${esc(atk.damage || '-')}</span>
      ${atk.crit ? `<small>Crítico ${esc(atk.crit)}</small>` : ''}
    </article>`).join('');
    setSummary(module, 'od1715-attack-summary', html || empty('Nenhum ataque cadastrado.'));
  }

  function renderSpellSummary(char = current()){
    const module = moduleByKey('magias-lista');
    if (!module || !char) return;
    const spells = Array.isArray(char.spells) ? char.spells : [];
    const html = spells.map(spell => `<article class="od1715-card-mini od1715-spell-mini">
      <strong>${esc(spell.name || 'Magia')}</strong>
      <span>${esc(spell.circle || 'Círculo -')} • ${esc(spell.cost || 'Custo -')}</span>
      <small>${esc(spell.exec || spell.range || 'Sem descrição expandida')}</small>
    </article>`).join('');
    setSummary(module, 'od1715-spell-summary', html || empty('Nenhuma magia cadastrada.'));
  }

  function renderEquipmentSummary(char = current()){
    const module = moduleByKey('equip-lista-simples');
    if (!module || !char) return;
    const items = Array.isArray(char.inventoryItems) ? char.inventoryItems : [];
    const html = items.map(item => `<article class="od1715-card-mini od1715-item-mini">
      <strong>${esc(item.name || 'Item')}</strong>
      <span>Peso ${esc(item.weight || 0)} • Usos ${esc(item.uses || 0)}</span>
    </article>`).join('');
    setSummary(module, 'od1715-equipment-summary', html || empty('Nenhum item cadastrado.'));
  }

  function renderSummaries(){
    renderAttrSummary();
    renderSkillSummary();
    renderAttackSummary();
    renderSpellSummary();
    renderEquipmentSummary();
  }

  function enhanceCharacterCards(){
    document.querySelectorAll('#od71-character-list .od85-character-card, #od71-character-list .od71-character-card').forEach(card => {
      card.classList.add('od1715-character-card');
      const body = card.querySelector('.od71-card-body');
      if (body) body.classList.add('od1715-character-body');
      const img = card.querySelector('img');
      if (img) {
        img.classList.add('od1715-character-img');
        img.loading = 'lazy';
        img.decoding = 'async';
      }
    });
  }

  function sync(){
    forceHubScroll();
    renderSummaries();
    enhanceCharacterCards();
  }
  function schedule(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      sync();
    });
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-od170-toggle], [data-od71-tab], #od71-new-character, [data-od71-open-character]')) {
      setTimeout(schedule, 0);
      setTimeout(schedule, 160);
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target.closest?.('#attributes-grid input, #skills-wrap input, #attacks-list input, #spells-list input, #simple-inventory-list input, #simple-inventory-list textarea')) {
      schedule();
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target.closest?.('#attributes-grid input, #skills-wrap input, #attacks-list input, #spells-list input, #simple-inventory-list input, #simple-inventory-list textarea')) {
      setTimeout(schedule, 0);
    }
  }, true);

  window.addEventListener('resize', schedule);
  window.addEventListener('popstate', () => setTimeout(schedule, 0));

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();

  setTimeout(sync, 120);
  setTimeout(sync, 600);
  setTimeout(sync, 1400);

  window.od1715Adjustments = { sync, renderSummaries, forceHubScroll };
})();


/* =========================
   V176 - Modo edição x modo reduzido organizado
   Foco:
   - atributos reduzidos escondem os campos editáveis;
   - perícias reduzidas mostram só treinadas + total;
   - ataques reduzidos mostram descrição;
   - magias/habilidades reduzidas mostram informações organizadas;
   - expandido continua sendo modo edição.
========================= */
(function od176SmartSheetModes(){
  'use strict';
  if (window.__od176SmartSheetModesInstalled) return;
  window.__od176SmartSheetModesInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  let scheduled = false;

  function $(id){ return document.getElementById(id); }
  function safe(fn, fallback){ try { return fn(); } catch (_) { return fallback; } }
  function current(){ return safe(() => typeof currentChar === 'function' ? currentChar() : null, null); }
  function esc(value){
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function clean(value, fallback = '-'){
    const text = String(value ?? '').trim();
    return text || fallback;
  }
  function nl(value){
    return esc(clean(value, '')).replace(/\n/g, '<br>');
  }
  function formatBonus(value){
    if (typeof formatMod === 'function') return formatMod(Number(value || 0));
    const n = Number(value || 0);
    return n >= 0 ? `+${n}` : String(n);
  }
  function attrBonus(char, key){
    if (typeof attrMod === 'function') return attrMod(Number(char?.attrs?.[key] ?? 1));
    return Math.floor((Number(char?.attrs?.[key] ?? 10) - 10) / 2);
  }
  function skillTotalSafe(char, name, attr){
    if (typeof skillTotal === 'function') return skillTotal(char, name, attr);
    return attrBonus(char, attr) + (char?.skills?.[name]?.trained ? Number(char?.profBonus || 0) : 0) + Number(char?.skills?.[name]?.bonus || 0);
  }
  function moduleByKey(key){
    return document.querySelector(`.od170-module[data-od170-key="${key}"]`);
  }
  function setSummary(module, className, html){
    if (!module) return null;
    let box = module.querySelector(`:scope > .${className}`);
    const head = module.querySelector(':scope > .od170-module-head');
    if (!box) {
      box = document.createElement('div');
      box.className = `od176-reduced-view od1715-collapse-summary ${className}`;
      if (head?.nextSibling) module.insertBefore(box, head.nextSibling);
      else module.appendChild(box);
    }
    box.innerHTML = html;
    return box;
  }
  function empty(label){
    return `<div class="od176-empty">${esc(label)}</div>`;
  }
  function pill(label, value){
    return `<span class="od176-info-pill"><small>${esc(label)}</small><b>${esc(value)}</b></span>`;
  }

  function markModeHeaders(){
    document.querySelectorAll('.od170-module').forEach(module => {
      const head = module.querySelector(':scope > .od170-module-head');
      if (!head) return;
      let tag = head.querySelector('.od176-mode-tag');
      if (!tag) {
        tag = document.createElement('span');
        tag.className = 'od176-mode-tag';
        head.appendChild(tag);
      }
      tag.textContent = module.classList.contains('od170-collapsed') ? 'Visualização' : 'Edição';
    });
  }

  function renderAttrSummary(char = current()){
    const module = moduleByKey('resumo-atributos');
    if (!module || !char) return;
    const keys = safe(() => Array.isArray(ATTRIBUTE_KEYS) ? ATTRIBUTE_KEYS : [], []);
    const html = `<div class="od176-attr-grid">${keys.map(([key, label]) => {
      const value = Number(char?.attrs?.[key] ?? 1);
      const bonus = attrBonus(char, key);
      return `<div class="od176-attr-box">
        <small>${esc(label)}</small>
        <strong>${esc(value)}</strong>
        <span>${esc(formatBonus(bonus))}</span>
      </div>`;
    }).join('')}</div>`;
    setSummary(module, 'od176-attr-summary', html || empty('Sem atributos.'));
  }

  function renderSkillSummary(char = current()){
    const module = moduleByKey('pericias-lista');
    if (!module || !char) return;
    const skills = safe(() => Array.isArray(SKILLS) ? SKILLS : [], []);
    const trained = skills.filter(([name]) => !!char.skills?.[name]?.trained);
    const html = trained.map(([name, attr]) => {
      const total = skillTotalSafe(char, name, attr);
      return `<div class="od176-skill-line">
        <span>${esc(name)}</span>
        <strong>${esc(formatBonus(total))}</strong>
      </div>`;
    }).join('');
    setSummary(module, 'od176-skill-summary', html ? `<div class="od176-skill-grid">${html}</div>` : empty('Nenhuma perícia treinada.'));
  }

  function renderAttackSummary(char = current()){
    const module = moduleByKey('combate-ataques');
    if (!module || !char) return;
    const attacks = Array.isArray(char.attacks) ? char.attacks : [];
    const html = attacks.map(atk => `<article class="od176-view-card od176-attack-card">
      <header>
        <strong>${esc(atk.name || 'Ataque')}</strong>
        <span>${esc(formatBonus(Number(atk.bonus || 0)))}</span>
      </header>
      <div class="od176-card-pills">
        ${pill('Dano', clean(atk.damage))}
        ${pill('Crítico', clean(atk.crit))}
      </div>
      ${clean(atk.desc, '') ? `<p>${nl(atk.desc)}</p>` : '<p class="od176-muted">Sem descrição.</p>'}
    </article>`).join('');
    setSummary(module, 'od176-attack-summary', html ? `<div class="od176-view-grid">${html}</div>` : empty('Nenhum ataque cadastrado.'));
  }

  function renderSpellSummary(char = current()){
    const module = moduleByKey('magias-lista');
    if (!module || !char) return;
    const spells = Array.isArray(char.spells) ? char.spells : [];
    const html = spells.map(spell => `<article class="od176-view-card od176-spell-card">
      <header>
        <strong>${esc(spell.name || 'Magia')}</strong>
        <span>${esc(clean(spell.circle, 'Círculo -'))}</span>
      </header>
      <div class="od176-card-pills">
        ${pill('Execução', clean(spell.exec))}
        ${pill('Alcance', clean(spell.range))}
        ${pill('Custo', clean(spell.cost))}
        ${pill('Componentes', clean(spell.components))}
      </div>
      <section>
        <b>Descrição</b>
        ${clean(spell.description, '') ? `<p>${nl(spell.description)}</p>` : '<p class="od176-muted">Sem descrição.</p>'}
      </section>
      ${clean(spell.upgrades, '') ? `<section><b>Aprimoramentos</b><p>${nl(spell.upgrades)}</p></section>` : ''}
    </article>`).join('');
    setSummary(module, 'od176-spell-summary', html ? `<div class="od176-view-grid od176-spell-grid">${html}</div>` : empty('Nenhuma magia cadastrada.'));
  }

  function renderAbilitySummary(char = current()){
    const module = moduleByKey('habilidades-lista');
    if (!module || !char) return;
    const abilities = Array.isArray(char.abilities) ? char.abilities : [];
    const html = abilities.map(ability => {
      const cost = ability.cost || (Number(ability.costAmount || 0) > 0 ? `${ability.costAmount} ${ability.costResource || 'PE'}` : 'Sem custo');
      return `<article class="od176-view-card od176-ability-card">
        <header>
          <strong>${esc(ability.name || 'Habilidade')}</strong>
          <span>${esc(clean(ability.action, 'Ação -'))}</span>
        </header>
        <div class="od176-card-pills">
          ${pill('Custo', clean(cost))}
          ${pill('Bônus', clean(ability.bonus))}
        </div>
        ${clean(ability.description, '') ? `<p>${nl(ability.description)}</p>` : '<p class="od176-muted">Sem descrição.</p>'}
      </article>`;
    }).join('');
    setSummary(module, 'od176-ability-summary', html ? `<div class="od176-view-grid">${html}</div>` : empty('Nenhuma habilidade cadastrada.'));
  }

  function renderEquipmentSummary(char = current()){
    const simple = moduleByKey('equip-lista-simples');
    if (!simple || !char) return;
    const items = Array.isArray(char.inventoryItems) ? char.inventoryItems : [];
    const html = items.map(item => `<article class="od176-view-card od176-item-card">
      <header>
        <strong>${esc(item.name || 'Item')}</strong>
        <span>${esc(clean(item.type || item.category, 'Item'))}</span>
      </header>
      <div class="od176-card-pills">
        ${pill('Peso', clean(item.weight, '0'))}
        ${pill('Usos', clean(item.uses, '0'))}
      </div>
      ${clean(item.desc, '') ? `<p>${nl(item.desc)}</p>` : '<p class="od176-muted">Sem descrição.</p>'}
    </article>`).join('');
    setSummary(simple, 'od176-equipment-summary', html ? `<div class="od176-view-grid">${html}</div>` : empty('Nenhum item cadastrado.'));
  }

  function hideOldSummaryBits(){
    // Remove visualmente botões/resumos antigos redundantes sem apagar função de edição.
    document.querySelectorAll('#spells-summary, #abilities-summary, .spells-summary, .abilities-summary, .od75-summary-panel').forEach(el => {
      el.classList.add('od176-old-summary-hidden');
    });
    document.querySelectorAll('#spells-summary-toggle, #abilities-summary-toggle, [data-summary-toggle]').forEach(el => {
      el.classList.add('od176-old-summary-hidden');
    });
  }

  function renderAll(){
    renderAttrSummary();
    renderSkillSummary();
    renderAttackSummary();
    renderSpellSummary();
    renderAbilitySummary();
    renderEquipmentSummary();
    hideOldSummaryBits();
    markModeHeaders();
  }

  function schedule(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      renderAll();
    });
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-od170-toggle], #od170-collapse-all, #od170-expand-all')) {
      setTimeout(schedule, 0);
      setTimeout(schedule, 120);
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target.closest?.('#attributes-grid, #skills-wrap, #attacks-list, #spells-list, #abilities-list, #simple-inventory-list')) {
      schedule();
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target.closest?.('#attributes-grid, #skills-wrap, #attacks-list, #spells-list, #abilities-list, #simple-inventory-list')) {
      setTimeout(schedule, 0);
    }
  }, true);

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderAll, { once: true });
  else renderAll();

  setTimeout(renderAll, 150);
  setTimeout(renderAll, 650);
  setTimeout(renderAll, 1400);

  window.od176SmartSheetModes = { renderAll };
})();


/* =========================
   V176.1 - Hotfix: remove duplicação dos resumos reduzidos
   Causa:
   - A v1.71.5 já gerava resumos reduzidos antigos.
   - A v1.76 adicionou o novo modo visualização, mas os resumos antigos continuaram no DOM.
   - Resultado: atributos, perícias e ataques apareciam duas vezes.
========================= */
(function od1761NoDuplicateReducedSummaries(){
  'use strict';
  if (window.__od1761NoDuplicateReducedSummariesInstalled) return;
  window.__od1761NoDuplicateReducedSummariesInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  const OLD_SUMMARY_SELECTOR = [
    '.od1715-attr-summary',
    '.od1715-skill-summary',
    '.od1715-attack-summary',
    '.od1715-spell-summary',
    '.od1715-equipment-summary'
  ].join(',');

  function cleanupOldSummaries(){
    document.querySelectorAll(OLD_SUMMARY_SELECTOR).forEach(el => {
      if (el.classList.contains('od176-reduced-view')) return;
      el.classList.add('od1761-old-summary-disabled');
      el.setAttribute('aria-hidden', 'true');
      // Remove o bloco antigo quando existir novo bloco v1.76 no mesmo módulo.
      const module = el.closest('.od170-module');
      if (module && module.querySelector(':scope > .od176-reduced-view')) {
        el.remove();
      }
    });

    // Garante que cada módulo fique com apenas um resumo novo da v1.76 por tipo.
    document.querySelectorAll('.od170-module').forEach(module => {
      const seen = new Set();
      module.querySelectorAll(':scope > .od176-reduced-view').forEach(box => {
        const type = [...box.classList].find(cls => cls.startsWith('od176-') && cls.endsWith('-summary')) || box.className;
        if (seen.has(type)) box.remove();
        else seen.add(type);
      });
    });
  }

  function scheduleCleanup(){
    clearTimeout(window.__od1761CleanupTimer);
    window.__od1761CleanupTimer = setTimeout(cleanupOldSummaries, 40);
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-od170-toggle], #od170-collapse-all, #od170-expand-all')) {
      scheduleCleanup();
      setTimeout(cleanupOldSummaries, 160);
    }
  }, true);

  const observer = new MutationObserver(scheduleCleanup);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cleanupOldSummaries, { once: true });
  else cleanupOldSummaries();

  setTimeout(cleanupOldSummaries, 120);
  setTimeout(cleanupOldSummaries, 600);
  setTimeout(cleanupOldSummaries, 1400);
})();


/* =========================
   V176.2 - Marcador de correção de reload em URLs limpas
   A correção principal está no index.html e no server/server.js.
========================= */
(function od1762ReloadPathFixMarker(){
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';
})();


/* =========================
   V177 - Inventário reorganizado
   Objetivo:
   - topo do inventário mostra o modo ativo;
   - Resumo do Inventário tem reduzir/expandir correto;
   - Proficiências ficam preservadas;
   - Inventário em Texto reduzido vira visualização sem edição,
     com nome, peso, usos, descrição, Transferir e Enviar para Drop.
========================= */
(function od177InventoryRework(){
  'use strict';
  if (window.__od177InventoryReworkInstalled) return;
  window.__od177InventoryReworkInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  let scheduled = false;

  function $(id){ return document.getElementById(id); }
  function safe(fn, fallback){ try { return fn(); } catch (_) { return fallback; } }
  function current(){ return safe(() => typeof currentChar === 'function' ? currentChar() : null, null); }
  function esc(value){
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function text(value, fallback = '-'){
    const v = String(value ?? '').trim();
    return v || fallback;
  }
  function nl(value){
    return esc(text(value, '')).replace(/\n/g, '<br>');
  }
  function moduleByKey(key){
    return document.querySelector(`.od170-module[data-od170-key="${key}"]`);
  }
  function setSummary(module, className, html){
    if (!module) return null;
    let box = module.querySelector(`:scope > .${className}`);
    const head = module.querySelector(':scope > .od170-module-head');
    if (!box) {
      box = document.createElement('div');
      box.className = `od177-reduced-view ${className}`;
      if (head?.nextSibling) module.insertBefore(box, head.nextSibling);
      else module.appendChild(box);
    }
    box.innerHTML = html;
    return box;
  }
  function money(char){
    return text(char?.money ?? $('money')?.value ?? '0', '0');
  }
  function weightCurrent(char){
    return text(char?.weightCurrent ?? $('weight-current')?.value ?? '0', '0');
  }
  function weightMax(char){
    return text(char?.weightMax ?? $('weight-max')?.value ?? '0', '0');
  }
  function isBlockMode(char = current()){
    return !!char?.blockInventoryMode || !!$('block-inventory-panel')?.classList.contains('active');
  }

  function modeLabel(char = current()){
    return isBlockMode(char) ? 'MODO BLOCK INVENTORY' : 'MODO TEXTO';
  }

  function updateInventoryHeader(char = current()){
    const tab = $('tab-equipamentos');
    if (!tab) return;
    const title = tab.querySelector(':scope > .section-title-row h3') || tab.querySelector('.section-title-row h3');
    if (title) title.textContent = 'Inventário';

    const subtitle = tab.querySelector(':scope > .section-title-row .helper-text') || tab.querySelector('.section-title-row .helper-text');
    if (subtitle) subtitle.textContent = isBlockMode(char)
      ? 'Modo ativo: Block Inventory. Use o inventário modular por slots.'
      : 'Modo ativo: Texto. Use cards de itens em lista.';

    const head = tab.querySelector(':scope > .section-title-row') || tab.querySelector('.section-title-row');
    if (head && !head.querySelector('.od177-mode-banner')) {
      const banner = document.createElement('div');
      banner.className = 'od177-mode-banner';
      banner.innerHTML = `<span>Inventário</span><strong></strong>`;
      head.appendChild(banner);
    }
    const bannerText = head?.querySelector('.od177-mode-banner strong');
    if (bannerText) bannerText.textContent = modeLabel(char);

    const toggle = $('block-inventory-toggle');
    if (toggle) {
      toggle.classList.add('od177-mode-toggle');
      toggle.textContent = isBlockMode(char) ? 'Trocar para Texto' : 'Trocar para Block Inventory';
      toggle.setAttribute('aria-label', toggle.textContent);
    }
  }

  function cleanupOldInventorySummaries(){
    document.querySelectorAll([
      '.od176-equipment-summary',
      '.od1715-equipment-summary',
      '.od1761-old-summary-disabled'
    ].join(',')).forEach(el => {
      if (!el.classList.contains('od177-inventory-text-summary') && !el.classList.contains('od177-inventory-summary')) {
        el.remove();
      }
    });
  }

  function renderInventorySummary(char = current()){
    const module = moduleByKey('equip-resumo');
    if (!module || !char) return;
    const status = $('weight-status')?.textContent || 'Peso dentro do limite.';
    const overweight = safe(() => typeof isOverweight === 'function' ? isOverweight(char) : false, false);
    const html = `
      <div class="od177-summary-grid">
        <article>
          <small>Dinheiro</small>
          <strong>${esc(money(char))}</strong>
        </article>
        <article>
          <small>Peso Atual</small>
          <strong>${esc(weightCurrent(char))}</strong>
        </article>
        <article>
          <small>Peso Máximo</small>
          <strong>${esc(weightMax(char))}</strong>
        </article>
      </div>
      <div class="od177-weight-status ${overweight ? 'danger' : ''}">${esc(status)}</div>`;
    setSummary(module, 'od177-inventory-summary', html);
  }

  function renderTextInventoryReduced(char = current()){
    const module = moduleByKey('equip-lista-simples');
    if (!module || !char) return;
    const items = Array.isArray(char.inventoryItems) ? char.inventoryItems : [];
    const html = items.length ? `
      <div class="od177-text-items">
        ${items.map(item => {
          const id = esc(item.id || '');
          return `<article class="od177-text-item-card">
            <header>
              <strong>${esc(item.name || 'Item')}</strong>
              <span>${esc(text(item.type || item.category, 'Item'))}</span>
            </header>
            <div class="od177-item-metrics">
              <span><small>Peso</small><b>${esc(text(item.weight, '0'))}</b></span>
              <span><small>Usos</small><b>${esc(text(item.uses, '0'))}</b></span>
            </div>
            <p>${text(item.desc, '') ? nl(item.desc) : '<em>Sem descrição.</em>'}</p>
            <div class="od177-item-actions">
              <button class="ghost-btn small" data-transfer-simple-item="${id}" type="button">Transferir</button>
              <button class="ghost-btn small" data-drop-simple-item="${id}" type="button">Enviar para Drop</button>
            </div>
          </article>`;
        }).join('')}
      </div>` : `<div class="od177-empty">Nenhum item cadastrado.</div>`;
    setSummary(module, 'od177-inventory-text-summary', html);
  }

  function syncModuleButtons(){
    document.querySelectorAll('.od170-module').forEach(module => {
      const btn = module.querySelector(':scope > .od170-module-head .od170-module-toggle');
      if (!btn) return;
      const collapsed = module.classList.contains('od170-collapsed');
      btn.textContent = collapsed ? 'Expandir' : 'Reduzir';
      btn.setAttribute('aria-expanded', String(!collapsed));
    });

    const textToggle = $('simple-inventory-compact-toggle');
    const textModule = moduleByKey('equip-lista-simples');
    if (textToggle && textModule) {
      const collapsed = textModule.classList.contains('od170-collapsed');
      textToggle.textContent = collapsed ? 'Expandir Texto' : 'Reduzir Texto';
      textToggle.dataset.od177ToggleTextInventory = '1';
    }
  }

  function forceInventoryOrder(){
    const tab = $('tab-equipamentos');
    if (!tab) return;
    const summary = moduleByKey('equip-resumo');
    const prof = moduleByKey('equip-proficiencias');
    const textModule = moduleByKey('equip-lista-simples');
    const block = moduleByKey('equip-modular');
    [summary, prof, textModule, block].forEach(module => {
      if (module && module.parentElement === tab) tab.appendChild(module);
    });
    summary?.classList.add('od177-inventory-section', 'od177-summary-section');
    prof?.classList.add('od177-inventory-section', 'od177-prof-section');
    textModule?.classList.add('od177-inventory-section', 'od177-text-section');
    block?.classList.add('od177-inventory-section', 'od177-block-section');
  }

  function sync(){
    const char = current();
    updateInventoryHeader(char);
    cleanupOldInventorySummaries();
    forceInventoryOrder();
    renderInventorySummary(char);
    renderTextInventoryReduced(char);
    syncModuleButtons();
  }

  function schedule(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      sync();
    });
  }

  document.addEventListener('click', event => {
    const textToggle = event.target.closest?.('[data-od177-toggle-text-inventory], #simple-inventory-compact-toggle');
    if (textToggle) {
      const textModule = moduleByKey('equip-lista-simples');
      if (textModule && event.target.id === 'simple-inventory-compact-toggle') {
        event.preventDefault();
        event.stopPropagation();
        const btn = textModule.querySelector(':scope > .od170-module-head .od170-module-toggle');
        if (btn) btn.click();
        else textModule.classList.toggle('od170-collapsed');
        schedule();
        return;
      }
    }

    if (event.target.closest?.('#block-inventory-toggle, [data-od170-toggle], #od170-collapse-all, #od170-expand-all')) {
      setTimeout(schedule, 0);
      setTimeout(schedule, 140);
    }

    if (event.target.closest?.('[data-transfer-simple-item], [data-drop-simple-item]')) {
      setTimeout(schedule, 180);
      setTimeout(schedule, 650);
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target.closest?.('#tab-equipamentos')) schedule();
  }, true);
  document.addEventListener('change', event => {
    if (event.target.closest?.('#tab-equipamentos')) setTimeout(schedule, 0);
  }, true);

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();

  setTimeout(sync, 120);
  setTimeout(sync, 650);
  setTimeout(sync, 1400);

  window.od177InventoryRework = { sync };
})();


/* =========================
   V177.1 - Hotfix visual da aba Equipamentos
   - Remove fundo preto extra da aba.
   - Só mostra "Inventário Modular" quando Block Inventory estiver ativo.
========================= */
(function od1771EquipmentVisualHotfix(){
  'use strict';
  if (window.__od1771EquipmentVisualHotfixInstalled) return;
  window.__od1771EquipmentVisualHotfixInstalled = true;
  window.ONE_DICE_CLIENT_VERSION = '1.77.1';

  function $(id){ return document.getElementById(id); }
  function safe(fn, fallback){ try { return fn(); } catch (_) { return fallback; } }
  function current(){ return safe(() => typeof currentChar === 'function' ? currentChar() : null, null); }
  function blockMode(){
    const char = current();
    return !!char?.blockInventoryMode || !!$('block-inventory-panel')?.classList.contains('active');
  }
  function sync(){
    const active = blockMode();
    const tab = $('tab-equipamentos');
    const blockPanel = $('block-inventory-panel');
    const blockModule = document.querySelector('.od170-module[data-od170-key="equip-modular"]');
    tab?.classList.toggle('od1771-block-mode', active);
    tab?.classList.toggle('od1771-text-mode', !active);
    blockPanel?.classList.toggle('od1771-hidden-modular', !active);
    blockModule?.classList.toggle('od1771-hidden-modular', !active);

    const title = blockModule?.querySelector(':scope > .od170-module-head h2, :scope > .od170-module-head h3');
    if (title && !active) title.setAttribute('aria-hidden', 'true');
    if (title && active) title.removeAttribute('aria-hidden');
  }
  function schedule(){
    clearTimeout(window.__od1771EquipmentVisualTimer);
    window.__od1771EquipmentVisualTimer = setTimeout(sync, 40);
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('#block-inventory-toggle, [data-od170-toggle], #od170-collapse-all, #od170-expand-all')) {
      schedule();
      setTimeout(sync, 180);
    }
  }, true);

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();

  setTimeout(sync, 120);
  setTimeout(sync, 650);
})();
