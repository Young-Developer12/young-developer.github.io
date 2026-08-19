class KeyHint {
    static ROOT_SELECTOR = '.keyhint-root';
    static FRAME_SELECTOR = '.keyhint-frame';
    static VISIBLE_CLASS = 'keyhint-frame--visible';

    static FALLBACK_ANIM_DURATION = 400;
    static ANIM_DURATION_VAR = '--keyhint-anim-duration';

    static SHOW_DELAY = 250;
    
    static DEFAULT_AUTO_HIDE_DELAY = 5000;
    static DELAY_FIELDS = ['autoHideDelay', 'hideDelay', 'timeout', 'delay'];

    static DEFAULT_TEXT = 'Используйте клавишу';

    static EVENTS = {
        show: 'game:ShowHint',
        hide: 'game:HideHint',
    };

    constructor(cef = null, options = {}) {
        this.cef = cef || (typeof window !== 'undefined' ? window.cef : null) || null;

        this.root = options.root || document.querySelector(KeyHint.ROOT_SELECTOR);
        if (!this.root) {
            return;
        }

        this.frame = this.root.querySelector(KeyHint.FRAME_SELECTOR);
        this.els = {
            text: this.root.querySelector('.keyhint-text'),
            key: this.root.querySelector('.keyhint-key__label'),
        };

        this.autoHideDelay = Number.isFinite(options.autoHideDelay)
            ? options.autoHideDelay
            : KeyHint.DEFAULT_AUTO_HIDE_DELAY;
        this.showDelay = Number.isFinite(options.showDelay) ? options.showDelay : KeyHint.SHOW_DELAY;

        this.showTimer = null;
        this.hideTimer = null;
        this.resetTimer = null;
        this.visible = false;
        this.handlers = new Map();

        this.bindEvents();
        this.clear();
    }

    bindEvents() {
        if (!this.cef || typeof this.cef.on !== 'function') {
            return;
        }

        this.on(KeyHint.EVENTS.show, (key, timeout) => this.show(key, timeout));
        this.on(KeyHint.EVENTS.hide, () => this.hide());
    }

    on(event, handler) {
        this.handlers.set(event, handler);
        this.cef.on(event, handler);
    }

    getAnimationDuration() {
        const raw = getComputedStyle(this.root)
            .getPropertyValue(KeyHint.ANIM_DURATION_VAR)
            .trim();

        if (raw.endsWith('ms')) {
            return parseFloat(raw) || KeyHint.FALLBACK_ANIM_DURATION;
        }
        if (raw.endsWith('s')) {
            return (parseFloat(raw) || 0) * 1000 || KeyHint.FALLBACK_ANIM_DURATION;
        }
        return KeyHint.FALLBACK_ANIM_DURATION;
    }

    resolveAutoHideDelay(delay, data) {
        if (Number.isFinite(delay)) {
            return delay;
        }

        if (data && typeof data === 'object') {
            for (const field of KeyHint.DELAY_FIELDS) {
                if (Number.isFinite(data[field])) {
                    return data[field];
                }
            }
        }

        return this.autoHideDelay;
    }

    setAutoHideDelay(delay) {
        this.autoHideDelay = Number.isFinite(delay) ? delay : KeyHint.DEFAULT_AUTO_HIDE_DELAY;
        return this.autoHideDelay;
    }

    clearTimers() {
        clearTimeout(this.showTimer);
        clearTimeout(this.hideTimer);
        clearTimeout(this.resetTimer);
        this.showTimer = null;
        this.hideTimer = null;
        this.resetTimer = null;
    }

    show(keyOrData, delay = undefined) {
        const data = keyOrData && typeof keyOrData === 'object'
            ? keyOrData
            : { key: keyOrData };

        this.clearTimers();
        this.setData(data);

        const autoHide = this.resolveAutoHideDelay(delay, data);

        this.showTimer = setTimeout(() => {
            this.showTimer = null;
            this.frame.classList.add(KeyHint.VISIBLE_CLASS);
            this.visible = true;

            if (autoHide > 0) {
                this.hideTimer = setTimeout(() => this.hide(), autoHide);
            }
        }, this.showDelay);
    }

    hide() {
        this.clearTimers();
        this.frame.classList.remove(KeyHint.VISIBLE_CLASS);
        this.visible = false;

        this.resetTimer = setTimeout(() => {
            this.resetTimer = null;
            this.clear();
        }, this.getAnimationDuration());
    }

    setData(data) {
        if (!data || typeof data !== 'object') {
            return;
        }

        if (this.els.key && data.key !== undefined) {
            this.els.key.textContent = data.key;
        }
        if (this.els.text) {
            this.els.text.textContent = data.text || KeyHint.DEFAULT_TEXT;
        }
    }

    update(data, delay = undefined) {
        this.setData(data);

        if (!this.visible) {
            return;
        }

        if (Number.isFinite(delay) || this.hasDelayField(data)) {
            clearTimeout(this.hideTimer);
            const autoHide = this.resolveAutoHideDelay(delay, data);
            this.hideTimer = autoHide > 0 ? setTimeout(() => this.hide(), autoHide) : null;
        }
    }

    hasDelayField(data) {
        return Boolean(data) && typeof data === 'object'
            && KeyHint.DELAY_FIELDS.some((field) => Number.isFinite(data[field]));
    }

    isVisible() {
        return this.visible;
    }

    clear() {
        if (this.els.key) {
            this.els.key.textContent = '';
        }
        if (this.els.text) {
            this.els.text.textContent = KeyHint.DEFAULT_TEXT;
        }
    }

    destroy() {
        this.clearTimers();

        if (this.cef && typeof this.cef.off === 'function') {
            this.handlers.forEach((handler, event) => this.cef.off(event, handler));
        }
        this.handlers.clear();

        this.frame.classList.remove(KeyHint.VISIBLE_CLASS);
        this.visible = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.keyHint = new KeyHint(window.cef);
});