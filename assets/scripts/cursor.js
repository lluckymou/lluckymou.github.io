document.addEventListener('DOMContentLoaded', () => {
    const cursorOut = 'assets/images/cursorout.png';
    const cursorIn = 'assets/images/cursorin.png';

    const cursorElement = document.createElement('div');
    cursorElement.classList.add('custom-cursor');    
    document.body.appendChild(cursorElement);

    function updateCursorStyle(isPointer) {
        if (isPointer) {
            cursorElement.style.backgroundImage = `url(${cursorIn})`;
            cursorElement.style.width = '102px';
            cursorElement.style.height = '102px';
        } else {
            cursorElement.style.backgroundImage = `url(${cursorOut})`;
            cursorElement.style.width = '68px';
            cursorElement.style.height = '68px';
        }
    }

    function updateCursorVisibility() {
        if (window.innerWidth >= 768) {
            cursorElement.style.display = 'block';
            document.body.style.cursor = 'none';
        } else {
            cursorElement.style.display = 'none';
            document.body.style.cursor = '';
        }
    }

    document.addEventListener('mousemove', (e) => {
        cursorElement.style.left = `${e.clientX}px`;
        cursorElement.style.top = `${e.clientY}px`;
    });

    document.addEventListener('mouseover', (e) => {
        if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.classList.contains('pointer')) {
            updateCursorStyle(true);
        } else {
            updateCursorStyle(false);
        }
    });

    window.addEventListener('resize', updateCursorVisibility);
    updateCursorVisibility();
});