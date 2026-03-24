'use strict';
/* ============================================================
   StudyQuest — script.js
   Transforms study notes into Roblox / CoD / R6S explanations
   via the OpenAI Chat Completions API (gpt-4o-mini).
   ============================================================ */

// ── Game Configurations ──────────────────────────────────────
const GAMES = {

  roblox: {
    name:    'Roblox',
    icon:    '🟥',
    heading: 'Roblox Tutorial Mode',
    loadMsg: '🏗️ Building your learning obby...',
    system: `You are StudyQuest, an enthusiastic Roblox-themed educational tutor!
Your mission: transform study material into fun, memorable explanations using Roblox references.

Draw on these Roblox elements naturally:
• Games: Blox Fruits, Adopt Me, Jailbreak, Tower of Hell, Murder Mystery 2, Brookhaven, Piggy, Doors
• Mechanics: Robux, XP, leveling up, game passes, VIP servers, obbies, spawning, respawning, Roblox Studio, Lua scripting
• Terms: noob, pro, admin, building, accessories, avatar, checkpoint, void
• Analogies: "think of this like earning Robux", "this step is the checkpoint before the final boss obby"

Output format:
1. First line: "🟥 ROBLOX STUDY MODE: [Topic Name]"
2. ## section headings with Roblox-themed names
3. **Bold** all key terms
4. Bullet lists for sub-points
5. Finish with a "🏆 Achievement Unlocked:" paragraph summarising the key takeaways
Keep it fun and energetic while keeping the educational content 100% accurate.`
  },

  cod: {
    name:    'Call of Duty',
    icon:    '🎖️',
    heading: 'COD Mission Briefing',
    loadMsg: '🔫 Loading mission intel...',
    system: `You are StudyQuest, a Call of Duty tactical instructor!
Transform study material into military mission briefings using COD references.

Draw on these COD elements naturally:
• Titles/modes: Modern Warfare, Warzone, Black Ops, MW2, Zombies
• Mechanics: loadouts, killstreaks, perks, field upgrades, UAV (overview/surveillance), airstrike, VTOL
• Weapons + attachments: M4, AK-47, MP5, sniper, shotgun, scope, silencer, grip tape
• Maps: Shipment, Nuketown, Verdansk, Rebirth Island, Highrise
• Terminology: ADS, flanking, holding an angle, cover & concealment, clutch, hardscoping, spawn
• Analogies: "the UAV reveals the big picture", "flanking = approaching from an unexpected direction"

Output format:
1. "🎖️ MISSION BRIEFING — [TOPIC IN CAPS]"
2. ## INTEL REPORT (background / introduction)
3. ## TACTICAL BREAKDOWN sections for each main concept (give them COD-flavoured names)
4. **Bold** critical intel / key terms; bullet lists for sub-points
5. Finish with "🏆 KILLSTREAK EARNED: [one-paragraph key-takeaway summary]"
Write like a mix between a military briefing and a COD loading-screen tip. Keep education accurate.`
  },

  r6s: {
    name:    'Rainbow Six Siege',
    icon:    '🛡️',
    heading: 'R6S Operator Dossier',
    loadMsg: '🔍 Analysing site intel...',
    system: `You are StudyQuest, a Rainbow Six Siege tactical analyst!
Transform study material into operator dossiers and tactical briefings using R6S references.

Draw on these R6S elements naturally:
• Attack operators: Thermite (exothermic charge), Ash (breaching round), Hibana (X-KAIROS), Sledge, Twitch, Nomad
• Defence operators: Jäger (ADS), Bandit (batteries), Doc (stim pistol), Rook (armour pack), Maestro (Evil Eye), Vigil
• Mechanics: soft walls, hard walls, reinforcing, droning, roaming, anchoring, rotate holes, breach & clear
• Maps / callouts: Oregon, Border, Clubhouse, Coastline, Consulate
• Concepts: intel gathering, site setup, gadget interactions, flanking routes, spawn peeks, defuser plant
• Roles: Fragger, Hard Breach, Soft Breach, Intel, Support, Roamer, Anchor

Output format:
1. "🛡️ OPERATOR INTEL DOSSIER — [TOPIC]"
2. CLASSIFICATION: Easy / Intermediate / Advanced (based on topic complexity)
3. ## OPERATOR BACKGROUND (introduction)
4. ## TACTICAL ABILITY sections for each concept (name each section like an operator gadget/ability)
5. ## GADGET SYNERGIES (how the concepts connect / interact)
6. **Bold** key terms; bullet lists for sub-points
7. Finish with "🏆 RANKED UP: [one-paragraph mastery summary]"
Write like an official R6S operator dossier. Precise, tactical, thorough.`
  }
};

