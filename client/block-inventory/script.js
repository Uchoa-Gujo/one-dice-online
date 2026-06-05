const GRID_COLS = 6;
const GRID_ROWS = 6;
const CELL_SIZE = 58;
const CELL_GAP = 4;
const STEP = CELL_SIZE + CELL_GAP;
const DRAG_THRESHOLD = 0;

const inventoryGrid = document.getElementById("inventoryGrid");
const inventoryItemsLayer = document.getElementById("inventoryItemsLayer");
const shelfArea = document.getElementById("shelfArea");
const selectedInfo = document.getElementById("selectedInfo");
const strengthInput = document.getElementById("strengthInput");

const rotateRightBtn = document.getElementById("rotateRightBtn");
const rotateLeftBtn = document.getElementById("rotateLeftBtn");
const toggleSlotsLockBtn = document.getElementById("toggleSlotsLockBtn");
const unequipBtn = document.getElementById("unequipBtn");
const moveToShelfBtn = document.getElementById("moveToShelfBtn");
const deleteItemBtn = document.getElementById("deleteItemBtn");
const resetBtn = document.getElementById("resetBtn");

const settingsToggleBtn = document.getElementById("settingsToggleBtn");
const settingsPanel = document.getElementById("settingsPanel");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const toggleControlsPanelBtn = document.getElementById("toggleControlsPanelBtn");
const controlsConfigPanel = document.getElementById("controlsConfigPanel");
const keybindsList = document.getElementById("keybindsList");
const keybindWarning = document.getElementById("keybindWarning");
const soundEnabledInput = document.getElementById("soundEnabledInput");

const confirmModal = document.getElementById("confirmModal");
const confirmModalText = document.getElementById("confirmModalText");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

const brandTitle = document.getElementById("brandTitle");
const brandSubtitle = document.getElementById("brandSubtitle");
const brandTitleInput = document.getElementById("brandTitleInput");
const brandSubtitleInput = document.getElementById("brandSubtitleInput");
const saveBrandTextBtn = document.getElementById("saveBrandTextBtn");

const addBackpackBtn = document.getElementById("addBackpackBtn");
const removeBackpackBtn = document.getElementById("removeBackpackBtn");
const clearShapeBtn = document.getElementById("clearShapeBtn");
const fillRectShapeBtn = document.getElementById("fillRectShapeBtn");
const shapeEditor = document.getElementById("shapeEditor");

const itemNameInput = document.getElementById("itemNameInput");
const itemDescInput = document.getElementById("itemDescInput");
const saveItemTextBtn = document.getElementById("saveItemTextBtn");

const newItemNameInput = document.getElementById("newItemNameInput");
const newItemDescInput = document.getElementById("newItemDescInput");
const newItemWidthInput = document.getElementById("newItemWidthInput");
const newItemHeightInput = document.getElementById("newItemHeightInput");
const newItemTypeInput = document.getElementById("newItemTypeInput");
const newItemImageInput = document.getElementById("newItemImageInput");
const addItemBtn = document.getElementById("addItemBtn");

const characterAvatarInput = document.getElementById("characterAvatarInput");
const characterAvatarPreview = document.getElementById("characterAvatarPreview");

const leftPanel = document.getElementById("leftPanel");
const rightPanel = document.getElementById("rightPanel");
const toggleLeftPanelBtn = document.getElementById("toggleLeftPanelBtn");
const toggleRightPanelBtn = document.getElementById("toggleRightPanelBtn");
const leftPanelBody = document.getElementById("leftPanelBody");

const equipmentSlots = document.querySelectorAll(".equip-slot");
const themeButtons = document.querySelectorAll(".theme-dot");

const FIXED_SLOT_KEYS = new Set(["0,0", "0,1"]);

const KEYBIND_LABELS = {
  rotateRight: "Girar para direita",
  rotateLeft: "Girar para esquerda",
  moveLeft: "Mover para esquerda",
  moveRight: "Mover para direita",
  moveUp: "Mover para cima",
  moveDown: "Mover para baixo"
};

const initialItems = [];
const initialBlueGroups = [
  { id: "group_0", x: 1, y: 0, orientation: "horizontal" },
  { id: "group_1", x: 1, y: 1, orientation: "horizontal" },
  { id: "group_2", x: 1, y: 2, orientation: "horizontal" },
  { id: "group_3", x: 1, y: 3, orientation: "horizontal" },
  { id: "group_4", x: 1, y: 4, orientation: "horizontal" }
];
const initialBackpacks = [];

let items = structuredClone(initialItems);
let blueGroups = structuredClone(initialBlueGroups);
let backpackModules = structuredClone(initialBackpacks);

let selectedItemId = null;
let selectedBackpackId = null;
let selectedBlueGroupId = null;
let slotsLocked = true;
let controlsPanelCollapsed = false;
let soundEnabled = true;
let waitingKeybindAction = null;
let pendingDeleteItemId = null;

let keybinds = {
  rotateRight: "r",
  rotateLeft: "q",
  moveLeft: "arrowleft",
  moveRight: "arrowright",
  moveUp: "arrowup",
  moveDown: "arrowdown"
};

let shapeMatrix = Array.from({ length: GRID_ROWS }, () =>
  Array.from({ length: GRID_COLS }, () => false)
);

/* =========================
   SOUND
========================= */

let audioContext = null;

function ensureAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) audioContext = new AudioCtx();
  }
  return audioContext;
}

function playTone({ frequency = 440, duration = 0.06, type = "sine", volume = 0.03 } = {}) {
  if (!soundEnabled) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}

function playSound(name) {
  const map = {
    click: () => playTone({ frequency: 520, duration: 0.03, type: "triangle", volume: 0.02 }),
    rotate: () => {
      playTone({ frequency: 620, duration: 0.04, type: "triangle", volume: 0.024 });
      setTimeout(() => playTone({ frequency: 860, duration: 0.07, type: "square", volume: 0.022 }), 28);
    },
    equip: () => {
      playTone({ frequency: 660, duration: 0.04, type: "triangle", volume: 0.025 });
      setTimeout(() => playTone({ frequency: 880, duration: 0.05, type: "triangle", volume: 0.02 }), 35);
    },
    drop: () => playTone({ frequency: 300, duration: 0.05, type: "sine", volume: 0.03 }),
    error: () => playTone({ frequency: 180, duration: 0.09, type: "sawtooth", volume: 0.03 })
  };

  const fn = map[name];
  if (fn) fn();
}

/* =========================
   UTIL
========================= */

