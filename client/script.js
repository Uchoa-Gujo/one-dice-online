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
    attrs: { forca: 1, agilidade: 1, vigor: 1, intelecto: 1, presenca: 1 },
    skills, resistances,
    money: "0", weightCurrent: 0, weightMax: 10,
    equipmentNotes: "", abilitiesNotes: "", inventoryItems: [],
    abilities: [], abilityDescriptionsHidden: false,
    blockInventoryMode: false,
    blockInventory: [],
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

function showAuth() {
  document.getElementById("auth-screen").classList.add("active");
  document.getElementById("app-screen").classList.remove("active");
  document.getElementById("overlay-screen").classList.remove("active");
}
function showApp() {
  document.getElementById("auth-screen").classList.remove("active");
  document.getElementById("app-screen").classList.add("active");
  document.getElementById("overlay-screen").classList.remove("active");
}

function login(email, password) {
  const user = get(STORAGE.users, []).find(u => u.email === email && u.password === password);
  if (!user) return alert("Email ou senha inválidos.");
  currentUser = user;
  setSessionValue(user.id);
  initApp();
}


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

function initApp() {
  showApp();
  document.getElementById("current-user-label").textContent = `${userDisplayName(currentUser)} • Conta`;
  renderCharacterList();
  const chars = get(STORAGE.characters, []);
  currentCharacterId = currentCharacterId || chars[0]?.id;
  loadCharacter(currentCharacterId);
  renderChat();
}

function renderCharacterList() {
  const list = document.getElementById("character-list");
  const chars = get(STORAGE.characters, []);
  list.innerHTML = "";
  chars.forEach(char => {
    const el = document.createElement("div");
    el.className = `character-pill ${char.id === currentCharacterId ? "active" : ""}`;
    el.innerHTML = `<strong>${escapeHtml(char.name)}</strong><span>${escapeHtml(char.race)} • ${escapeHtml(char.className)} • Nv. ${char.level}</span><button class="delete-character" title="Apagar ficha" data-delete-char="${char.id}">×</button>`;
    el.onclick = (ev) => {
      if (ev.target.closest(".delete-character")) return;
      saveCurrentCharacter(); currentCharacterId = char.id; loadCharacter(char.id); renderCharacterList();
    };
    list.appendChild(el);
  });
}

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function currentChar() { return get(STORAGE.characters, []).find(c => c.id === currentCharacterId); }
function updateChar(mutator) {
  const chars = get(STORAGE.characters, []);
  const index = chars.findIndex(c => c.id === currentCharacterId);
  if (index < 0) return;
  mutator(chars[index]);
  set(STORAGE.characters, chars);
}

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
  byId("dodge").value = calculatedDodge(char);
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

