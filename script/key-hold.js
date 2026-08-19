
let keys = [81, 69, 70, 90, 88, 67, 82, 84];

let prevKey = '-';
let currentKey = '';
let nextKey = '';
let currentlyHeldCode = null;
let progress = 0;
let animationFrame = null;

let progressSpeed = 0.5;
let decaySpeed = 5;

let prevEl = document.querySelectorAll('.div-wrapper-key .text-wrapper-keys')[0];
let currentEl = document.querySelector('.text-wrapper-key-main');
let nextEl = document.querySelectorAll('.div-wrapper-key .text-wrapper-keys')[1];
let progressEl = document.querySelector('.rectangle-key');
let container = document.querySelector('.key-hold');

let keyHoldGameStarted = false;

function getRandomKey(exclude) {
    let key;
    do {
        key = keys[Math.floor(Math.random() * keys.length)];
    } while (key === exclude);
    return key;
}

function animateKeyChange(element, newText) {
    element.classList.remove('text-visible');
    element.classList.add('text-hidden');

    setTimeout(() => {
        element.textContent = newText;
        element.classList.remove('text-hidden');
        element.classList.add('text-visible');
    }, 200);
}

function updateKeys() {
    animateKeyChange(prevEl, typeof prevKey === 'number' ? String.fromCharCode(prevKey) : '-');
    animateKeyChange(currentEl, typeof currentKey === 'number' ? String.fromCharCode(currentKey) : '?');
    animateKeyChange(nextEl, typeof nextKey === 'number' ? String.fromCharCode(nextKey) : '?');
}



function nextRound() {
    prevKey = currentKey;
    currentKey = nextKey || getRandomKey();
    nextKey = getRandomKey(currentKey);
    progress = 0;
    currentlyHeldCode = null;
    updateKeys();
    cef.emit("game:KeyHeld:KeySelected", currentKey, currentlyHeldCode);
}

function updateProgressBar() {
    const maxWidth = 98;
    progressEl.style.width = `${(progress / 100) * maxWidth}px`;
}

function gameLoop() {
    if (currentlyHeldCode === currentKey) {
        progress += progressSpeed;
        if (progress >= 100) {
            progress = 100;
            updateProgressBar();
            nextRound();
            cef.emit("game:KeyHeld:IncreaseScore");
        }
    } else {
        progress -= decaySpeed;
        if (progress < 0) progress = 0;
    }

    updateProgressBar();
    animationFrame = requestAnimationFrame(gameLoop);
}

function handleKeyDown(e) {
    // if (e.code === currentKey) {
    //     currentlyHeldCode = e.code;
    // }
    cef.emit("game:KeyHeld", e.keyCode);
}

function handleKeyUp(e) {
    // if (e.code === currentlyHeldCode) {
    //     currentlyHeldCode = null;
    //     alert("aga");
    // }
    cef.emit("game:KeyHeld:KeySelected", e.keyCode, currentlyHeldCode);
}

function startGame() {
    nextRound();
    gameLoop();
    
    window.addEventListener('keydown', handleKeyDown);

    keyHoldGameStarted = true;
    // window.addEventListener('keyup', handleKeyUp);
}

function stopGame() {
    cancelAnimationFrame(animationFrame);
    window.removeEventListener('keydown', handleKeyDown);

    keyHoldGameStarted = false;
    // window.removeEventListener('keyup', handleKeyUp);
}

function showInterface() {
    if (container) container.classList.add('visible');
}

function hideInterface() {
    if (container) container.classList.remove('visible');
}

// CEF trigger
cef.on("game:key-held:show", (status) => {
    if (status) {
        showInterface();
        startGame();
        cef.set_focus(true); // передаёт фокус CEF-элементу
    } else {
        hideInterface();
        stopGame();
        cef.set_focus(false); // отключает фокус
    }
});
cef.on("game:key-held:SetHeldCode", (heldCode) => {
    currentlyHeldCode = heldCode;
});
