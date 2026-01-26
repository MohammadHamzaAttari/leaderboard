import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lock, Unlock, AlertCircle, Search, Download,
  ZoomIn, ZoomOut, Maximize2, Minimize2, Menu, X, Check, RefreshCw,
  Clock, Calendar, Trophy, Zap, TrendingUp, TrendingDown, Target,
  CheckCircle, CheckCircle2, CircleDot, Circle
} from 'lucide-react';

interface MonthOption {
  value: string;
  label: string;
}

interface CommissionPropertyPair {
  commissionValue: string | null;
  propertyCode: string | null;
}

interface EarnedDetail {
  propertyCode: string;
  commission: number;
}

interface RolloverCommission extends CommissionPropertyPair {
  isRollover: boolean;
  sourceMonth: string;
  sourceMonthLabel: string;
}

interface AgentLeaderboardData {
  rank: number;
  name: string;
  sales: number;
  above_10: number;
  commission: number;
  
  totalBonus: number;       
  speedBonus: number;       
  firstTo20Bonus: number;   
  effectiveFirstTo20Bonus: number;
  isFirstTo20Winner: boolean;
  isSpeedBonusWinner: boolean;

  toEarn: number;
  totalEarnings: number;
  propertyCode: string | null;
  commissionEarned: number;
  commissionPropertyPairs: CommissionPropertyPair[];
  earnedDetails: EarnedDetail[];
}

interface TeamPerformanceData {
  totalSales: number;
  target: number;
  totalSalesAbove10: number;
}

interface BonusStatus {
  teamBonus: {
    amount: number;
    target: number;
    currentSales: number;
    isUnlocked: boolean;
    progress: number;
    remaining: number;
    status: string;
  };
  firstTo20: {
    amount: number;
    target: number;
    claimed: boolean;
    winner: { name: string; claimedAt: string; id?: string } | null;
    closestAgent: { name: string; sales: number; remaining: number } | null;
  };
}

interface ApiDashboardResponse {
  leaderboard: any[];
  team: TeamPerformanceData;
  bonuses?: BonusStatus;
}

const getCurrentWeekOfMonth = (): number => {
  const now = new Date();
  const dayOfMonth = now.getDate();
  return Math.ceil(dayOfMonth / 7);
};

const getWeekTarget = (week: number): number => {
  switch(week) {
    case 1: return 30;
    case 2: return 60;
    case 3: return 90;
    case 4:
    default: return 100;
  }
};

// ✅ Beautiful Animated Checkmark Component
const EarnedCheckmark: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className={`relative ${sizeClasses[size]}`}>
      {/* Glow effect */}
      <div className="absolute inset-0 bg-green-500 rounded-full blur-sm opacity-50 animate-pulse"></div>
      {/* Main checkmark circle */}
      <div className="relative bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center w-full h-full shadow-lg shadow-green-500/30">
        <Check className="text-white" size={size === 'sm' ? 10 : size === 'md' ? 12 : 14} strokeWidth={3} />
      </div>
    </div>
  );
};

