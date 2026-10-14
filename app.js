// מילון לשטח — all words live in words.json. This file only shows them and speaks them.

const els = {
  cards: document.getElementById('cards'),
  cats: document.getElementById('cats'),
  search: document.getElementById('search'),
  empty: document.getElementById('empty'),
  warning: document.getElementById('voice-warning'),
  help: document.getElementById('help'),
  voiceStatus: document.getElementById('voice-status')
};

let data = { categories: [], words: [] };
let currentCat = 'all';

// ---------- Speech (built into the phone, free) ----------
const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let hebrewVoice = null;
let voicesLoaded = false;

function findHebrewVoice() {
  if (!canSpeak) return;
  const voices = speechSynthesis.getVoices();
  if (voices.length) voicesLoaded = true;
  // Older Android phones report Hebrew as "iw" instead of "he"
  const he = voices.filter(v => /^(he|iw)([-_]|$)/i.test(v.lang));
  hebrewVoice = he.find(v => v.localService) || he[0] || null;
  updateVoiceWarning();
}

function updateVoiceWarning() {
  const missing = !canSpeak || (voicesLoaded && !hebrewVoice);
  els.warning.hidden = !missing;
  if (!canSpeak) {
    els.voiceStatus.textContent = 'הדפדפן הזה לא תומך בהקראה. נסו לפתוח ב-Chrome (אנדרואיד) או ב-Safari (אייפון).';
  } else if (hebrewVoice) {
    els.voiceStatus.textContent = 'קול עברי נמצא: ' + hebrewVoice.name;
  } else if (voicesLoaded) {
    els.voiceStatus.textContent = 'לא נמצא קול עברי בטלפון.';
  } else {
    els.voiceStatus.textContent = '';
  }
}

if (canSpeak) {
  findHebrewVoice();
  speechSynthesis.addEventListener?.('voiceschanged', findHebrewVoice);
  // Some phones load voices late and never fire the event
  setTimeout(findHebrewVoice, 800);
  setTimeout(findHebrewVoice, 2500);
}

let speakingCard = null;

function speak(text, card) {
  if (!canSpeak) { openHelp(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'he-IL';
  if (hebrewVoice) u.voice = hebrewVoice;
  u.rate = 0.85;
  if (speakingCard) speakingCard.classList.remove('speaking');
  speakingCard = card;
  card.classList.add('speaking');
  const done = () => card.classList.remove('speaking');
  u.onend = done;
  u.onerror = done;
  setTimeout(done, 4000); // safety: never leave a card highlighted
  speechSynthesis.speak(u);
}

// ---------- Search ----------
function normalize(s) {
  return (s || '')
    .replace(/[֑-ׇ]/g, '') // Hebrew vowel marks (niqqud)
    .replace(/‍/g, '')
    .toLowerCase()
    .trim();
}

function matches(word, q) {
  if (!q) return true;
  return [word.he, word.say, word.sound, word.si, word.en].some(f => normalize(f).includes(q));
}

// ---------- Drawing the screen ----------
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderCats() {
  els.cats.innerHTML = '';
  const all = [{ id: 'all', he: 'הכל', si: 'සියල්ල', icon: '📋' }, ...data.categories];
  for (const c of all) {
    const b = el('button', 'cat');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(c.id === currentCat));
    b.append(`${c.icon} ${c.he}`);
    const s = el('small', null, c.si);
    s.lang = 'si';
    b.append(s);
    b.addEventListener('click', () => {
      currentCat = c.id;
      renderCats();
      renderCards();
      window.scrollTo({ top: 0 });
    });
    els.cats.append(b);
  }
  els.cats.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}

function renderCards() {
  const q = normalize(els.search.value);
  // When searching, look in all categories
  const list = data.words.filter(w => (q || currentCat === 'all' || w.category === currentCat) && matches(w, q));

  els.cards.innerHTML = '';
  for (const w of list) {
    const card = el('button', 'card');
    card.type = 'button';
    card.setAttribute('aria-label', `${w.he} – ${w.si}`);

    const img = el('img');
    img.src = w.image;
    img.alt = '';
    img.loading = 'lazy';

    const text = el('span', 'text');
    const he = el('span', 'he', w.he);
    he.lang = 'he';
    const sound = el('span', 'sound', '🗣 ' + w.sound);
    sound.lang = 'si';
    sound.dir = 'ltr';
    const si = el('span', 'si', '= ' + w.si);
    si.lang = 'si';
    si.dir = 'ltr';
    text.append(he, sound, si);

    const spk = el('span', 'spk', '🔊');
    spk.setAttribute('aria-hidden', 'true');

    card.append(img, text, spk);
    card.addEventListener('click', () => speak(w.say || w.he, card));
    els.cards.append(card);
  }
  els.empty.hidden = list.length > 0;
}

// ---------- Help panel ----------
function openHelp() { els.help.hidden = false; updateVoiceWarning(); }
function closeHelp() { els.help.hidden = true; }
document.getElementById('help-btn').addEventListener('click', openHelp);
document.getElementById('warning-help').addEventListener('click', openHelp);
document.getElementById('help-close').addEventListener('click', closeHelp);
els.help.addEventListener('click', e => { if (e.target === els.help) closeHelp(); });

els.search.addEventListener('input', renderCards);

// ---------- Start ----------
fetch('words.json')
  .then(r => r.json())
  .then(json => {
    data = json;
    renderCats();
    renderCards();
  })
  .catch(() => {
    els.empty.hidden = false;
    els.empty.textContent = 'לא הצלחתי לטעון את רשימת המילים. פתחו את האפליקציה דרך כתובת האינטרנט שלה.';
  });

// Works without internet after the first visit
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
