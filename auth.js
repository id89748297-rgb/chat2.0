// === FIREBASE AUTHENTICATION (чат-приложение) ===
let currentUser = null;

// Заглушки функций профиля (в песочнице нет страницы профиля — не мешают)
function loadUserAvatar() {}
function resetAvatarsInUI() {}

auth.onAuthStateChanged(async (user) => {
    const authPage = document.getElementById('page-auth');
    const homePage = document.getElementById('page-home');

    if (user) {
        // ✅ ПРОВЕРКА: Почта должна быть подтверждена
        if (!user.emailVerified) {
            currentUser = null;
            localStorage.removeItem('clc_current_uid');
            if (document.getElementById('profile-btn')) document.getElementById('profile-btn').style.display = 'none';
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            if (authPage) authPage.classList.add('active');
            showAuthError(`⚠️ Почта не подтверждена! Проверьте ящик ${user.email}.`);
            return;
        }

        currentUser = user;
        localStorage.setItem('clc_current_uid', user.uid);
        console.log('✅ Авторизован:', user.email);

        // Показываем страницу выбора команды (мгновенно, с локальными данными)
        showPage('page-home');
        renderTeamsList();

        // Загружаем команды из облака в фоне
        showToast('↻ Синхронизация...', 'info');
        loadUserDataFromCloud().then(() => {
            showToast('✅ Данные синхронизированы', 'success');
            renderTeamsList();
            syncPublicProfileToTeams();
        }).catch(err => {
            console.error('Ошибка синхронизации:', err);
            showToast('⚠️ Ошибка синхронизации. Команды загружены локально.', 'error');
        });

        // Реал-тайм обновление команд
        startCloudSync();

        // Регистрируем сессию устройства
        registerSession();

        // Починка старых команд: создаём «пропуск» участника, если его нет
        if (typeof ensureTeamMemberships === 'function') {
            ensureTeamMemberships();
        }

    } else {
        currentUser = null;
        localStorage.removeItem('clc_current_uid');
        // Очистка локальных данных
        ['clc_teams','clc_team_members_cache','clc_chat_reads_cache',
         'clc_team_roles_cache','clc_state'].forEach(k => localStorage.removeItem(k));
        teams = []; teamRolesCache = {}; chatMessagesCache = {}; chatReadsCache = {};
        console.log('❌ Не авторизован');
        stopCloudSync();
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        if (authPage) authPage.classList.add('active');
    }
});

// Выход из аккаунта
async function logout() {
    if (confirm('Выйти из аккаунта?')) {
        if (typeof stopCloudSync === 'function') {
            stopCloudSync();
        }
        if (currentUser) {
            try {
                await db.collection('users').doc(currentUser.uid).collection('sessions').doc(currentSessionId).delete();
            } catch (e) {
                console.log('Сессия уже удалена или не существовала');
            }
        }
        localStorage.removeItem('session_id');
        ['clc_teams','clc_team_members_cache','clc_chat_reads_cache',
         'clc_team_roles_cache','clc_state'].forEach(k => localStorage.removeItem(k));
        teams = []; teamRolesCache = {}; chatMessagesCache = {}; chatReadsCache = {};
        // Firebase сам вызовет onAuthStateChanged(null) во ВСЕХ вкладках
        await auth.signOut();
    }
}

// Вход по email/паролю
async function loginWithEmail() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) {
    showAuthError('Заполните все поля');
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    showAuthError(getAuthErrorMessage(error.code));
  }
}

// Регистрация
async function registerWithEmail() {
const name = document.getElementById('register-name').value.trim();
const email = document.getElementById('login-email').value.trim();
const password = document.getElementById('login-password').value;
if (!name) {
showAuthError('Введите имя');
return;
}
if (!email || !password) {
showAuthError('Заполните все поля');
return;
}
if (password.length < 6) {
showAuthError('Пароль должен быть минимум 6 символов');
return;
}
try {
const userCredential = await auth.createUserWithEmailAndPassword(email, password);
await userCredential.user.updateProfile({ displayName: name });
await userCredential.user.sendEmailVerification();
alert('✅ Аккаунт создан! Пожалуйста, проверьте почту и перейдите по ссылке для подтверждения.');
} catch (error) {
showAuthError(getAuthErrorMessage(error.code));
}
}

// Сброс пароля
async function resetPassword() {
    const email = document.getElementById('login-email').value.trim();
    if (!email) {
        showAuthError('Сначала введите email в поле выше');
        return;
    }
    try {
        await auth.sendPasswordResetEmail(email);
        alert('✅ Письмо отправлено на ' + email + '\n\nПроверьте почту (включая спам).');
    } catch (error) {
        showAuthError(getAuthErrorMessage(error.code));
    }
}

// Повторная отправка письма подтверждения
async function resendVerification() {
  if (auth.currentUser) {
    try {
      await auth.currentUser.sendEmailVerification();
      alert('✅ Письмо подтверждения отправлено на ' + auth.currentUser.email + '\nПроверьте почту (включая спам).');
    } catch (error) {
      showAuthError(getAuthErrorMessage(error.code));
    }
    return;
  }
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) {
    showAuthError('Введите email и пароль в поля выше, затем нажмите ещё раз');
    return;
  }
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    await cred.user.sendEmailVerification();
    alert('✅ Письмо подтверждения отправлено на ' + email + '\nПроверьте почту (включая спам).');
  } catch (error) {
    showAuthError(getAuthErrorMessage(error.code));
  }
}

// Показ ошибки авторизации
function showAuthError(message) {
  const errorDiv = document.getElementById('auth-error');
  if (errorDiv) {
    errorDiv.innerText = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
  }
}

// Расшифровка ошибок
function getAuthErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
    'auth/invalid-email': 'Неверный формат email',
    'auth/weak-password': 'Пароль слишком слабый',
    'auth/user-not-found': 'Пользователь не найден',
    'auth/wrong-password': 'Неверный пароль',
    'auth/invalid-credential': 'Неверные учетные данные'
  };
  return messages[code] || 'Ошибка авторизации';
}

// Показ поля «Имя» при регистрации
function showRegisterForm() {
  const nameField = document.getElementById('register-name');
  if (nameField.style.display === 'none') {
    nameField.style.display = 'block';
    nameField.focus();
    return;
  }
  if (confirm('Создать новый аккаунт?')) {
    registerWithEmail();
  }
}

// === СЕССИИ (УСТРОЙСТВА) ===
let currentSessionId = localStorage.getItem('session_id');
if (!currentSessionId) {
    currentSessionId = window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now().toString();
    localStorage.setItem('session_id', currentSessionId);
}

let unsubscribeSessionWatch = null;

async function registerSession() {
    if (!currentUser) return;
    const deviceLabel = /Mobi|Android/i.test(navigator.userAgent) ? "📱 Мобильное устройство" : "💻 Компьютер";

    await db.collection('users').doc(currentUser.uid).collection('sessions').doc(currentSessionId).set({
        deviceLabel: deviceLabel,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (unsubscribeSessionWatch) unsubscribeSessionWatch();
    unsubscribeSessionWatch = db.collection('users').doc(currentUser.uid).collection('sessions').doc(currentSessionId)
        .onSnapshot((doc) => {
            if (!doc.exists) {
                console.log("Сессия удалена удаленно. Выполняется выход...");
                auth.signOut();
                alert("Эта сессия была завершена с другого устройства.");
            }
        });
}