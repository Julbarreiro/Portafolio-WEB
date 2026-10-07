const customCursor = document.querySelector('.custom-cursor');
const mediaLightbox = document.getElementById('media-lightbox');
const contactDialog = document.getElementById('contact-dialog');
const supportsCustomCursor = window.matchMedia('(hover: hover) and (pointer: fine)');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (customCursor && supportsCustomCursor.matches && window.gsap) {
    const { gsap } = window;
    const interactiveSelector = 'a, button, input, select, textarea, summary, [role="button"], .interactive-card, .media-card, .menu-item';

    gsap.set(customCursor, { xPercent: -50, yPercent: -50 });
    document.documentElement.classList.add('custom-cursor-enabled');

    document.addEventListener('mousemove', event => {
        gsap.set(customCursor, { x: event.clientX, y: event.clientY, opacity: 1 });
        customCursor.classList.add('visible');
    }, { passive: true });

    document.addEventListener('mouseover', event => {
        if (event.target instanceof Element && event.target.closest(interactiveSelector)) {
            document.body.classList.add('hovering');
        }
    }, { passive: true });

    document.addEventListener('mouseout', event => {
        if (!(event.target instanceof Element)) return;
        const relatedTarget = event.relatedTarget;
        const movedToInteractive = relatedTarget instanceof Element && relatedTarget.closest(interactiveSelector);
        if (event.target.closest(interactiveSelector) && !movedToInteractive) {
            document.body.classList.remove('hovering');
        }
    }, { passive: true });

    function getEffectLayer() {
        if (mediaLightbox?.open) return mediaLightbox;
        if (contactDialog?.open) return contactDialog;
        return document.body;
    }

    function createBurst(x, y) {
        if (prefersReducedMotion.matches) return;
        const effectLayer = getEffectLayer();
        const dotBurst = document.createElement('span');
        dotBurst.className = 'cursor-dot-burst';
        dotBurst.style.left = `${x}px`;
        dotBurst.style.top = `${y}px`;
        effectLayer.append(dotBurst);

        gsap.fromTo(dotBurst,
            { xPercent: -50, yPercent: -50, width: 12, height: 12, opacity: 1 },
            {
                width: 38,
                height: 38,
                opacity: 0,
                duration: 0.4,
                ease: 'power2.out',
                onComplete: () => dotBurst.remove()
            }
        );

        const ripple = document.createElement('span');
        ripple.className = 'cursor-ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        effectLayer.append(ripple);

        gsap.fromTo(ripple,
            { xPercent: -50, yPercent: -50, scale: 0.15, opacity: 0.9 },
            {
                scale: 1.1,
                opacity: 0,
                duration: 0.5,
                ease: 'power2.out',
                onComplete: () => ripple.remove()
            }
        );

        const particleCount = 7;
        const startDistance = 5;
        const maxDistance = 45;

        for (let index = 0; index < particleCount; index += 1) {
            const particle = document.createElement('span');
            const angle = (index / particleCount) * Math.PI * 2;
            const startX = Math.cos(angle) * startDistance;
            const startY = Math.sin(angle) * startDistance;
            const targetX = Math.cos(angle) * maxDistance;
            const targetY = Math.sin(angle) * maxDistance;

            particle.className = 'cursor-particle';
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            effectLayer.append(particle);

            gsap.to(particle, {
                keyframes: [
                    { xPercent: -50, yPercent: -50, x: startX, y: startY, scale: 1.2, opacity: 1, duration: 0.08, ease: 'power1.in' },
                    { x: targetX * 0.7, y: targetY * 0.7, scale: 0.9, opacity: 0.85, duration: 0.22, ease: 'none' },
                    { x: targetX, y: targetY, scale: 0.2, opacity: 0, duration: 0.45, ease: 'power3.out' }
                ],
                onComplete: () => particle.remove()
            });
        }
    }

    document.addEventListener('mousedown', event => {
        if (event.button === 0) {
            customCursor.classList.add('is-down');
        }
    });

    document.addEventListener('mouseup', event => {
        if (event.button !== 0) return;
        customCursor.classList.remove('is-down');
        createBurst(event.clientX, event.clientY);
    }, { passive: true });

    window.addEventListener('blur', () => customCursor.classList.remove('is-down'));
    window.addEventListener('lightbox:open', () => mediaLightbox.append(customCursor));
    window.addEventListener('lightbox:close', () => {
        document.body.append(customCursor);
        document.body.classList.remove('hovering');
    });
    window.addEventListener('contact:open', () => contactDialog.append(customCursor));
    window.addEventListener('contact:close', () => {
        document.body.append(customCursor);
        document.body.classList.remove('hovering');
    });
} else if (supportsCustomCursor.matches && !window.gsap) {
    console.error('No se pudo iniciar el cursor animado porque GSAP no está disponible.');
}
