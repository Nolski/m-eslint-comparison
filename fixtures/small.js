"use strict";

const DEFAULT_TIMEOUT = 5000;
let requestCount = 0;

function validateEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
}

function formatCurrency(amount, currency) {
    if (typeof amount !== "number") {
        throw new TypeError("Amount must be a number");
    }
    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
    });
    return formatter.format(amount);
}

class EventEmitter {
    constructor() {
        this._listeners = {};
    }

    on(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
        return this;
    }

    emit(event, ...args) {
        const listeners = this._listeners[event];
        if (listeners) {
            for (const listener of listeners) {
                listener.apply(this, args);
            }
        }
        return this;
    }

    off(event, callback) {
        if (this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(
                (cb) => cb !== callback
            );
        }
        return this;
    }
}

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay || DEFAULT_TIMEOUT);
    };
}

module.exports = { validateEmail, formatCurrency, EventEmitter, debounce };
