// === СИНХРОНИЗАЦИЯ КОМАНД С ОБЛАКОМ (чат-приложение) ===

// Заглушка обновления аватарок (страницы профиля в песочнице нет)
function updateAvatarsInUI(avatar) {}

function mergeTeamsFromCloud(remoteTeams) {
    if (!remoteTeams) return false;
    let changed = false;
    const localIds = new Set(teams.map(t => t.id));
    const LEAVE_GRACE_MS = 5 * 60 * 1000;
    remoteTeams.forEach(rt => {
        if (localIds.has(rt.id)) return;
        const leftAt = recentlyLeftTeams[rt.id];
        if (leftAt && Date.now() - leftAt < LEAVE_GRACE_MS) return;
        teams.push(rt);
        changed = true;
    });
    return changed;
}

// Загрузка данных пользователя из облака
async function loadUserDataFromCloud() {
    if (!currentUser) return;
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            let updated = false;
            if (data.teams && mergeTeamsFromCloud(data.teams)) {
                localStorage.setItem('clc_teams', JSON.stringify(teams));
                updated = true;
            }
            if (data.avatar) {
                localStorage.setItem('clc_avatar_' + currentUser.uid, data.avatar);
            }
            teams.forEach(t => startTeamDataListener(t.id));
            if (updated) {
                renderTeamsList();
                console.log('✅ Команды загружены из облака');
            } else {
                console.log('✅ Данные актуальны, загрузка не требуется');
            }
        } else {
            console.log('📝 Новый пользователь — сохраняем данные в облако');
            await saveUserDataToCloud();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        throw error;
    }
}

// Сохранение списка команд в облако (merge — чужие поля не трогаем!)
async function saveUserDataToCloud() {
    if (!currentUser) return;
    try {
        const localAvatar = localStorage.getItem('clc_avatar_' + currentUser.uid);
        await db.collection('users').doc(currentUser.uid).set({
            teams: teams.map(t => ({ id: t.id, createdAt: t.createdAt || null, joinedByLink: t.joinedByLink || false })),
            avatar: localAvatar || null,
            lastSync: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('✅ Данные сохранены в облако');
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
    }
}

// === РЕАЛ-ТАЙМ СИНХРОНИЗАЦИЯ ===
let unsubscribeCloudSync = null;

function startCloudSync() {
    if (!currentUser || unsubscribeCloudSync) return;
    unsubscribeCloudSync = db.collection('users').doc(currentUser.uid)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                let needsRender = false;
                if (data.teams && mergeTeamsFromCloud(data.teams)) {
                    needsRender = true;
                }
                teams.forEach(t => startTeamDataListener(t.id));
                if (data.avatar && !localStorage.getItem('clc_avatar_' + currentUser.uid)) {
                    localStorage.setItem('clc_avatar_' + currentUser.uid, data.avatar);
                }
                if (needsRender) {
                    localStorage.setItem('clc_teams', JSON.stringify(teams));
                    renderTeamsList();
                    console.log("✅ Команды синхронизированы в реальном времени");
                }
            }
        }, (error) => {
            console.error("Ошибка синхронизации:", error);
        });
}

function stopCloudSync() {
    if (unsubscribeCloudSync) {
        unsubscribeCloudSync();
        unsubscribeCloudSync = null;
    }
    if (typeof unsubscribeSessionWatch !== 'undefined' && unsubscribeSessionWatch) {
        unsubscribeSessionWatch();
        unsubscribeSessionWatch = null;
    }
}