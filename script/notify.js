class Notify {
    static ROOT_SELECTOR = '.nfy-root';
    static STACK_SELECTOR = '.nfy-stack';
    static ITEM_CLASS = 'nfy-item';
    static VISIBLE_CLASS = 'nfy-item--visible';

    static FALLBACK_ANIM_DURATION = 350;
    static ANIM_DURATION_VAR = '--nfy-anim-duration';

    static DEFAULT_AUTO_HIDE_DELAY = 5000;
    static DELAY_FIELDS = ['autoHideDelay', 'hideDelay', 'delay'];
    
    static DURATION_FIELD = 'duration';

    static DEFAULT_ACCENT = '#ffffff';
    static DEFAULT_ICON = 'info';
    static MAX_ITEMS = 6;

    static EVENTS = {
        show: 'game:ShowNotification',
        hideAll: 'game:HideNotifications',
    };

    constructor(cef = null, options = {}) {
        this.cef = cef || (typeof window !== 'undefined' ? window.cef : null) || null;

        this.root = options.root || document.querySelector(Notify.ROOT_SELECTOR);
        if (!this.root) {
            return;
        }

        this.stack = this.root.querySelector(Notify.STACK_SELECTOR);
        this.autoHideDelay = Number.isFinite(options.autoHideDelay)
            ? options.autoHideDelay
            : Notify.DEFAULT_AUTO_HIDE_DELAY;
        this.maxItems = Number.isFinite(options.maxItems) ? options.maxItems : Notify.MAX_ITEMS;

        this.items = new Set();
        this.handlers = new Map();

        this.bindEvents();
    }

    bindEvents() {
        if (!this.cef || typeof this.cef.on !== 'function') {
            return;
        }

        this.on(Notify.EVENTS.show, (title, text, icon, duration, gradientStart, gradientEnd, accentColor) => {
            this.show({ title, text, icon, duration, gradientStart, gradientEnd, accentColor });
        });

        this.on(Notify.EVENTS.hideAll, () => this.hideAll());
    }

    on(event, handler) {
        this.handlers.set(event, handler);
        this.cef.on(event, handler);
    }

    getAnimationDuration() {
        const raw = getComputedStyle(this.root)
            .getPropertyValue(Notify.ANIM_DURATION_VAR)
            .trim();

        if (raw.endsWith('ms')) {
            return parseFloat(raw) || Notify.FALLBACK_ANIM_DURATION;
        }
        if (raw.endsWith('s')) {
            return (parseFloat(raw) || 0) * 1000 || Notify.FALLBACK_ANIM_DURATION;
        }
        return Notify.FALLBACK_ANIM_DURATION;
    }

    resolveAutoHideDelay(delay, data) {
        if (Number.isFinite(delay)) {
            return delay;
        }

        if (data && typeof data === 'object') {
            for (const field of Notify.DELAY_FIELDS) {
                if (Number.isFinite(data[field])) {
                    return data[field];
                }
            }
            if (Number.isFinite(data[Notify.DURATION_FIELD])) {
                return data[Notify.DURATION_FIELD] * 1000;
            }
        }

        return this.autoHideDelay;
    }

    setAutoHideDelay(delay) {
        this.autoHideDelay = Number.isFinite(delay) ? delay : Notify.DEFAULT_AUTO_HIDE_DELAY;
        return this.autoHideDelay;
    }

    createItem(data, autoHide) {
        const accent = data.accentColor || Notify.DEFAULT_ACCENT;

        const item = document.createElement('div');
        item.className = Notify.ITEM_CLASS;
        if (data.gradientStart && data.gradientEnd) {
            item.style.backgroundImage = `linear-gradient(135deg, ${data.gradientStart}, ${data.gradientEnd})`;
        }

        const background = document.createElement('div');
        background.className = 'nfy-item__bg';

        const header = document.createElement('div');
        header.className = 'nfy-item__header';
        header.style.color = accent;

        const icon = document.createElement('i');
        icon.className = 'nfy-item__icon';
        icon.textContent = data.icon || Notify.DEFAULT_ICON;

        const title = document.createElement('span');
        title.className = 'nfy-item__title';
        title.textContent = data.title || '';

        header.append(icon, title);

        const text = document.createElement('div');
        text.className = 'nfy-item__text';
        text.style.color = accent;
        text.textContent = data.text || '';

        const progress = document.createElement('div');
        progress.className = 'nfy-progress';

        const fill = document.createElement('div');
        fill.className = 'nfy-progress__fill';
        fill.style.background = accent;
        fill.style.width = '100%';
        progress.appendChild(fill);

        item.append(background, header, text);
        if (autoHide > 0) {
            item.appendChild(progress);
        }

        return { item, fill };
    }

    show(data = {}, delay = undefined) {
        if (!this.stack) {
            return null;
        }

        const autoHide = this.resolveAutoHideDelay(delay, data);
        const { item, fill } = this.createItem(data, autoHide);
        const entry = { item, hideTimer: null, removeTimer: null };

        this.stack.appendChild(item);
        this.items.add(entry);
        this.trim();

        void item.offsetWidth;
        item.classList.add(Notify.VISIBLE_CLASS);

        if (autoHide > 0) {
            fill.style.transition = `width ${autoHide}ms linear`;
            fill.style.width = '0%';
            entry.hideTimer = setTimeout(() => this.hide(entry), autoHide);
        }

        return entry;
    }

    hide(entry) {
        if (!entry || !this.items.has(entry)) {
            return;
        }

        clearTimeout(entry.hideTimer);
        entry.hideTimer = null;

        entry.item.classList.remove(Notify.VISIBLE_CLASS);

        entry.removeTimer = setTimeout(() => {
            entry.removeTimer = null;
            entry.item.remove();
            this.items.delete(entry);
        }, this.getAnimationDuration());
    }

    hideAll() {
        [...this.items].forEach((entry) => this.hide(entry));
    }

    trim() {
        const overflow = this.items.size - this.maxItems;
        if (overflow <= 0) {
            return;
        }

        [...this.items].slice(0, overflow).forEach((entry) => this.hide(entry));
    }

    count() {
        return this.items.size;
    }

    isVisible() {
        return this.items.size > 0;
    }

    destroy() {
        this.items.forEach((entry) => {
            clearTimeout(entry.hideTimer);
            clearTimeout(entry.removeTimer);
            entry.item.remove();
        });
        this.items.clear();

        if (this.cef && typeof this.cef.off === 'function') {
            this.handlers.forEach((handler, event) => this.cef.off(event, handler));
        }
        this.handlers.clear();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.notify = new Notify(window.cef);
});