function addChat(text, type = "msg") {
  const chat = get(STORAGE.chat, []);
  chat.push({ id: uid("msg"), user: currentUser?.name || "Sistema", text, type, at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) });
  set(STORAGE.chat, chat.slice(-80));
  renderChat();
}
function renderChat() {
  const log = byId("chat-log"); if (!log) return;
  log.innerHTML = "";
  get(STORAGE.chat, []).forEach(msg => {
    const div = document.createElement("div");
    div.className = `chat-msg ${msg.type === "roll" ? "roll" : ""}`;
    div.innerHTML = `<small>${msg.user} • ${msg.at}</small>${escapeHtml(msg.text)}`;
    log.appendChild(div);
  });
  log.scrollTop = log.scrollHeight;
}
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
    btn.classList.add("active"); byId(`${btn.dataset.auth}-form`).classList.add("active");
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
  byId("logout-btn").onclick = () => { saveCurrentCharacter(); showSessions(); };
  byId("theme-toggle").onclick = () => updateSettings(st => st.theme = st.theme === "dark" ? "light" : "dark");
  byId("accent-select").onchange = e => updateSettings(st => st.accent = e.target.value);
  byId("font-select").onchange = e => updateSettings(st => st.font = e.target.value);
  byId("compact-skills-toggle").onclick = () => {
    updateSettings(st => st.skillsCompact = !st.skillsCompact);
    const char = currentChar();
    if (char) renderSkills(char);
  };
  byId("portrait-button").onclick = () => {
    byId("portrait-modal-url").value = byId("portrait-url").value;
    byId("portrait-modal").showModal();
  };
  byId("save-portrait-url").onclick = () => {
    byId("portrait-url").value = byId("portrait-modal-url").value.trim();
    saveCurrentCharacter();
    byId("portrait-modal").close();
  };
  setupTopbarMenu();
  byId("new-character-btn").onclick = () => { saveCurrentCharacter(); const chars = get(STORAGE.characters, []); const char = createCharacter(currentUser.id); chars.push(char); set(STORAGE.characters, chars); currentCharacterId = char.id; initApp(); };
  byId("overlay-btn").onclick = () => { saveCurrentCharacter(); document.getElementById("app-screen").classList.remove("active"); document.getElementById("overlay-screen").classList.add("active"); updateOverlay(currentChar()); };
  byId("close-overlay").onclick = showApp;
  document.addEventListener("input", e => { if (document.getElementById("app-screen").classList.contains("active")) queueSave(); });
  document.addEventListener("change", e => {
    if (!document.getElementById("app-screen").classList.contains("active")) return;
    saveCurrentCharacter();
    const char = currentChar();
    if (char) { renderAttributes(char); renderSkills(char); updateBars(char); updateOverlay(char); updateDerivedStatsDisplay(char); applySettings(); }
  });
  document.querySelectorAll(".sheet-tab").forEach(btn => btn.onclick = () => {
    document.querySelectorAll(".sheet-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active"); byId(`tab-${btn.dataset.tab}`).classList.add("active");
  });
  byId("add-attack").onclick = () => { addAttackCard(); queueSave(); };
  byId("add-spell").onclick = () => { addSpellCard(); queueSave(); };
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
  byId("block-inventory-toggle").onclick = () => {
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
  byId("roll-dice").onclick = () => doRoll("Rolagem livre", Number(byId("dice-qty").value || 1), Number(byId("dice-type").value), Number(byId("dice-mod").value || 0));
  byId("chat-form").onsubmit = e => { e.preventDefault(); const input = byId("chat-input"); if (!input.value.trim()) return; addChat(input.value.trim()); input.value = ""; };
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
  if (!byId("account-tools-panel")) {
    const panel = document.createElement("div");
    panel.id = "account-tools-panel";
    panel.className = "manga-panel account-tools-panel";
    panel.innerHTML = `
      <div class="account-sheets-head">
        <div><p class="eyebrow">Backup</p><h2>Importar / Exportar Fichas</h2><p class="subtitle">Use isso como segurança durante os testes locais.</p></div>
        <div class="account-tools-actions">
          <button id="export-sheets-btn" class="ghost-btn" type="button">Exportar Fichas</button>
          <button id="toggle-import-sheets-btn" class="ghost-btn" type="button">Importar Fichas</button>
        </div>
      </div>
      <div id="import-export-area" class="import-export-area">
        <textarea id="import-export-text" placeholder="Cole aqui o JSON exportado"></textarea>
        <div class="account-tools-actions"><button id="confirm-import-sheets-btn" class="primary-btn small" type="button">Confirmar Importação</button></div>
      </div>`;
    const sessionsList = document.querySelector(".sessions-list-panel");
    sessionsList?.insertAdjacentElement("afterend", panel);
  }
}

function v35ExportSheets() {
  const mine = get(STORAGE.characters, []).filter(c => c.ownerId === currentUser?.id);
  const payload = { version: "one-dice-v35", exportedAt: new Date().toISOString(), characters: mine };
  const text = JSON.stringify(payload, null, 2);
  const area = byId("import-export-area");
  const out = byId("import-export-text");
  if (area && out) {
    area.classList.add("active");
    out.value = text;
    out.focus();
    out.select();
  }
  navigator.clipboard?.writeText(text).catch(() => {});
}

function v35ImportSheets() {
  const raw = byId("import-export-text")?.value?.trim();
  if (!raw) return alert("Cole o JSON exportado antes de importar.");
  let payload;
  try { payload = JSON.parse(raw); } catch (_) { return alert("JSON inválido."); }
  const incoming = Array.isArray(payload) ? payload : payload.characters;
  if (!Array.isArray(incoming) || !incoming.length) return alert("Nenhuma ficha encontrada no arquivo.");
  const chars = get(STORAGE.characters, []);
  incoming.forEach(old => {
    const copy = { ...old, id: uid("char"), ownerId: currentUser.id, name: `${old.name || "Ficha Importada"} (importada)` };
    chars.push(copy);
  });
  set(STORAGE.characters, chars);
  renderAccountCharacterMenu();
  alert(`${incoming.length} ficha(s) importada(s).`);
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
  if (event.target.closest("#export-sheets-btn")) return v35ExportSheets();
  if (event.target.closest("#toggle-import-sheets-btn")) {
    byId("import-export-area")?.classList.toggle("active");
    byId("import-export-text")?.focus();
    return;
  }
  if (event.target.closest("#confirm-import-sheets-btn")) return v35ImportSheets();
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

document.addEventListener("input", event => {
});

setTimeout(() => { renderTransformations(currentChar()); v39RenderCommercePanel(); }, 100);