// ✅ Pending/Not Earned Indicator Component
const PendingIndicator: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center`}>
      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
    </div>
  );
};

const DWITSDashboard: React.FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<AgentLeaderboardData[]>([]);
  const [filteredData, setFilteredData] = useState<AgentLeaderboardData[]>([]);
  const [teamData, setTeamData] = useState<TeamPerformanceData | null>(null);
  const [bonusData, setBonusData] = useState<BonusStatus | null>(null);
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expandedAgentRank, setExpandedAgentRank] = useState<string | null>(null);
  const [expandedEarnedAgentRank, setExpandedEarnedAgentRank] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [includeRollover, setIncludeRollover] = useState(false);

  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(30);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const leaderboardRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const REFRESH_INTERVAL = 30;

  // --- Helper Functions ---
  const formatCurrency = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined) return '£0.00';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '£0.00';
    return `£${numValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  const formatInteger = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined) return '0';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '0';
    return Math.round(numValue).toLocaleString('en-US');
  };

  const formatMonthName = (monthStr: string): string => {
    if (!monthStr) return 'N/A';
    try {
      const date = new Date(monthStr + '-01');
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch (e) { return monthStr; }
  };

  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  const getValidCommissionPairs = useCallback((agent: AgentLeaderboardData): CommissionPropertyPair[] => {
    if (!agent.commissionPropertyPairs || !Array.isArray(agent.commissionPropertyPairs)) return [];
    return agent.commissionPropertyPairs.filter(pair => {
      if (!pair) return false;
      const commValue = pair.commissionValue;
      if (commValue === null || commValue === undefined || commValue === '' || commValue === 'null') return false;
      const numValue = parseFloat(commValue);
      return !isNaN(numValue) && numValue !== 0;
    });
  }, []);

  const getValidEarnedDetails = (agent: AgentLeaderboardData): EarnedDetail[] => {
    if (!agent.earnedDetails || !Array.isArray(agent.earnedDetails)) return [];
    return agent.earnedDetails.filter(detail =>
      detail && detail.commission !== null && detail.commission !== undefined && detail.commission !== 0
    );
  };

  const isPropertyEarned = (agent: AgentLeaderboardData, propertyCode: string | null): boolean => {
    if (!propertyCode || !agent.earnedDetails || !Array.isArray(agent.earnedDetails)) return false;
    const normalizedPropertyCode = propertyCode.trim().toLowerCase();
    return agent.earnedDetails.some(detail =>
      detail.propertyCode &&
      detail.propertyCode.trim().toLowerCase() === normalizedPropertyCode
    );
  };

  // Get earned amount for a property
  const getEarnedAmount = (agent: AgentLeaderboardData, propertyCode: string | null): number | null => {
    if (!propertyCode || !agent.earnedDetails || !Array.isArray(agent.earnedDetails)) return null;
    const normalizedPropertyCode = propertyCode.trim().toLowerCase();
    const earnedDetail = agent.earnedDetails.find(detail =>
      detail.propertyCode &&
      detail.propertyCode.trim().toLowerCase() === normalizedPropertyCode
    );
    return earnedDetail ? earnedDetail.commission : null;
  };

  // --- API Fetching Functions ---
  const fetchAvailableMonths = async () => {
    try {
      const response = await fetch('/api/available-months');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data.months)) {
        setAvailableMonths(data.months);
        if (data.months.length > 0) setSelectedMonth(data.months[0].value);
        else {
          const currentMonth = new Date().toISOString().slice(0, 7);
          setSelectedMonth(currentMonth);
          setAvailableMonths([{ value: currentMonth, label: formatMonthName(currentMonth) }]);
        }
      }
    } catch (error: any) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      setSelectedMonth(currentMonth);
      setAvailableMonths([{ value: currentMonth, label: formatMonthName(currentMonth) }]);
    }
  };

  const fetchData = async (isAutoRefresh = false) => {
    if (isAutoRefresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    if (!selectedMonth) {
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const response = await fetch('/api/dashboard-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: ApiDashboardResponse = await response.json();

      const teamSales = data.team?.totalSales || 0;
      const isTeamBonusUnlockedForCalc = teamSales >= 100;

      const processedData: AgentLeaderboardData[] = data.leaderboard.map((agent) => {
          const commission = parseFloat(agent['Commission (£)'] || agent.commission) || 0;
          const speedBonus = parseFloat(agent['Bonus (£)'] || agent['Speed Bonus (€)'] || agent.bonus || 0);
          
          const rawFirstTo20Bonus = parseFloat(agent['First to 20 Bonus (€)'] || agent.firstTo20Bonus || 0);
          const isFirstTo20Winner = agent.is_first_to_20_winner || agent.isFirstTo20Winner || false;
          
          const effectiveFirstTo20Bonus = isTeamBonusUnlockedForCalc ? rawFirstTo20Bonus : 0;
          const totalBonus = speedBonus + effectiveFirstTo20Bonus;

          const sales = parseInt(agent['Sales'] || agent.sales) || 0;
          const above_10 = parseInt(agent['Above 10'] || agent.above_10) || 0;
          const commissionEarned = parseFloat(agent.commissionEarned) || 0;

          let commissionPropertyPairs: CommissionPropertyPair[] = [];
          try {
            const rawCommissionData = agent['commission_property_pair'];
            if (rawCommissionData && typeof rawCommissionData === 'string') {
                const parsed = JSON.parse(rawCommissionData.replace(/\\"/g, '"'));
                if (Array.isArray(parsed)) commissionPropertyPairs = parsed;
            } else if (Array.isArray(rawCommissionData)) {
              commissionPropertyPairs = rawCommissionData;
            }
          } catch (error) { commissionPropertyPairs = []; }

          let earnedDetails: EarnedDetail[] = [];
          try {
            if (agent.earnedDetails && Array.isArray(agent.earnedDetails)) {
              earnedDetails = agent.earnedDetails.filter((detail: any) =>
                detail && detail.propertyCode && detail.commission !== null
              );
            }
          } catch (error) { earnedDetails = []; }

          const agentName = agent['Agent Name'] || agent.name || '';
          const displayName = agentName.trim() !== '' ? agentName : 'Unknown Agent';

          return {
            rank: parseInt(agent['Rank'] || agent.rank) || 0,
            name: String(displayName),
            sales,
            above_10,
            commission,
            totalBonus,
            speedBonus,
            firstTo20Bonus: rawFirstTo20Bonus,
            effectiveFirstTo20Bonus,
            isFirstTo20Winner,
            isSpeedBonusWinner: speedBonus > 0,
            toEarn: Math.max(500 - commission, 0),
            totalEarnings: commission + totalBonus,
            propertyCode: agent.propertyCode || null,
            commissionEarned,
            commissionPropertyPairs,
            earnedDetails
          };
        })
        .sort((a, b) => a.rank - b.rank);

      setLeaderboardData(processedData);
      setFilteredData(processedData);
      setTeamData(data.team);
      setBonusData(data.bonuses || null); 
      setLastRefreshTime(new Date());
      setTimeUntilRefresh(REFRESH_INTERVAL);
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      setError(error.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const startAutoRefresh = () => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setTimeUntilRefresh(REFRESH_INTERVAL);
    countdownIntervalRef.current = setInterval(() => {
      setTimeUntilRefresh(prev => (prev <= 1 ? REFRESH_INTERVAL : prev - 1));
    }, 1000);

    refreshIntervalRef.current = setInterval(() => {
      fetchData(true);
    }, REFRESH_INTERVAL * 1000);
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const handleManualRefresh = () => {
    fetchData(false);
    stopAutoRefresh();
    startAutoRefresh();
  };

  useEffect(() => {
    fetchAvailableMonths();
    return () => stopAutoRefresh();
  }, []);

  useEffect(() => {
    if (selectedMonth) fetchData();
  }, [selectedMonth]);

  useEffect(() => {
    if (!loading && selectedMonth) startAutoRefresh();
    return () => stopAutoRefresh();
  }, [loading, selectedMonth]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredData(leaderboardData);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = leaderboardData.filter(agent =>
        agent.name.toLowerCase().includes(query) ||
        agent.rank.toString().includes(query)
      );
      setFilteredData(filtered);
    }
  }, [searchQuery, leaderboardData]);

  const handleCommissionClick = (agent: AgentLeaderboardData) => {
    setExpandedAgentRank(expandedAgentRank === agent.name ? null : agent.name);
  };

  const handleEarnedClick = (agent: AgentLeaderboardData) => {
    setExpandedEarnedAgentRank(expandedEarnedAgentRank === agent.name ? null : agent.name);
  };

  const downloadCSV = () => {
    const headers = ['Rank', 'Agent Name', 'Sales', 'Above 10', 'Commission (£)', 'Earned (£)', 'Total Bonus (£)', 'Speed Bonus', '1st to 20 Winner', 'First to 20 Bonus Status'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(agent =>
        [
          agent.rank,
          `"${agent.name.replace(/"/g, '""')}"`,
          agent.sales,
          agent.above_10,
          agent.commission,
          agent.commissionEarned,
          agent.totalBonus,
          agent.speedBonus > 0 ? 'Yes' : 'No',
          agent.isFirstTo20Winner ? 'Yes' : 'No',
          agent.isFirstTo20Winner ? (isTeamBonusUnlocked ? 'Awarded' : 'Pending Unlock') : 'N/A'
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaderboard-${selectedMonth}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleFullscreen = () => {
    if (!leaderboardRef.current) return;
    if (!document.fullscreenElement) {
      leaderboardRef.current.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1d24] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-300 text-lg">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1a1d24] flex items-center justify-center p-4">
        <div className="bg-[#252932] border border-red-500 border-l-4 p-6 max-w-md w-full text-center rounded-lg shadow-lg">
          <h2 className="text-red-500 text-xl font-bold mb-2">Error</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button onClick={() => { setError(null); fetchData(); }} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg">Retry</button>
        </div>
      </div>
    );
  }

  const currentTotalSales = teamData?.totalSales || 0;
  const targetSales = teamData?.target || 100;
  
  const isTeamBonusUnlocked = currentTotalSales >= 100;
  const salesRemaining = Math.max(100 - currentTotalSales, 0);
  const progressPercent = Math.round((currentTotalSales / targetSales) * 100);

  const currentWeek = getCurrentWeekOfMonth();
  const weekTarget = getWeekTarget(currentWeek);
  const isOnPace = currentTotalSales >= weekTarget;

  const firstTo20Winner = bonusData?.firstTo20?.winner;
  const firstTo20Closest = bonusData?.firstTo20?.closestAgent;

  return (
    <div className="min-h-screen bg-[#1a1d24] text-white font-sans flex flex-col" ref={leaderboardRef}>
      {/* Custom CSS for animations */}
      <style>{`
        @keyframes checkmarkPop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.5), 0 0 10px rgba(34, 197, 94, 0.3); }
          50% { box-shadow: 0 0 10px rgba(34, 197, 94, 0.8), 0 0 20px rgba(34, 197, 94, 0.5); }
        }
        .earned-card {
          animation: checkmarkPop 0.3s ease-out forwards;
        }
        .earned-glow {
          animation: glow 2s ease-in-out infinite;
        }
        .shimmer-text {
          background: linear-gradient(90deg, #22c55e 0%, #86efac 50%, #22c55e 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 2s linear infinite;
        }
      `}</style>

      {/* Header */}
      <header className="border-b border-gray-800 bg-[#1a1d24] flex-shrink-0 sticky top-0 z-10">
        <div className="px-4 py-3 w-full">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg bg-[#252932] border border-gray-700">
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <img src="/logo.png" alt="Deal With IT Solutions" className="h-16 w-auto object-contain" onError={(e: any) => e.target.style.display = 'none'} />
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-xs text-gray-400">Updated: <span className="text-gray-300">{formatTimeAgo(lastRefreshTime)}</span></div>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:flex items-center justify-between mb-4">
            <div className="flex items-center">
              <img src="/logo.png" alt="Deal With IT Solutions" className="h-24 w-auto object-contain" onError={(e: any) => e.target.style.display = 'none'} />
            </div>
            <div className="flex flex-col items-center flex-1">
              <h1 className="text-xl font-bold text-white text-center mb-2">Team Overview</h1>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-[#252932] to-[#2d3139] rounded-lg p-1 border border-gray-700 shadow-xl min-w-[200px]">
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full bg-[#1a1d24] text-white border-none rounded-md px-3 py-1 text-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500">
                    {availableMonths.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                  </select>
                </div>
                <button onClick={() => setIncludeRollover(!includeRollover)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${includeRollover ? 'bg-orange-600/20 border-orange-500 text-orange-400' : 'bg-[#252932] border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                  <Calendar size={16} />
                  <span className="text-sm font-medium whitespace-nowrap">{includeRollover ? 'Rollover ON' : 'Show Rollover'}</span>
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 min-w-[120px]">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Updated: <span className="text-gray-300 font-medium">{formatTimeAgo(lastRefreshTime)}</span></span>
              </div>
              <div className="text-xs text-gray-400">Next refresh: <span className="text-blue-400 font-medium">{timeUntilRefresh}s</span></div>
            </div>
          </div>

          {/* Mobile Menu */}
          <div className={`lg:hidden ${mobileMenuOpen ? 'block' : 'hidden'} mb-4 space-y-3`}>
             <div className="bg-gradient-to-r from-[#252932] to-[#2d3139] rounded-lg p-1 border border-gray-700 shadow-xl">
               <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full bg-[#1a1d24] text-white border-none rounded-md px-3 py-2">
                 {availableMonths.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
               </select>
             </div>
          </div>

          {/* === METRICS GRID === */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* 1. Team Sales */}
            <div className="bg-[#252932] rounded-lg p-3 border-l-4 border-blue-500 shadow-inner">
              <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">Team Sales</div>
              <div className="text-xl font-bold text-white">
                {formatInteger(currentTotalSales)} <span className="text-sm text-gray-500 font-normal">/ {formatInteger(targetSales)}</span>
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${isTeamBonusUnlocked ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{progressPercent}% Complete</div>
              </div>
            </div>

            {/* 2. Week Status */}
            <div className={`bg-[#252932] rounded-lg p-3 border-l-4 shadow-inner ${isOnPace ? 'border-green-500' : 'border-orange-500'}`}>
              <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">Week-{currentWeek} Status</div>
              <div className={`text-lg font-bold flex items-center gap-2 ${isOnPace ? 'text-green-400' : 'text-orange-400'}`}>
                {isOnPace ? (
                  <>
                    <TrendingUp size={20} />
                    <span>ON PACE</span>
                  </>
                ) : (
                  <>
                    <TrendingDown size={20} />
                    <span>BELOW PACE</span>
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Target: {weekTarget}+ by Week {currentWeek}
              </div>
            </div>

            {/* 3. Bonus Unlock Status */}
            <div className={`bg-[#252932] rounded-lg p-3 border-l-4 shadow-inner ${isTeamBonusUnlocked ? 'border-green-500 bg-green-900/10' : 'border-yellow-500 bg-yellow-900/10'}`}>
              <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider flex items-center justify-between">
                <span>Bonus Status</span>
                {isTeamBonusUnlocked ? (
                  <Unlock size={14} className="text-green-500" />
                ) : (
                  <Lock size={14} className="text-yellow-500" />
                )}
              </div>
              
              {isTeamBonusUnlocked ? (
                <>
                  <div className="text-lg font-bold text-green-400 flex items-center gap-2">
                    <Trophy size={18} />
                    <span>UNLOCKED</span>
                  </div>
                  <div className="text-xs text-green-500 mt-1">
                    All bonuses active! 🎉
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg font-bold text-yellow-500 flex items-center gap-2">
                    <Lock size={18} />
                    <span>LOCKED</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Unlock at 100+ sales ({salesRemaining} to go)
                  </div>
                </>
              )}
            </div>

            {/* 4. First to 20 Race Status */}
            <div className={`bg-[#252932] rounded-lg p-3 border-l-4 shadow-inner 
              ${!isTeamBonusUnlocked ? 'border-gray-600' : (firstTo20Winner ? 'border-purple-500 bg-purple-900/10' : 'border-orange-500')}`}>
              
              <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider flex items-center justify-between">
                <span>First to 20 Race</span>
                {!isTeamBonusUnlocked ? (
                  <Lock size={14} className="text-gray-500" />
                ) : (
                  <Zap size={14} className={firstTo20Winner ? "text-purple-500" : "text-orange-500"} />
                )}
              </div>
              
              {!isTeamBonusUnlocked ? (
                <>
                  <div className="text-lg font-bold text-gray-500 flex items-center gap-2">
                    <Lock size={18} />
                    <span>PENDING</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {firstTo20Winner ? (
                      <span className="text-yellow-500">🏎️ {firstTo20Winner.name} waiting...</span>
                    ) : firstTo20Closest ? (
                      <span>Leader: {firstTo20Closest.name} ({firstTo20Closest.sales}/20)</span>
                    ) : (
                      <span>Awaiting team unlock</span>
                    )}
                  </div>
                </>
              ) : (
                firstTo20Winner ? (
                  <>
                    <div className="text-lg font-bold text-purple-400 flex items-center gap-2">
                      <Trophy size={18} />
                      <span>CLAIMED</span>
                    </div>
                    <div className="text-xs text-purple-400 mt-1 truncate">
                      🏆 Winner: {firstTo20Winner.name}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-bold text-orange-400 flex items-center gap-2">
                      <Zap size={18} />
                      <span>ACTIVE</span>
                    </div>
                    <div className="text-xs text-orange-400 mt-1 truncate">
                      {firstTo20Closest 
                        ? `🏎️ ${firstTo20Closest.name} leads (${firstTo20Closest.sales}/20)` 
                        : "Race is on!"}
                    </div>
                  </>
                )
              )}
            </div>
          </div>

          {/* Bonus Summary Bar - Only when UNLOCKED */}
          {isTeamBonusUnlocked && (
            <div className="mt-3 bg-gradient-to-r from-green-900/30 to-purple-900/30 rounded-lg p-3 border border-green-500/30">
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Trophy className="text-green-400" size={16} />
                  <span className="text-gray-400">Team Bonus Pool:</span>
                  <span className="text-green-400 font-bold">£1,500</span>
                </div>
                <div className="w-px h-4 bg-gray-600 hidden sm:block"></div>
                <div className="flex items-center gap-2">
                  <Zap className="text-purple-400" size={16} />
                  <span className="text-gray-400">First to 20:</span>
                  <span className="text-purple-400 font-bold">£1,000</span>
                  {firstTo20Winner && (
                    <span className="text-purple-300">→ {firstTo20Winner.name}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-4 py-3">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 flex-shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">🏆 Agent Leaderboard</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Search agents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#2d3139] text-white border border-gray-700 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
            <div className="flex items-center gap-2">
               <button onClick={handleManualRefresh} className="p-2 bg-[#2d3139] hover:bg-gray-700 rounded-lg shadow-sm" title="Refresh">
                 <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
               </button>
               <button onClick={downloadCSV} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm">
                 <Download size={16} /><span className="hidden sm:inline">Download</span>
               </button>
               <button onClick={toggleFullscreen} className="p-2 bg-[#2d3139] hover:bg-gray-700 rounded-lg shadow-sm">
                 {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
               </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 bg-[#252932] rounded-lg shadow-lg border border-gray-800 overflow-hidden" style={{ fontSize: `${zoomLevel}%` }}>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 gap-4 px-4 py-3 bg-[#2d3139] text-gray-300 font-semibold border-b border-gray-700">
                <div className="text-sm">Rank</div>
                <div className="text-sm">Agent Name</div>
                <div className="text-sm">Sales</div>
                <div className="text-sm">Above 10</div>
                <div className="text-sm">Commission (£)</div>
                <div className="text-sm">Earned (£)</div>
                <div className="text-sm">
                  Bonus (£)
                  {!isTeamBonusUnlocked && (
                    <Lock size={12} className="inline ml-1 text-yellow-500" title="Some bonuses pending unlock" />
                  )}
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {filteredData.length > 0 ? (
                  <div>
                    {filteredData.map((agent) => (
                      <React.Fragment key={agent.rank}>
                        <div className={`grid grid-cols-7 gap-4 px-4 py-3 border-b border-gray-800 hover:bg-[#2d3139] transition-colors duration-150 items-center 
                          ${agent.isFirstTo20Winner && isTeamBonusUnlocked ? 'bg-purple-900/10' : ''}
                          ${agent.isFirstTo20Winner && !isTeamBonusUnlocked ? 'bg-yellow-900/5' : ''}
                          ${!agent.isFirstTo20Winner ? 'bg-[#252932]' : ''}`}>
                          
                          <div className="font-semibold text-blue-400 text-base flex items-center gap-2">
                            {agent.rank === 1 ? '1 🥇' : agent.rank === 2 ? '2 🥈' : agent.rank === 3 ? '3 🥉' : agent.rank}
                            {agent.isFirstTo20Winner && (
                              <span 
                                title={isTeamBonusUnlocked ? "First to 20 Winner - £1,000 Awarded!" : "First to 20 - Pending Team Unlock"}
                                className="cursor-help"
                              >
                                {isTeamBonusUnlocked ? '🏎️' : '🔒'}
                              </span>
                            )}
                            {!agent.isFirstTo20Winner && agent.isSpeedBonusWinner && (
                              <span title="Speed Bonus Winner">⚡</span>
                            )}
                          </div>
                          
                          <div className="font-medium truncate text-base" title={agent.name}>
                            {agent.name}
                            {agent.isFirstTo20Winner && !isTeamBonusUnlocked && (
                              <span className="ml-2 text-xs text-yellow-500">(1st to 20)</span>
                            )}
                          </div>
                          <div className="text-base">{agent.sales}</div>
                          <div className="text-green-400 text-base">{agent.above_10}</div>
                          
                          {/* Commission Column with Earned Indicator */}
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleCommissionClick(agent)} className="text-blue-400 hover:text-blue-300 transition duration-150 text-base font-medium">
                              {formatCurrency(agent.commission)}
                            </button>
                            {/* Show mini checkmark if any commission is earned */}
                            {getValidEarnedDetails(agent).length > 0 && (
                              <div className="flex items-center gap-1">
                                <EarnedCheckmark size="sm" />
                                <span className="text-xs text-green-400">{getValidEarnedDetails(agent).length}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Earned Column */}
                          <div>
                            <button onClick={() => handleEarnedClick(agent)} className="text-green-500 hover:text-green-400 transition duration-150 text-base font-semibold flex items-center gap-2">
                              {agent.commissionEarned > 0 && <EarnedCheckmark size="sm" />}
                              <span className={agent.commissionEarned > 0 ? 'shimmer-text' : ''}>
                                {formatCurrency(agent.commissionEarned)}
                              </span>
                            </button>
                          </div>
                          
                          {/* Bonus Column */}
                          <div className="font-medium text-base">
                            {agent.totalBonus > 0 ? (
                              <span className={`
                                ${agent.isFirstTo20Winner && isTeamBonusUnlocked ? 'text-purple-400 font-bold' : 'text-yellow-400'}
                              `}>
                                {formatCurrency(agent.totalBonus)}
                              </span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                            
                            {agent.isFirstTo20Winner && !isTeamBonusUnlocked && (
                              <div className="text-xs text-yellow-500 mt-0.5 flex items-center gap-1">
                                <Lock size={10} />
                                <span>+£1,000 pending</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ✅ ENHANCED Commission Breakdown Dropdown with Earned Checkmarks */}
                        {expandedAgentRank === agent.name && (
                          <div className="bg-[#2d3139] border-t border-gray-700 px-4 py-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="text-sm font-semibold text-blue-400">Commission Breakdown</div>
                                {/* Legend */}
                                <div className="flex items-center gap-4 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <EarnedCheckmark size="sm" />
                                    <span className="text-green-400">Earned</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <PendingIndicator size="sm" />
                                    <span className="text-gray-400">Pending</span>
                                  </div>
                                </div>
                              </div>
                              {includeRollover && agent.commissionPropertyPairs?.some(p => (p as RolloverCommission).isRollover) && (
                                <div className="flex items-center gap-2 text-xs text-orange-400">
                                  <Clock size={12} />
                                  <span>Includes Rollover Items</span>
                                </div>
                              )}
                            </div>

                            {/* Stats Summary */}
                            <div className="flex items-center gap-4 mb-4 p-3 bg-[#252932] rounded-lg border border-gray-700">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                  <span className="text-blue-400 font-bold text-sm">{getValidCommissionPairs(agent).length}</span>
                                </div>
                                <div className="text-xs text-gray-400">Total Properties</div>
                              </div>
                              <div className="w-px h-8 bg-gray-700"></div>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                  <span className="text-green-400 font-bold text-sm">{getValidEarnedDetails(agent).length}</span>
                                </div>
                                <div className="text-xs text-gray-400">Earned</div>
                              </div>
                              <div className="w-px h-8 bg-gray-700"></div>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
                                  <span className="text-gray-400 font-bold text-sm">
                                    {getValidCommissionPairs(agent).length - getValidEarnedDetails(agent).length}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-400">Pending</div>
                              </div>
                            </div>

                            {getValidCommissionPairs(agent).length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {getValidCommissionPairs(agent)
                                  .filter(pair => includeRollover || !(pair as RolloverCommission).isRollover)
                                  .map((pair, idx) => {
                                    const isRollover = (pair as RolloverCommission).isRollover;
                                    const isEarned = isPropertyEarned(agent, pair.propertyCode);
                                    const earnedAmount = getEarnedAmount(agent, pair.propertyCode);
                                    
                                    return (
                                      <div 
                                        key={idx} 
                                        className={`
                                          relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-300
                                          ${isEarned 
                                            ? 'border-green-500 bg-gradient-to-br from-green-900/30 to-emerald-900/20 earned-card earned-glow' 
                                            : isRollover 
                                              ? 'border-orange-500/50 bg-orange-900/10' 
                                              : 'border-gray-700 bg-[#252932] hover:border-gray-600'
                                          }
                                        `}
                                      >
                                        {/* Status Badge - Top Right */}
                                        <div className="absolute -top-2 -right-2">
                                          {isEarned ? (
                                            <div className="relative">
                                              <div className="absolute inset-0 bg-green-500 rounded-full blur-md opacity-50"></div>
                                              <div className="relative bg-gradient-to-br from-green-400 to-emerald-600 rounded-full p-1.5 shadow-lg shadow-green-500/50">
                                                <Check className="text-white" size={14} strokeWidth={3} />
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="bg-gray-700 rounded-full p-1.5 border border-gray-600">
                                              <Clock className="text-gray-400" size={12} />
                                            </div>
                                          )}
                                        </div>

                                        {/* Index Number */}
                                        <div className={`
                                          w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0
                                          ${isEarned 
                                            ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                                            : isRollover 
                                              ? 'bg-gradient-to-br from-orange-500 to-amber-600' 
                                              : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                          }
                                        `}>
                                          {idx + 1}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <div className={`text-sm font-semibold truncate ${isEarned ? 'text-green-300' : 'text-gray-300'}`}>
                                              {pair.propertyCode || '—'}
                                            </div>
                                            {isRollover && (
                                              <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] rounded font-medium">
                                                ROLLOVER
                                              </span>
                                            )}
                                          </div>
                                          
                                          {/* Commission Amount */}
                                          <div className={`text-lg font-bold ${isEarned ? 'text-green-400' : isRollover ? 'text-orange-400' : 'text-blue-400'}`}>
                                            {formatCurrency(pair.commissionValue)}
                                          </div>

                                          {/* Earned Status Text */}
                                          <div className={`text-xs mt-1 font-medium ${isEarned ? 'text-green-500' : 'text-gray-500'}`}>
                                            {isEarned ? (
                                              <span className="flex items-center gap-1">
                                                <CheckCircle2 size={12} />
                                                Paid Out
                                              </span>
                                            ) : (
                                              <span className="flex items-center gap-1">
                                                <Clock size={12} />
                                                Awaiting Payment
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-gray-400">
                                <Circle className="mx-auto mb-2 text-gray-600" size={32} />
                                No commission data available
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Earned Breakdown Dropdown */}
                        {expandedEarnedAgentRank === agent.name && (
                          <div className="bg-[#2d3139] border-t border-gray-700 px-4 py-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="text-sm font-semibold text-green-400 flex items-center gap-2">
                                <CheckCircle2 className="text-green-500" size={18} />
                                Earned Breakdown
                              </div>
                              <div className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                                {getValidEarnedDetails(agent).length} Properties Paid
                              </div>
                            </div>
                            
                            {getValidEarnedDetails(agent).length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {getValidEarnedDetails(agent).map((detail, idx) => (
                                  <div 
                                    key={idx} 
                                    className="relative flex items-center gap-3 p-4 rounded-xl border-2 border-green-500 bg-gradient-to-br from-green-900/30 to-emerald-900/20 earned-card"
                                  >
                                    {/* Checkmark Badge */}
                                    <div className="absolute -top-2 -right-2">
                                      <div className="relative">
                                        <div className="absolute inset-0 bg-green-500 rounded-full blur-md opacity-60 animate-pulse"></div>
                                        <div className="relative bg-gradient-to-br from-green-400 to-emerald-600 rounded-full p-1.5 shadow-lg shadow-green-500/50">
                                          <Check className="text-white" size={14} strokeWidth={3} />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-lg shadow-green-500/30">
                                      {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-sm font-semibold text-green-300">{detail.propertyCode}</div>
                                      <div className="text-lg font-bold shimmer-text">{formatCurrency(detail.commission)}</div>
                                      <div className="text-xs text-green-500 mt-0.5 flex items-center gap-1">
                                        <CheckCircle2 size={10} />
                                        <span>Successfully Paid</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-gray-400">
                                <Circle className="mx-auto mb-2 text-gray-600" size={32} />
                                No earned data available yet
                              </div>
                            )}

                            {/* Total Earned Summary */}
                            {getValidEarnedDetails(agent).length > 0 && (
                              <div className="mt-4 p-4 bg-gradient-to-r from-green-900/40 to-emerald-900/40 rounded-xl border border-green-500/30">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                                      <Trophy className="text-white" size={20} />
                                    </div>
                                    <div>
                                      <div className="text-xs text-green-400 uppercase tracking-wider font-medium">Total Earned</div>
                                      <div className="text-2xl font-bold shimmer-text">{formatCurrency(agent.commissionEarned)}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <EarnedCheckmark size="lg" />
                                    <span className="text-green-400 font-medium">Verified</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-gray-500 text-base">No data available for {formatMonthName(selectedMonth)}.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        {leaderboardData.length > 0 && (
          <div className="mt-4 flex-shrink-0 space-y-2">
            
            {!isTeamBonusUnlocked && (
              <div className="bg-yellow-900/20 border-l-4 border-yellow-500 rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Lock className="text-yellow-500 flex-shrink-0 mt-0.5" size={18} />
                  <div className="flex-1">
                    <div className="font-semibold text-yellow-400 text-sm uppercase tracking-wider">Bonuses Locked</div>
                    <div className="text-sm text-gray-300 mt-1">
                      Team sales: <strong>{currentTotalSales}/{targetSales}</strong>. 
                      Need <strong>{salesRemaining} more sales</strong> to unlock all bonus pools.
                    </div>
                    {firstTo20Winner && (
                      <div className="text-sm text-orange-400 mt-2">
                        🏎️ <strong>{firstTo20Winner.name}</strong> has reached 20 sales and is waiting for team unlock to claim First to 20 bonus.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isOnPace && !isTeamBonusUnlocked && (
              <div className="bg-orange-900/20 border-l-4 border-orange-500 rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <TrendingDown className="text-orange-500 flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <div className="font-semibold text-orange-400 text-sm uppercase tracking-wider">Below Weekly Pace</div>
                    <div className="text-sm text-gray-300 mt-1">
                      Week {currentWeek} target is <strong>{weekTarget} sales</strong>. 
                      Currently at <strong>{currentTotalSales}</strong> ({weekTarget - currentTotalSales} behind pace).
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isTeamBonusUnlocked && (
              <div className="bg-green-900/20 border-l-4 border-green-500 rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Trophy className="text-green-500 flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <div className="font-semibold text-green-400 text-sm uppercase tracking-wider">🎉 All Bonuses Unlocked!</div>
                    <div className="text-sm text-gray-300 mt-1">
                      Congratulations! Team achieved <strong>{currentTotalSales} sales</strong>. 
                      All bonus pools are now active and distributed!
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default DWITSDashboard;