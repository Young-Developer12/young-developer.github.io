// ==========================================
// 1. БЕЗОПАСНЫЙ ЭМУЛЯТОР CEF (для консоли/браузера)
// ==========================================
if (typeof window.cef === 'undefined') {
    window.cef = {};
}

// Добавляем отсутствующие методы, чтобы консоль не выдавала Uncaught TypeError
if (!window.cef.emit) {
    window.cef.emit = function(event, ...args) {
        console.log(`[CEF EMIT] -> ${event}:`, args);
    };
}

if (!window.cef.set_focus) {
    window.cef.set_focus = function(state) {
        console.log(`[CEF FOCUS] ->`, state);
    };
}

// Кастомный реестр событий для консольных вызовов
window.cef._events = window.cef._events || {};

if (!window.cef.on) {
    window.cef.on = function(event, callback) {
        window.cef._events[event] = callback;
    };
} else {
    // Если cef.on встроен в клиент, перехватываем подписки для trigger
    const nativeOn = window.cef.on;
    window.cef.on = function(event, callback) {
        window.cef._events[event] = callback;
        nativeOn.call(window.cef, event, callback);
    };
}

// Создаем универсальный trigger для консоли F12
window.cef.trigger = function(event, ...args) {
    if (window.cef._events[event]) {
        window.cef._events[event](...args);
    } else {
        console.warn(`[CEF TRIGGER] Событие "${event}" не найдено.`);
    }
};

// ==========================================
// 2. ДАННЫЕ СКИНОК
// ==========================================
const boy_skin = [ 14, 20, 24, 22, 21, 7 ];
const girl_skin = [ 13, 201, 207, 90, 77, 31 ];

const boy_skin_images = [
    'images/skins/skins14.png',
    'images/skins/skins20.png',
    'images/skins/skins24.png',
    'images/skins/skins22.png',
    'images/skins/skins21.png',
    'images/skins/skins7.png',
];
const girl_skin_images = [
    'images/skins/skins13.png',
    'images/skins/skins201.png',
    'images/skins/skins207.png',
    'images/skins/skins90.png',
    'images/skins/skins77.png',
    'images/skins/skins31.png',
];

// ==========================================
// 3. VUE ИНИЦИАЛИЗАЦИЯ
// ==========================================
var auth = new Vue({
    el: ".__main__",
    data: {
        active: true,
        data: 'auth',
        vpass: false,
        clothes: 0,
        sex: 1,
        LPass: '',
        inputs: [
            { id: 0, placeholder: 'Укажите свою эл.почту', type: 'email', inputtext: '' },
            { id: 1, placeholder: 'Введите пароль', type: 'password', inputtext: '' },
            { id: 2, placeholder: 'Повторите пароль', type: 'password', inputtext: '' },
            { id: 3, placeholder: 'Введите промокод. Если есть', type: 'text', inputtext: '' }
        ],
        mskin: [
            { id: 0, img: boy_skin_images[0], skin: boy_skin[0] },
            { id: 1, img: boy_skin_images[1], skin: boy_skin[1] },
            { id: 2, img: boy_skin_images[2], skin: boy_skin[2] },
            { id: 3, img: boy_skin_images[3], skin: boy_skin[3] },
            { id: 4, img: boy_skin_images[4], skin: boy_skin[4] },
            { id: 5, img: boy_skin_images[5], skin: boy_skin[5] }
        ],
        gskin: [
            { id: 0, img: girl_skin_images[0], skin: girl_skin[0] },
            { id: 1, img: girl_skin_images[1], skin: girl_skin[1] },
            { id: 2, img: girl_skin_images[2], skin: girl_skin[2] },
            { id: 3, img: girl_skin_images[3], skin: girl_skin[3] },
            { id: 4, img: girl_skin_images[4], skin: girl_skin[4] },
            { id: 5, img: girl_skin_images[5], skin: girl_skin[5] }
        ],
        notify: []
    },
    methods: {
        PasswordVisibility() {
            this.vpass = !this.vpass;
        },
        PasswordVisibilityReg(id) {
            if (this.inputs[id]) {
                this.inputs[id].type = (this.inputs[id].type === 'password') ? 'text' : 'password';
            }
        },
        ReplaceSex(id) {
            this.sex = id;
            this.clothes = 0;
        },
        ReplaceClothes(data) {
            this.clothes = data;
        },
        addNotify(name, text, time) {
            if (this.notify.length <= 4) {
                const count_id = Date.now() + Math.random();
                this.notify.push({
                    id: count_id,
                    name: name,
                    text: text
                });
                setTimeout(() => {
                    this.removeNotify(count_id);
                }, (time || 3) * 1000);
            }
        },
        removeNotify(id) {
            this.notify = this.notify.filter(item => item.id !== id);
        },
        ReplaceData(data) {
            if (data !== 'responce-reg') {
                this.data = data;
            } else {
                let email = (this.inputs[0].inputtext.trim() === '') ? 'NullEmail' : this.inputs[0].inputtext;
                let pass = this.inputs[1].inputtext;
                let passRepeat = this.inputs[2].inputtext;
                let promo = (this.inputs[3].inputtext.trim() === '') ? 'NullPromocode' : this.inputs[3].inputtext;

                cef.emit("game:auth:reg:response", email, pass, passRepeat, promo, this.clothes, this.sex);
            }
        },
        ResponceLogin() {
            cef.emit("game:auth:login:response", this.LPass);
        },
        // Вспомогательный метод управления видимостью DOM
        setVisible(active) {
            const el = document.querySelector('.__main__');
            if (el) {
                el.style.opacity = active ? '1' : '0';
                el.style.visibility = active ? 'visible' : 'hidden';
            }
        }
    },
    mounted() {
        // Подписываемся на события CEF
        cef.on("game:auth:active", (active, data) => {
            this.active = active;
            this.data = data;

            cef.set_focus(active);
            this.setVisible(active);
        });

        cef.on("game:auth:notify", (name, text, time) => {
            this.addNotify(name, text, time);
        });
    }
});