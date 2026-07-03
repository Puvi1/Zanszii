import confetti from "canvas-confetti";

const GOLD = "#EAB308";
const BLUE = "#3B82F6";
const WHITE = "#ffffff";

export function fireConfetti(opts = {}) {
    const defaults = {
        particleCount: 90,
        spread: 70,
        startVelocity: 45,
        origin: { y: 0.6 },
        colors: [GOLD, BLUE, WHITE, "#FDE047"],
        scalar: 1.1,
    };
    confetti({ ...defaults, ...opts });
}

export function fireBigConfetti() {
    const duration = 1500;
    const end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors: [GOLD, BLUE, WHITE] });
        confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: [GOLD, BLUE, WHITE] });
        if (Date.now() < end) requestAnimationFrame(frame);
    })();
}
