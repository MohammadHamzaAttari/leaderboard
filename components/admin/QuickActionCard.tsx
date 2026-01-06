import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface QuickActionCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    href: string;
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'pink';
    onClick?: () => void;
}

const colorClasses = {
    blue: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: 'text-blue-400',
        gradient: 'from-blue-500 to-blue-600',
        hover: 'hover:border-blue-500/40',
    },
    green: {
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        icon: 'text-green-400',
        gradient: 'from-green-500 to-green-600',
        hover: 'hover:border-green-500/40',
    },
    purple: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
        icon: 'text-purple-400',
        gradient: 'from-purple-500 to-purple-600',
        hover: 'hover:border-purple-500/40',
    },
    orange: {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/20',
        icon: 'text-orange-400',
        gradient: 'from-orange-500 to-orange-600',
        hover: 'hover:border-orange-500/40',
    },
    pink: {
        bg: 'bg-pink-500/10',
        border: 'border-pink-500/20',
        icon: 'text-pink-400',
        gradient: 'from-pink-500 to-pink-600',
        hover: 'hover:border-pink-500/40',
    },
};

const QuickActionCard: React.FC<QuickActionCardProps> = ({
    title,
    description,
    icon,
    href,
    color = 'blue',
    onClick,
}) => {
    const colors = colorClasses[color];

    const content = (
        <div className={`relative group bg-[#252932] rounded-xl border ${colors.border} ${colors.hover} overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer`}>
            {/* Gradient background on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

            {/* Glass morphism effect */}
            <div className="relative backdrop-blur-sm p-6">
                <div className="flex items-start justify-between mb-4">
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                        <div className={colors.icon}>
                            {icon}
                        </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight
                        size={20}
                        className={`${colors.icon} opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300`}
                    />
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-white transition-colors">
                    {title}
                </h3>
                <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                    {description}
                </p>
            </div>

            {/* Bottom gradient accent */}
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        </div>
    );

    if (onClick) {
        return <div onClick={onClick}>{content}</div>;
    }

    return <Link href={href}>{content}</Link>;
};

export default QuickActionCard;
