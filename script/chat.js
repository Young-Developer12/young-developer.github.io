const CHAT_COMMANDS = ['/timestamp', '/mute', '/message', '/m', '/mn', '/menu', '/me', '/mp', '/mask', '/med', '/phone', '/kick', '/set_neon', '/set_toning', '/car_menu', '/set_number'];
const CHAT_CATEGORY_COLORS = {
    'IC': 'rgba(0, 0, 0, 0.50)', 'ME': 'rgba(0, 0, 0, 0.50)', 'DO': 'rgba(0, 0, 0, 0.50)', 'TRY': 'rgba(0, 0, 0, 0.50)', 'OOC': 'rgba(0, 0, 0, 0.50)',
    'Семья': '#eb741e', 'Рация': '#1f87ff', 'Объявление': '#41b317', 'Информация': '#ff2626', 'Предложение': '#e89923', 'Организация': '#009733'
};

var chat = new Vue({
    el: '.cef-chat__main',
    data: {
        chatMessages: [], chatInput: '', chatOpacity: 1, chatFontSize: 1.3, chatHeight: 30, chatOverflow: 'auto',
        chatShowTime: true, chatShowHints: true, chatShowHintsCmd: true, chatShowInput: false, chatShowCategory: true, chatShowSettings: false,
        chatCategoryColors: CHAT_CATEGORY_COLORS, chatFilteredCommands: [], chatHistory: [], chatHistoryIndex: -1
    },
    mounted() {
        window.addEventListener('keydown', this.handleKeyDown);
        cef.on('chat:add', (text, category, color) => this.addMessage(text, category, color));
        cef.on('chat:clear', () => this.clearChat());
    },
    beforeDestroy() {
        window.removeEventListener('keydown', this.handleKeyDown);
    },
    methods: {
        clearChat() { this.chatMessages = []; },
        
        toggleInput(show) {
            this.chatShowInput = show;
            if (show) this.chatHistoryIndex = -1;
            this.$nextTick(() => {
                const input = document.getElementById('chat-input');
                if (!input) return;
                input.style.display = show ? 'block' : 'none';
                show ? input.focus() : input.blur();
                cef.set_focus(show);
            });
        },

        addMessage(text, category = '', color = '') {
            const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            
            let resolvedColor = '#fff';
            if (/^\d{1,3},\d{1,3},\d{1,3}$/.test(color?.trim())) resolvedColor = `rgb(${color.trim()})`;
            else if (color?.startsWith('#') || color?.startsWith('rgb')) resolvedColor = color;
            else if (this.chatCategoryColors[category]) resolvedColor = this.chatCategoryColors[category];

            const parsedText = this.parseSampColors(text);
            const lastMsg = this.chatMessages[this.chatMessages.length - 1];

            if (lastMsg?.text === parsedText && lastMsg?.category === category && lastMsg?.color === resolvedColor) {
                lastMsg.repeat = (lastMsg.repeat || 1) + 1;
                lastMsg.time = time;
                this.$forceUpdate();
                return;
            }

            this.chatMessages.push({ id, time, category, text: parsedText, color: resolvedColor, repeat: 1 });
            this.$nextTick(() => {
                const container = this.$refs.chatMessages;
                container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            });
        },

        parseSampColors(text) {
            return text.replace(/\{([A-Fa-f0-9]{6})\}/g, '<span style="color:#$1">').replace(/$/g, match => match.includes('<span') ? '</span>' : '');
        },

        filterCommands() {
            if (this.chatInput.startsWith('/')) {
                this.chatFilteredCommands = CHAT_COMMANDS.filter(cmd => cmd.startsWith(this.chatInput.toLowerCase()));
                this.chatShowHints = this.chatFilteredCommands.length > 0;
            } else this.chatShowHints = false;
        },

        selectCommand(command) {
            this.chatInput = command + ' ';
            this.chatShowHints = false;
            this.chatHistoryIndex = -1;
        },

        handleKeyDown(e) {
            const openKeys = ['F6', 't', 'T', 'е', 'Е'];
            const isInputBlocked = keyHoldGameStarted || auth.active || 
                                  (document.activeElement.tagName === 'INPUT' && !this.chatShowInput);

            if (e.key === 'Escape' && this.chatShowInput) {
                this.toggleInput(false);
                return;
            }

            if (openKeys.includes(e.key) && !this.chatShowInput) {
                if (isInputBlocked) return;
                e.preventDefault();
                this.toggleInput(true);
                return;
            }

            if (e.key === 'F8') {
                e.preventDefault();
                this.addMessage('Вы успешно создали скриншот! Он сохранён в папке adept/screens текущей игры.', 'INFO', '151,201,0');
                return;
            }

            if (e.key === 'ArrowUp' && this.chatShowInput && this.chatHistory.length > 0) {
                e.preventDefault();
                if (this.chatHistoryIndex < this.chatHistory.length - 1) {
                    this.chatHistoryIndex++;
                    this.chatInput = this.chatHistory[this.chatHistoryIndex];
                }
                return;
            }

            if (e.key === 'ArrowDown' && this.chatShowInput && this.chatHistory.length > 0) {
                e.preventDefault();
                if (this.chatHistoryIndex > 0) {
                    this.chatHistoryIndex--;
                    this.chatInput = this.chatHistory[this.chatHistoryIndex];
                } else if (this.chatHistoryIndex === 0) {
                    this.chatHistoryIndex = -1;
                    this.chatInput = '';
                }
                return;
            }

            if (e.key === 'Enter' && this.chatShowInput) {
                const input = this.chatInput.trim();
                if (!input) {
                    this.chatInput = '';
                    this.chatShowHints = false;
                    this.toggleInput(false);
                    return;
                }

                cef.emit("send:chat:message:result", input);
                this.chatHistory.unshift(input);
                if (this.chatHistory.length > 10) this.chatHistory.pop();
                
                this.chatHistoryIndex = -1;
                this.chatInput = '';
                this.chatShowHints = false;
                this.toggleInput(false);
            }
        }
    }
});