// ── State ────────────────────────────────────────────────────
let currentGame = 'roblox';
let lastNotes   = '';
let startTime   = 0;

// ── DOM helpers ──────────────────────────────────────────────
const $ = id => document.getElementById(id);

const apiKeyInput    = $('apiKey');
const toggleKeyBtn   = $('toggleKey');
const studyInput     = $('studyInput');
const charCountEl    = $('charCount');
const transformBtn   = $('transformBtn');
const btnText        = $('btnText');
const outputIcon     = $('outputIcon');
const outputTitle    = $('outputTitle');
const copyBtn        = $('copyBtn');
const stateIdle      = $('stateIdle');
const stateLoading   = $('stateLoading');
const stateResult    = $('stateResult');
const stateError     = $('stateError');
const resultContent  = $('resultContent');
const errorMsgEl     = $('errorMsg');
const retryBtn       = $('retryBtn');
const statsBar       = $('statsBar');
const statWords      = $('statWords');
const statTime       = $('statTime');
const statGame       = $('statGame');
const loadingMsgEl   = $('loadingMsg');

// ── Init ─────────────────────────────────────────────────────
(function init() {
  // Restore saved API key
  const savedKey = localStorage.getItem('sq_apikey');
  if (savedKey) apiKeyInput.value = savedKey;

  // Restore saved game choice
  const savedGame = localStorage.getItem('sq_game');
  if (savedGame && GAMES[savedGame]) setGame(savedGame);

  // Game card clicks
  document.querySelectorAll('.game-btn').forEach(btn => {
    btn.addEventListener('click', () => setGame(btn.dataset.game));
  });

  // Buttons
  transformBtn.addEventListener('click', run);
  retryBtn.addEventListener('click', run);
  toggleKeyBtn.addEventListener('click', toggleKeyVisibility);
  copyBtn.addEventListener('click', copyResult);

  // Character counter
  studyInput.addEventListener('input', () => {
    const n = studyInput.value.length;
    charCountEl.textContent = `${n.toLocaleString()} character${n !== 1 ? 's' : ''}`;
  });

  // Persist API key on change
  apiKeyInput.addEventListener('change', () => {
    const key = apiKeyInput.value.trim();
    if (key) localStorage.setItem('sq_apikey', key);
  });
})();

// ── Set Game / Theme ─────────────────────────────────────────
function setGame(name) {
  if (!GAMES[name]) return;
  currentGame = name;

  document.body.dataset.theme = name;

  document.querySelectorAll('.game-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.game === name);
  });

  outputIcon.textContent  = GAMES[name].icon;
  outputTitle.textContent = GAMES[name].heading;

  localStorage.setItem('sq_game', name);
}

// ── Main Transform ───────────────────────────────────────────
async function run() {
  const key   = apiKeyInput.value.trim();
  const notes = studyInput.value.trim();

  // Validation
  if (!key) {
    return showError(
      'No API key — Enter your OpenAI API key in the box on the left. ' +
      'You can get one at platform.openai.com/api-keys'
    );
  }
  if (!notes) {
    return showError('No study notes — Paste some study material into the text box.');
  }
  if (notes.length < 20) {
    return showError('Too short — Add more content for a better result!');
  }

  lastNotes = notes;
  startTime = Date.now();

  setState('loading');
  loadingMsgEl.textContent = GAMES[currentGame].loadMsg;
  transformBtn.disabled = true;
  btnText.textContent   = '⏳ Transforming...';

  try {
    const result = await callOpenAI(key, notes);
    showResult(result);
  } catch (err) {
    showError(err.message || 'Unexpected error. Please try again.');
  } finally {
    transformBtn.disabled = false;
    btnText.textContent   = '⚡ TRANSFORM TO GAME LANGUAGE!';
  }
}

