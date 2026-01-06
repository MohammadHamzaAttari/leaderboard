import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CompactStatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
    isLoading?: boolean;
}

const colorClasses = {
    blue: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        icon: 'text-blue-400',
        gradient: 'from-blue-500 to-blue-600',
    },
    green: {
        bg: 'bg-green-500/10',
        border: 'border-green-500/30',
        icon: 'text-green-400',
        gradient: 'from-green-500 to-green-600',
    },
    yellow: {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        icon: 'text-yellow-400',
        gradient: 'from-yellow-500 to-yellow-600',
    },
    red: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        icon: 'text-red-400',
        gradient: 'from-red-500 to-red-600',
    },
    purple: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        icon: 'text-purple-400',
        gradient: 'from-purple-500 to-purple-600',
    },
    indigo: {
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/30',
        icon: 'text-indigo-400',
        gradient: 'from-indigo-500 to-indigo-600',
    },
};

const CompactStatCard: React.FC<CompactStatCardProps> = ({
    title,
    value,
    icon,
    trend,
    color = 'blue',
    isLoading = false,
}) => {
    const colors = colorClasses[color];

    return (
        <div className="group relative bg-[#252932] rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-all duration-300">
            {/* Animated gradient background on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

            <div className="relative p-4">
                <div className="flex items-center gap-4">
                    {/* Icon Section */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                        <div className={colors.icon}>
                            {icon}
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                            {title}
                        </p>
                        {isLoading ? (
                            <div className="h-7 w-20 bg-gray-700 rounded animate-pulse" />
                        ) : (
                            <p className="text-2xl font-bold text-white truncate">
                                {value}
                            </p>
                        )}
                    </div>

                    {/* Trend Indicator */}
                    {trend && !isLoading && (
                        <div className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${trend.isPositive
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                            <span>{trend.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(trend.value)}%</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom accent line */}
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        </div>
    );
};

export default CompactStatCard;