function slotKey(x, y) {
  return `${x},${y}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getStrengthValue() {
  const value = Number(strengthInput?.value ?? 1);
  if (Number.isNaN(value) || value < 1) return 1;
  return value;
}

function getSlotCountByStrength(strength) {
  if (strength < 8) return 1;
  if (strength <= 9) return 2;
  if (strength <= 11) return 4;
  if (strength <= 13) return 8;
  if (strength <= 15) return 12;

  const extra = strength - 15;
  const groups = Math.ceil(extra / 2);
  return 12 + groups * 4;
}

function getSelectedItem() {
  return items.find((item) => item.id === selectedItemId) || null;
}

function getSelectedBackpack() {
  return backpackModules.find((bag) => bag.id === selectedBackpackId) || null;
}

function getSelectedBlueGroup() {
  return blueGroups.find((group) => group.id === selectedBlueGroupId) || null;
}

function setSelection({ itemId = null, backpackId = null, blueGroupId = null } = {}) {
  selectedItemId = itemId;
  selectedBackpackId = backpackId;
  selectedBlueGroupId = blueGroupId;
  syncSelectedEditors();
}

function getItemDimensions(item) {
  return item.rotated
    ? { width: item.height, height: item.width }
    : { width: item.width, height: item.height };
}

function translateLocation(location) {
  if (location === "inventory") return "Inventário";
  if (location === "equipment") return "Equipado";
  if (location === "shelf") return "Prateleira";
  return location;
}

function slotLabel(slotName) {
  const labels = {
    cabeca: "Cabeça",
    bracos: "Braços",
    tronco: "Tronco",
    pernas: "Pernas"
  };
  return labels[slotName] || slotName;
}

function getEquipSlotForType(type) {
  const map = {
    cabeca: "cabeca",
    bracos: "bracos",
    tronco: "tronco",
    pernas: "pernas"
  };
  return map[type] || null;
}

function getRectSize(widthCells, heightCells) {
  return {
    width: widthCells * CELL_SIZE + (widthCells - 1) * CELL_GAP,
    height: heightCells * CELL_SIZE + (heightCells - 1) * CELL_GAP
  };
}

function isPointerInsideElement(clientX, clientY, element) {
  const rect = element.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

function getEquipSlotUnderPointer(clientX, clientY) {
  for (const slotEl of equipmentSlots) {
    if (isPointerInsideElement(clientX, clientY, slotEl)) {
      return slotEl.dataset.slot;
    }
  }
  return null;
}

function getGridPositionFromPointer(clientX, clientY, offsetX = 0, offsetY = 0) {
  const rect = inventoryItemsLayer.getBoundingClientRect();
  const localX = clientX - rect.left - offsetX;
  const localY = clientY - rect.top - offsetY;

  return {
    x: Math.round(localX / STEP),
    y: Math.round(localY / STEP)
  };
}

function updateSlotsLockButton() {
  document.body.classList.toggle("slots-locked", slotsLocked);
  toggleSlotsLockBtn.textContent = slotsLocked ? "🔒 Slots" : "🔓 Slots";
}

function syncSelectedEditors() {
  const item = getSelectedItem();
  if (!item) {
    itemNameInput.value = "";
    itemDescInput.value = "";
    return;
  }

  itemNameInput.value = item.nome ?? "";
  itemDescInput.value = item.descricao ?? "";
}

function isTypingInField(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

/* =========================
   AVATAR / TITLE
========================= */

function renderCharacterAvatar(imageUrl = null) {
  characterAvatarPreview.innerHTML = "";
  if (!imageUrl) {
    const span = document.createElement("span");
    span.textContent = "+";
    characterAvatarPreview.appendChild(span);
    return;
  }

  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = "Avatar do personagem";
  characterAvatarPreview.appendChild(img);
}

function syncBrandEditors() {
  brandTitleInput.value = brandTitle.textContent;
  brandSubtitleInput.value = brandSubtitle.textContent;
}

/* =========================
   CONFIRM DELETE
========================= */

function openDeleteModal(item) {
  pendingDeleteItemId = item.id;
  confirmModalText.textContent = `Tem certeza que deseja excluir "${item.nome}"?`;
  confirmModal.classList.remove("hidden");
}

function closeDeleteModal() {
  pendingDeleteItemId = null;
  confirmModal.classList.add("hidden");
}

function deletePendingItem() {
  if (!pendingDeleteItemId) return;

  items = items.filter((item) => item.id !== pendingDeleteItemId);
  if (selectedItemId === pendingDeleteItemId) selectedItemId = null;
  pendingDeleteItemId = null;
  closeDeleteModal();
  playSound("drop");
  render();
}

/* =========================
   LEFT CARDS
========================= */

function renderLeftCardButtons() {
  leftPanelBody.querySelectorAll(".dock-card").forEach((card, index, arr) => {
    const upBtn = card.querySelector('.card-move-btn[data-move="up"]');
    const downBtn = card.querySelector('.card-move-btn[data-move="down"]');
    const toggleBtn = card.querySelector(".card-toggle-btn");

    upBtn.disabled = index === 0;
    downBtn.disabled = index === arr.length - 1;
    toggleBtn.textContent = card.classList.contains("collapsed") ? "+" : "—";
  });
}

function moveCard(card, direction) {
  const sibling = direction === "up" ? card.previousElementSibling : card.nextElementSibling;
  if (!sibling) return;

  if (direction === "up") {
    leftPanelBody.insertBefore(card, sibling);
  } else {
    leftPanelBody.insertBefore(sibling, card);
  }

  playSound("click");
  renderLeftCardButtons();
}

function setupLeftCards() {
  leftPanelBody.querySelectorAll(".dock-card").forEach((card) => {
    const upBtn = card.querySelector('.card-move-btn[data-move="up"]');
    const downBtn = card.querySelector('.card-move-btn[data-move="down"]');
    const toggleBtn = card.querySelector(".card-toggle-btn");

    upBtn.addEventListener("click", () => moveCard(card, "up"));
    downBtn.addEventListener("click", () => moveCard(card, "down"));
    toggleBtn.addEventListener("click", () => {
      card.classList.toggle("collapsed");
      playSound("click");
      renderLeftCardButtons();
    });
  });

  renderLeftCardButtons();
}

/* =========================
   KEYBINDS
========================= */

function formatKeyName(key) {
  if (!key) return "-";
  const map = {
    " ": "space",
    arrowleft: "←",
    arrowright: "→",
    arrowup: "↑",
    arrowdown: "↓",
    escape: "esc"
  };
  return map[key] || key;
}

function isKeyAlreadyUsed(action, key) {
  return Object.entries(keybinds).some(([name, value]) => name !== action && value === key);
}

function setKeybind(action, key) {
  const normalized = key.toLowerCase();

  if (isKeyAlreadyUsed(action, normalized)) {
    keybindWarning.textContent = `A tecla "${formatKeyName(normalized)}" já está sendo usada em outro comando.`;
    keybindWarning.classList.add("error");
    playSound("error");
    renderKeybinds();
    return false;
  }

  keybinds[action] = normalized;
  keybindWarning.textContent = `Tecla alterada para "${formatKeyName(normalized)}".`;
  keybindWarning.classList.remove("error");
  playSound("click");
  renderKeybinds();
  return true;
}

function renderKeybinds() {
  keybindsList.innerHTML = "";

  Object.entries(KEYBIND_LABELS).forEach(([action, label]) => {
    const row = document.createElement("div");
    row.className = "keybind-row";

    const nameEl = document.createElement("div");
    nameEl.className = "keybind-label";
    nameEl.textContent = label;

    const valueEl = document.createElement("div");
    valueEl.className = "keybind-value";
    valueEl.textContent = waitingKeybindAction === action ? "pressione..." : formatKeyName(keybinds[action]);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "keybind-btn";
    if (waitingKeybindAction === action) btn.classList.add("waiting");
    btn.textContent = waitingKeybindAction === action ? "Aguardando" : "Alterar";

    btn.addEventListener("click", () => {
      waitingKeybindAction = waitingKeybindAction === action ? null : action;
      keybindWarning.textContent = waitingKeybindAction
        ? `Pressione uma tecla para "${label}".`
        : "Nenhum conflito.";
      keybindWarning.classList.remove("error");
      playSound("click");
      renderKeybinds();
    });

    row.appendChild(nameEl);
    row.appendChild(valueEl);
    row.appendChild(btn);
    keybindsList.appendChild(row);
  });

  controlsConfigPanel.classList.toggle("hidden", controlsPanelCollapsed);
}

/* =========================
   SHAPE EDITOR
========================= */

function renderShapeEditor() {
  shapeEditor.innerHTML = "";

  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "shape-editor-cell";
      if (shapeMatrix[y][x]) cell.classList.add("active");

      cell.addEventListener("click", () => {
        shapeMatrix[y][x] = !shapeMatrix[y][x];
        playSound("click");
        renderShapeEditor();
      });

      shapeEditor.appendChild(cell);
    }
  }
}

function clearShapeMatrix() {
  shapeMatrix = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => false)
  );
  renderShapeEditor();
}

function fillRectShape(width = 2, height = 2) {
  clearShapeMatrix();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      shapeMatrix[y][x] = true;
    }
  }
  renderShapeEditor();
}

function getShapeCellsFromMatrix() {
  const cells = [];
  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      if (shapeMatrix[y][x]) cells.push({ x, y });
    }
  }

  if (!cells.length) return [];

  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));

  return cells.map((c) => ({
    x: c.x - minX,
    y: c.y - minY
  }));
}

/* =========================
   ACTIVE CELLS
========================= */

function getFixedSlots() {
  const strength = getStrengthValue();
  const slotCount = getSlotCountByStrength(strength);

  const slots = [];
  if (slotCount >= 1) slots.push({ x: 0, y: 0, fixed: true });
  if (slotCount >= 2) slots.push({ x: 0, y: 1, fixed: true });

  return slots;
}

function getRequiredBlueGroupCount() {
  const total = getSlotCountByStrength(getStrengthValue());
  const movable = Math.max(0, total - getFixedSlots().length);
  return Math.floor(movable / 2);
}

function getBlueGroupCells(group, orientation = group.orientation, baseX = group.x, baseY = group.y) {
  if (orientation === "vertical") {
    return [
      { x: baseX, y: baseY },
      { x: baseX, y: baseY + 1 }
    ];
  }

  return [
    { x: baseX, y: baseY },
    { x: baseX + 1, y: baseY }
  ];
}

function getBackpackCells(backpack, baseX = backpack.x, baseY = backpack.y) {
  return backpack.cells.map((cell) => ({
    x: baseX + cell.x,
    y: baseY + cell.y
  }));
}

function getBackpackBounds(backpack) {
  const maxX = Math.max(...backpack.cells.map((c) => c.x));
  const maxY = Math.max(...backpack.cells.map((c) => c.y));
  return {
    width: maxX + 1,
    height: maxY + 1
  };
}

function getAllActiveCells() {
  const map = new Map();

  for (const fixed of getFixedSlots()) {
    map.set(slotKey(fixed.x, fixed.y), { type: "fixed", x: fixed.x, y: fixed.y });
  }

  const groupCount = getRequiredBlueGroupCount();
  for (const group of blueGroups.slice(0, groupCount)) {
    for (const cell of getBlueGroupCells(group)) {
      map.set(slotKey(cell.x, cell.y), { type: "blue", x: cell.x, y: cell.y, groupId: group.id });
    }
  }

  for (const bag of backpackModules) {
    for (const cell of getBackpackCells(bag)) {
      map.set(slotKey(cell.x, cell.y), { type: "backpack", x: cell.x, y: cell.y, backpackId: bag.id });
    }
  }

  return [...map.values()];
}

function isCellActive(x, y) {
  return getAllActiveCells().some((cell) => cell.x === x && cell.y === y);
}

function isCellOccupiedByItem(x, y, ignoreItemId = null) {
  return items.some((item) => {
    if (item.id === ignoreItemId) return false;
    if (item.location !== "inventory") return false;

    const dim = getItemDimensions(item);
    return (
      x >= item.x &&
      x < item.x + dim.width &&
      y >= item.y &&
      y < item.y + dim.height
    );
  });
}

/* =========================
   BLUE GROUPS
========================= */

function canPlaceBlueGroup(group, newX, newY, newOrientation = group.orientation, ignoreGroupId = group.id) {
  const cells = getBlueGroupCells(group, newOrientation, newX, newY);

  for (const cell of cells) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= GRID_COLS || cell.y >= GRID_ROWS) return false;
    if (FIXED_SLOT_KEYS.has(slotKey(cell.x, cell.y))) return false;
    if (isCellOccupiedByItem(cell.x, cell.y)) return false;
  }

  const otherGroups = blueGroups.filter((entry) => entry.id !== ignoreGroupId);
  for (const other of otherGroups) {
    const otherCells = getBlueGroupCells(other);
    for (const cell of cells) {
      if (otherCells.some((otherCell) => otherCell.x === cell.x && otherCell.y === cell.y)) return false;
    }
  }

  for (const bag of backpackModules) {
    const bagCells = getBackpackCells(bag);
    for (const cell of cells) {
      if (bagCells.some((bagCell) => bagCell.x === cell.x && bagCell.y === cell.y)) return false;
    }
  }

  return true;
}

function findFirstFreeBlueGroupSpot(orientation = "horizontal") {
  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      const temp = { id: "__temp__", x, y, orientation };
      if (canPlaceBlueGroup(temp, x, y, orientation, "__temp__")) return { x, y };
    }
  }
  return null;
}

function ensureBlueGroupsCount() {
  const needed = getRequiredBlueGroupCount();

  while (blueGroups.length < needed) {
    const id = `group_${blueGroups.length}`;
    const spot = findFirstFreeBlueGroupSpot("horizontal") || findFirstFreeBlueGroupSpot("vertical");
    blueGroups.push({
      id,
      x: spot ? spot.x : 1,
      y: spot ? spot.y : 0,
      orientation: "horizontal"
    });
  }

  if (blueGroups.length > needed) {
    blueGroups = blueGroups.slice(0, needed);
  }
}

function rotateSelectedBlueGroup(direction = "right") {
  const group = getSelectedBlueGroup();
  if (!group) return;

  const nextOrientation = group.orientation === "horizontal" ? "vertical" : "horizontal";
  if (canPlaceBlueGroup(group, group.x, group.y, nextOrientation, group.id)) {
    group.orientation = nextOrientation;
    playSound("rotate");
    render();
  } else {
    playSound("error");
  }
}

/* =========================
   BACKPACKS
========================= */

function rotateBackpackCells(cells, direction = "right") {
  if (!cells.length) return cells;

  const maxX = Math.max(...cells.map((c) => c.x));
  const maxY = Math.max(...cells.map((c) => c.y));

  let rotated;
  if (direction === "right") {
    rotated = cells.map((cell) => ({
      x: maxY - cell.y,
      y: cell.x
    }));
  } else {
    rotated = cells.map((cell) => ({
      x: cell.y,
      y: maxX - cell.x
    }));
  }

  const minX = Math.min(...rotated.map((c) => c.x));
  const minY = Math.min(...rotated.map((c) => c.y));

  return rotated.map((cell) => ({
    x: cell.x - minX,
    y: cell.y - minY
  }));
}

function canPlaceBackpack(backpack, newX, newY, ignoreBackpackId = backpack.id) {
  const cells = getBackpackCells(backpack, newX, newY);

  for (const cell of cells) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= GRID_COLS || cell.y >= GRID_ROWS) return false;
    if (FIXED_SLOT_KEYS.has(slotKey(cell.x, cell.y))) return false;
    if (isCellOccupiedByItem(cell.x, cell.y)) return false;
  }

  const groupCount = getRequiredBlueGroupCount();
  for (const group of blueGroups.slice(0, groupCount)) {
    const groupCells = getBlueGroupCells(group);
    for (const cell of cells) {
      if (groupCells.some((groupCell) => groupCell.x === cell.x && groupCell.y === cell.y)) return false;
    }
  }

  for (const other of backpackModules) {
    if (other.id === ignoreBackpackId) continue;
    const otherCells = getBackpackCells(other);
    for (const cell of cells) {
      if (otherCells.some((otherCell) => otherCell.x === cell.x && otherCell.y === cell.y)) return false;
    }
  }

  return true;
}

function findFirstFreeBackpackSpot(cells) {
  const temp = { id: "__bag__", x: 0, y: 0, cells };

  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      if (canPlaceBackpack(temp, x, y, "__bag__")) return { x, y };
    }
  }

  return null;
}

function addBackpackFromShape() {
  const cells = getShapeCellsFromMatrix();
  if (!cells.length) {
    playSound("error");
    return;
  }

  const spot = findFirstFreeBackpackSpot(cells);
  if (!spot) {
    playSound("error");
    return;
  }

  const backpack = {
    id: `bag_${Date.now()}`,
    x: spot.x,
    y: spot.y,
    cells
  };

  backpackModules.push(backpack);
  setSelection({ backpackId: backpack.id });
  playSound("drop");
  render();
}

function removeSelectedBackpack() {
  const bag = getSelectedBackpack();
  if (!bag) return;

  backpackModules = backpackModules.filter((entry) => entry.id !== bag.id);
  if (selectedBackpackId === bag.id) selectedBackpackId = null;
  normalizeInventoryItems();
  playSound("click");
  render();
}

function rotateSelectedBackpack(direction = "right") {
  const bag = getSelectedBackpack();
  if (!bag) return;

  const oldCells = structuredClone(bag.cells);
  bag.cells = rotateBackpackCells(bag.cells, direction);

  if (!canPlaceBackpack(bag, bag.x, bag.y, bag.id)) {
    bag.cells = oldCells;
    playSound("error");
    return;
  }

  playSound("rotate");
  render();
}

/* =========================
   ITEMS
========================= */

function canPlaceItem(item, newX, newY) {
  const { width, height } = getItemDimensions(item);

  if (newX < 0 || newY < 0) return false;
  if (newX + width > GRID_COLS) return false;
  if (newY + height > GRID_ROWS) return false;

  for (let yy = newY; yy < newY + height; yy += 1) {
    for (let xx = newX; xx < newX + width; xx += 1) {
      if (!isCellActive(xx, yy)) return false;
    }
  }

  for (const other of items) {
    if (other.id === item.id) continue;
    if (other.location !== "inventory") continue;

    const otherDim = getItemDimensions(other);
    const overlap = !(
      newX + width <= other.x ||
      newX >= other.x + otherDim.width ||
      newY + height <= other.y ||
      newY >= other.y + otherDim.height
    );

    if (overlap) return false;
  }

  return true;
}

function findFirstFreeSpot(item) {
  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      if (canPlaceItem(item, x, y)) return { x, y };
    }
  }
  return null;
}

function moveItemToInventoryFirstFree(item) {
  const spot = findFirstFreeSpot(item);
  if (!spot) return false;

  item.location = "inventory";
  item.slot = null;
  item.x = spot.x;
  item.y = spot.y;
  return true;
}

function moveSelectedItemToShelf() {
  const item = getSelectedItem();
  if (!item) return;
  item.location = "shelf";
  item.slot = null;
  playSound("drop");
  render();
}

function normalizeInventoryItems() {
  for (const item of items) {
    if (item.location !== "inventory") continue;

    if (!canPlaceItem(item, item.x, item.y)) {
      const spot = findFirstFreeSpot(item);
      if (spot) {
        item.x = spot.x;
        item.y = spot.y;
      } else {
        item.location = "shelf";
        item.slot = null;
      }
    }
  }
}

function equipItemToSlot(item, forcedSlot = null) {
  const naturalSlot = getEquipSlotForType(item.tipo);
  const slot = forcedSlot || naturalSlot;

  if (!slot || !naturalSlot || slot !== naturalSlot) return false;

  const occupied = items.find((entry) => entry.location === "equipment" && entry.slot === slot);
  if (occupied) {
    occupied.location = "shelf";
    occupied.slot = null;
  }

  item.location = "equipment";
  item.slot = slot;
  return true;
}

function unequipSelectedItem() {
  const item = getSelectedItem();
  if (!item || item.location !== "equipment") return;
  item.location = "shelf";
  item.slot = null;
  playSound("drop");
  render();
}

function saveSelectedItemText() {
  const item = getSelectedItem();
  if (!item) return;

  item.nome = itemNameInput.value.trim() || item.nome;
  item.descricao = itemDescInput.value.trim() || "";
  playSound("click");
  render();
}

function addSimpleItem() {
  const nome = newItemNameInput.value.trim() || "Novo item";
  const descricao = newItemDescInput.value.trim() || "";
  const width = clamp(Number(newItemWidthInput.value) || 1, 1, GRID_COLS);
  const height = clamp(Number(newItemHeightInput.value) || 1, 1, GRID_ROWS);
  const tipo = newItemTypeInput.value || "misc";
  const file = newItemImageInput.files?.[0];

  function finishCreate(imageUrl = null) {
    const item = {
      id: `item_${Date.now()}`,
      nome,
      tipo,
      width,
      height,
      x: 0,
      y: 0,
      rotated: false,
      rotationDeg: 0,
      location: "shelf",
      slot: null,
      sprite: "📦",
      descricao,
      imageUrl
    };

    items.push(item);
    setSelection({ itemId: item.id });
    playSound("drop");
    render();

    newItemNameInput.value = "";
    newItemDescInput.value = "";
    newItemWidthInput.value = "1";
    newItemHeightInput.value = "1";
    newItemTypeInput.value = "misc";
    newItemImageInput.value = "";
  }

  if (file) {
    const reader = new FileReader();
    reader.onload = () => finishCreate(reader.result);
    reader.readAsDataURL(file);
    return;
  }

  finishCreate(null);
}

/* =========================
   RENDER
========================= */

function createInventoryGrid() {
  inventoryGrid.innerHTML = "";

  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      if (FIXED_SLOT_KEYS.has(slotKey(x, y))) cell.classList.add("fixed-slot-base");
      inventoryGrid.appendChild(cell);
    }
  }
}

function renderBlueGroups() {
  inventoryItemsLayer.querySelectorAll(".slot-group").forEach((node) => node.remove());

  const groupCount = getRequiredBlueGroupCount();
  for (const group of blueGroups.slice(0, groupCount)) {
    const isHorizontal = group.orientation === "horizontal";
    const size = getRectSize(isHorizontal ? 2 : 1, isHorizontal ? 1 : 2);

    const node = document.createElement("div");
    node.className = `slot-group ${group.orientation}`;
    if (group.id === selectedBlueGroupId) node.classList.add("selected");

    node.style.left = `${group.x * STEP}px`;
    node.style.top = `${group.y * STEP}px`;
    node.style.width = `${size.width}px`;
    node.style.height = `${size.height}px`;

    node.addEventListener("click", (event) => {
      event.stopPropagation();

      if (event.altKey) {
        setSelection({ blueGroupId: group.id });
        rotateSelectedBlueGroup("right");
        return;
      }

      playSound("click");
      setSelection({ blueGroupId: group.id });
      render();
    });

    makeGroupDrag(node, group);
    inventoryItemsLayer.appendChild(node);
  }
}

function renderBackpacks() {
  inventoryItemsLayer.querySelectorAll(".backpack-module").forEach((node) => node.remove());

  for (const bag of backpackModules) {
    const bounds = getBackpackBounds(bag);
    const size = getRectSize(bounds.width, bounds.height);

    const node = document.createElement("div");
    node.className = "backpack-module";
    if (bag.id === selectedBackpackId) node.classList.add("selected");

    node.style.left = `${bag.x * STEP}px`;
    node.style.top = `${bag.y * STEP}px`;
    node.style.width = `${size.width}px`;
    node.style.height = `${size.height}px`;

    const rotLabel = document.createElement("div");
    rotLabel.className = "backpack-rot-label";
    rotLabel.textContent = "ALT";
    node.appendChild(rotLabel);

    for (const cell of bag.cells) {
      const mark = document.createElement("div");
      mark.className = "backpack-cell-mark";
      mark.style.left = `${cell.x * STEP}px`;
      mark.style.top = `${cell.y * STEP}px`;
      node.appendChild(mark);
    }

    node.addEventListener("click", (event) => {
      event.stopPropagation();

      if (event.altKey) {
        setSelection({ backpackId: bag.id });
        rotateSelectedBackpack("right");
        return;
      }

      playSound("click");
      setSelection({ backpackId: bag.id });
      render();
    });

    makeBackpackDrag(node, bag);
    inventoryItemsLayer.appendChild(node);
  }
}

function renderInventoryItems() {
  inventoryItemsLayer.querySelectorAll(".item").forEach((node) => node.remove());

  for (const item of items) {
    if (item.location !== "inventory") continue;

    const dim = getItemDimensions(item);
    const node = document.createElement("div");
    node.className = "item";
    if (item.id === selectedItemId) node.classList.add("selected");

    node.style.left = `${item.x * STEP}px`;
    node.style.top = `${item.y * STEP}px`;
    node.style.width = `${dim.width * CELL_SIZE + (dim.width - 1) * CELL_GAP}px`;
    node.style.height = `${dim.height * CELL_SIZE + (dim.height - 1) * CELL_GAP}px`;

    if (item.imageUrl) {
      node.classList.add("has-image");
      node.innerHTML = `
        <img class="item-image" src="${item.imageUrl}" alt="${item.nome}" style="transform: rotate(${item.rotationDeg}deg);" />
        <span class="item-tag">${dim.width}x${dim.height}</span>
      `;
    } else {
      node.innerHTML = `
        <span class="item-icon" style="transform: rotate(${item.rotationDeg}deg)">
          ${item.sprite}
        </span>
        <span class="item-tag">${dim.width}x${dim.height}</span>
      `;
    }

    node.addEventListener("click", (event) => {
      event.stopPropagation();
      playSound("click");
      setSelection({ itemId: item.id });
      render();
    });

    makeInventoryItemDrag(node, item);
    inventoryItemsLayer.appendChild(node);
  }
}

function renderShelfItems() {
  shelfArea.innerHTML = "";

  for (const item of items) {
    if (item.location !== "shelf") continue;

    const dim = getItemDimensions(item);
    const widthPx = dim.width * CELL_SIZE + (dim.width - 1) * CELL_GAP;
    const heightPx = dim.height * CELL_SIZE + (dim.height - 1) * CELL_GAP;

    const node = document.createElement("div");
    node.className = "shelf-item";
    if (item.id === selectedItemId) node.classList.add("selected");

    node.style.width = `${widthPx}px`;
    node.style.height = `${heightPx}px`;

    if (item.imageUrl) {
      node.classList.add("has-image");
      node.innerHTML = `
        <img class="shelf-item-image" src="${item.imageUrl}" alt="${item.nome}" style="transform: rotate(${item.rotationDeg}deg);" />
        <span class="item-tag">${dim.width}x${dim.height}</span>
      `;
    } else {
      node.innerHTML = `
        <span class="item-icon" style="transform: rotate(${item.rotationDeg}deg)">
          ${item.sprite}
        </span>
        <span class="item-tag">${dim.width}x${dim.height}</span>
      `;
    }

    node.addEventListener("click", (event) => {
      event.stopPropagation();

      if (event.shiftKey) {
        if (moveItemToInventoryFirstFree(item)) playSound("drop");
        else playSound("error");
        setSelection({ itemId: item.id });
        render();
        return;
      }

      playSound("click");
      setSelection({ itemId: item.id });
      render();
    });

    makeShelfItemDrag(node, item);
    shelfArea.appendChild(node);
  }
}

function renderEquipment() {
  equipmentSlots.forEach((slotEl) => {
    const slotName = slotEl.dataset.slot;
    const equipped = items.find((item) => item.location === "equipment" && item.slot === slotName);

    if (equipped) {
      slotEl.classList.add("filled");
      slotEl.textContent = `${equipped.sprite} ${equipped.nome}`;
    } else {
      slotEl.classList.remove("filled");
      slotEl.textContent = slotLabel(slotName);
    }
  });
}

function renderSelectedInfo() {
  const item = getSelectedItem();
  const bag = getSelectedBackpack();
  const group = getSelectedBlueGroup();

  if (item) {
    const dim = getItemDimensions(item);
    selectedInfo.innerHTML = `
      <strong>${item.nome}</strong><br>
      Tipo: ${item.tipo}<br>
      Tamanho: ${dim.width}x${dim.height}<br>
      Local: ${translateLocation(item.location)}<br>
      Rotação visual: ${item.rotationDeg}°<br>
      <span>${item.descricao}</span>
    `;
    return;
  }

  if (bag) {
    selectedInfo.innerHTML = `
      <strong>Mochila livre</strong><br>
      Células: ${bag.cells.length}<br>
      Posição: ${bag.x}, ${bag.y}<br>
      <span>Formato desenhado manualmente.</span>
    `;
    return;
  }

  if (group) {
    selectedInfo.innerHTML = `
      <strong>Grupo azul</strong><br>
      Tipo: módulo duplo<br>
      Orientação: ${group.orientation === "horizontal" ? "Horizontal" : "Vertical"}<br>
      Posição: ${group.x}, ${group.y}<br>
      <span>Use Alt + clique ou os botões Girar.</span>
    `;
    return;
  }

  selectedInfo.textContent = "Nenhum item selecionado.";
}

function renderThemeButtons() {
  const theme = document.body.dataset.theme || "blue";
  themeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === theme);
  });
}

function renderPanelButtons() {
  toggleLeftPanelBtn.textContent = leftPanel.classList.contains("collapsed") ? "+" : "—";
  toggleRightPanelBtn.textContent = rightPanel.classList.contains("collapsed") ? "+" : "—";
  renderLeftCardButtons();
}

function render() {
  ensureBlueGroupsCount();
  normalizeInventoryItems();
  createInventoryGrid();
  renderBlueGroups();
  renderBackpacks();
  renderInventoryItems();
  renderShelfItems();
  renderEquipment();
  renderSelectedInfo();
  renderThemeButtons();
  updateSlotsLockButton();
  syncSelectedEditors();
  syncBrandEditors();
  renderKeybinds();
  renderPanelButtons();
}

/* =========================
   DRAG CORE
========================= */

function buildGhostFromNode(node) {
  const ghost = node.cloneNode(true);
  ghost.style.pointerEvents = "none";
  return ghost;
}

function startDragSession({
  downEvent,
  originElement,
  createGhost,
  onClick,
  onMoveValidate,
  onDropCommit,
  blockDrag = false,
  hiddenClass
}) {
  if (downEvent.button !== 0) return;

  let started = false;
  let ghost = null;
  let lastGridPos = null;
  let pointerOffsetX = 0;
  let pointerOffsetY = 0;

  const originRect = originElement.getBoundingClientRect();
  const startX = downEvent.clientX;
  const startY = downEvent.clientY;

  pointerOffsetX = startX - originRect.left;
  pointerOffsetY = startY - originRect.top;

  function cleanup() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    if (ghost) ghost.remove();
    originElement.classList.remove(hiddenClass);
  }

  function onMove(moveEvent) {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    const distance = Math.hypot(dx, dy);

    if (!started && distance >= DRAG_THRESHOLD) {
      if (blockDrag) return;
      started = true;
      ghost = createGhost();
      ghost.classList.add("drag-ghost");
      ghost.style.width = `${originRect.width}px`;
      ghost.style.height = `${originRect.height}px`;
      document.body.appendChild(ghost);
      originElement.classList.add(hiddenClass);
    }

    if (!started) return;

    moveEvent.preventDefault();

    ghost.style.left = `${moveEvent.clientX - pointerOffsetX}px`;
    ghost.style.top = `${moveEvent.clientY - pointerOffsetY}px`;

    const pos = getGridPositionFromPointer(moveEvent.clientX, moveEvent.clientY, pointerOffsetX, pointerOffsetY);
    lastGridPos = pos;

    ghost.classList.toggle("invalid", !onMoveValidate(pos.x, pos.y));
  }

  function onUp(upEvent) {
    if (!started) {
      cleanup();
      onClick(upEvent);
      return;
    }

    cleanup();

    if (lastGridPos) onDropCommit(lastGridPos.x, lastGridPos.y, upEvent);
    else onDropCommit(null, null, upEvent);
  }

  document.addEventListener("mousemove", onMove, { passive: false });
  document.addEventListener("mouseup", onUp);
}

/* =========================
   DRAG GROUP
========================= */

function makeGroupDrag(node, group) {
  node.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    startDragSession({
      downEvent: event,
      originElement: node,
      hiddenClass: "group-origin-hidden",
      blockDrag: slotsLocked,
      createGhost: () => buildGhostFromNode(node),
      onClick: (upEvent) => {
        if (upEvent.altKey) {
          setSelection({ blueGroupId: group.id });
          rotateSelectedBlueGroup("right");
          return;
        }

        playSound("click");
        setSelection({ blueGroupId: group.id });
        render();
      },
      onMoveValidate: (x, y) => canPlaceBlueGroup(group, x, y, group.orientation, group.id),
      onDropCommit: (x, y) => {
        if (x !== null && canPlaceBlueGroup(group, x, y, group.orientation, group.id)) {
          group.x = x;
          group.y = y;
          playSound("drop");
        }
        render();
      }
    });
  });
}

/* =========================
   DRAG BACKPACK
========================= */

function makeBackpackDrag(node, bag) {
  node.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    startDragSession({
      downEvent: event,
      originElement: node,
      hiddenClass: "backpack-origin-hidden",
      blockDrag: slotsLocked,
      createGhost: () => buildGhostFromNode(node),
      onClick: (upEvent) => {
        if (upEvent.altKey) {
          setSelection({ backpackId: bag.id });
          rotateSelectedBackpack("right");
          return;
        }

        playSound("click");
        setSelection({ backpackId: bag.id });
        render();
      },
      onMoveValidate: (x, y) => canPlaceBackpack(bag, x, y, bag.id),
      onDropCommit: (x, y) => {
        if (x !== null && canPlaceBackpack(bag, x, y, bag.id)) {
          bag.x = x;
          bag.y = y;
          playSound("drop");
        }
        render();
      }
    });
  });
}

/* =========================
   DRAG INVENTORY ITEM
========================= */

function makeInventoryItemDrag(node, item) {
  node.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    startDragSession({
      downEvent: event,
      originElement: node,
      hiddenClass: "item-origin-hidden",
      createGhost: () => buildGhostFromNode(node),
      onClick: () => {
        playSound("click");
        setSelection({ itemId: item.id });
        render();
      },
      onMoveValidate: (x, y) => (x === null ? true : canPlaceItem(item, x, y)),
      onDropCommit: (x, y, upEvent) => {
        const droppedEquipSlot = getEquipSlotUnderPointer(upEvent.clientX, upEvent.clientY);
        if (droppedEquipSlot) {
          if (equipItemToSlot(item, droppedEquipSlot)) playSound("equip");
          else playSound("error");
          render();
          return;
        }

        const droppedInShelf = isPointerInsideElement(upEvent.clientX, upEvent.clientY, shelfArea);
        if (droppedInShelf) {
          item.location = "shelf";
          item.slot = null;
          playSound("drop");
          render();
          return;
        }

        const droppedInInventory = isPointerInsideElement(upEvent.clientX, upEvent.clientY, inventoryItemsLayer);
        if (droppedInInventory && x !== null && canPlaceItem(item, x, y)) {
          item.x = x;
          item.y = y;
          playSound("drop");
        }

        render();
      }
    });
  });
}

/* =========================
   DRAG SHELF ITEM
========================= */

function makeShelfItemDrag(node, item) {
  node.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    startDragSession({
      downEvent: event,
      originElement: node,
      hiddenClass: "shelf-origin-hidden",
      createGhost: () => buildGhostFromNode(node),
      onClick: (upEvent) => {
        if (upEvent.shiftKey) {
          if (moveItemToInventoryFirstFree(item)) playSound("drop");
          else playSound("error");
          setSelection({ itemId: item.id });
          render();
          return;
        }

        playSound("click");
        setSelection({ itemId: item.id });
        render();
      },
      onMoveValidate: (x, y) => (x === null ? true : canPlaceItem(item, x, y)),
      onDropCommit: (x, y, upEvent) => {
        const droppedEquipSlot = getEquipSlotUnderPointer(upEvent.clientX, upEvent.clientY);
        if (droppedEquipSlot) {
          if (equipItemToSlot(item, droppedEquipSlot)) playSound("equip");
          else playSound("error");
          render();
          return;
        }

        const droppedInInventory = isPointerInsideElement(upEvent.clientX, upEvent.clientY, inventoryItemsLayer);
        if (droppedInInventory && x !== null && canPlaceItem(item, x, y)) {
          item.location = "inventory";
          item.slot = null;
          item.x = x;
          item.y = y;
          playSound("drop");
        }

        render();
      }
    });
  });
}

/* =========================
   ACTIONS
========================= */

function deleteSelectedItemPrompt() {
  const item = getSelectedItem();
  if (!item) {
    playSound("error");
    return;
  }
  openDeleteModal(item);
  playSound("click");
}

function rotateSelected(direction = "right") {
  const item = getSelectedItem();
  if (item && item.location === "inventory") {
    const oldRotated = item.rotated;
    const oldDeg = item.rotationDeg;
    const oldX = item.x;
    const oldY = item.y;

    item.rotated = !item.rotated;
    item.rotationDeg += direction === "right" ? 90 : -90;

    if (canPlaceItem(item, item.x, item.y)) {
      playSound("rotate");
      render();
      return;
    }

    const oldDim = oldRotated
      ? { width: item.height, height: item.width }
      : { width: item.width, height: item.height };
    const newDim = getItemDimensions(item);

    const pivotX = item.x + Math.floor(oldDim.width / 2);
    const pivotY = item.y + Math.floor(oldDim.height / 2);

    const candidateX = pivotX - Math.floor(newDim.width / 2);
    const candidateY = pivotY - Math.floor(newDim.height / 2);

    if (canPlaceItem(item, candidateX, candidateY)) {
      item.x = candidateX;
      item.y = candidateY;
      playSound("rotate");
      render();
      return;
    }

    item.rotated = oldRotated;
    item.rotationDeg = oldDeg;
    item.x = oldX;
    item.y = oldY;
    playSound("error");
    return;
  }

  const group = getSelectedBlueGroup();
  if (group) {
    rotateSelectedBlueGroup(direction);
    return;
  }

  const bag = getSelectedBackpack();
  if (bag) rotateSelectedBackpack(direction);
}

function moveSelectedBy(dx, dy) {
  const item = getSelectedItem();
  if (!item || item.location !== "inventory") return;

  const newX = item.x + dx;
  const newY = item.y + dy;

  if (canPlaceItem(item, newX, newY)) {
    item.x = newX;
    item.y = newY;
    playSound("drop");
    render();
  } else {
    playSound("error");
  }
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  playSound("click");
  renderThemeButtons();
}

function resetLayout() {
  items = structuredClone(initialItems);
  blueGroups = structuredClone(initialBlueGroups);
  backpackModules = structuredClone(initialBackpacks);
  setSelection();
  slotsLocked = true;
  controlsPanelCollapsed = false;
  waitingKeybindAction = null;
  pendingDeleteItemId = null;
  keybinds = {
    rotateRight: "r",
    rotateLeft: "q",
    moveLeft: "arrowleft",
    moveRight: "arrowright",
    moveUp: "arrowup",
    moveDown: "arrowdown"
  };
  clearShapeMatrix();
  fillRectShape(2, 2);
  ensureBlueGroupsCount();
  normalizeInventoryItems();
  renderCharacterAvatar(null);
  brandTitle.textContent = "Inventário Modular";
  brandSubtitle.textContent = "";
  leftPanel.classList.remove("collapsed");
  rightPanel.classList.remove("collapsed");
  leftPanelBody.querySelectorAll(".dock-card").forEach((card) => card.classList.remove("collapsed"));
  closeDeleteModal();
  playSound("click");
  render();
}

/* =========================
   EVENTS
========================= */

rotateRightBtn.addEventListener("click", () => rotateSelected("right"));
rotateLeftBtn.addEventListener("click", () => rotateSelected("left"));

toggleSlotsLockBtn.addEventListener("click", () => {
  slotsLocked = !slotsLocked;
  playSound("click");
  render();
});

unequipBtn.addEventListener("click", unequipSelectedItem);
moveToShelfBtn.addEventListener("click", moveSelectedItemToShelf);
deleteItemBtn.addEventListener("click", deleteSelectedItemPrompt);
resetBtn.addEventListener("click", resetLayout);

confirmDeleteBtn.addEventListener("click", deletePendingItem);
cancelDeleteBtn.addEventListener("click", closeDeleteModal);
confirmModal.addEventListener("click", (event) => {
  if (event.target === confirmModal) closeDeleteModal();
});

settingsToggleBtn.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
  playSound("click");
});

closeSettingsBtn.addEventListener("click", () => {
  settingsPanel.classList.add("hidden");
  playSound("click");
});

toggleControlsPanelBtn.addEventListener("click", () => {
  controlsPanelCollapsed = !controlsPanelCollapsed;
  playSound("click");
  renderKeybinds();
});

soundEnabledInput.addEventListener("change", () => {
  soundEnabled = soundEnabledInput.checked;
  if (soundEnabled) playSound("click");
});

toggleLeftPanelBtn.addEventListener("click", () => {
  leftPanel.classList.toggle("collapsed");
  playSound("click");
  renderPanelButtons();
});

toggleRightPanelBtn.addEventListener("click", () => {
  rightPanel.classList.toggle("collapsed");
  playSound("click");
  renderPanelButtons();
});

characterAvatarInput.addEventListener("change", () => {
  const file = characterAvatarInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    renderCharacterAvatar(reader.result);
    playSound("click");
  };
  reader.readAsDataURL(file);
});

saveBrandTextBtn.addEventListener("click", () => {
  brandTitle.textContent = brandTitleInput.value.trim() || "Inventário Modular";
  brandSubtitle.textContent = brandSubtitleInput.value.trim() || "";
  playSound("click");
});

addBackpackBtn.addEventListener("click", addBackpackFromShape);
removeBackpackBtn.addEventListener("click", removeSelectedBackpack);
clearShapeBtn.addEventListener("click", () => {
  clearShapeMatrix();
  playSound("click");
});
fillRectShapeBtn.addEventListener("click", () => {
  fillRectShape(2, 2);
  playSound("click");
});

saveItemTextBtn.addEventListener("click", saveSelectedItemText);
addItemBtn.addEventListener("click", addSimpleItem);

strengthInput.addEventListener("input", () => {
  ensureBlueGroupsCount();
  normalizeInventoryItems();
  render();
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.theme);
  });
});

window.addEventListener("keydown", (event) => {
  if (waitingKeybindAction && !isTypingInField(event.target)) {
    event.preventDefault();

    const key = event.key.toLowerCase();

    if (key === "escape") {
      waitingKeybindAction = null;
      keybindWarning.textContent = "Alteração cancelada.";
      keybindWarning.classList.remove("error");
      renderKeybinds();
      playSound("click");
      return;
    }

    const ok = setKeybind(waitingKeybindAction, key);
    if (ok) waitingKeybindAction = null;
    return;
  }

  if (!confirmModal.classList.contains("hidden")) {
    if (event.key === "Escape") {
      closeDeleteModal();
    }
    return;
  }

  if (isTypingInField(event.target)) return;

  const key = event.key.toLowerCase();

  if (key === keybinds.rotateRight) {
    event.preventDefault();
    rotateSelected("right");
    return;
  }

  if (key === keybinds.rotateLeft) {
    event.preventDefault();
    rotateSelected("left");
    return;
  }

  if (key === keybinds.moveLeft) {
    event.preventDefault();
    moveSelectedBy(-1, 0);
    return;
  }

  if (key === keybinds.moveRight) {
    event.preventDefault();
    moveSelectedBy(1, 0);
    return;
  }

  if (key === keybinds.moveUp) {
    event.preventDefault();
    moveSelectedBy(0, -1);
    return;
  }

  if (key === keybinds.moveDown) {
    event.preventDefault();
    moveSelectedBy(0, 1);
  }
});

inventoryItemsLayer.addEventListener("click", (event) => {
  if (event.target === inventoryItemsLayer) {
    setSelection();
    render();
  }
});

shelfArea.addEventListener("click", (event) => {
  if (event.target === shelfArea) {
    setSelection();
    render();
  }
});

equipmentSlots.forEach((slotEl) => {
  slotEl.addEventListener("click", (event) => {
    const equipped = items.find((item) => item.location === "equipment" && item.slot === slotEl.dataset.slot);

    if (event.shiftKey && equipped) {
      equipped.location = "shelf";
      equipped.slot = null;
      setSelection({ itemId: equipped.id });
      playSound("drop");
      render();
      return;
    }

    if (equipped) {
      playSound("click");
      setSelection({ itemId: equipped.id });
      render();
      return;
    }

    const selected = getSelectedItem();
    if (!selected) return;

    if (equipItemToSlot(selected, slotEl.dataset.slot)) playSound("equip");
    else playSound("error");
    render();
  });
});

/* =========================
   START
========================= */

fillRectShape(2, 2);
ensureBlueGroupsCount();
normalizeInventoryItems();
renderShapeEditor();
renderCharacterAvatar(null);
setupLeftCards();
render();
/* =========================
   V07 - Ficha One Dice sync / drawers
========================= */
function getOneDiceSettings() {
  try {
    return JSON.parse(localStorage.getItem("od_settings") || "{}");
  } catch (_) {
    return {};
  }
}

function applyOneDiceVisualSettings(settings = getOneDiceSettings()) {
  const accent = settings.accent || "black";
  const font = settings.font || "impact";
  const theme = settings.theme || "light";
  document.body.dataset.accent = accent;
  document.body.dataset.font = font;
  document.body.classList.toggle("dark-sheet", theme === "dark");
  // Mantém compatibilidade com funções antigas do módulo.
  document.body.dataset.theme = accent === "black" ? "blue" : accent;
}

function openToolDrawer(cardId) {
  document.querySelectorAll(".tool-drawer").forEach((drawer) => drawer.classList.add("hidden"));
  const drawer = document.querySelector(`.tool-drawer[data-card-id="${cardId}"]`);
  if (drawer) {
    drawer.classList.remove("hidden");
    playSound("click");
  }
}

function closeToolDrawers() {
  document.querySelectorAll(".tool-drawer").forEach((drawer) => drawer.classList.add("hidden"));
}

applyOneDiceVisualSettings();
window.addEventListener("storage", (event) => {
  if (event.key === "od_settings") applyOneDiceVisualSettings();
});
window.addEventListener("message", (event) => {
  if (event?.data?.type === "od-settings") applyOneDiceVisualSettings(event.data.settings || {});
});

document.getElementById("openAddItemDrawerBtn")?.addEventListener("click", () => openToolDrawer("addItem"));
document.getElementById("openBackpackDrawerBtn")?.addEventListener("click", () => {
  renderShapeEditor();
  openToolDrawer("backpack");
});
document.querySelectorAll("[data-close-drawer]").forEach((button) => {
  button.addEventListener("click", closeToolDrawers);
});

// Fecha a janela modular depois de confirmar ações principais.
document.getElementById("addItemBtn")?.addEventListener("click", () => setTimeout(closeToolDrawers, 80));
document.getElementById("addBackpackBtn")?.addEventListener("click", () => setTimeout(closeToolDrawers, 80));

function runOneDiceInventoryShortcut(key) {
  const normalized = String(key || "").toLowerCase();
  if (normalized === keybinds.rotateRight) return rotateSelected("right");
  if (normalized === keybinds.rotateLeft) return rotateSelected("left");
  if (normalized === keybinds.moveLeft) return moveSelectedBy(-1, 0);
  if (normalized === keybinds.moveRight) return moveSelectedBy(1, 0);
  if (normalized === keybinds.moveUp) return moveSelectedBy(0, -1);
  if (normalized === keybinds.moveDown) return moveSelectedBy(0, 1);
}
window.addEventListener("message", (event) => {
  if (event?.data?.type === "od-keydown") runOneDiceInventoryShortcut(event.data.key);
});

/* =========================
   V12 - modal real integrado, sem depender dos drawers
========================= */
function v12EnsureModalRoot() {
  let root = document.getElementById('v12InventoryModalRoot');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'v12InventoryModalRoot';
  root.className = 'v12-modal-root hidden';
  root.innerHTML = `
    <div class="v12-modal-backdrop" data-v12-close="1"></div>
    <section class="v12-modal-card manga-panel" role="dialog" aria-modal="true">
      <button class="v12-modal-close" type="button" data-v12-close="1">×</button>
      <div id="v12ItemModal" class="v12-modal-content hidden">
        <h2>Adicionar Item</h2>
        <p class="hint">Defina o tamanho em slots. A imagem será encaixada automaticamente no bloco.</p>
        <div class="v12-modal-grid">
          <label>Nome<input id="v12ItemName" class="field-input" type="text" placeholder="Nome do item"></label>
          <label>Tipo
            <select id="v12ItemType" class="field-input">
              <option value="misc">Geral</option>
              <option value="cabeca">Cabeça</option>
              <option value="bracos">Braços</option>
              <option value="tronco">Tronco</option>
              <option value="pernas">Pernas</option>
            </select>
          </label>
          <label>Largura<input id="v12ItemWidth" class="field-input" type="number" min="1" max="6" value="1"></label>
          <label>Altura<input id="v12ItemHeight" class="field-input" type="number" min="1" max="6" value="1"></label>
        </div>
        <label>Descrição<textarea id="v12ItemDesc" class="field-textarea" rows="4" placeholder="Descrição do item"></textarea></label>
        <label>Imagem / Ícone<input id="v12ItemImage" class="field-input" type="file" accept="image/png,image/*"></label>
        <div class="v12-modal-actions">
          <button class="btn secondary" type="button" data-v12-close="1">Cancelar</button>
          <button id="v12ConfirmItem" class="btn" type="button">Adicionar item</button>
        </div>
      </div>

      <div id="v12BackpackModal" class="v12-modal-content hidden">
        <h2>Criar Mochila</h2>
        <p class="hint">Clique nos quadrados para desenhar o formato da mochila em slots.</p>
        <div id="v12BackpackShape" class="v12-shape-editor"></div>
        <div class="v12-modal-actions wrap">
          <button id="v12ClearBackpack" class="btn secondary" type="button">Limpar</button>
          <button id="v12RectBackpack" class="btn secondary" type="button">Retângulo 2x2</button>
          <button class="btn secondary" type="button" data-v12-close="1">Cancelar</button>
          <button id="v12ConfirmBackpack" class="btn" type="button">Adicionar mochila</button>
        </div>
      </div>
    </section>
  `;
  document.body.appendChild(root);

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-v12-close]')) v12CloseModal();
  });

  root.querySelector('#v12ConfirmItem').addEventListener('click', v12CreateItemFromModal);
  root.querySelector('#v12ConfirmBackpack').addEventListener('click', v12CreateBackpackFromModal);
  root.querySelector('#v12ClearBackpack').addEventListener('click', () => {
    v12ShapeMatrix = v12EmptyShape();
    v12RenderShapeEditor();
  });
  root.querySelector('#v12RectBackpack').addEventListener('click', () => {
    v12ShapeMatrix = v12EmptyShape();
    for (let y = 0; y < 2; y += 1) {
      for (let x = 0; x < 2; x += 1) v12ShapeMatrix[y][x] = true;
    }
    v12RenderShapeEditor();
  });

  return root;
}

function v12OpenModal(kind) {
  const root = v12EnsureModalRoot();
  root.classList.remove('hidden');
  root.querySelector('#v12ItemModal').classList.toggle('hidden', kind !== 'item');
  root.querySelector('#v12BackpackModal').classList.toggle('hidden', kind !== 'backpack');
  if (kind === 'item') {
    root.querySelector('#v12ItemName').focus();
  }
  if (kind === 'backpack') {
    v12ShapeMatrix = v12EmptyShape();
    v12RenderShapeEditor();
  }
  playSound('click');
}

function v12CloseModal() {
  const root = document.getElementById('v12InventoryModalRoot');
  if (root) root.classList.add('hidden');
}

function v12CreateItemFromModal() {
  const root = v12EnsureModalRoot();
  const nome = root.querySelector('#v12ItemName').value.trim() || 'Novo item';
  const descricao = root.querySelector('#v12ItemDesc').value.trim() || '';
  const width = clamp(Number(root.querySelector('#v12ItemWidth').value) || 1, 1, GRID_COLS);
  const height = clamp(Number(root.querySelector('#v12ItemHeight').value) || 1, 1, GRID_ROWS);
  const tipo = root.querySelector('#v12ItemType').value || 'misc';
  const file = root.querySelector('#v12ItemImage').files?.[0];

  function finishCreate(imageUrl = null) {
    const item = {
      id: `item_${Date.now()}`,
      nome,
      tipo,
      width,
      height,
      x: 0,
      y: 0,
      rotated: false,
      rotationDeg: 0,
      location: 'shelf',
      slot: null,
      sprite: '📦',
      descricao,
      imageUrl
    };

    items.push(item);
    setSelection({ itemId: item.id });
    root.querySelector('#v12ItemName').value = '';
    root.querySelector('#v12ItemDesc').value = '';
    root.querySelector('#v12ItemWidth').value = '1';
    root.querySelector('#v12ItemHeight').value = '1';
    root.querySelector('#v12ItemType').value = 'misc';
    root.querySelector('#v12ItemImage').value = '';
    playSound('drop');
    render();
    v12CloseModal();
  }

  if (file) {
    const reader = new FileReader();
    reader.onload = () => finishCreate(reader.result);
    reader.readAsDataURL(file);
    return;
  }

  finishCreate(null);
}

let v12ShapeMatrix = v12EmptyShape();

function v12EmptyShape() {
  return Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => false));
}

function v12RenderShapeEditor() {
  const editor = document.getElementById('v12BackpackShape');
  if (!editor) return;
  editor.innerHTML = '';

  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'v12-shape-cell';
      if (v12ShapeMatrix[y][x]) cell.classList.add('active');
      cell.addEventListener('click', () => {
        v12ShapeMatrix[y][x] = !v12ShapeMatrix[y][x];
        playSound('click');
        v12RenderShapeEditor();
      });
      editor.appendChild(cell);
    }
  }
}

function v12ShapeCells() {
  const cells = [];
  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      if (v12ShapeMatrix[y][x]) cells.push({ x, y });
    }
  }
  if (!cells.length) return [];
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  return cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
}

function v12CreateBackpackFromModal() {
  const cells = v12ShapeCells();
  if (!cells.length) {
    playSound('error');
    return;
  }

  const spot = findFirstFreeBackpackSpot(cells);
  if (!spot) {
    playSound('error');
    return;
  }

  const backpack = {
    id: `bag_${Date.now()}`,
    x: spot.x,
    y: spot.y,
    cells
  };

  backpackModules.push(backpack);
  setSelection({ backpackId: backpack.id });
  playSound('drop');
  render();
  v12CloseModal();
}

function v12RebindToolbarButtons() {
  const itemBtn = document.getElementById('openAddItemDrawerBtn');
  const bagBtn = document.getElementById('openBackpackDrawerBtn');
  if (itemBtn) {
    const clone = itemBtn.cloneNode(true);
    itemBtn.replaceWith(clone);
    clone.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      v12OpenModal('item');
    });
  }
  if (bagBtn) {
    const clone = bagBtn.cloneNode(true);
    bagBtn.replaceWith(clone);
    clone.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      v12OpenModal('backpack');
    });
  }
}

v12EnsureModalRoot();
v12RebindToolbarButtons();


/* =========================
   V13 - ligação definitiva dos botões + Item e + Mochila
   Remove dependência dos drawers antigos e usa apenas o modal real.
========================= */
window.oneDiceV13OpenItem = function () { v12OpenModal('item'); };
window.oneDiceV13OpenBackpack = function () { v12OpenModal('backpack'); };

function v13BindFinalInventoryButtons() {
  const itemBtn = document.getElementById('openAddItemDrawerBtn');
  const bagBtn = document.getElementById('openBackpackDrawerBtn');

  if (itemBtn) {
    itemBtn.onclick = null;
    itemBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      v12OpenModal('item');
    });
  }

  if (bagBtn) {
    bagBtn.onclick = null;
    bagBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      v12OpenModal('backpack');
    });
  }
}

// Delegação final: mesmo se algum render trocar o botão, o clique continua funcionando.
document.addEventListener('click', function (event) {
  const itemBtn = event.target.closest('#openAddItemDrawerBtn');
  const bagBtn = event.target.closest('#openBackpackDrawerBtn');

  if (itemBtn) {
    event.preventDefault();
    event.stopPropagation();
    v12OpenModal('item');
    return;
  }

  if (bagBtn) {
    event.preventDefault();
    event.stopPropagation();
    v12OpenModal('backpack');
  }
}, false);

v13BindFinalInventoryButtons();
