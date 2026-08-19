class Speedometer {
    static ROOT_SELECTOR = '.spdm-root';
    static VISIBLE_CLASS = 'spdm-root--visible';

    static FALLBACK_ANIM_DURATION = 250;
    static ANIM_DURATION_VAR = '--spdm-anim-duration';

    static DEFAULT_AUTO_HIDE_DELAY = 0;
    
    static DELAY_FIELDS = ['autoHideDelay', 'hideDelay', 'delay'];

    static DEFAULT_STATE = {
        speed: 0,
        maxSpeed: 300,
        fuelValue: 100,
        fuelCapacity: 100,
        strength: 1000,
        mileage: 0,
    };

    static ARROW_MAX_ANGLE = 158;
    static INDICATORS_COUNT = 24;
    static MILEAGE_DIGITS = 6;

    static STRENGTH_MIN = 333;
    static STRENGTH_MAX = 1000;

    static FUEL_ARC_ANGLE = 48;
    static STRENGTH_ARC_ANGLE = 32;
    static BAR_STROKE_WIDTH = 5;
    static BAR_TRACK_COLOR = 'rgba(255, 255, 255, 0.3)';
    static FUEL_COLOR = '#F3BE00';
    static STRENGTH_COLOR = '#FFFFFF';

    static COLOR_ON = '#69da67';
    static COLOR_OFF = '#ffffff80';

    static EVENTS = {
        toggle: 'game:ToggleSpeedometer',
        fuel: 'game:SetSpeedFuel',
        strength: 'game:SetSpeedHealth',
        mileage: 'game:SetSpeedMileage',
        engine: 'game:SetSpeedEngine',
        doors: 'game:SetSpeedDoors',
        lights: 'game:SetSpeedLights',
    };

    constructor(cef = null, options = {}) {
        this.cef = cef || (typeof window !== 'undefined' ? window.cef : null) || null;

        this.root = options.root || document.querySelector(Speedometer.ROOT_SELECTOR);
        if (!this.root) {
            return;
        }

        this.state = { ...Speedometer.DEFAULT_STATE };
        this.autoHideDelay = Number.isFinite(options.autoHideDelay)
            ? options.autoHideDelay
            : Speedometer.DEFAULT_AUTO_HIDE_DELAY;

        this.hideTimer = null;
        this.resetTimer = null;
        this.visible = false;
        this.handlers = new Map();

        this.cacheElements();
        this.bindEvents();
        this.render();
    }

    cacheElements() {
        const $ = (selector) => this.root.querySelector(selector);

        this.els = {
            speed: $('.spdm-speed'),
            mileage: $('.spdm-mileage'),
            arrow: $('.spdm-arrow__anchor'),
            indicators: this.root.querySelectorAll('.spdm-scale__indicators .spdm-indicator'),
            fuelBar: $('.spdm-fuel__bar'),
            strengthBar: $('.spdm-strength__bar'),
            engine: $('.spdm-engine__icon'),
            doors: $('.spdm-doors__icon'),
            headlights: $('.spdm-headlights__icon'),
        };
    }

    bindEvents() {
        if (!this.cef || typeof this.cef.on !== 'function') {
            return;
        }

        const events = Speedometer.EVENTS;

        this.on(events.toggle, (value) => this.toggle(value));
        this.on(events.fuel, (value) => this.update({ fuelValue: value }));
        this.on(events.strength, (value) => this.update({ strength: value }));
        this.on(events.mileage, (value) => this.update({ mileage: value }));
        this.on(events.engine, (value) => this.setEngine(value));
        this.on(events.doors, (value) => this.setDoors(value));
        this.on(events.lights, (value) => this.setLights(value));
    }

    on(event, handler) {
        this.handlers.set(event, handler);
        this.cef.on(event, handler);
    }


    map(value, inMin, inMax, outMin, outMax) {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(Number(value) || 0, max));
    }

    getAnimationDuration() {
        const raw = getComputedStyle(this.root)
            .getPropertyValue(Speedometer.ANIM_DURATION_VAR)
            .trim();

        if (raw.endsWith('ms')) {
            return parseFloat(raw) || Speedometer.FALLBACK_ANIM_DURATION;
        }
        if (raw.endsWith('s')) {
            return (parseFloat(raw) || 0) * 1000 || Speedometer.FALLBACK_ANIM_DURATION;
        }
        return Speedometer.FALLBACK_ANIM_DURATION;
    }

    resolveAutoHideDelay(delay, data) {
        if (Number.isFinite(delay)) {
            return delay;
        }

        if (data && typeof data === 'object') {
            for (const field of Speedometer.DELAY_FIELDS) {
                if (Number.isFinite(data[field])) {
                    return data[field];
                }
            }
        }

        return this.autoHideDelay;
    }

    setAutoHideDelay(delay) {
        this.autoHideDelay = Number.isFinite(delay) ? delay : Speedometer.DEFAULT_AUTO_HIDE_DELAY;
        return this.autoHideDelay;
    }

    clearTimers() {
        clearTimeout(this.hideTimer);
        clearTimeout(this.resetTimer);
        this.hideTimer = null;
        this.resetTimer = null;
    }

    show(data = null, delay = undefined) {
        if (!this.root) {
            return;
        }

        this.clearTimers();

        if (data && typeof data === 'object') {
            this.setState(data);
        }

        this.root.classList.add(Speedometer.VISIBLE_CLASS);
        this.visible = true;

        const autoHide = this.resolveAutoHideDelay(delay, data);
        if (autoHide > 0) {
            this.hideTimer = setTimeout(() => this.hide(), autoHide);
        }
    }

    hide() {
        if (!this.root) {
            return;
        }

        this.clearTimers();
        this.root.classList.remove(Speedometer.VISIBLE_CLASS);
        this.visible = false;

        this.resetTimer = setTimeout(() => {
            this.resetTimer = null;
            this.resetState();
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

    setState(data) {
        if (!data || typeof data !== 'object') {
            return;
        }

        const next = { ...this.state };

        if (Number.isFinite(data.maxSpeed) && data.maxSpeed > 0) {
            next.maxSpeed = data.maxSpeed;
        }
        if (Number.isFinite(data.fuelCapacity) && data.fuelCapacity > 0) {
            next.fuelCapacity = data.fuelCapacity;
        }
        if (data.speed !== undefined) {
            next.speed = this.clamp(data.speed, 0, next.maxSpeed);
        }
        if (data.fuelValue !== undefined) {
            next.fuelValue = this.clamp(data.fuelValue, 0, next.fuelCapacity);
        }
        if (data.strength !== undefined) {
            next.strength = this.clamp(data.strength, Speedometer.STRENGTH_MIN, Speedometer.STRENGTH_MAX);
        }
        if (data.mileage !== undefined) {
            next.mileage = Math.max(0, Number(data.mileage) || 0);
        }

        this.state = next;
        this.render();
    }

    update(data, delay = undefined) {
        this.setState(data);

        if (!this.visible) {
            return;
        }

        const autoHide = this.resolveAutoHideDelay(delay, data);
        clearTimeout(this.hideTimer);
        this.hideTimer = autoHide > 0 ? setTimeout(() => this.hide(), autoHide) : null;
    }

    resetState() {
        this.state = { ...Speedometer.DEFAULT_STATE };
        this.setEngine(false);
        this.setDoors(false);
        this.setLights(false);
        this.render();
    }

    setSpeed(value) {
        this.update({ speed: value });
    }

    setFuel(value, capacity = undefined) {
        this.update({ fuelValue: value, fuelCapacity: capacity });
    }

    setStrength(value) {
        this.update({ strength: value });
    }

    setMileage(value) {
        this.update({ mileage: value });
    }

    setEngine(enabled) {
        this.paintIndicator(this.els.engine, enabled);
    }

    setDoors(enabled) {
        this.paintIndicator(this.els.doors, enabled);
    }

    setLights(enabled) {
        this.paintIndicator(this.els.headlights, enabled);
    }

    paintIndicator(element, enabled) {
        if (!element) {
            return;
        }
        element.style.background = enabled ? Speedometer.COLOR_ON : Speedometer.COLOR_OFF;
    }

    drawCircleProgressBar(canvas, progress, angle, strokeWidth, strokeColor, progressColor, clockwise = false) {
        if (!canvas || typeof canvas.getContext !== 'function') {
            return;
        }

        const ctx = canvas.getContext('2d');
        const size = canvas.width;
        const center = size / 2;
        const radius = (size - strokeWidth) / 2;
        const startAngle = Math.PI * 1.5;
        const maxAngle = (Math.PI * 2 * angle) / 360;
        const progressAngle = (maxAngle * progress) / 100;

        ctx.clearRect(0, 0, size, size);

        ctx.beginPath();
        ctx.arc(center, center, radius, startAngle, startAngle + maxAngle, clockwise);
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(center, center, radius, startAngle, startAngle + progressAngle, clockwise);
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = progressColor;
        ctx.stroke();
    }

    renderSpeed() {
        if (this.els.speed) {
            this.els.speed.textContent = Math.round(this.state.speed);
        }

        if (this.els.arrow) {
            const rotation = this.map(this.state.speed, 0, this.state.maxSpeed, 0, Speedometer.ARROW_MAX_ANGLE);
            this.els.arrow.style.transform = `rotate(${rotation}deg)`;
        }

        const step = this.state.maxSpeed / Speedometer.INDICATORS_COUNT;
        const fullIndicators = Math.floor(this.state.speed / step) - 1;
        const partialIndicator = (this.state.speed % step) / step;

        this.els.indicators.forEach((indicator, index) => {
            if (index <= fullIndicators) {
                indicator.style.opacity = 1;
            } else if (index === fullIndicators + 1) {
                indicator.style.opacity = partialIndicator;
            } else {
                indicator.style.opacity = 0;
            }
        });
    }

    renderMileage() {
        if (!this.els.mileage) {
            return;
        }
        this.els.mileage.textContent = String(Math.round(this.state.mileage))
            .padStart(Speedometer.MILEAGE_DIGITS, '0');
    }

    renderBars() {
        const fuelProgress = (this.state.fuelValue / this.state.fuelCapacity) * 100;
        this.drawCircleProgressBar(
            this.els.fuelBar,
            fuelProgress,
            Speedometer.FUEL_ARC_ANGLE,
            Speedometer.BAR_STROKE_WIDTH,
            Speedometer.BAR_TRACK_COLOR,
            Speedometer.FUEL_COLOR,
            false,
        );

        const strengthProgress = this.map(
            this.state.strength,
            Speedometer.STRENGTH_MIN,
            Speedometer.STRENGTH_MAX,
            0,
            100,
        );
        this.drawCircleProgressBar(
            this.els.strengthBar,
            strengthProgress,
            Speedometer.STRENGTH_ARC_ANGLE,
            Speedometer.BAR_STROKE_WIDTH,
            Speedometer.BAR_TRACK_COLOR,
            Speedometer.STRENGTH_COLOR,
            false,
        );
    }

    render() {
        this.renderSpeed();
        this.renderMileage();
        this.renderBars();
    }

    destroy() {
        this.clearTimers();

        if (this.cef && typeof this.cef.off === 'function') {
            this.handlers.forEach((handler, event) => this.cef.off(event, handler));
        }
        this.handlers.clear();

        if (this.root) {
            this.root.classList.remove(Speedometer.VISIBLE_CLASS);
        }
        this.visible = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.speedometer = new Speedometer(window.cef);
});