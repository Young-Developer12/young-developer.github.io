(function (global) {
  "use strict";

  var DIALOG_STYLE = {
    MSGBOX: 0,
    INPUT: 1,
    LIST: 2,
    PASSWORD: 3,
    TABLIST: 4,
    TABLIST_HEADERS: 5,
  };

  class DialogWidget {
    constructor(options) {
      var o = options || {};

      this.rootId = o.rootId || "dlgw-root";
      this.eventName = o.eventName || "show_dialog";
      this.callbackName = o.callbackName || "callback_dialog_response";
      this.inputPlaceholder = o.inputPlaceholder || "Нажмите для ввода";
      this.animationDuration = this._toNumber(o.animationDuration, 300);

      this.dialogId = -1;
      this.dialogType = DIALOG_STYLE.MSGBOX;
      this.response = 1;
      this.listItem = 0;
      this.inputText = "";
      this.selectedIndex = 0;
      this.items = [];
      this.isClosing = false;

      this.root = null;
      this.windowEl = null;
      this.inputEl = null;
      this.listEl = null;
      this.closeTimer = null;

      this._onRootClick = this._handleClick.bind(this);
      this._onKeyDown = this._handleKeyDown.bind(this);

      this._createRoot();
      this.root.addEventListener("click", this._onRootClick);
      document.addEventListener("keydown", this._onKeyDown, true);
      this._bindGameEvents();
    }

    show(dataOrId) {
      var args = Array.prototype.slice.call(arguments);
      var data;

      if (dataOrId && typeof dataOrId === "object") {
        data = dataOrId;
      } else {
        data = {
          id: args[0],
          type: args[1],
          header: args[2],
          text: args[3],
          button1: args[4],
          button2: args[5],
        };
      }

      var payload = this._normalize(data);

      this._clearCloseTimer();
      this._removeWindow();

      this.dialogId = payload.id;
      this.dialogType = payload.type;
      this.response = 1;
      this.listItem = 0;
      this.selectedIndex = 0;
      this.inputText = "";
      this.isClosing = false;

      this._render(payload);
      this._animateIn();

      this._setFocus(true);
      return this;
    }

    close(response) {
      if (this.dialogId === -1 || this.isClosing) return this;

      this.isClosing = true;

      if (typeof response === "number") this.response = response;
      if (
        this.dialogType === DIALOG_STYLE.INPUT ||
        this.dialogType === DIALOG_STYLE.PASSWORD
      ) {
        this.inputText = this.inputEl ? String(this.inputEl.value) : "";
      }

      this._setFocus(false);
      this._emit(
        this.callbackName,
        this.dialogId,
        this.response,
        this.listItem,
        this.inputText
      );

      this._animateOut();
      return this;
    }

    hide() {
      if (this.dialogId === -1 || this.isClosing) return this;
      this.isClosing = true;
      this._setFocus(false);
      this._animateOut();
      return this;
    }

    isOpen() {
      return this.dialogId !== -1;
    }

    destroy() {
      this._clearCloseTimer();
      document.removeEventListener("keydown", this._onKeyDown, true);
      if (this.root) {
        this.root.removeEventListener("click", this._onRootClick);
        if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
      }
      this.root = null;
      this.windowEl = null;
      this.inputEl = null;
      this.listEl = null;
      this.items = [];
      this.dialogId = -1;
    }

    _createRoot() {
      var existing = document.getElementById(this.rootId);
      if (existing) {
        this.root = existing;
        return;
      }
      var root = document.createElement("div");
      root.id = this.rootId;
      document.body.appendChild(root);
      this.root = root;
    }

    _bindGameEvents() {
      var cefApi = this._cef();
      if (!cefApi || typeof cefApi.on !== "function") return;

      var self = this;
      cefApi.on(this.eventName, function (id, type, header, text, b1, b2) {
        self.show({
          id: id,
          type: type,
          header: header,
          text: text,
          button1: b1,
          button2: b2,
        });
      });
    }

    _cef() {
      if (typeof global.cef !== "undefined" && global.cef) return global.cef;
      if (typeof cef !== "undefined") return cef; // eslint-disable-line no-undef
      return null;
    }

    _emit() {
      var cefApi = this._cef();
      if (!cefApi || typeof cefApi.emit !== "function") return;
      cefApi.emit.apply(cefApi, arguments);
    }

    _setFocus(state) {
      var cefApi = this._cef();
      if (cefApi && typeof cefApi.set_focus === "function") {
        cefApi.set_focus(state);
      }
    }

    _normalize(data) {
      var d = data || {};
      return {
        id: this._toNumber(d.id !== undefined ? d.id : d.dialogId, -1),
        type: this._toNumber(d.type !== undefined ? d.type : d.dialogType, 0),
        header: String(d.header !== undefined ? d.header : d.dialogHeader || ""),
        text: String(d.text !== undefined ? d.text : d.dialogText || ""),
        button1: String(d.button1 !== undefined ? d.button1 : d.button_1 || ""),
        button2: String(d.button2 !== undefined ? d.button2 : d.button_2 || ""),
      };
    }

    _toNumber(value, fallback) {
      var n = Number(value);
      return isFinite(n) ? n : fallback;
    }

    _render(payload) {
      var type = payload.type;
      var isTextual =
        type === DIALOG_STYLE.MSGBOX ||
        type === DIALOG_STYLE.INPUT ||
        type === DIALOG_STYLE.PASSWORD;

      var rawText = isTextual
        ? payload.text.replace(/\n/g, "<br />")
        : payload.text;

      var body = this._colorize(rawText);
      var header = this._colorize(payload.header, true);

      var win = document.createElement("div");
      win.className = "dlgw-window";
      win.setAttribute("role", "dialog");
      win.setAttribute("aria-modal", "true");

      var headerEl = document.createElement("div");
      headerEl.className = "dlgw-header";
      headerEl.innerHTML = header;
      win.appendChild(headerEl);

      this.inputEl = null;
      this.listEl = null;
      this.items = [];

      if (isTextual) {
        var textEl = document.createElement("div");
        textEl.className = "dlgw-text";
        textEl.innerHTML = body;
        win.appendChild(textEl);

        if (type === DIALOG_STYLE.INPUT || type === DIALOG_STYLE.PASSWORD) {
          var input = document.createElement("input");
          input.className = "dlgw-input";
          input.id = "dlgw-input";
          input.placeholder = this.inputPlaceholder;
          input.type = type === DIALOG_STYLE.PASSWORD ? "password" : "text";
          win.appendChild(input);
          this.inputEl = input;
        }
      } else {
        var list = document.createElement("div");
        list.className = "dlgw-list";
        win.appendChild(list);
        this.listEl = list;

        if (type === DIALOG_STYLE.LIST) {
          this._renderList(list, body);
        } else {
          this._renderTablist(list, body, type === DIALOG_STYLE.TABLIST_HEADERS);
        }
      }

      win.appendChild(this._renderButtons(payload));

      this.root.appendChild(win);
      this.windowEl = win;

      if (this.inputEl) {
        this.inputEl.focus();
        this.inputEl.select();
      }

      if (this.items.length) this._select(0);
      if (this.listEl) {
        this.listEl.classList.toggle(
          "dlgw-is-scrollable",
          this.listEl.scrollHeight > this.listEl.clientHeight
        );
      }
    }

    _renderList(container, body) {
      var lines = body.replace(/\t/g, "").split("\n");
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.length || line === "</span>") continue;

        var item = document.createElement("div");
        item.className = "dlgw-item";
        item.innerHTML = line;
        item.setAttribute("data-value", String(this.items.length));
        item.setAttribute("tabindex", "0");
        container.appendChild(item);
        this.items.push(item);
      }
    }

    _renderTablist(container, body, withHeaders) {
      var lines = body.split("\n");
      var headerPlaced = false;

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.length || line === "</span>") continue;

        var columns = line.split("\t");

        if (withHeaders && !headerPlaced) {
          var head = document.createElement("div");
          head.className = "dlgw-tablist-head";
          head.innerHTML = this._toCells(columns);
          container.appendChild(head);
          headerPlaced = true;
          continue;
        }

        var item = document.createElement("div");
        item.className = "dlgw-item";
        item.innerHTML = columns.length === 1 ? line : this._toCells(columns);
        item.setAttribute("data-value", String(this.items.length));
        item.setAttribute("tabindex", "0");
        if (columns.length !== 1) item.classList.add("dlgw-row");
        if (line.length === 1) item.classList.add("dlgw-item--flat");

        container.appendChild(item);
        this.items.push(item);
      }
    }

    _toCells(columns) {
      var html = "";
      for (var i = 0; i < columns.length; i++) {
        html += '<div class="dlgw-cell">' + columns[i] + "</div>";
      }
      return html;
    }

    _renderButtons(payload) {
      var wrap = document.createElement("div");
      wrap.className = "dlgw-buttons";
      var self = this;

      var btn1 = document.createElement("button");
      btn1.type = "button";
      btn1.className = "dlgw-btn dlgw-btn--primary";
      btn1.textContent = payload.button1;
      btn1.addEventListener("click", function () {
        self.close(1);
      });
      wrap.appendChild(btn1);

      if (payload.button2 !== "") {
        var btn2 = document.createElement("button");
        btn2.type = "button";
        btn2.className = "dlgw-btn dlgw-btn--secondary";
        btn2.textContent = payload.button2;
        btn2.addEventListener("click", function () {
          self.close(0);
        });
        wrap.appendChild(btn2);
      }

      return wrap;
    }

    _colorize(text, headerMode) {
      return String(text).replace(/\{(\w{3}|\w{6})\}[^{}]*/gi, function (chunk) {
        return (
          chunk.replace(/\{\w*\}/, function (color) {
            var hex = color.slice(1, -1).toLowerCase();
            return headerMode
              ? '<span class="dlgw-color" style="--i: #' + hex + ';">'
              : '<span class="dlgw-color" style="--i: #' +
                  hex +
                  "; --g: #" +
                  hex +
                  ';">';
          }) + "</span>"
        );
      });
    }

    _select(index) {
      if (!this.items.length) return;
      var max = this.items.length - 1;
      this.selectedIndex = Math.min(Math.max(index, 0), max);

      for (var i = 0; i < this.items.length; i++) {
        var item = this.items[i];
        var active = i === this.selectedIndex;
        item.classList.toggle("dlgw-item--active", active);

        var texts = item.querySelectorAll(".dlgw-color, .dlgw-cell");
        for (var j = 0; j < texts.length; j++) {
          texts[j].classList.toggle("dlgw-text--active", active);
        }
      }

      var current = this.items[this.selectedIndex];
      this.listItem = Number(current.getAttribute("data-value"));

      var list = this.listEl;
      if (list) {
        var top = current.offsetTop;
        var bottom = top + current.offsetHeight;
        if (top < list.scrollTop) list.scrollTop = top;
        else if (bottom > list.scrollTop + list.clientHeight)
          list.scrollTop = bottom - list.clientHeight;
        list.scrollLeft = 0;
      }
    }

    _handleClick(event) {
      if (this.dialogId === -1 || this.isClosing) return;

      var item = event.target.closest ? event.target.closest(".dlgw-item") : null;
      if (!item || item.classList.contains("dlgw-item--flat")) return;

      var index = this.items.indexOf(item);
      if (index === -1) return;

      this._select(index);
      this.close(1);
    }

    _handleKeyDown(event) {
      if (this.dialogId === -1 || this.isClosing) return;

      var isList =
        this.dialogType === DIALOG_STYLE.LIST ||
        this.dialogType === DIALOG_STYLE.TABLIST ||
        this.dialogType === DIALOG_STYLE.TABLIST_HEADERS;

      if (event.key === "Escape") {
        event.preventDefault();
        this.close(0);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        this.close(1);
        return;
      }

      if (!isList) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        this._select(this.selectedIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this._select(this.selectedIndex - 1);
      }
    }

    _animateIn() {
      var win = this.windowEl;
      if (!win) return;

      var onEnd = function (event) {
        if (event.target !== win || event.pseudoElement) return;
        win.removeEventListener("animationend", onEnd);
        win.classList.remove("dlgw-window--entering");
      };

      win.addEventListener("animationend", onEnd);
      win.classList.add("dlgw-window--entering");
    }

    _animateOut() {
      var self = this;
      var win = this.windowEl;

      if (!win) {
        this._reset();
        return;
      }

      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        win.removeEventListener("animationend", onEnd);
        self._clearCloseTimer();
        self._reset();
      };

      var onEnd = function (event) {
        if (event.target !== win || event.pseudoElement) return;
        finish();
      };

      win.classList.remove("dlgw-window--entering");
      win.addEventListener("animationend", onEnd);
      this.closeTimer = setTimeout(finish, this.animationDuration + 80);

      win.classList.add("dlgw-window--leaving");
    }

    _reset() {
      this._removeWindow();
      this.dialogId = -1;
      this.dialogType = DIALOG_STYLE.MSGBOX;
      this.response = 1;
      this.listItem = 0;
      this.selectedIndex = 0;
      this.inputText = "";
      this.items = [];
      this.isClosing = false;
    }

    _removeWindow() {
      if (this.windowEl && this.windowEl.parentNode) {
        this.windowEl.parentNode.removeChild(this.windowEl);
      }
      this.windowEl = null;
      this.inputEl = null;
      this.listEl = null;
    }

    _clearCloseTimer() {
      if (this.closeTimer) {
        clearTimeout(this.closeTimer);
        this.closeTimer = null;
      }
    }
  }

  DialogWidget.STYLE = DIALOG_STYLE;
  global.DialogWidget = DialogWidget;
})(typeof window !== "undefined" ? window : this);

document.addEventListener("DOMContentLoaded", function () {
  window.gameDialog = new window.DialogWidget();
});