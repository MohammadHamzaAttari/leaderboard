import React from 'react';
import { UserPlus, UserMinus, Edit, LogIn, Clock } from 'lucide-react';

interface Activity {
    id: string;
    type: 'create' | 'update' | 'delete' | 'login';
    user: string;
    description: string;
    timestamp: string;
}

interface ActivityTimelineProps {
    activities: Activity[];
    isLoading?: boolean;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
    activities,
    isLoading = false,
}) => {
    const getActivityIcon = (type: Activity['type']) => {
        switch (type) {
            case 'create':
                return <UserPlus size={16} className="text-green-400" />;
            case 'update':
                return <Edit size={16} className="text-blue-400" />;
            case 'delete':
                return <UserMinus size={16} className="text-red-400" />;
            case 'login':
                return <LogIn size={16} className="text-purple-400" />;
            default:
                return <Clock size={16} className="text-gray-400" />;
        }
    };

    const getActivityColor = (type: Activity['type']) => {
        switch (type) {
            case 'create':
                return 'bg-green-500/20 border-green-500/30';
            case 'update':
                return 'bg-blue-500/20 border-blue-500/30';
            case 'delete':
                return 'bg-red-500/20 border-red-500/30';
            case 'login':
                return 'bg-purple-500/20 border-purple-500/30';
            default:
                return 'bg-gray-500/20 border-gray-500/30';
        }
    };

    const formatTimeAgo = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-3 animate-pulse">
                        <div className="w-8 h-8 bg-gray-700 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-700 rounded w-3/4" />
                            <div className="h-3 bg-gray-700 rounded w-1/4" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="text-center py-8">
                <Clock size={32} className="mx-auto text-gray-600 mb-2" />
                <p className="text-gray-400 text-sm">No recent activity</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {activities.map((activity, index) => (
                <div
                    key={activity.id}
                    className="flex items-start gap-3 group hover:bg-[#1a1d24] p-2 rounded-lg transition-colors duration-200"
                >
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg border ${getActivityColor(activity.type)} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                        {getActivityIcon(activity.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                            <span className="font-semibold text-white">{activity.user}</span>{' '}
                            {activity.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <Clock size={10} />
                            {formatTimeAgo(activity.timestamp)}
                        </p>
                    </div>

                    {/* Timeline connector */}
                    {index < activities.length - 1 && (
                        <div className="absolute left-[19px] top-[44px] w-px h-6 bg-gray-800" />
                    )}
                </div>
            ))}
        </div>
    );
};

export default ActivityTimeline;
