// static/js/modules/profile_tabProfile.js

export function enterEditMode(state) {
    state.editForm.name = state.user.name;
    state.editForm.email = state.user.email;
    state.editForm.password = '';
    state.mode = 'edit';
}

export function cancelEditProfile(state) {
    state.mode = 'view';
}

export async function saveProfile(state) {
    state.isSaving = true;
    try {
        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.editForm)
        });

        const data = await res.json();
        if (res.ok) {
            // Обновляем локальное состояние реальными данными
            state.user.name = state.editForm.name;
            state.user.email = state.editForm.email;
            state.mode = 'view';
            alert('Изменения успешно сохранены!');
        } else {
            alert('Ошибка: ' + (data.error || 'Не удалось сохранить изменения'));
        }
9    } catch (error) {
        console.error('Ошибка сохранения профиля:', error);
        alert('Произошла ошибка сети');
    } finally {
        state.isSaving = false;
    }
}

export function previewAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        // Заглушка для демо-версии, но с понятным сообщением
        alert(`Файл "${file.name}" выбран. (Загрузка аватара будет реализована в следующей версии)`);
    }
}