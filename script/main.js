cef.on("game:fadeScreen", (o) => {
    const blackout = document.getElementById('blackout');
    o ? blackout.classList.add('visible') : blackout.classList.remove('visible');
    cef.emit("game:readyToTeleport");
});

const processHint = (function() {
    const element = document.getElementById('process-hint');
    let currentData = null;

    const elements = {
        coloredEllipse: document.querySelector('.hint .container__colored-ellipse'),
        preTitle: document.querySelector('.hint #pre-title'),
        title: document.querySelector('.hint #title'),
        titleSpan: document.querySelector('.hint #title span'),
        postTitle: document.querySelector('.hint #post-title'),
        description: document.querySelector('.hint #description'),
        timerTitle: document.querySelector('.hint #timer-title'),
        timerTime: document.querySelector('.hint #timer-time'),
        timerProgress: document.querySelector('.hint #timer-progress'),
        postDescription: document.querySelector('.hint #post-description'),
        postDescriptionSpan: document.querySelector('.hint #post-description span')
    };

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? '0' + secs : secs}`;
    }

    function updateElement(element, spanElement, content, useHTML = false) {
        if (!element) return;

        if (content) {
            if (spanElement) {
                spanElement.innerHTML = useHTML ? content.replace(/\n/g, '<br>') : content;
            } else {
                element.innerHTML = useHTML ? content.replace(/\n/g, '<br>') : content;
            }
            element.style.display = spanElement ? 'flex' : 'block';
        } else {
            element.style.display = 'none';
        }
    }

    function updateUI() {
        if (!currentData) return;

        elements.coloredEllipse.style.background =
            `linear-gradient(90deg, ${currentData.colorLeft} 42%, ${currentData.colorRight} 57%)`;

        updateElement(elements.preTitle, null, currentData.preTitle);
        updateElement(elements.title, elements.titleSpan, currentData.title);
        updateElement(elements.postTitle, null, currentData.postTitle);
        updateElement(elements.description, null, currentData.description, true);
        updateElement(elements.postDescription, elements.postDescriptionSpan, currentData.postDescription, true);

        elements.timerTitle.textContent = currentData.timerTitle || '';
        elements.timerTime.textContent = formatTime(currentData.timerCurrentTime);
        elements.timerProgress.style.width = `${(currentData.timerCurrentTime / currentData.timerMaxTime) * 100}%`;
    }

    return {
        show: function(data) {
            currentData = data;
            updateUI();
            element.style.display = 'flex';
        },

        hide: function() {
            currentData = null;
            element.style.display = 'none';
        },

        update: function(data) {
            Object.assign(currentData, data);
            updateUI();
        }
    };
})();

cef.on("game:ShowBHint", (h_title, h_description, h_timerTitle, h_timerCurrentTime, h_timerMaxTime, h_postDescription, h_colorLeft, h_colorRight) => {
    processHint.show({
        title: h_title,
        description: h_description,
        timerTitle: h_timerTitle,
        timerCurrentTime: h_timerCurrentTime, // Int
        timerMaxTime: h_timerMaxTime, // Int
        postDescription: h_postDescription,
        colorLeft: h_colorLeft,
        colorRight: h_colorRight
    });
});

cef.on("game:ShowScooterHint", () => {
    processHint.show({
        title: "Внимание",
        description: "Вернитесь в Ваш арендованный транспорт",
        timerTitle: "Осталось времени:",
        timerCurrentTime: 90,
        timerMaxTime: 90,
        postDescription: "Если Вы не успеете, то аренда Вашего транспорта будет прекращена \nИспользуйте /unrent, чтобы прекратить аренду",
        colorLeft: "#e46007",
        colorRight: "#4602bf"
    });
});

cef.on("game:HideBHint", () => {
    processHint.hide();
});
cef.on("game:UpdateBHint", (o) => {
    processHint.show({
        title: "Внимание",
        description: "Вернитесь в Ваш арендованный транспорт",
        timerTitle: "Осталось времени:",
        timerCurrentTime: o,
        timerMaxTime: 90,
        postDescription: "Если Вы не успеете, то аренда Вашего транспорта будет прекращена \nИспользуйте /unrent, чтобы прекратить аренду",
        colorLeft: "#e46007",
        colorRight: "#4602bf"
    });
});

function showPodzkazka(key, timeout) {
    const message = document.getElementById('message');
    const keyElement = document.getElementById('key');
    
    keyElement.textContent = key;

    function showMessage() {
        message.style.bottom = '35px';
        message.style.opacity = '1';
    }

    function hideMessage() {
        message.style.bottom = '-100px';
        message.style.opacity = '0';
    }

    setTimeout(showMessage, 250);
    
    setTimeout(hideMessage, timeout || 5000);

    window.showMessage = showMessage;
    window.hideMessage = hideMessage;
}

cef.on("game:ShowHint", (key, timeout) => {
    showPodzkazka(key, timeout);
});

let audioInstances = new Map();

function playSound(filename, volume = 100, loop = false) {
    let audio = new Audio("sfx/" + filename);
    audio.volume = volume / 100;
    audio.loop = loop;
    audio.play();
    audioInstances.set(filename, audio);
}

function stopSound(filename) {
    if (audioInstances.has(filename)) {
        let audio = audioInstances.get(filename);
        audio.pause();
        audio.currentTime = 0;
        audioInstances.delete(filename);
    }
}

function stopAllSounds() {
    audioInstances.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    audioInstances.clear();
}

function setVolume(filename, volume) {
    if (audioInstances.has(filename)) {
        audioInstances.get(filename).volume = volume / 100;
    }
}


cef.on("playSound", (filename, volume, loop) => {
    playSound(filename, volume, loop);
});
cef.on("stopSound", (filename) => {
    stopSound(filename);
});
cef.on("setVolume", (filename, volume) => {
    setVolume(filename, volume);
});
cef.on("stopAllSounds", () => {
    stopAllSounds();
});

document.addEventListener('keyup', (event) => {
    if(chat.chatShowInput === true) return;
    cef.emit("game:KeyReleased", event.keyCode);
});