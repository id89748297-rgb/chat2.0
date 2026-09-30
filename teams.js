// === ЧАТ-ПРИЛОЖЕНИЕ: список команд + чат ===

let chatReplyTo = null; // текущий ответ (реплай): { id, name, text }
const CHAT_EDIT_WINDOW_MS = 48 * 60 * 60 * 1000; // окно редактирования — 48 часов, как в Telegram
let chatPendingMsgs = {}; // черновики отправки: [teamId] = [{...Сообщение, __pending/__failed}] — живут отдельно от кэша

function saveTeamsLocal() {
try { localStorage.setItem('clc_teams', JSON.stringify(teams)); } catch (e) {}
}

function getSortedTeams() {
return [...teams].sort((a, b) => {
const ai = pinnedTeams.indexOf(a.id);
const bi = pinnedTeams.indexOf(b.id);
if (ai !== -1 && bi !== -1) return ai - bi;
if (ai !== -1) return -1;
if (bi !== -1) return 1;
return 0;
});
}

// Главная страница: список команд (тап — открыть чат, долгое нажатие — закрепить)
function renderTeamsList() {
const wrap = document.getElementById('home-teams-list');
if (!wrap) return;
const sorted = getSortedTeams();
if (!sorted.length) {
wrap.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#888;"><div style="font-size:48px;margin-bottom:10px;">👥</div><p>Пока нет команд.</p><p style="font-size:13px;margin-top:8px;">Команды, созданные в основном приложении, появятся здесь автоматически.</p></div>';
return;
}
wrap.innerHTML = sorted.map(t => {
const unread = getUnreadChatCount(t.id);
const pinnedMark = pinnedTeams.includes(t.id) ? '📌 ' : '';
const avatarHtml = t.avatar
? `<img src="${escapeHtml(t.avatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
: `<div style="width:40px;height:40px;border-radius:50%;background:#2a2a2a;display:flex;align-items:center;justify-content:center;font-size:20px;">🎸</div>`;
return `<div class="list-item" style="cursor:pointer;" onclick="if(window.__teamPressFired){window.__teamPressFired=false;return;} openTeamChat('${t.id}')" ontouchstart="startTeamPress(event,'${t.id}')" ontouchend="cancelTeamPress()" ontouchcancel="cancelTeamPress()" onmousedown="startTeamPress(event,'${t.id}')" onmouseup="cancelTeamPress()" onmouseleave="cancelTeamPress()">
<div class="item-left" style="min-width:0;flex:1;display:flex;align-items:center;gap:10px;">
${avatarHtml}
<div style="min-width:0;flex:1;"><div class="item-title">${pinnedMark}${escapeHtml(t.name)}</div></div>
</div>
${unread ? `<span style="background:#ef5350;color:#fff;font-size:11px;font-weight:bold;min-width:20px;height:20px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 6px;">${unread}</span>` : ''}
</div>`;
}).join('');
if (typeof renderPushButton === 'function') renderPushButton();
}

function toggleTeamPin(teamId) {
const idx = pinnedTeams.indexOf(teamId);
if (idx !== -1) pinnedTeams.splice(idx, 1);
else pinnedTeams.unshift(teamId);
try { localStorage.setItem('clc_pinned_teams', JSON.stringify(pinnedTeams)); } catch {}
renderTeamsList();
}
function closeTeamPinMenu() {
const menu = document.getElementById('team-pin-menu-popup');
if (menu) menu.remove();
const overlay = document.getElementById('team-pin-menu-overlay');
if (overlay) overlay.remove();
}
function openTeamPinMenu(teamId, x, y) {
closeTeamPinMenu();
const isPinned = pinnedTeams.includes(teamId);
const overlay = document.createElement('div');
overlay.id = 'team-pin-menu-overlay';
overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
overlay.onclick = closeTeamPinMenu;
document.body.appendChild(overlay);
const menu = document.createElement('div');
menu.id = 'team-pin-menu-popup';
menu.style.cssText = 'position:fixed;background:#2a2a2a;border-radius:10px;overflow:hidden;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,0.5);min-width:180px;';
menu.innerHTML = `<div class="team-pin-option" style="padding:13px 18px;color:#eee;font-size:15px;">${isPinned ? '📌 Открепить' : '📌 Закрепить вверху'}</div>`;
document.body.appendChild(menu);
menu.querySelector('.team-pin-option').addEventListener('click', (e) => { e.stopPropagation(); closeTeamPinMenu(); toggleTeamPin(teamId); });
menu.style.left = Math.min(x, window.innerWidth - 190) + 'px';
menu.style.top = Math.min(y, window.innerHeight - 60) + 'px';
}
function startTeamPress(e, teamId) {
const x = e.touches ? e.touches[0].clientX : e.clientX;
const y = e.touches ? e.touches[0].clientY : e.clientY;
window.__teamPressFired = false;
window.__teamPressTimer = setTimeout(() => {
window.__teamPressFired = true;
if (navigator.vibrate) navigator.vibrate(30);
openTeamPinMenu(teamId, x, y);
}, 500);
}
function cancelTeamPress() { clearTimeout(window.__teamPressTimer); }

// === БЛОКИРОВКА ПРОКРУТКИ СТРАНИЦЫ ПОД ЧАТОМ ===
function lockBodyScroll() {
window.__bodyScrollY = window.scrollY || window.pageYOffset || 0;
document.body.style.position = 'fixed';
document.body.style.top = '-' + window.__bodyScrollY + 'px';
document.body.style.left = '0';
document.body.style.right = '0';
document.body.style.width = '100%';
}
function unlockBodyScroll() {
document.body.style.position = '';
document.body.style.top = '';
document.body.style.left = '';
document.body.style.right = '';
document.body.style.width = '';
window.scrollTo(0, window.__bodyScrollY || 0);
}

// === ОТКРЫТИЕ ЧАТА ===
function openTeamChat(teamId) {
const team = teams.find(t => t.id === teamId);
if (!team) return;
currentChatTeamId = teamId;
chatEditingMessageId = null;
document.getElementById('chat-team-name').innerText = team.name;
document.getElementById('chat-team-avatar').innerHTML = team.avatar ? `<img src="${escapeHtml(team.avatar)}" alt="">` : '🎸';
document.getElementById('chat-input').value = '';
showPage('page-team-chat');
// Автофокус поля ввода при открытии чата (клавиатура всплывает как в Telegram).
// focus() должен вызываться синхронно в цепочке пользовательского касания,
// иначе мобильные браузеры не покажут клавиатуру.
try { document.getElementById('chat-input').focus({ preventScroll: true }); } catch (e) {}
setupChatKeyboardHandling();
setupChatFixedAreasTouchBlock();
setupChatTouchGuard();
setupChatFocusPin();
setupChatSwipeBack();
lockBodyScroll();
setTimeout(adjustChatForKeyboard, 50);
if (!chatMessagesCache[teamId]) chatMessagesCache[teamId] = [];
let mCache = {};
try { mCache = JSON.parse(localStorage.getItem('clc_team_members_cache') || '{}'); } catch {}
if (mCache[teamId] && mCache[teamId].profiles) {
currentMembersProfiles = { ...currentMembersProfiles, ...mCache[teamId].profiles };
}
startTeamRolesListener(teamId);
renderChatMessages(teamId);
if (db && currentUser) {
db.collection('teamRegistry').doc(teamId).collection('private').doc('profiles').get().then(doc => {
if (doc.exists) {
currentMembersProfiles = { ...currentMembersProfiles, ...(doc.data() || {}) };
try {
const c = JSON.parse(localStorage.getItem('clc_team_members_cache') || '{}');
c[teamId] = { ids: (c[teamId] && c[teamId].ids) || [], profiles: currentMembersProfiles };
localStorage.setItem('clc_team_members_cache', JSON.stringify(c));
} catch {}
if (currentChatTeamId === teamId) renderChatMessages(teamId);
}
}).catch(err => console.error('Не удалось загрузить профили для чата:', err));
}
startChatListener(teamId);
startChatReadsListener(teamId);
markChatRead(teamId);
setupChatBubbleSwipes();
renderChatPinnedBanner();
setTimeout(() => scrollChatToBottom(), 50);
}

// === ФИКСЫ КЛАВИАТУРЫ/СКРОЛЛА (весь накопленный опыт) ===
function setupChatFixedAreasTouchBlock() {
if (window.__chatFixedTouchBound) return;
window.__chatFixedTouchBound = true;
const header = document.getElementById('chat-page-header');
const inputBar = document.getElementById('chat-input-bar');
const block = (e) => { e.preventDefault(); };
if (header) header.addEventListener('touchmove', block, { passive: false });
if (inputBar) inputBar.addEventListener('touchmove', block, { passive: false });
}
function setupChatTouchGuard() {
if (window.__chatTouchGuardBound) return;
window.__chatTouchGuardBound = true;
const page = document.getElementById('page-team-chat');
if (!page) return;
page.addEventListener('touchmove', (e) => {
const list = document.getElementById('chat-messages-list');
if (!list || !list.contains(e.target)) { e.preventDefault(); return; }
const canScroll = list.scrollHeight > list.clientHeight + 1;
if (!canScroll) { e.preventDefault(); return; }
const atTop = list.scrollTop <= 0;
const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
if (page.__lastTouchY !== undefined) {
const dy = e.touches[0].clientY - page.__lastTouchY;
if ((atTop && dy > 0) || (atBottom && dy < 0)) e.preventDefault();
}
page.__lastTouchY = e.touches[0].clientY;
}, { passive: false });
page.addEventListener('touchend', () => { page.__lastTouchY = undefined; }, { passive: true });
}
function setupChatFocusPin() {
if (window.__chatFocusPinBound) return;
window.__chatFocusPinBound = true;
const input = document.getElementById('chat-input');
if (!input) return;
const chatActive = () => {
const page = document.getElementById('page-team-chat');
return !!(page && page.classList.contains('active'));
};
// Сжатие страницы под клавиатуру в момент касания — ДО того, как iOS решит прокручивать
const preshrink = () => {
if (!chatActive() || __vvMaxH <= 0) return;
let lastKb = parseInt(localStorage.getItem('clc_kb_height_v2') || '0');
if (!lastKb || lastKb < 100 || lastKb > __vvMaxH * 0.7) lastKb = Math.round(__vvMaxH * 0.42);
const page = document.getElementById('page-team-chat');
page.style.setProperty('height', (__vvMaxH - lastKb) + 'px', 'important');
setTimeout(() => {
if (chatActive() && !__kbOpen && document.activeElement !== input) {
page.style.removeProperty('height');
page.style.removeProperty('top');
}
}, 800);
};
['pointerdown', 'touchstart'].forEach(ev => {
input.addEventListener(ev, preshrink, { passive: true });
});
// Конец тапа: ручной фокус-страховка (без preventDefault — жест «настоящий»)
input.addEventListener('touchend', () => {
if (!chatActive()) return;
window.scrollTo(0, 0);
input.focus();
}, false);
input.addEventListener('focusin', () => {
if (chatActive()) window.scrollTo(0, 0);
});
window.addEventListener('scroll', () => {
if (chatActive() && window.scrollY !== 0) window.scrollTo(0, 0);
}, true);
input.addEventListener('focus', () => {
[0, 100, 300, 600].forEach(ms => setTimeout(() => {
if (chatActive()) { window.scrollTo(0, 0); adjustChatForKeyboard(); }
}, ms));
});
input.addEventListener('blur', () => setTimeout(() => {
if (chatActive()) window.scrollTo(0, 0);
}, 100));
}
function setupChatSwipeBack() {
if (window.__chatSwipeBackBound) return;
window.__chatSwipeBackBound = true;
const page = document.getElementById('page-team-chat');
if (!page) return;
let sx = 0, sy = 0, tracking = false;
page.addEventListener('touchstart', (e) => {
if (e.target.closest('textarea, input, button, select')) { tracking = false; return; }
sx = e.touches[0].clientX;
sy = e.touches[0].clientY;
// ловим жест только от левого края (~60px) — как нативный «назад» на iOS
tracking = sx < 60;
}, { passive: true });
page.addEventListener('touchend', (e) => {
if (!tracking) return;
tracking = false;
const dx = e.changedTouches[0].clientX - sx;
const dy = e.changedTouches[0].clientY - sy;
if (dx > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) closeTeamChat();
}, { passive: true });
}
function setupChatKeyboardHandling() {
if (!window.visualViewport || window.__chatKeyboardHandlerBound) return;
window.__chatKeyboardHandlerBound = true;
window.visualViewport.addEventListener('resize', adjustChatForKeyboard);
window.visualViewport.addEventListener('scroll', adjustChatForKeyboard);
}
let __chatKBLast = -1;
let __vvMaxH = 0; // запоминаем высоту экрана БЕЗ клавиатуры
let __kbOpen = false;
function adjustChatForKeyboard() {
const page = document.getElementById('page-team-chat');
if (!page || !page.classList.contains('active') || !window.visualViewport) return;
const vv = window.visualViewport;
const vh = Math.round(vv.height);
if (vh > __vvMaxH) __vvMaxH = vh;
const kb = __vvMaxH > 0 ? (__vvMaxH - vh) : 0;
if (kb > 150) {
__kbOpen = true;
try { localStorage.setItem('clc_kb_height_v2', String(kb)); } catch {}
// Шапку НЕ смещаем: top остаётся 0 всегда, сжимается только высота страницы (список).
// Установка top по vv.offsetTop давала «приседание» шапки: в момент открытия клавиатуры
// браузер на миг прокручивает документ, offsetTop становится ненулевым — шапка
// опускалась, а при сбросе прокрутки вскакивала обратно.
page.style.setProperty('height', vh + 'px', 'important');
window.scrollTo(0, 0);
} else {
__kbOpen = false;
page.style.removeProperty('height');
page.style.removeProperty('top');
}
if (kb !== __chatKBLast) { __chatKBLast = kb; scrollChatToBottom(); }
}
function autoGrowChatInput(el) {
el.style.setProperty('height', 'auto', 'important');
const newHeight = Math.min(el.scrollHeight, 98);
el.style.setProperty('height', Math.max(newHeight, 38) + 'px', 'important');
el.style.overflowY = el.scrollHeight > 98 ? 'auto' : 'hidden';
}
function closeTeamChat() {
currentChatTeamId = null;
chatEditingMessageId = null;
chatReplyTo = null;
__chatKBLast = -1;
const pageEl = document.getElementById('page-team-chat');
if (pageEl) { pageEl.style.removeProperty('height'); pageEl.style.removeProperty('top'); }
renderTeamsList();
showPage('page-home');
unlockBodyScroll();
}
function scrollChatToBottom() {
const list = document.getElementById('chat-messages-list');
if (list) list.scrollTop = list.scrollHeight;
}
// Эффективное время сообщения в мс. createdAt может быть: числом (старые записи),
// объектом Firestore Timestamp (serverTimestamp) или null (сервер ещё не ответил).
function tsToMs(v) {
if (!v) return 0;
if (typeof v === 'number') return v;
if (typeof v.toMillis === 'function') return v.toMillis(); // Firestore Timestamp
if (v.seconds !== undefined) return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
return 0;
}
function msgTs(m) { return tsToMs(m.createdAt) || m.clientCreatedAt || 0; }
// Повтор отправки зависшего сообщения (клик по ⚠)
async function retryChatMessage(teamId, tempId) {
const msgs = chatPendingMsgs[teamId] || [];
const m = msgs.find(x => x.id === tempId);
if (!m || !m.__failed || !db || !currentUser) return;
m.__failed = false; m.__pending = true;
renderChatMessages(teamId);
try {
await db.collection('teamRegistry').doc(teamId).collection('chat').add({
text: m.text, senderId: currentUser.uid,
createdAt: firebase.firestore.FieldValue.serverTimestamp(),
clientCreatedAt: Date.now(),
...(m.replyTo ? { replyTo: m.replyTo } : {}),
...(m.mentions && m.mentions.length ? { mentions: m.mentions } : {})
});
} catch (err) {
console.error('Повторная отправка не удалась:', err);
if (chatMessagesCache[teamId]) {
const still = chatMessagesCache[teamId].find(x => x.id === tempId);
if (still) still.__failed = true;
renderChatMessages(teamId);
}
}
}
// Кнопка «вниз»: обновить видимость и бейдж непрочитанных
function updateChatScrollDownBtn() {
const teamId = currentChatTeamId;
const btn = document.getElementById('chat-scroll-down');
const list = document.getElementById('chat-messages-list');
if (!btn || !list || !teamId) return;
const farFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight > 300;
btn.style.display = farFromBottom ? 'flex' : 'none';
const badge = document.getElementById('chat-scroll-down-badge');
if (!farFromBottom || !currentUser) { if (badge) badge.style.display = 'none'; return; }
const unseen = (chatMessagesCache[teamId] || []).filter(m => !m.__pending && !m.__failed && m.senderId !== currentUser.uid && msgTs(m) > (window.__chatSeenTs || 0)).length;
if (badge) { badge.textContent = unseen > 0 ? (unseen > 99 ? '99+' : String(unseen)) : ''; badge.style.display = unseen > 0 ? 'flex' : 'none'; }
}
function chatScrollDownClick() {
const list = document.getElementById('chat-messages-list');
if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
}

// === ЛИСТЕНЕРЫ ЧАТА ===
function startChatListener(teamId) {
if (chatListenerUnsubs[teamId] || !db || !currentUser) return;
chatListenerUnsubs[teamId] = db.collection('teamRegistry').doc(teamId).collection('chat')
.orderBy('createdAt', 'desc').limit(50)
.onSnapshot(snap => {
const fresh = [];
snap.forEach(doc => fresh.push({ id: doc.id, ...doc.data() }));
fresh.reverse();
const freshIds = new Set(fresh.map(m => m.id));
// Черновик отправки убираем ТОЛЬКО когда сервер реально прислал документ.
// Считаем совпадения по количеству: два одинаковых «тест» не съедают друг друга.
const pend = chatPendingMsgs[teamId] || [];
for (const f of fresh) {
const idx = pend.findIndex(p => !p.__failed && !p.__matched && p.senderId === f.senderId && p.text === f.text);
if (idx >= 0) pend.splice(idx, 1);
}
// Не сбрасываем догруженную историю: старше самой старой из «свежих» оставляем в кэше
const oldestFreshTs = fresh.length ? msgTs(fresh[0]) : Infinity;
const prev = chatMessagesCache[teamId] || [];
const kept = prev.filter(m => !freshIds.has(m.id) && msgTs(m) < oldestFreshTs);
chatMessagesCache[teamId] = kept.concat(fresh).sort((a, b) => msgTs(a) - msgTs(b));
if (currentChatTeamId === teamId) {
const list = document.getElementById('chat-messages-list');
const wasAtBottom = list ? (list.scrollHeight - list.scrollTop - list.clientHeight < 60) : true;
renderChatMessages(teamId);
if (wasAtBottom) scrollChatToBottom();
markChatRead(teamId);
}
renderTeamsList();
}, err => console.error('chat listener error:', err));
}
function startChatReadsListener(teamId) {
if (chatReadsListenerUnsubs[teamId] || !db || !currentUser) return;
chatReadsListenerUnsubs[teamId] = db.collection('teamRegistry').doc(teamId).collection('chatReads')
.onSnapshot(snap => {
const reads = {};
snap.forEach(doc => { reads[doc.id] = doc.data().lastReadAt || 0; });
chatReadsCache[teamId] = reads;
try { localStorage.setItem('clc_chat_reads_cache', JSON.stringify(chatReadsCache)); } catch {}
if (currentChatTeamId === teamId) renderChatMessages(teamId);
renderTeamsList();
}, err => console.error('chat reads listener error:', err));
}
// === НЕПРОЧИТАННОЕ / ОТМЕТКИ ПРОЧТЕНИЯ ===
function getUnreadChatCount(teamId) {
if (!currentUser) return 0;
const msgs = chatMessagesCache[teamId] || [];
const reads = chatReadsCache[teamId] || {};
const myLastRead = reads[currentUser.uid] || 0;
return msgs.filter(m => !m.deleted && !m.__pending && !m.__failed && m.senderId !== currentUser.uid && msgTs(m) > myLastRead).length;
}
function markChatRead(teamId) {
if (!db || !currentUser) return;
// Отметка «прочитано» = время самого свежего чужого сообщения, а не текущие часы:
// иначе при спешащих часах отправителя его сообщения вечно считаются непрочитанными
const msgs = chatMessagesCache[teamId] || [];
let newestOther = 0;
for (const m of msgs) {
if (!m.__pending && !m.__failed && m.senderId !== currentUser.uid) newestOther = Math.max(newestOther, msgTs(m));
}
const val = newestOther > 0 ? newestOther : firebase.firestore.FieldValue.serverTimestamp();
db.collection('teamRegistry').doc(teamId).collection('chatReads').doc(currentUser.uid)
.set({ lastReadAt: val }, { merge: true }).catch(err => console.error('mark chat read failed:', err));
}

// === РЕНДЕР СООБЩЕНИЙ ===
function formatChatDateLabel(ts) {
const d = new Date(ts);
const now = new Date();
const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / (24 * 60 * 60 * 1000));
if (diffDays === 0) return 'Сегодня';
if (diffDays === 1) return 'Вчера';
const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
return `${d.getDate()} ${months[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
function renderChatMessages(teamId) {
const list = document.getElementById('chat-messages-list');
if (!list) return;
// Показываем сообщения из базы + черновики отправки (🕘/⚠) поверх них
const msgs = (chatMessagesCache[teamId] || []).concat(chatPendingMsgs[teamId] || []);
const roles = teamRolesCache[teamId] || {};
const reads = chatReadsCache[teamId] || {};
let lastDayKey = null;
list.innerHTML = msgs.map(m => {
let dateDivider = '';
const dayKey = new Date(msgTs(m)).toDateString();
if (dayKey !== lastDayKey) {
lastDayKey = dayKey;
dateDivider = `<div style="text-align:center;margin:8px 0;"><span style="background:rgba(255,255,255,0.08);color:#888;font-size:12px;padding:4px 12px;border-radius:12px;">${formatChatDateLabel(msgTs(m))}</span></div>`;
}
const isMe = m.senderId === currentUser.uid;
const p = currentMembersProfiles[m.senderId] || {};
const name = [p.displayName, p.lastName].filter(Boolean).join(' ').trim() || 'Без имени';
const roleObj = roles[m.senderId];
const roleLabel = roleObj && roleObj.role === 'owner' ? 'Владелец' : (roleObj && roleObj.role === 'admin' ? 'Админ' : '');
const avatarHtml = p.avatar ? `<img src="${escapeHtml(p.avatar)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : `<div style="width:32px;height:32px;border-radius:50%;background:#444;display:flex;align-items:center;justify-content:center;">👤</div>`;
const time = new Date(msgTs(m)).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
const bodyText = m.deleted ? '<i style="opacity:0.6;">Сообщение удалено</i>' : formatChatText(m.text || '');
const editedTag = (!m.deleted && m.editedAt) ? ' <span style="opacity:0.6;font-size:11px;">(изменено)</span>' : '';
const otherUids = Object.keys(roles).filter(uid => uid !== m.senderId);
let statusHtml = '';
if (isMe && !m.deleted) {
if (m.__pending) {
statusHtml = `<span style="color:#888;font-size:11px;">🕘</span>`;
} else if (m.__failed) {
statusHtml = `<span style="color:#ef5350;font-size:13px;cursor:pointer;padding:2px;" title="Не отправлено — нажмите для повтора" onclick="event.stopPropagation(); retryChatMessage('${teamId}','${m.id}')">⚠</span>`;
} else {
const allRead = otherUids.every(uid => (reads[uid] || 0) >= msgTs(m));
statusHtml = allRead ? `<span style="color:#42a5f5;font-size:11px;">✔\uFE0E✔\uFE0E</span>` : `<span style="color:#888;font-size:11px;">✔\uFE0E</span>`;
}
}
const pressAttrs = !m.deleted ? `ontouchstart="startChatMsgPress(event,'${teamId}','${m.id}','${m.senderId}')" ontouchend="cancelChatMsgPress()" ontouchcancel="cancelChatMsgPress()" onmousedown="startChatMsgPress(event,'${teamId}','${m.id}','${m.senderId}')" onmouseup="cancelChatMsgPress()" onmouseleave="cancelChatMsgPress()"` : '';
// Цитата-ответ
const replyHtml = (m.replyTo && !m.deleted) ? `<div class="chat-msg-reply" onclick="event.stopPropagation(); scrollToChatMessage('${m.replyTo.id}')"><span class="chat-msg-reply-name">↩️ ${escapeHtml(m.replyTo.name || '')}</span><span class="chat-msg-reply-text">${formatChatText((m.replyTo.text || '').slice(0, 100))}</span></div>` : '';
// Реакции
const rMap = m.reactions || {};
const rKeys = Object.keys(rMap).filter(k => rMap[k] && Object.keys(rMap[k]).length > 0);
const reactionsHtml = (!m.deleted && rKeys.length) ? `<div class="chat-msg-reactions">${rKeys.map(k => {
const mine = currentUser && rMap[k][currentUser.uid];
const cnt = Object.keys(rMap[k]).length;
return `<span class="chat-msg-reaction${mine ? ' mine' : ''}" onclick="event.stopPropagation(); toggleChatReaction('${teamId}','${m.id}','${k}')">${k}${cnt > 1 ? ' ' + cnt : ''}</span>`;
}).join('')}</div>` : '';
let bubbleHtml;
if (isMe) {
bubbleHtml = `<div style="display:flex;justify-content:flex-end;">
<div id="chat-msg-${m.id}" class="chat-bubble chat-bubble-me" ${pressAttrs} style="max-width:75%;background:rgba(144,202,249,0.18);border-radius:14px 14px 4px 14px;padding:8px 12px;${m.__pending ? 'opacity:0.6;' : ''}${m.__failed ? 'border:1px solid #ef5350;' : ''}">
${replyHtml}
<div style="font-size:14px;color:#eee;white-space:pre-wrap;word-break:break-word;">${bodyText}${editedTag}</div>
<div style="display:flex;justify-content:flex-end;align-items:center;gap:4px;margin-top:2px;">${m.starred ? '<span style="font-size:11px;">⭐</span>' : ''}<span style="font-size:11px;color:#888;">${time}</span>${statusHtml}</div>
${reactionsHtml}
</div>
</div>`;
} else {
bubbleHtml = `<div style="display:flex;gap:8px;align-items:flex-end;">
${avatarHtml}
<div id="chat-msg-${m.id}" class="chat-bubble" ${pressAttrs} style="max-width:75%;background:#2a2a2a;border-radius:14px 14px 14px 4px;padding:8px 12px;">
${replyHtml}
<div style="font-size:12px;color:#90caf9;font-weight:bold;">${escapeHtml(name)}${roleLabel ? ` <span style="color:#888;font-weight:normal;">· ${roleLabel}</span>` : ''}</div>
<div style="font-size:14px;color:#eee;white-space:pre-wrap;word-break:break-word;margin-top:2px;">${bodyText}${editedTag}</div>
<div style="font-size:11px;color:#888;margin-top:2px;">${m.starred ? '⭐ ' : ''}${time}</div>
${reactionsHtml}
</div>
</div>`;
}
return dateDivider + bubbleHtml;
}).join('');
// Подсветка сообщения, к которому прыгнули по цитате (переживает перерисовку списка)
if (window.__highlightMsgId) {
const hl = list.querySelector('#chat-msg-' + window.__highlightMsgId);
if (hl) hl.style.background = 'rgba(66,165,245,0.25)';
}
updateChatScrollDownBtn();
}
// === ФОРМАТИРОВАНИЕ ТЕКСТА (жирный / курсив / зачёркнутый / код) ===
// Как в Telegram: **жирный**, *курсив*, ~~зачёркнутый~~, `код`, @упоминание
function formatChatText(text) {
let s = escapeHtml(text || '');
s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
s = s.replace(/\*([^*\n]+)\*/g, '<i>$1</i>');
s = s.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
s = s.replace(/`([^`\n]+)`/g, '<code style="background:rgba(255,255,255,0.12);border-radius:4px;padding:1px 5px;font-family:monospace;font-size:13px;">$1</code>');
s = s.replace(/@([\wа-яёА-ЯЁ][\wа-яёА-ЯЁ.-]*)/g, (m) => `<span class="chat-mention" onclick="event.stopPropagation(); openMentionProfileByName('${m.slice(1).replace(/'/g, "\\'")}')">${m}</span>`);
return s;
}
// Клик по @упоминанию — открыть профиль участника
function openMentionProfileByName(name) {
const clean = (name || '').replace(/_/g, ' ').toLowerCase().trim();
if (!clean) return;
const uid = Object.keys(currentMembersProfiles).find(uid => {
const p = currentMembersProfiles[uid] || {};
const full = [p.displayName, p.lastName].filter(Boolean).join(' ').trim().toLowerCase();
return full === clean || (p.displayName || '').toLowerCase() === clean;
});
if (uid && typeof openMemberProfile === 'function') openMemberProfile(uid);
}
// Обернуть выделение в textarea маркерами форматирования (кнопки B / I / S / код)
function wrapChatSelection(marker) {
const input = document.getElementById('chat-input');
if (!input) return;
const start = input.selectionStart, end = input.selectionEnd;
const before = input.value.slice(0, start);
const sel = input.value.slice(start, end);
const after = input.value.slice(end);
const alreadyOpen = before.endsWith(marker) && after.startsWith(marker);
let newValue, newCaret;
if (alreadyOpen) {
newValue = before.slice(0, -marker.length) + sel + after.slice(marker.length);
newCaret = start - marker.length + sel.length;
} else if (sel) {
newValue = before + marker + sel + marker + after;
newCaret = end + marker.length;
} else {
newValue = before + marker + marker + after;
newCaret = start + marker.length;
}
input.value = newValue;
input.focus();
input.setSelectionRange(newCaret, newCaret);
autoGrowChatInput(input);
handleChatInputChange(input);
}

// === УПОМИНАНИЯ @: извлечение uid из текста ===
function extractMentionUids(text) {
const uids = new Set();
const re = /@([\wа-яёА-ЯЁ][\wа-яёА-ЯЁ.-]*)/g;
let m;
while ((m = re.exec(text || ''))) {
const clean = m[1].replace(/_/g, ' ').toLowerCase();
Object.keys(currentMembersProfiles).forEach(uid => {
const p = currentMembersProfiles[uid] || {};
const full = [p.displayName, p.lastName].filter(Boolean).join(' ').trim().toLowerCase();
if (full === clean || (p.displayName || '').toLowerCase() === clean) uids.add(uid);
});
}
return [...uids];
}

// === АВТОКОМПЛИТ @УПОМИНАНИЙ ===
let __mentionState = null; // { token, start, items, active }
function handleChatInputChange(input) {
const caret = input.selectionStart;
const upToCaret = input.value.slice(0, caret);
const m = upToCaret.match(/(^|\s)@([\wа-яёА-ЯЁ.-]*)$/);
if (!m) { closeMentionPopup(); return; }
const token = m[2].toLowerCase();
const roles = teamRolesCache[currentChatTeamId] || {};
const items = Object.keys(roles).map(uid => {
const p = currentMembersProfiles[uid] || {};
const name = [p.displayName, p.lastName].filter(Boolean).join(' ').trim();
if (!name) return null;
if (token && !name.toLowerCase().includes(token)) return null;
return { uid, name, avatar: p.avatar, role: roles[uid] ? roles[uid].role : 'member' };
}).filter(Boolean).slice(0, 5);
if (!items.length) { closeMentionPopup(); return; }
__mentionState = { token: m[2], start: caret - m[2].length - 1, items, active: 0 };
showMentionPopup(items);
}
function showMentionPopup(items) {
let popup = document.getElementById('chat-mention-popup');
if (!popup) {
popup = document.createElement('div');
popup.id = 'chat-mention-popup';
document.body.appendChild(popup);
}
popup.innerHTML = items.map((it, i) => {
const avatar = it.avatar
? `<img src="${escapeHtml(it.avatar)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`
: `<div style="width:28px;height:28px;border-radius:50%;background:#444;display:flex;align-items:center;justify-content:center;font-size:14px;">👤</div>`;
const roleLabel = it.role === 'owner' ? ' · Владелец' : (it.role === 'admin' ? ' · Админ' : '');
return `<div class="chat-mention-item${i === __mentionState.active ? ' active' : ''}" data-uid="${it.uid}">${avatar}<div style="min-width:0;"><div style="font-size:14px;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(it.name)}</div><div style="font-size:11px;color:#888;">@${escapeHtml(it.name.split(' ')[0])}${roleLabel}</div></div></div>`;
}).join('');
popup.querySelectorAll('.chat-mention-item').forEach((el, i) => {
el.addEventListener('mousedown', (e) => { e.preventDefault(); pickMention(i); });
});
const inputBar = document.getElementById('chat-input-bar');
const rect = inputBar ? inputBar.getBoundingClientRect() : { top: window.innerHeight - 60, left: 10, width: window.innerWidth - 20 };
popup.style.display = 'block';
popup.style.left = Math.max(8, rect.left) + 'px';
popup.style.width = Math.min(300, rect.width - 16) + 'px';
popup.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
}
function closeMentionPopup() {
__mentionState = null;
const popup = document.getElementById('chat-mention-popup');
if (popup) popup.remove();
}
// onBlur инпута: не закрывать попап, если по нему кликают в этот момент
function closeMentionPopupIfIdle() {
const popup = document.getElementById('chat-mention-popup');
if (popup && popup.matches(':hover')) return;
closeMentionPopup();
}
function pickMention(i) {
if (!__mentionState) return;
const it = __mentionState.items[i];
const input = document.getElementById('chat-input');
const insert = '@' + it.name.replace(/\s+/g, '_');
input.value = input.value.slice(0, __mentionState.start) + insert + ' ' + input.value.slice(input.selectionStart);
const caret = __mentionState.start + insert.length + 1;
input.focus();
input.setSelectionRange(caret, caret);
closeMentionPopup();
autoGrowChatInput(input);
}

function isTouchChatDevice() { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }
function handleChatInputKeydown(e) {
// навигация по автокомплиту упоминаний
if (__mentionState && popupOpen()) {
if (e.key === 'ArrowDown') { e.preventDefault(); __mentionState.active = (__mentionState.active + 1) % __mentionState.items.length; showMentionPopup(__mentionState.items); return; }
if (e.key === 'ArrowUp') { e.preventDefault(); __mentionState.active = (__mentionState.active - 1 + __mentionState.items.length) % __mentionState.items.length; showMentionPopup(__mentionState.items); return; }
if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(__mentionState.active); return; }
if (e.key === 'Escape') { e.preventDefault(); closeMentionPopup(); return; }
}
// Enter — отправить (только на компьютере; на телефоне Enter = перенос строки)
if (e.key === 'Enter' && !e.shiftKey && !isTouchChatDevice()) {
e.preventDefault();
sendOrEditChatMessage();
}
}
function popupOpen() { return !!document.getElementById('chat-mention-popup'); }

// === ОТПРАВКА / РЕДАКТИРОВАНИЕ ===
async function sendOrEditChatMessage() {
const teamId = currentChatTeamId;
if (!teamId || !db || !currentUser) return;
const input = document.getElementById('chat-input');
const text = input.value.trim();
if (!text) return;
input.value = '';
autoGrowChatInput(input);
try {
if (chatEditingMessageId) {
await db.collection('teamRegistry').doc(teamId).collection('chat').doc(chatEditingMessageId).update({ text, editedAt: Date.now() });
chatEditingMessageId = null;
} else {
// Оптимистичный показ: сообщение видно сразу, до ответа сервера
const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
const localMsg = { id: tempId, text, senderId: currentUser.uid, createdAt: Date.now(), clientCreatedAt: Date.now(), __pending: true };
if (chatReplyTo) localMsg.replyTo = chatReplyTo;
const mentionUids = extractMentionUids(text);
if (mentionUids.length) localMsg.mentions = mentionUids;
if (!chatMessagesCache[teamId]) chatMessagesCache[teamId] = [];
if (!chatPendingMsgs[teamId]) chatPendingMsgs[teamId] = [];
chatPendingMsgs[teamId].push(localMsg);
renderChatMessages(teamId);
scrollChatToBottom();
const msgData = { text, senderId: currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(), clientCreatedAt: Date.now() };
if (chatReplyTo) msgData.replyTo = chatReplyTo;
if (mentionUids.length) msgData.mentions = mentionUids;
try {
await db.collection('teamRegistry').doc(teamId).collection('chat').add(msgData);
} catch (sendErr) {
// Сервер не принял: помечаем ⚠ — клик по значку повторит отправку
console.error('Не удалось отправить сообщение:', sendErr);
const still = (chatPendingMsgs[teamId] || []).find(m => m.id === tempId);
if (still) { still.__pending = false; still.__failed = true; renderChatMessages(teamId); }
showToast('⚠ Сообщение не отправлено — нажмите ⚠ для повтора', 'error');
return;
}
chatReplyTo = null;
renderChatReplyPreview();
// push-уведомление всем участникам, кроме себя
const pushTeam = teams.find(t => t.id === teamId);
sendPushToTeam(teamId, '💬 ' + ((pushTeam && pushTeam.name) || 'Чат команды'), text);
}
} catch (err) {
console.error('Ошибка отправки:', err);
showToast('❌ Не удалось отправить сообщение', 'error');
input.value = text;
}
}

// === ДОЛГОЕ НАЖАТИЕ И МЕНЮ СООБЩЕНИЯ ===
function startChatMsgPress(e, teamId, msgId, senderId) {
const x = e.touches ? e.touches[0].clientX : e.clientX;
const y = e.touches ? e.touches[0].clientY : e.clientY;
window.__chatPressFired = false;
window.__chatPressTimer = setTimeout(() => {
window.__chatPressFired = true;
if (navigator.vibrate) navigator.vibrate(30);
openChatMsgMenu(teamId, msgId, senderId, x, y);
}, 500);
}
function cancelChatMsgPress() { clearTimeout(window.__chatPressTimer); }
function closeChatMsgMenuPopup() {
const menu = document.getElementById('chat-msg-menu-popup');
if (menu) menu.remove();
const overlay = document.getElementById('chat-msg-menu-overlay');
if (overlay) overlay.remove();
}
function openChatMsgMenu(teamId, msgId, senderId, x, y) {
closeChatMsgMenuPopup();
const myRole = getMyRole(teamId);
const isMine = currentUser && senderId === currentUser.uid;
const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin';
const msg = (chatMessagesCache[teamId] || []).find(m => m.id === msgId);
if (!msg) return;
const reads = chatReadsCache[teamId] || {};
const roles = teamRolesCache[teamId] || {};
const otherUids = Object.keys(roles).filter(uid => uid !== senderId);
const allRead = otherUids.every(uid => (reads[uid] || 0) >= msg.createdAt);
const options = [];
options.push(['reply', '↩️ Ответить']);
options.push(['react', '😀 Реакция']);
options.push(['star', msg.starred ? '⭐ Убрать из избранного' : '⭐ В избранное']);
const teamForPin = teams.find(t => t.id === teamId);
const isPinned = teamForPin && teamForPin.pinnedChatMsg && teamForPin.pinnedChatMsg.id === msgId;
options.push(isPinned ? ['unpin', '📌 Открепить'] : ['pin', '📌 Закрепить']);
if (!msg.deleted) options.push(['copy', '📋 Скопировать']);
if (isMine && !allRead && (Date.now() - msg.createdAt < CHAT_EDIT_WINDOW_MS)) options.push(['edit', '✏️ Изменить']);
if (isMine || isOwnerOrAdmin) options.push(['delete', '🗑️ Удалить сообщение']);
if (!isMine && isOwnerOrAdmin) options.push(['deleteAllKick', '⛔ Удалить все сообщения и исключить']);
if (options.length === 0) return;
const overlay = document.createElement('div');
overlay.id = 'chat-msg-menu-overlay';
overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
overlay.onclick = closeChatMsgMenuPopup;
document.body.appendChild(overlay);
const menu = document.createElement('div');
menu.id = 'chat-msg-menu-popup';
menu.style.cssText = 'position:fixed;background:#2a2a2a;border-radius:10px;overflow:hidden;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,0.5);min-width:220px;';
menu.innerHTML = options.map(([val, label]) =>
`<div class="chat-menu-option" data-action="${val}" style="padding:13px 18px;color:${val==='deleteAllKick'?'#ef5350':'#eee'};font-size:15px;">${label}</div>`
).join('<div style="height:1px;background:rgba(255,255,255,0.1);"></div>');
document.body.appendChild(menu);
menu.querySelectorAll('.chat-menu-option').forEach(el => {
el.addEventListener('click', (e) => {
e.stopPropagation();
const action = el.dataset.action;
closeChatMsgMenuPopup();
if (action === 'reply') setChatReplyTo(msg);
else if (action === 'copy') copyChatText(msg.text);
else if (action === 'react') showReactionPicker(teamId, msgId, x, y);
else if (action === 'star') toggleStarChatMessage(teamId, msgId);
else if (action === 'pin') pinChatMessage(teamId, msgId);
else if (action === 'unpin') unpinChatMessage(teamId);
else if (action === 'edit') startEditChatMessage(msgId);
else if (action === 'delete') deleteChatMessage(teamId, msgId);
else if (action === 'deleteAllKick') deleteAllMessagesFromUserAndKick(teamId, senderId);
});
});
const menuHeight = options.length * 45;
menu.style.left = Math.min(x, window.innerWidth - 230) + 'px';
menu.style.top = Math.min(y, window.innerHeight - menuHeight - 10) + 'px';
}
function startEditChatMessage(msgId) {
const teamId = currentChatTeamId;
const msg = (chatMessagesCache[teamId] || []).find(m => m.id === msgId);
if (!msg) return;
chatEditingMessageId = msgId;
const input = document.getElementById('chat-input');
input.value = msg.text || '';
input.focus();
}

// === ОЧИСТКА ЧАТА (долгое нажатие на кнопку чата владельцем) ===
function startChatBtnPress(e, teamId) {
const x = e.touches ? e.touches[0].clientX : e.clientX;
const y = e.touches ? e.touches[0].clientY : e.clientY;
window.__chatBtnPressFired = false;
window.__chatBtnPressTimer = setTimeout(() => {
window.__chatBtnPressFired = true;
if (navigator.vibrate) navigator.vibrate(30);
openClearChatMenu(teamId, x, y);
}, 500);
}
function cancelChatBtnPress() { clearTimeout(window.__chatBtnPressTimer); }
function closeClearChatMenuPopup() {
const menu = document.getElementById('clear-chat-menu-popup');
if (menu) menu.remove();
const overlay = document.getElementById('clear-chat-menu-overlay');
if (overlay) overlay.remove();
}
function openClearChatMenu(teamId, x, y) {
if (getMyRole(teamId) !== 'owner') return;
closeClearChatMenuPopup();
const overlay = document.createElement('div');
overlay.id = 'clear-chat-menu-overlay';
overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
overlay.onclick = closeClearChatMenuPopup;
document.body.appendChild(overlay);
const menu = document.createElement('div');
menu.id = 'clear-chat-menu-popup';
menu.style.cssText = 'position:fixed;background:#2a2a2a;border-radius:10px;overflow:hidden;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,0.5);min-width:240px;';
menu.innerHTML = `<div class="clear-chat-option" data-action="keepStarred" style="padding:13px 18px;color:#eee;font-size:15px;">⭐ Очистить, оставить избранные</div><div style="height:1px;background:rgba(255,255,255,0.1);"></div><div class="clear-chat-option" data-action="clearAll" style="padding:13px 18px;color:#ef5350;font-size:15px;">🗑️ Очистить чат полностью</div>`;
document.body.appendChild(menu);
menu.querySelectorAll('.clear-chat-option').forEach(el => {
el.addEventListener('click', (e) => {
e.stopPropagation();
const action = el.dataset.action;
closeClearChatMenuPopup();
if (action === 'clearAll') clearTeamChat(teamId, false);
else if (action === 'keepStarred') clearTeamChat(teamId, true);
});
});
menu.style.left = Math.min(x, window.innerWidth - 250) + 'px';
menu.style.top = Math.min(y, window.innerHeight - 100) + 'px';
}
async function clearTeamChat(teamId, keepStarred) {
if (!db || !currentUser) return;
const confirmMsg = keepStarred ? 'Очистить чат, оставив только избранные сообщения?' : 'Очистить весь чат полностью? Это действие необратимо для всех участников.';
if (!confirm(confirmMsg)) return;
try {
const snap = await db.collection('teamRegistry').doc(teamId).collection('chat').get();
const docsToDelete = snap.docs.filter(doc => !(keepStarred && doc.data().starred));
let batch = db.batch();
let count = 0;
for (const doc of docsToDelete) {
batch.delete(doc.ref);
count++;
if (count === 400) { await batch.commit(); batch = db.batch(); count = 0; }
}
if (count > 0) await batch.commit();
showToast('✅ Чат очищен', 'success');
} catch (err) {
console.error('Не удалось очистить чат:', err);
showToast('❌ Не удалось очистить чат', 'error');
}
}
async function toggleStarChatMessage(teamId, msgId) {
const msg = (chatMessagesCache[teamId] || []).find(m => m.id === msgId);
if (!msg) return;
try {
await db.collection('teamRegistry').doc(teamId).collection('chat').doc(msgId).update({ starred: !msg.starred });
} catch (err) {
console.error('Не удалось изменить избранное:', err);
}
}
async function deleteChatMessage(teamId, msgId) {
if (!confirm('Удалить это сообщение?')) return;
try {
await db.collection('teamRegistry').doc(teamId).collection('chat').doc(msgId).update({ text: null, deleted: true, editedAt: null });
} catch (err) {
console.error('Не удалось удалить сообщение:', err);
showToast('❌ Не удалось удалить сообщение', 'error');
}
}
async function deleteAllMessagesFromUserAndKick(teamId, senderId) {
if (!confirm('Удалить все сообщения этого участника и исключить его из команды?')) return;
try {
const snap = await db.collection('teamRegistry').doc(teamId).collection('chat').where('senderId', '==', senderId).get();
const batch = db.batch();
snap.forEach(doc => batch.update(doc.ref, { text: null, deleted: true, editedAt: null }));
await batch.commit();
} catch (err) {
console.error('Не удалось удалить сообщения участника:', err);
}
currentMembersTeamId = teamId;
await kickTeamMember(senderId);
}

// === ПОСТРАНИЧНАЯ ЗАГРУЗКА ИСТОРИИ ===
function handleChatScroll(el) {
if (el.scrollTop < 40) loadMoreChatMessages(currentChatTeamId);
// Запоминаем «увиденное» время, когда пользователь у самого низа (для бейджа кнопки «вниз»)
if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
const msgs = chatMessagesCache[currentChatTeamId] || [];
for (let i = msgs.length - 1; i >= 0; i--) {
if (!msgs[i].__pending && !msgs[i].__failed) { window.__chatSeenTs = Math.max(window.__chatSeenTs || 0, msgTs(msgs[i])); break; }
}
}
updateChatScrollDownBtn();
}
async function loadMoreChatMessages(teamId) {
if (!teamId || !db || chatOldestLoaded[teamId] === 'end') return;
const msgs = chatMessagesCache[teamId] || [];
if (msgs.length === 0) return;
const oldestTs = msgTs(msgs[0]);
try {
const snap = await db.collection('teamRegistry').doc(teamId).collection('chat')
.orderBy('createdAt', 'desc').startAfter(oldestTs).limit(30).get();
if (snap.empty) { chatOldestLoaded[teamId] = 'end'; return; }
const older = [];
snap.forEach(doc => older.push({ id: doc.id, ...doc.data() }));
older.reverse();
const list = document.getElementById('chat-messages-list');
const prevHeight = list ? list.scrollHeight : 0;
chatMessagesCache[teamId] = older.concat(chatMessagesCache[teamId] || []);
renderChatMessages(teamId);
if (list) list.scrollTop = list.scrollHeight - prevHeight;
} catch (err) { console.error('Не удалось подгрузить старые сообщения:', err); }
}

// === ЛИСТЕНЕРЫ КОМАНДЫ ===
function startTeamRegistryListener(teamId) {
if (teamRegistryListenerUnsubs[teamId] || !db || !currentUser) return;
teamRegistryListenerUnsubs[teamId] = db.collection('teamRegistry').doc(teamId).onSnapshot(doc => {
if (!doc.exists) return;
const data = doc.data();
const team = teams.find(t => t.id === teamId);
if (!team) return;
if (data.updatedAt && team.updatedAt && data.updatedAt < team.updatedAt) return;
team.name = data.name;
team.avatar = data.avatar || null;
team.updatedAt = data.updatedAt || team.updatedAt;
team.createdBy = data.createdBy || team.createdBy;
team.pinnedChatMsg = data.pinnedChatMsg || null;
saveTeamsLocal();
renderTeamsList();
if (currentChatTeamId === teamId) {
document.getElementById('chat-team-name').innerText = team.name;
document.getElementById('chat-team-avatar').innerHTML = team.avatar ? `<img src="${escapeHtml(team.avatar)}" alt="">` : '🎸';
renderChatPinnedBanner();
}
}, err => console.error('teamRegistry listener error:', err));
}
function startMembershipWatch(teamId) {
if (membershipWatchUnsubs[teamId] || !db || !currentUser) return;
let sawExisting = false;
membershipWatchUnsubs[teamId] = db.collection('teamRegistry').doc(teamId).collection('members').doc(currentUser.uid)
.onSnapshot(doc => {
if (doc.exists) { sawExisting = true; return; }
if (!sawExisting) return;
handleKickedFromTeam(teamId);
}, err => console.error('membership watch error:', err));
}
function handleKickedFromTeam(teamId) {
const team = teams.find(t => t.id === teamId);
const teamName = team ? team.name : 'команда';
recentlyLeftTeams[teamId] = Date.now();
teams = teams.filter(t => t.id !== teamId);
[teamListenerUnsubs, teamRegistryListenerUnsubs, membershipWatchUnsubs,
teamRolesListenerUnsubs, chatListenerUnsubs, chatReadsListenerUnsubs].forEach(m => {
if (m[teamId]) { m[teamId](); delete m[teamId]; }
});
delete teamRolesCache[teamId];
delete chatMessagesCache[teamId];
delete chatReadsCache[teamId];
pinnedTeams = pinnedTeams.filter(id => id !== teamId);
saveTeamsLocal();
if (currentChatTeamId === teamId) closeTeamChat();
renderTeamsList();
alert(`⚠️ Вас удалили из команды «${teamName}»`);
}
function startTeamRolesListener(teamId) {
if (teamRolesListenerUnsubs[teamId] || !db || !currentUser) return;
teamRolesListenerUnsubs[teamId] = db.collection('teamRegistry').doc(teamId).collection('members')
.onSnapshot(snap => {
const roles = {};
let myRawRole;
snap.forEach(doc => {
roles[doc.id] = { role: doc.data().role || 'member', joinedAt: doc.data().joinedAt || 0 };
if (doc.id === currentUser.uid) myRawRole = doc.data().role;
});
teamRolesCache[teamId] = roles;
try { localStorage.setItem('clc_team_roles_cache', JSON.stringify(teamRolesCache)); } catch {}
const team = teams.find(t => t.id === teamId);
if (!myRawRole && team && team.createdBy === currentUser.uid) {
db.collection('teamRegistry').doc(teamId).collection('members').doc(currentUser.uid)
.set({ role: 'owner' }, { merge: true }).catch(err => console.error('role bootstrap failed:', err));
}
if (currentChatTeamId === teamId) renderChatMessages(teamId);
if (currentMembersTeamId === teamId && typeof renderTeamMembersList === 'function') renderTeamMembersList();
renderTeamsList();
}, err => console.error('roles listener error:', err));
}
function getMyRole(teamId) {
const roles = teamRolesCache[teamId];
if (!roles || !currentUser) return 'member';
const entry = roles[currentUser.uid];
return entry ? entry.role : 'member';
}
function isTeamOwner(teamId) { return getMyRole(teamId) === 'owner'; }
function isTeamOwnerOrAdmin(teamId) { const r = getMyRole(teamId); return r === 'owner' || r === 'admin'; }
function notAllowedForRole() { showToast('⛔ Недоступно для вашей роли в команде', 'error'); }

// Точка входа: запускает листенеры команды (только чат-related, без песен)
function startTeamDataListener(teamId) {
startTeamRegistryListener(teamId);
startMembershipWatch(teamId);
startTeamRolesListener(teamId);
startChatListener(teamId);
startChatReadsListener(teamId);
}

// === РЕПЛАИ (ОТВЕТЫ) ===
function setChatReplyTo(msg) {
const p = currentMembersProfiles[msg.senderId] || {};
const name = [p.displayName, p.lastName].filter(Boolean).join(' ').trim() || 'Без имени';
chatReplyTo = { id: msg.id, name, text: (msg.text || '').slice(0, 120) };
renderChatReplyPreview();
document.getElementById('chat-input').focus();
}
function clearChatReplyTo() {
chatReplyTo = null;
renderChatReplyPreview();
}
function renderChatReplyPreview() {
const el = document.getElementById('chat-reply-preview');
if (!el) return;
if (!chatReplyTo) { el.style.display = 'none'; el.innerHTML = ''; return; }
el.style.display = 'flex';
el.innerHTML = `<div style="min-width:0;flex:1;border-left:3px solid #42a5f5;padding-left:8px;"><div style="font-size:12px;color:#42a5f5;font-weight:bold;">↩️ ${escapeHtml(chatReplyTo.name)}</div><div style="font-size:13px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(chatReplyTo.text)}</div></div><button class="btn-icon" onclick="event.stopPropagation(); clearChatReplyTo()">✕</button>`;
}

// === СВАЙПЫ ПО СООБЩЕНИЯМ (вправо — ответить, влево по своим — изменить) ===
function setupChatBubbleSwipes() {
if (window.__chatBubbleSwipesBound) return;
window.__chatBubbleSwipesBound = true;
const list = document.getElementById('chat-messages-list');
if (!list) return;
let bubble = null, sx = 0, sy = 0, dx = 0, mode = 0; // mode: 0 неизвестно, 1 горизонталь, 2 вертикаль
list.addEventListener('touchstart', (e) => {
const t = e.touches[0];
bubble = e.target.closest('.chat-bubble');
sx = t.clientX; sy = t.clientY; dx = 0; mode = 0;
if (bubble) bubble.style.transition = 'none';
}, { passive: true });
list.addEventListener('touchmove', (e) => {
if (!bubble) return;
const t = e.touches[0];
const mdx = t.clientX - sx, mdy = t.clientY - sy;
if (mode === 0 && (Math.abs(mdx) > 12 || Math.abs(mdy) > 12)) {
mode = Math.abs(mdx) > Math.abs(mdy) ? 1 : 2;
// горизонтальное движение отменяет долгое нажатие
if (mode === 1) { clearTimeout(window.__chatPressTimer); window.__chatPressFired = true; }
}
if (mode !== 1) return;
// вправо — «ответить», влево по своему сообщению — «изменить»
dx = Math.min(140, Math.max(-140, mdx));
const dxClamped = dx > 0 ? Math.min(dx, 90) * 0.6 : Math.max(dx, -90) * 0.6;
bubble.style.transform = `translateX(${dxClamped}px)`;
}, { passive: true });
list.addEventListener('touchend', (e) => {
if (!bubble) return;
const b = bubble; bubble = null;
b.style.transition = 'transform 0.15s ease';
b.style.transform = '';
const msgId0 = (b.id || '').replace('chat-msg-', '');
if (mode !== 1) {
// двойной тап (телефон) — сердечко; браузерный dblclick на тачах не срабатывает
const tx = e.changedTouches[0].clientX - sx;
const ty = e.changedTouches[0].clientY - sy;
if (Math.abs(tx) < 12 && Math.abs(ty) < 12) {
const now = Date.now();
if (list.__lastTapAt && now - list.__lastTapAt < 320) {
list.__lastTapAt = 0;
toggleChatReaction(currentChatTeamId, msgId0, '❤️');
} else {
list.__lastTapAt = now;
}
}
return;
}
const teamId = currentChatTeamId;
const msgId = (b.id || '').replace('chat-msg-', '');
const msg = (chatMessagesCache[teamId] || []).find(m => m.id === msgId);
if (!msg || msg.deleted) return;
if (dx > 60) { if (navigator.vibrate) navigator.vibrate(20); setChatReplyTo(msg); }
else if (dx < -60 && msg.senderId === currentUser.uid && Date.now() - msg.createdAt < CHAT_EDIT_WINDOW_MS) {
if (navigator.vibrate) navigator.vibrate(20);
startEditChatMessage(msg.id);
}
}, { passive: true });
// Двойной тап мышью (компьютер) — сердечко
list.addEventListener('dblclick', (e) => {
const b = e.target.closest('.chat-bubble');
if (!b) return;
const msgId = (b.id || '').replace('chat-msg-', '');
toggleChatReaction(currentChatTeamId, msgId, '❤️');
});
}

// === РЕАКЦИИ ===
async function toggleChatReaction(teamId, msgId, emoji) {
if (!db || !currentUser || !teamId || !msgId) return;
const msg = (chatMessagesCache[teamId] || []).find(m => m.id === msgId);
if (!msg || msg.deleted) return;
const mine = msg.reactions && msg.reactions[emoji] && msg.reactions[emoji][currentUser.uid];
try {
if (mine) {
await db.collection('teamRegistry').doc(teamId).collection('chat').doc(msgId)
.update({ [`reactions.${emoji}.${currentUser.uid}`]: firebase.firestore.FieldValue.delete() });
} else {
await db.collection('teamRegistry').doc(teamId).collection('chat').doc(msgId)
.update({ [`reactions.${emoji}.${currentUser.uid}`]: true });
}
} catch (err) { console.error('reaction failed:', err); }
}
function showReactionPicker(teamId, msgId, x, y) {
closeChatMsgMenuPopup();
const overlay = document.createElement('div');
overlay.id = 'chat-msg-menu-overlay';
overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
overlay.onclick = closeChatMsgMenuPopup;
document.body.appendChild(overlay);
const menu = document.createElement('div');
menu.id = 'chat-msg-menu-popup';
menu.style.cssText = 'position:fixed;background:#2a2a2a;border-radius:22px;box-shadow:0 4px 14px rgba(0,0,0,0.5);z-index:9999;display:flex;gap:2px;padding:6px;';
['❤️','👍','😂','😢','🙏','🔥'].forEach(em => {
const s = document.createElement('span');
s.textContent = em;
s.style.cssText = 'font-size:24px;padding:6px 8px;cursor:pointer;border-radius:50%;';
s.onclick = (e) => { e.stopPropagation(); closeChatMsgMenuPopup(); toggleChatReaction(teamId, msgId, em); };
menu.appendChild(s);
});
document.body.appendChild(menu);
menu.style.left = Math.min(Math.max(8, x - 110), window.innerWidth - 250) + 'px';
menu.style.top = Math.min(y, window.innerHeight - 60) + 'px';
}

// === ЗАКРЕПЛЁННОЕ СООБЩЕНИЕ ===
async function pinChatMessage(teamId, msgId) {
const msg = (chatMessagesCache[teamId] || []).find(m => m.id === msgId);
if (!db || !msg || msg.deleted) return;
const p = currentMembersProfiles[msg.senderId] || {};
const name = [p.displayName, p.lastName].filter(Boolean).join(' ').trim() || 'Без имени';
try {
await db.collection('teamRegistry').doc(teamId).update({
pinnedChatMsg: { id: msg.id, name, text: (msg.text || '').slice(0, 140), senderId: msg.senderId, createdAt: msg.createdAt }
});
showToast('📌 Сообщение закреплено', 'success');
} catch (err) {
console.error('pin failed:', err);
showToast('❌ Не удалось закрепить сообщение', 'error');
}
}
async function unpinChatMessage(teamId) {
if (!db || !teamId) return;
try {
await db.collection('teamRegistry').doc(teamId).update({ pinnedChatMsg: firebase.firestore.FieldValue.delete() });
} catch (err) {
console.error('unpin failed:', err);
showToast('❌ Не удалось открепить сообщение', 'error');
}
}
function renderChatPinnedBanner() {
const banner = document.getElementById('chat-pinned-banner');
if (!banner) return;
const team = teams.find(t => t.id === currentChatTeamId);
const pin = team && team.pinnedChatMsg;
if (!pin) { banner.style.display = 'none'; banner.innerHTML = ''; return; }
banner.style.display = 'flex';
banner.innerHTML = `<div style="min-width:0;flex:1;border-left:3px solid #42a5f5;padding-left:8px;" onclick="scrollToChatMessage('${pin.id}')"><div style="font-size:12px;color:#42a5f5;font-weight:bold;">📌 ${escapeHtml(pin.name)}</div><div style="font-size:13px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${formatChatText(pin.text)}</div></div><button class="btn-icon" onclick="event.stopPropagation(); unpinChatMessage('${currentChatTeamId}')" title="Открепить">✕</button>`;
}
function scrollToChatMessage(msgId) {
const el = document.getElementById('chat-msg-' + msgId);
if (!el) { showToast('Сообщение выше загруженной истории — прокрутите вверх и повторите', 'info'); return; }
window.__highlightMsgId = msgId;
el.scrollIntoView({ behavior: 'smooth', block: 'center' });
el.style.background = 'rgba(66,165,245,0.25)';
setTimeout(() => {
window.__highlightMsgId = null;
const el2 = document.getElementById('chat-msg-' + msgId);
if (el2) el2.style.background = '';
}, 2500);
}
async function copyChatText(text) {
const t = text || '';
try {
if (navigator.clipboard && navigator.clipboard.writeText) {
await navigator.clipboard.writeText(t);
} else {
const ta = document.createElement('textarea');
ta.value = t;
document.body.appendChild(ta);
ta.select();
document.execCommand('copy');
ta.remove();
}
showToast('📋 Скопировано', 'success');
} catch (err) {
console.error('copy failed:', err);
showToast('❌ Не удалось скопировать', 'error');
}
}