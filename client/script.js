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
  if (portraitButton) portraitButton.onclick = () => {
    byId("portrait-modal-url").value = byId("portrait-url").value;
    byId("portrait-modal").showModal();
  };
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

document.addEventListener("input", event => {
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
    if (userCharacters().length >= 10) return alert('Você atingiu o limite de 10 personagens. Apague uma ficha para criar outra.');
    return baseCreateAccount70(openAfterCreate);
  };

  const baseCreateCampaign70 = createCampaign;
  createCampaign = function() {
    const owned = getCampaigns().filter(c => c.ownerId === currentUser?.id).length;
    if (owned >= 5) return alert('Você atingiu o limite de 5 campanhas. Apague uma campanha para criar outra.');
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
    if (charHead) charHead.textContent = `${userCharacters().length}/10 personagens. Crie e edite suas fichas antes de entrar em uma mesa.`;
    const campaignTitle = document.querySelector('.campaign-list-panel h2');
    const campaignEmpty = document.querySelector('#campaign-list .campaign-empty');
    const owned = getCampaigns().filter(c => c.ownerId === currentUser?.id).length;
    if (campaignTitle && !campaignTitle.dataset.v70) { campaignTitle.dataset.v70 = '1'; campaignTitle.textContent = 'Minhas Campanhas'; }
    if (campaignEmpty) campaignEmpty.textContent = `${owned}/5 campanhas. Crie uma campanha ou use o código de convite do mestre.`;
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
  const OD71_LIMITS = { characters: 10, campaigns: 5 };
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
    if (chars.length >= OD71_LIMITS.characters) return alert('Limite de 10 personagens atingido.');
    const btn = document.getElementById('create-account-character-btn');
    if (btn) btn.click();
    else if (typeof createAccountCharacter === 'function') createAccountCharacter(false);
    od71SetTab('characters');
  }

  async function od71CreateCampaign() {
    const owned = (getCampaigns ? getCampaigns() : []).filter(c => c.ownerId === currentUser?.id);
    if (owned.length >= OD71_LIMITS.campaigns) return alert('Limite de 5 campanhas criadas atingido.');
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
      ['account-character-list', 10, 'personagens'],
      ['campaign-list', 5, 'campanhas']
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
      </label>`;
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
