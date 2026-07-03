export function xpProgress(user) {
    const xp = user?.xp || 0;
    const level = Math.floor(Math.sqrt(xp / 100)) + 1;
    const current = (level - 1) ** 2 * 100;
    const next = level ** 2 * 100;
    return {
        level,
        xp,
        current_level_xp: current,
        next_level_xp: next,
        progress_pct: Math.round(((xp - current) / Math.max(1, next - current)) * 100),
        xp_to_next: next - xp,
    };
}

export function classNames(...args) {
    return args.filter(Boolean).join(" ");
}