// ── OpenAI API Call ──────────────────────────────────────────
async function callOpenAI(apiKey, notes) {
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role:    'system',
            content: GAMES[currentGame].system
          },
          {
            role:    'user',
            content: `Transform this study material into ${GAMES[currentGame].name} game language so I can understand it better:\n\n${notes}`
          }
        ],
        max_tokens:  2000,
        temperature: 0.78
      })
    });
  } catch {
    throw new Error('Network error — Check your internet connection and try again.');
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch {}

    if (res.status === 401) throw new Error('Invalid API key — Double-check your key at platform.openai.com');
    if (res.status === 429) throw new Error('Rate limited — Too many requests. Wait a moment then retry.');
    if (res.status === 402) throw new Error('No credits — Top up your OpenAI account at platform.openai.com/settings/billing');
    throw new Error(detail || `API error ${res.status} — Please try again.`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ── State Management ─────────────────────────────────────────
function setState(name) {
  stateIdle.classList.toggle   ('hidden', name !== 'idle');
  stateLoading.classList.toggle('hidden', name !== 'loading');
  stateResult.classList.toggle ('hidden', name !== 'result');
  stateError.classList.toggle  ('hidden', name !== 'error');
}

function showResult(text) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const words   = lastNotes.trim().split(/\s+/).filter(Boolean).length;

  resultContent.innerHTML = renderMarkdown(text);
  setState('result');

  // Stats bar
  statWords.textContent = words.toLocaleString();
  statTime.textContent  = elapsed;
  statGame.textContent  = GAMES[currentGame].name;
  statsBar.classList.remove('hidden');

  // Copy button
  copyBtn.classList.remove('hidden');
  copyBtn._rawText = text;
}

function showError(msg) {
  errorMsgEl.textContent = msg;
  setState('error');
  copyBtn.classList.add('hidden');
  statsBar.classList.add('hidden');
}

// ── Markdown → HTML Renderer ─────────────────────────────────
function renderMarkdown(md) {
  const lines = md.split('\n');
  const out   = [];
  let inUL = false, inOL = false;

  /** Close any open list */
  const flush = () => {
    if (inUL) { out.push('</ul>'); inUL = false; }
    if (inOL) { out.push('</ol>'); inOL = false; }
  };

  /** Inline: bold, italic, code */
  const inline = t =>
    t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
     .replace(/\*(.+?)\*/g,     '<em>$1</em>')
     .replace(/`(.+?)`/g,       '<code>$1</code>');

  for (const raw of lines) {
    if (/^### /.test(raw)) {
      flush();
      out.push(`<h3>${inline(raw.slice(4))}</h3>`);
    } else if (/^## /.test(raw)) {
      flush();
      out.push(`<h2>${inline(raw.slice(3))}</h2>`);
    } else if (/^# /.test(raw)) {
      flush();
      out.push(`<h1>${inline(raw.slice(2))}</h1>`);
    } else if (/^---+$/.test(raw.trim())) {
      flush();
      out.push('<hr>');
    } else if (/^> /.test(raw)) {
      flush();
      out.push(`<blockquote>${inline(raw.slice(2))}</blockquote>`);
    } else if (/^[*\-] /.test(raw)) {
      if (inOL) { out.push('</ol>'); inOL = false; }
      if (!inUL) { out.push('<ul>'); inUL = true; }
      out.push(`<li>${inline(raw.slice(2))}</li>`);
    } else if (/^\d+\. /.test(raw)) {
      if (inUL) { out.push('</ul>'); inUL = false; }
      if (!inOL) { out.push('<ol>'); inOL = true; }
      out.push(`<li>${inline(raw.replace(/^\d+\.\s+/, ''))}</li>`);
    } else if (raw.trim() === '') {
      flush();
    } else {
      flush();
      out.push(`<p>${inline(raw)}</p>`);
    }
  }
  flush();
  return out.join('\n');
}

// ── Helpers ──────────────────────────────────────────────────
function toggleKeyVisibility() {
  const show = apiKeyInput.type === 'password';
  apiKeyInput.type     = show ? 'text' : 'password';
  toggleKeyBtn.textContent = show ? '🙈' : '👁️';
}

async function copyResult() {
  const text = copyBtn._rawText;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const orig = copyBtn.textContent;
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => { copyBtn.textContent = orig; }, 1800);
  } catch {
    /* clipboard unavailable in some browsers/contexts */
  }
}
