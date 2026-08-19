class Hud {
    static ROOT_SELECTOR = '.nhud-root';
    static VISIBLE_CLASS = 'nhud-root--visible';
    static COMPACT_CLASS = 'nhud-root--compact';
    static WEAPON_HIDDEN_CLASS = 'nhud-weapon--hidden';

    static STATE_FULL = 0;
    static STATE_COMPACT = 1;
    static STATE_HIDDEN = 2;
    static STATES_COUNT = 3;

    static STORAGE_KEY = 'hudState';
    static TOGGLE_KEY = 'F7';
    static PEEK_KEY = 'F1';

    static FALLBACK_ANIM_DURATION = 250;
    static ANIM_DURATION_VAR = '--nhud-anim-duration';

    static DEFAULT_AUTO_HIDE_DELAY = 0;
    static DELAY_FIELDS = ['autoHideDelay', 'hideDelay', 'delay'];
    
    static DEFAULT_RESET_ON_HIDE = false;

    static CLOCK_INTERVAL = 1000;
    static CLOCK_LOCALE = 'ru-RU';
    static CLOCK_TIMEZONE = 'Europe/Moscow';

    static POLL_INTERVAL = 50;
    static BAR_MAX_WIDTH_VW = 7;
    static MAX_HEALTH = 100;
    static WEAPON_ICON_PATH = 'images/guns/';
    static MONEY_SUFFIX = ' ₽';
    static MONEY_SEPARATOR = '.';

    static DEFAULT_DATA = {
        playerName: '',
        playerId: 0,
        money: 0,
        health: 0,
        armor: 0,
        weapon: 0,
        ammo: 0,
        maxAmmo: 0,
        city: 't.me/naziksquad',
        street: 't.me/undefineddevvvvv',
    };

    static EVENTS = {
        stats: 'game:data:playerStats',
        location: 'game:hud:location',
        update: 'game:hud:update',
        active: 'game:hud:active',
        poll: 'game:data:pollPlayerStats',
        component: 'game:hud:setComponentVisible',
    };

    constructor(cef = null, options = {}) {
        this.cef = cef || (typeof window !== 'undefined' ? window.cef : null) || null;

        this.root = options.root || document.querySelector(Hud.ROOT_SELECTOR);
        if (!this.root) {
            return;
        }

        this.data = { ...Hud.DEFAULT_DATA };
        this.hasWeapon = false;

        this.autoHideDelay = Number.isFinite(options.autoHideDelay)
            ? options.autoHideDelay
            : Hud.DEFAULT_AUTO_HIDE_DELAY;
        this.resetOnHide = typeof options.resetOnHide === 'boolean'
            ? options.resetOnHide
            : Hud.DEFAULT_RESET_ON_HIDE;

        this.hideTimer = null;
        this.resetTimer = null;
        this.clockTimer = null;
        this.handlers = new Map();

        this.visibleState = this.readSavedState();
        
        this.state = Hud.STATE_HIDDEN;
        this.stateBeforePeek = this.visibleState;

        this.cacheElements();
        this.bindKeyboard();
        this.bindGameEvents();
        this.startClock();

        this.applyState();
        this.render();
    }

    cacheElements() {
        const $ = (selector) => this.root.querySelector(selector);

        this.els = {
            nick: $('.nhud-nick__text'),
            time: $('.nhud-time__text'),
            id: $('.nhud-id__text'),
            money: $('.nhud-money__text'),
            healthValue: $('.nhud-health .nhud-bar__value'),
            armorValue: $('.nhud-armor .nhud-bar__value'),
            healthFill: $('.nhud-health__fill'),
            armorFill: $('.nhud-armor__fill'),
            weapon: $('.nhud-weapon'),
            weaponImg: $('.nhud-weapon__img'),
            ammoCurrent: $('.nhud-ammo__current'),
            ammoMax: $('.nhud-ammo__max'),
            city: $('.nhud-location__city'),
            street: $('.nhud-location__street'),
        };
    }

    bindKeyboard() {
        this.onKeyDown = (event) => {
            if (event.key === Hud.TOGGLE_KEY) {
                this.cycleState();
            }
            if (event.key === Hud.PEEK_KEY && this.state !== Hud.STATE_HIDDEN) {
                this.stateBeforePeek = this.state;
                this.setState(Hud.STATE_HIDDEN);
            }
        };

        this.onKeyUp = (event) => {
            if (event.key === Hud.PEEK_KEY) {
                this.setState(this.stateBeforePeek);
            }
        };

        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
    }

    bindGameEvents() {
        if (!this.cef) {
            return;
        }

        if (typeof this.cef.emit === 'function') {
            this.cef.emit(Hud.EVENTS.component, 'interface', false);
            this.cef.emit(Hud.EVENTS.poll, true, Hud.POLL_INTERVAL);
        }

        if (typeof this.cef.on !== 'function') {
            return;
        }

        this.on(Hud.EVENTS.stats, (hp, maxHp, arm, breath, wanted, weapon, ammo, maxAmmo, money, speed) => {
            this.update({
                health: hp,
                armor: arm,
                weapon: weapon,
                ammo: ammo,
                maxAmmo: maxAmmo,
            });
            this.pushSpeed(speed);
        });

        this.on(Hud.EVENTS.location, (city, street) => {
            this.update({ city, street });
        });

        this.on(Hud.EVENTS.update, (money, playerName, playerId) => {
            this.update({ money, playerName, playerId });
        });

        this.on(Hud.EVENTS.active, (active) => {
            this.toggle(active);
        });
    }

    on(event, handler) {
        this.handlers.set(event, handler);
        this.cef.on(event, handler);
    }

    startClock() {
        this.renderClock();
        this.clockTimer = setInterval(() => this.renderClock(), Hud.CLOCK_INTERVAL);
    }

    pushSpeed(speed) {
        const speedometer = typeof window !== 'undefined' ? window.speedometer : null;
        if (speedometer && typeof speedometer.setSpeed === 'function') {
            speedometer.setSpeed(speed);
        }
    }

    readSavedState() {
        try {
            const saved = parseInt(localStorage.getItem(Hud.STORAGE_KEY), 10);
            if (saved === Hud.STATE_FULL || saved === Hud.STATE_COMPACT) {
                return saved;
            }
        } catch (error) {
        }
        return Hud.STATE_FULL;
    }

    saveState(state) {
        try {
            localStorage.setItem(Hud.STORAGE_KEY, String(state));
        } catch (error) {
        }
    }

    getAnimationDuration() {
        const raw = getComputedStyle(this.root)
            .getPropertyValue(Hud.ANIM_DURATION_VAR)
            .trim();

        if (raw.endsWith('ms')) {
            return parseFloat(raw) || Hud.FALLBACK_ANIM_DURATION;
        }
        if (raw.endsWith('s')) {
            return (parseFloat(raw) || 0) * 1000 || Hud.FALLBACK_ANIM_DURATION;
        }
        return Hud.FALLBACK_ANIM_DURATION;
    }

    resolveAutoHideDelay(delay, data) {
        if (Number.isFinite(delay)) {
            return delay;
        }

        if (data && typeof data === 'object') {
            for (const field of Hud.DELAY_FIELDS) {
                if (Number.isFinite(data[field])) {
                    return data[field];
                }
            }
        }

        return this.autoHideDelay;
    }

    setAutoHideDelay(delay) {
        this.autoHideDelay = Number.isFinite(delay) ? delay : Hud.DEFAULT_AUTO_HIDE_DELAY;
        return this.autoHideDelay;
    }

    scheduleAutoHide(delay, data) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;

        const autoHide = this.resolveAutoHideDelay(delay, data);
        if (autoHide > 0) {
            this.hideTimer = setTimeout(() => this.hide(), autoHide);
        }
    }

    clearTimers() {
        clearTimeout(this.hideTimer);
        clearTimeout(this.resetTimer);
        this.hideTimer = null;
        this.resetTimer = null;
    }

    formatMoney(value) {
        const digits = String(Math.round(Number(value) || 0));
        return digits.replace(/\B(?=(\d{3})+(?!\d))/g, Hud.MONEY_SEPARATOR) + Hud.MONEY_SUFFIX;
    }

    setState(state, delay = undefined) {
        const next = Number.isFinite(state) ? state : Hud.STATE_HIDDEN;
        this.state = next;

        if (next !== Hud.STATE_HIDDEN) {
            this.visibleState = next;
            this.saveState(next);
            
            this.clearTimers();
            this.applyState();
            this.render();
            this.scheduleAutoHide(delay, null);
            return;
        }

        this.clearTimers();
        this.applyState();

        if (this.resetOnHide) {
            this.resetTimer = setTimeout(() => {
                this.resetTimer = null;
                this.resetData();
            }, this.getAnimationDuration());
        }
    }

    applyState() {
        const visible = this.state !== Hud.STATE_HIDDEN;
        this.root.classList.toggle(Hud.VISIBLE_CLASS, visible);
        this.root.classList.toggle(Hud.COMPACT_CLASS, this.state === Hud.STATE_COMPACT);
    }

    cycleState() {
        this.setState((this.state + 1) % Hud.STATES_COUNT);
    }

    show(data = null, delay = undefined) {
        if (data && typeof data === 'object') {
            this.setData(data);
        }
        this.setState(this.visibleState, this.resolveAutoHideDelay(delay, data));
    }

    hide() {
        this.setState(Hud.STATE_HIDDEN);
    }

    toggle(flag, delay = undefined) {
        if (flag && typeof flag === 'object') {
            this.show(flag, delay);
            return;
        }

        const enabled = flag === true || flag === 1 || flag === '1';
        if (enabled) {
            this.show(null, delay);
        } else {
            this.hide();
        }
    }

    isVisible() {
        return this.state !== Hud.STATE_HIDDEN;
    }

    getState() {
        return this.state;
    }

    setData(data) {
        if (!data || typeof data !== 'object') {
            return;
        }

        for (const key of Object.keys(Hud.DEFAULT_DATA)) {
            if (data[key] !== undefined) {
                this.data[key] = data[key];
            }
        }

        this.hasWeapon = Number(this.data.weapon) > 0;
    }

    update(data, delay = undefined) {
        this.setData(data);

        if (!this.isVisible()) {
            return;
        }

        this.render();

        if (Number.isFinite(delay) || this.hasDelayField(data)) {
            this.scheduleAutoHide(delay, data);
        }
    }

    hasDelayField(data) {
        return Boolean(data) && typeof data === 'object'
            && Hud.DELAY_FIELDS.some((field) => Number.isFinite(data[field]));
    }

    resetData() {
        this.data = { ...Hud.DEFAULT_DATA };
        this.hasWeapon = false;
        this.render();
    }

    renderClock() {
        if (!this.els.time) {
            return;
        }

        this.els.time.textContent = new Date().toLocaleTimeString(Hud.CLOCK_LOCALE, {
            hour12: false,
            timeZone: Hud.CLOCK_TIMEZONE,
        });
    }

    renderStats() {
        const health = Math.max(0, Math.min(Number(this.data.health) || 0, Hud.MAX_HEALTH));
        const armor = Math.max(0, Math.min(Number(this.data.armor) || 0, Hud.MAX_HEALTH));

        if (this.els.healthValue) {
            this.els.healthValue.textContent = Math.round(health);
        }
        if (this.els.armorValue) {
            this.els.armorValue.textContent = Math.round(armor);
        }
        if (this.els.healthFill) {
            this.els.healthFill.style.width = `${(health / Hud.MAX_HEALTH) * Hud.BAR_MAX_WIDTH_VW}vw`;
        }
        if (this.els.armorFill) {
            this.els.armorFill.style.width = `${(armor / Hud.MAX_HEALTH) * Hud.BAR_MAX_WIDTH_VW}vw`;
        }
    }

    renderWeapon() {
        if (this.els.weapon) {
            this.els.weapon.classList.toggle(Hud.WEAPON_HIDDEN_CLASS, !this.hasWeapon);
        }

        if (!this.hasWeapon) {
            return;
        }

        const iconSrc = `${Hud.WEAPON_ICON_PATH}${this.data.weapon}.png`;
        if (this.els.weaponImg && !this.els.weaponImg.src.endsWith(iconSrc)) {
            this.els.weaponImg.src = iconSrc;
        }
        if (this.els.ammoCurrent) {
            this.els.ammoCurrent.textContent = this.data.ammo;
        }
        if (this.els.ammoMax) {
            this.els.ammoMax.textContent = `/${this.data.maxAmmo}`;
        }
    }

    renderInfo() {
        if (this.els.money) {
            this.els.money.textContent = this.formatMoney(this.data.money);
        }
        if (this.els.nick) {
            this.els.nick.textContent = this.data.playerName;
        }
        if (this.els.id) {
            this.els.id.textContent = `ID: ${this.data.playerId}`;
        }
        if (this.els.city) {
            this.els.city.textContent = this.data.city;
        }
        if (this.els.street) {
            this.els.street.textContent = this.data.street;
        }
    }

    render() {
        this.renderStats();
        this.renderWeapon();
        this.renderInfo();
    }

    destroy() {
        this.clearTimers();
        clearInterval(this.clockTimer);
        this.clockTimer = null;

        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);

        if (this.cef && typeof this.cef.off === 'function') {
            this.handlers.forEach((handler, event) => this.cef.off(event, handler));
        }
        this.handlers.clear();

        if (this.root) {
            this.root.classList.remove(Hud.VISIBLE_CLASS, Hud.COMPACT_CLASS);
        }
        this.state = Hud.STATE_HIDDEN;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.hud = new Hud(window.cef);
});