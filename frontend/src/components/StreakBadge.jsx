import { Flame } from "@phosphor-icons/react";

export default function StreakBadge({ streak, longest }) {
    return (
        <div className="flex items-center gap-3" data-testid="streak-badge">
            <div className="relative streak-flame">
                <Flame size={36} weight="duotone" color="#EAB308" />
            </div>
            <div>
                <div className="text-3xl font-display font-black text-white leading-none" data-testid="streak-current">
                    {streak}
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                    Day Streak · Best {longest}
                </div>
            </div>
        </div>
    );
}
