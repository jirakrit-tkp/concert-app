'use client';

import { Award, CircleX, LucideIcon, User } from 'lucide-react';

type StatTone = 'info' | 'success' | 'danger';

const toneConfig: Record<StatTone, { colorClass: string; icon: LucideIcon }> = {
  info: { colorClass: 'bg-blue-1', icon: User },
  success: { colorClass: 'bg-green-1', icon: Award },
  danger: { colorClass: 'bg-red-1', icon: CircleX },
};

export interface StatCardProps {
  label: string;
  value: number;
  tone: StatTone;
}

const StatCard = ({ label, value, tone }: StatCardProps) => {
  const config = toneConfig[tone];
  const Icon = config.icon;

  return (
    <article
      className={`flex w-full flex-col items-center justify-center rounded-lg ${config.colorClass} px-6 py-6 text-center text-white shadow-lg lg:flex-1 lg:basis-[350px] lg:min-w-0 lg:px-8 lg:py-10`}
    >
      <div className="flex flex-col items-center lg:hidden">
        <p className="text-lg font-medium tracking-wide -mb-6">{label}</p>
        <div className="mt-6 flex items-center gap-3 text-5xl font-bold">
          <Icon size={40} aria-hidden="true" className="opacity-90" />
          <span>{value}</span>
        </div>
      </div>
      <div className="hidden flex-col items-center lg:flex">
        <Icon size={40} aria-hidden="true" className="opacity-90" />
        <p className="mt-3 text-lg font-medium tracking-wide">{label}</p>
        <span className="mt-6 text-5xl font-bold">{value}</span>
      </div>
    </article>
  );
};

StatCard.displayName = 'StatCard';

export default StatCard;