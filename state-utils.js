// === СОСТОЯНИЕ ЧАТ-ПРИЛОЖЕНИЯ ===
// Те же глобальные переменные, что в основном приложении, но только «командно-чатовая» часть.

// Данные (песни/сетлисты оставлены пустыми заглушками — на них могут ссылаться общие функции)
let songs = [], setlists = [], teams = [];
let sectionNotes = {}, inlineComments = {}, personalViewSettings = {};

// Команды
let teamDataCache = {}, teamListenerUnsubs = {}, currentTeamDetailId = null;
let teamRegistryListenerUnsubs = {};
let membershipWatchUnsubs = {};
let recentlyLeftTeams = {};
let pinnedTeams = [];
let setlistStatusCache = {};
let failedSyncSetlists = {};
let teamRolesCache = {};
let teamRolesListenerUnsubs = {};
let setlistStatusListenerUnsubs = {};
const MAX_TEAMS = 15;

// Чат
let chatListenerUnsubs = {};
let chatReadsListenerUnsubs = {};
let chatMessagesCache = {};
let chatReadsCache = {};
let chatOldestLoaded = {};
let currentChatTeamId = null;
let chatEditingMessageId = null;

// Общее UI-состояние
let currentTab = 'current', currentHomeView = 'teams', currentSongId = null, currentSlId = null;
let carouselItems = [];
let carouselActiveIndex = 0;
let currentTeamArchiveTeamId = null;

// === УТИЛИТЫ ===

// Спиннер на кнопке на время асинхронной операции (отправка сообщения и т.п.)
function withButtonSpinner(btn, promiseFactory) {
if (!btn || btn.dataset.loading === 'true') return;
btn.dataset.loading = 'true';
const original = btn.innerHTML;
btn.disabled = true;
btn.innerHTML = '<span class="btn-spinner"></span>';
const finish = () => { btn.disabled = false; btn.innerHTML = original; delete btn.dataset.loading; };
try {
const result = promiseFactory();
if (result && typeof result.then === 'function') { result.then(finish).catch(finish); }
else { finish(); }
} catch (e) { finish(); throw e; }
return result;
}

// Очистка поля поиска (используется в списке участников)
function clearSearchInput(inputId, rerenderFn) {
const input = document.getElementById(inputId);
if (input) { input.value = ''; toggleSearchClearBtn(input); }
if (typeof rerenderFn === 'function') rerenderFn();
}
function toggleSearchClearBtn(input) {
const btn = input.parentElement.querySelector('.search-clear-btn');
if (btn) btn.style.display = input.value ? 'flex' : 'none';
}