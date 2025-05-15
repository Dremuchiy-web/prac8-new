const taskTextarea = document.getElementById('new-task-text');
const addTaskBtn = document.getElementById('add-task-btn');
const tasksList = document.getElementById('tasks-list');
const taskTemplate = document.getElementById('task-template');
const offlineStatus = document.getElementById('offline-status');
const enableNotificationsBtn = document.getElementById('enable-notifications');
const filterAllBtn = document.getElementById('filter-all');
const filterActiveBtn = document.getElementById('filter-active');
const filterCompletedBtn = document.getElementById('filter-completed');

let currentFilter = 'all'; 
let notificationsEnabled = false;
let swRegistration = null;

// массив с задачами
let tasks = [];

// чек интернет соединения
function updateOnlineStatus() {
    if (navigator.onLine) {
        offlineStatus.classList.add('hidden');
    } else {
        offlineStatus.classList.remove('hidden');
    }
}

// слушатели событий изменения статуса соединения
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

async function init() {
    updateOnlineStatus();
    loadTasks();
    renderTasks();
    
    if ('serviceWorker' in navigator) {
        try {
            swRegistration = await navigator.serviceWorker.getRegistration();
            updateNotificationButtonState();
        } catch (error) {
            console.error('Ошибка при регистрации Service Worker:', error);
        }
    }
    
    addTaskBtn.addEventListener('click', addTask);
    enableNotificationsBtn.addEventListener('click', toggleNotifications);
    
    filterAllBtn.addEventListener('click', () => setFilter('all'));
    filterActiveBtn.addEventListener('click', () => setFilter('active'));
    filterCompletedBtn.addEventListener('click', () => setFilter('completed'));
    
    scheduleReminders();
}

// загрузка задач
function loadTasks() {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
}

// сохранение задач
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// добавление задачи
function addTask() {
    const taskText = taskTextarea.value.trim();
    if (taskText) {
        const newTask = {
            id: Date.now(),
            text: taskText,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        tasks.unshift(newTask); 
        saveTasks();
        renderTasks();
        taskTextarea.value = '';
        
        if (notificationsEnabled) {
            showAddTaskNotification(newTask);
        }
    }
}

// удаление задачи
function deleteTask(taskId) {
    tasks = tasks.filter(task => task.id !== taskId);
    saveTasks();
    renderTasks();
}

// редактирование задачи
function editTask(taskId) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        const newText = prompt('Редактировать задачу:', task.text);
        if (newText !== null && newText.trim() !== '') {
            task.text = newText.trim();
            saveTasks();
            renderTasks();
        }
    }
}

// изменение статуса задачи
function toggleTaskStatus(taskId) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
    }
}

// установка фильтра
function setFilter(filter) {
    currentFilter = filter;
    
    [filterAllBtn, filterActiveBtn, filterCompletedBtn].forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (filter === 'all') {
        filterAllBtn.classList.add('active');
    } else if (filter === 'active') {
        filterActiveBtn.classList.add('active');
    } else if (filter === 'completed') {
        filterCompletedBtn.classList.add('active');
    }
    
    renderTasks();
}

// отображение задач
function renderTasks() {
    tasksList.innerHTML = '';
    
    let filteredTasks = tasks;
    if (currentFilter === 'active') {
        filteredTasks = tasks.filter(task => !task.completed);
    } else if (currentFilter === 'completed') {
        filteredTasks = tasks.filter(task => task.completed);
    }
    
    if (filteredTasks.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'Нет задач для отображения';
        emptyMessage.className = 'empty-tasks-message';
        tasksList.appendChild(emptyMessage);
        return;
    }
    
    filteredTasks.forEach(task => {
        const taskElement = document.importNode(taskTemplate.content, true);
        const taskContent = taskElement.querySelector('.task-content');
        const taskItem = taskElement.querySelector('.task-item');
        const checkbox = taskElement.querySelector('.task-checkbox');
        
        taskContent.textContent = task.text;
        checkbox.checked = task.completed;
        
        if (task.completed) {
            taskItem.classList.add('task-completed');
        }
        
        const deleteBtn = taskElement.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteTask(task.id));
        
        const editBtn = taskElement.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => editTask(task.id));
        
        checkbox.addEventListener('change', () => toggleTaskStatus(task.id));
        
        tasksList.appendChild(taskElement);
    });
}

// Push-уведомления
async function toggleNotifications() {
    if (!('Notification' in window)) {
        alert('Ваш браузер не поддерживает уведомления');
        return;
    }
    
    if (Notification.permission === 'granted') {
        notificationsEnabled = !notificationsEnabled;
        localStorage.setItem('notificationsEnabled', notificationsEnabled);
        updateNotificationButtonState();
        
        if (notificationsEnabled) {
            subscribeUserToPush();
        } else {
            unsubscribeFromPush();
        }
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            notificationsEnabled = true;
            localStorage.setItem('notificationsEnabled', true);
            updateNotificationButtonState();
            subscribeUserToPush();
        }
    } else {
        alert('Уведомления заблокированы. Пожалуйста, измените настройки уведомлений в браузере.');
    }
}

// обновление состояния кнопки уведомлений
function updateNotificationButtonState() {
    const savedState = localStorage.getItem('notificationsEnabled');
    if (savedState !== null) {
        notificationsEnabled = savedState === 'true';
    }
    
    if (notificationsEnabled) {
        enableNotificationsBtn.textContent = 'Отключить уведомления';
    } else {
        enableNotificationsBtn.textContent = 'Включить уведомления';
    }
    
    if (!('Notification' in window)) {
        enableNotificationsBtn.classList.add('disabled');
        enableNotificationsBtn.disabled = true;
    }
}

// подписка на push-уведомления
async function subscribeUserToPush() {
    if (!swRegistration) return;
    
    try {
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
                'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
            )
        });
        
        console.log('Успешно подписались на push-уведомления:', subscription);
    } catch (error) {
        console.error('Ошибка при подписке на push-уведомления:', error);
    }
}

// отписка от push-уведомлений
async function unsubscribeFromPush() {
    if (!swRegistration) return;
    
    try {
        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            console.log('Успешно отписались от push-уведомлений');
        }
    } catch (error) {
        console.error('Ошибка при отписке от push-уведомлений:', error);
    }
}

// функция для показа уведомления о новой задаче
function showAddTaskNotification(task) {
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        const title = 'Новая задача добавлена';
        const options = {
            body: task.text,
            icon: 'icons/icon-192x192.png',
            badge: 'icons/icon-32x32.png'
        };
        
        if (document.visibilityState === 'visible') {
            new Notification(title, options);
        } else if (swRegistration) {
            swRegistration.showNotification(title, options);
        }
    }
}

// планирование напоминаний о задачах каждые 2 часа
function scheduleReminders() {
    setInterval(() => {
        if (!notificationsEnabled) return;
        
        const activeTasks = tasks.filter(task => !task.completed);
        if (activeTasks.length > 0) {
            showReminderNotification(activeTasks.length);
        }
    }, 2 * 60 * 60 * 1000); // 2 часа
}

// показать напоминание о невыполненных задачах
function showReminderNotification(taskCount) {
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        const title = 'Напоминание';
        const options = {
            body: `У вас ${taskCount} невыполненных задач`,
            icon: 'icons/icon-192x192.png',
            badge: 'icons/icon-32x32.png'
        };
        
        if (document.visibilityState === 'visible') {
            new Notification(title, options);
        } else if (swRegistration) {
            swRegistration.showNotification(title, options);
        }
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

document.addEventListener('DOMContentLoaded', init); 