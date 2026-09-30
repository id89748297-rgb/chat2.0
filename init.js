// === ИНИЦИАЛИЗАЦИЯ ЧАТ-ПРИЛОЖЕНИЯ ===

// Локальные данные: список команд, отметки прочтения чатов, закреплённые команды
try { teams = JSON.parse(localStorage.getItem('clc_teams') || '[]'); } catch (e) { teams = []; }
try { chatReadsCache = JSON.parse(localStorage.getItem('clc_chat_reads_cache') || '{}'); } catch (e) { chatReadsCache = {}; }
try { pinnedTeams = JSON.parse(localStorage.getItem('clc_pinned_teams') || '[]'); } catch (e) { pinnedTeams = []; }

// Тема оформления
const __savedTheme = localStorage.getItem('clc_theme');
if (__savedTheme === 'light') {
document.body.classList.remove('dark');
document.body.classList.remove('dark-white');
document.body.classList.add('light');
updateThemeButtons('☀️');
} else if (__savedTheme === 'dark-white') {
document.body.classList.remove('dark');
document.body.classList.remove('light');
document.body.classList.add('dark-white');
updateThemeButtons('🌑');
} else {
document.body.classList.add('dark');
document.body.classList.remove('light');
document.body.classList.remove('dark-white');
updateThemeButtons('🌙');
}
const __savedColor = localStorage.getItem('clc_color');
if (__savedColor === 'violet') document.body.classList.add('violet'); else document.body.classList.remove('violet');

// === ОБНОВЛЕНИЕ СТРАНИЦЫ ===
function refreshPage(btnEl) {
if (btnEl) {
btnEl.classList.add('spinning');
setTimeout(() => btnEl.classList.remove('spinning'), 1000);
}
if (!navigator.onLine) {
showToast('❌ Нет подключения к интернету. Синхронизация невозможна.', 'error');
return;
}
showToast('↻ Обновление страницы...', 'info');
setTimeout(() => {
location.reload();
}, 600);
}

// === TOAST-УВЕДОМЛЕНИЯ (безопасная версия: textContent вместо innerHTML) ===
function showToast(message, type = 'error') {
const container = document.getElementById('toast-container');
if (!container) return;
while (container.children.length >= 3) container.firstChild.remove();
const toast = document.createElement('div');
toast.className = 'toast ' + type;
const span = document.createElement('span');
span.textContent = message;
toast.appendChild(span);
container.appendChild(toast);
setTimeout(() => {
if (toast.parentNode) toast.parentNode.removeChild(toast);
}, 3000);
}

// === СЛУШАТЕЛИ СОСТОЯНИЯ СЕТИ ===
window.addEventListener('online', () => {
showToast('✅ Подключение восстановлено', 'success');
});
window.addEventListener('offline', () => {
showToast('❌ Потеряно подключение к интернету', 'error');
});