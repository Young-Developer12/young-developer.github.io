class BizInfoWidget {
    static ROOT_SELECTOR = '.bizw-root';
    static VISIBLE_CLASS = 'bizw-root--visible';

    static FALLBACK_ANIM_DURATION = 250;
    static ANIM_DURATION_VAR = '--bizw-anim-duration';

    static DEFAULT_AUTO_HIDE_DELAY = 0;
    static DELAY_FIELDS = ['autoHideDelay', 'hideDelay', 'delay'];

    static STATUS_OPEN = 'ОТКРЫТО';
    static STATUS_CLOSED = 'ЗАКРЫТО';
    static STATUS_OPEN_CLASS = 'bizw-status__text--open';
    static STATUS_CLOSED_CLASS = 'bizw-status__text--closed';

    static CURRENCY = '₽';
    static ACCENT_CLASS = 'bizw-accent';
    static STRONG_CLASS = 'bizw-stat__value--strong';

    static TYPE_HOUSE = 'Жилой Дом';
    static ROOF_YES = 'Есть';
    static ROOF_NO = 'Отсутствует';

    static HOUSE_CLASSES = {
        1: { text: 'Низкий', modifier: 'bizw-stat__value--low' },
        2: { text: 'Средний', modifier: 'bizw-stat__value--medium' },
        3: { text: 'Высокий', modifier: 'bizw-stat__value--high' },
    };

    static BIZ_LABELS = ['Номер', 'Владелец', 'Цена', 'Крыша'];
    static HOUSE_LABELS = ['Владелец', 'Цена', 'Оплата в час', 'Класс'];

    static EVENTS = {
        biz: 'game:ShowBizInfo',
        house: 'game:ShowHouseInfo',
        hide: 'game:HideBizInfo',
    };

    constructor(cef = null, options = {}) {
        this.cef = cef || (typeof window !== 'undefined' ? window.cef : null) || null;

        this.root = options.root || document.querySelector(BizInfoWidget.ROOT_SELECTOR);
        if (!this.root) {
            return;
        }

        this.autoHideDelay = Number.isFinite(options.autoHideDelay)
            ? options.autoHideDelay
            : BizInfoWidget.DEFAULT_AUTO_HIDE_DELAY;

        this.hideTimer = null;
        this.resetTimer = null;
        this.visible = false;
        this.handlers = new Map();

        this.cacheElements();
        this.bindEvents();
        this.clear();
    }

    cacheElements() {
        this.els = {
            type: this.root.querySelector('.bizw-header__type'),
            name: this.root.querySelector('.bizw-header__name'),
            status: this.root.querySelector('.bizw-status__text'),
            stats: [...this.root.querySelectorAll('.bizw-stat')].map((stat) => ({
                value: stat.querySelector('.bizw-stat__value'),
                label: stat.querySelector('.bizw-stat__label'),
            })),
        };
    }

    bindEvents() {
        if (!this.cef || typeof this.cef.on !== 'function') {
            return;
        }

        this.on(BizInfoWidget.EVENTS.biz, (type, closed, name, number, owner, price, roof) => {
            this.showBusiness({ type, closed, name, number, owner, price, roof });
        });

        this.on(BizInfoWidget.EVENTS.house, (id, locked, owner, price, pay, houseClass) => {
            this.showHouse({ id, locked, owner, price, pay, houseClass });
        });

        this.on(BizInfoWidget.EVENTS.hide, () => this.hide());
    }

    on(event, handler) {
        this.handlers.set(event, handler);
        this.cef.on(event, handler);
    }

    getAnimationDuration() {
        const raw = getComputedStyle(this.root)
            .getPropertyValue(BizInfoWidget.ANIM_DURATION_VAR)
            .trim();

        if (raw.endsWith('ms')) {
            return parseFloat(raw) || BizInfoWidget.FALLBACK_ANIM_DURATION;
        }
        if (raw.endsWith('s')) {
            return (parseFloat(raw) || 0) * 1000 || BizInfoWidget.FALLBACK_ANIM_DURATION;
        }
        return BizInfoWidget.FALLBACK_ANIM_DURATION;
    }

    resolveAutoHideDelay(delay, data) {
        if (Number.isFinite(delay)) {
            return delay;
        }

        if (data && typeof data === 'object') {
            for (const field of BizInfoWidget.DELAY_FIELDS) {
                if (Number.isFinite(data[field])) {
                    return data[field];
                }
            }
        }

        return this.autoHideDelay;
    }

    setAutoHideDelay(delay) {
        this.autoHideDelay = Number.isFinite(delay) ? delay : BizInfoWidget.DEFAULT_AUTO_HIDE_DELAY;
        return this.autoHideDelay;
    }

    clearTimers() {
        clearTimeout(this.hideTimer);
        clearTimeout(this.resetTimer);
        this.hideTimer = null;
        this.resetTimer = null;
    }

    setText(element, text) {
        if (element) {
            element.textContent = text === undefined || text === null ? '' : String(text);
        }
    }

    setMoney(element, amount) {
        if (!element) {
            return;
        }

        element.textContent = `${amount === undefined || amount === null ? '' : amount} `;

        const currency = document.createElement('span');
        currency.className = BizInfoWidget.ACCENT_CLASS;
        currency.textContent = BizInfoWidget.CURRENCY;
        element.appendChild(currency);
    }

    fillStat(index, label, fill, modifier = null) {
        const stat = this.els.stats[index];
        if (!stat) {
            return;
        }

        stat.value.className = 'bizw-stat__value';
        if (modifier) {
            stat.value.classList.add(modifier);
        }

        fill(stat.value);
        this.setText(stat.label, label);
    }

    setStatus(closed) {
        if (!this.els.status) {
            return;
        }

        this.els.status.textContent = closed ? BizInfoWidget.STATUS_CLOSED : BizInfoWidget.STATUS_OPEN;
        this.els.status.className = 'bizw-status__text '
            + (closed ? BizInfoWidget.STATUS_CLOSED_CLASS : BizInfoWidget.STATUS_OPEN_CLASS);
    }

    renderBusiness(data) {
        const labels = BizInfoWidget.BIZ_LABELS;

        this.setText(this.els.type, data.type);
        this.setText(this.els.name, data.name);
        this.setStatus(data.closed);

        this.fillStat(0, labels[0], (el) => this.setText(el, data.number));
        this.fillStat(1, labels[1], (el) => this.setText(el, data.owner), BizInfoWidget.STRONG_CLASS);
        this.fillStat(2, labels[2], (el) => this.setMoney(el, data.price));
        this.fillStat(
            3,
            labels[3],
            (el) => this.setText(el, data.roof ? BizInfoWidget.ROOF_YES : BizInfoWidget.ROOF_NO),
            BizInfoWidget.STRONG_CLASS,
        );
    }

    renderHouse(data) {
        const labels = BizInfoWidget.HOUSE_LABELS;
        const houseClass = BizInfoWidget.HOUSE_CLASSES[data.houseClass]
            || BizInfoWidget.HOUSE_CLASSES[3];

        this.setText(this.els.type, BizInfoWidget.TYPE_HOUSE);
        this.setText(this.els.name, `№${data.id}`);
        this.setStatus(data.locked);

        this.fillStat(0, labels[0], (el) => this.setText(el, data.owner));
        this.fillStat(1, labels[1], (el) => this.setMoney(el, data.price));
        this.fillStat(2, labels[2], (el) => this.setMoney(el, data.pay));
        this.fillStat(3, labels[3], (el) => this.setText(el, houseClass.text), houseClass.modifier);
    }

    showBusiness(data, delay = undefined) {
        this.renderBusiness(data || {});
        this.open(this.resolveAutoHideDelay(delay, data));
    }

    showHouse(data, delay = undefined) {
        this.renderHouse(data || {});
        this.open(this.resolveAutoHideDelay(delay, data));
    }

    show(data = null, delay = undefined) {
        if (data && data.mode === 'house') {
            this.showHouse(data, delay);
            return;
        }
        if (data) {
            this.showBusiness(data, delay);
            return;
        }
        this.open(this.resolveAutoHideDelay(delay, null));
    }

    open(autoHide) {
        this.clearTimers();

        this.root.classList.add(BizInfoWidget.VISIBLE_CLASS);
        this.visible = true;

        if (autoHide > 0) {
            this.hideTimer = setTimeout(() => this.hide(), autoHide);
        }
    }

    hide() {
        this.clearTimers();
        this.root.classList.remove(BizInfoWidget.VISIBLE_CLASS);
        this.visible = false;

        this.resetTimer = setTimeout(() => {
            this.resetTimer = null;
            this.clear();
        }, this.getAnimationDuration());
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
        return this.visible;
    }

    clear() {
        this.setText(this.els.type, '');
        this.setText(this.els.name, '');
        this.setText(this.els.status, '');
        if (this.els.status) {
            this.els.status.className = 'bizw-status__text';
        }

        this.els.stats.forEach((stat, index) => {
            this.fillStat(index, '', (el) => this.setText(el, ''));
        });
    }

    destroy() {
        this.clearTimers();

        if (this.cef && typeof this.cef.off === 'function') {
            this.handlers.forEach((handler, event) => this.cef.off(event, handler));
        }
        this.handlers.clear();

        this.root.classList.remove(BizInfoWidget.VISIBLE_CLASS);
        this.visible = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.bizInfo = new BizInfoWidget(window.cef);
});