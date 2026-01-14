import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lock, Unlock, AlertCircle, ChevronDown, Search, Download,
  ZoomIn, ZoomOut, Eye, EyeOff, Maximize2, Minimize2, Menu, X, Check, RefreshCw,
  ArrowLeftRight, Clock, Calendar
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
  bonus: number;
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

interface ApiDashboardResponse {
  leaderboard: any[];
  team: TeamPerformanceData;
}

const DWITSDashboard: React.FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<AgentLeaderboardData[]>([]);
  const [filteredData, setFilteredData] = useState<AgentLeaderboardData[]>([]);
  const [teamData, setTeamData] = useState<TeamPerformanceData | null>(null);
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expandedAgentRank, setExpandedAgentRank] = useState<string | null>(null);
  const [expandedEarnedAgentRank, setExpandedEarnedAgentRank] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Rollover state
  const [includeRollover, setIncludeRollover] = useState(false);
  const [rolloverData, setRolloverData] = useState<Map<string, RolloverCommission[]>>(new Map());
  const [rolloverLoading, setRolloverLoading] = useState(false);
  const [rolloverSourceMonth, setRolloverSourceMonth] = useState<string>('');

  // Auto-refresh state (enabled by default with 30 seconds)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(30);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const leaderboardRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const REFRESH_INTERVAL = 30; // 30 seconds

  // Helper Functions
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
    } catch (e) {
      console.error("Error formatting month:", e);
      return monthStr;
    }
  };

  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Get previous month in YYYY-MM format
  const getPreviousMonth = (monthStr: string): string => {
    if (!monthStr) return '';
    try {
      const [year, month] = monthStr.split('-').map(Number);
      const date = new Date(year, month - 2, 1); // month is 0-indexed, so month-2 for previous
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } catch (e) {
      console.error("Error calculating previous month:", e);
      return '';
    }
  };

  // Get incomplete commissions (not in earnedDetails) for an agent
  const getIncompleteCommissions = useCallback((agent: AgentLeaderboardData): CommissionPropertyPair[] => {
    const validPairs = agent.commissionPropertyPairs?.filter(pair => {
      if (!pair) return false;
      const commValue = pair.commissionValue;
      if (commValue === null || commValue === undefined || commValue === '' || commValue === 'null') return false;
      const numValue = parseFloat(commValue);
      return !isNaN(numValue) && numValue !== 0;
    }) || [];

    const earnedPropertyCodes = new Set(
      (agent.earnedDetails || []).map(d => d.propertyCode?.trim().toLowerCase()).filter(Boolean)
    );

    return validPairs.filter(pair => {
      const normalizedCode = pair.propertyCode?.trim().toLowerCase();
      return normalizedCode && !earnedPropertyCodes.has(normalizedCode);
    });
  }, []);

  // Fetch rollover data from previous month
  const fetchRolloverData = useCallback(async (previousMonthStr: string): Promise<void> => {
    if (!previousMonthStr) {
      setRolloverData(new Map());
      return;
    }

    setRolloverLoading(true);
    try {
      const response = await fetch('/api/dashboard-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: previousMonthStr })
      });

      if (!response.ok) {
        console.warn(`No data available for previous month: ${previousMonthStr}`);
        setRolloverData(new Map());
        return;
      }

      const data: ApiDashboardResponse = await response.json();
      const monthLabel = formatMonthName(previousMonthStr);
      const newRolloverData = new Map<string, RolloverCommission[]>();

      data.leaderboard.forEach((agent) => {
        const agentName = String(agent['Agent Name'] || agent.name || 'Unknown Agent').trim();

        // Parse commission pairs
        let commissionPropertyPairs: CommissionPropertyPair[] = [];
        const rawCommissionData = agent['commission_property_pair'];
        if (rawCommissionData && typeof rawCommissionData === 'string') {
          try {
            let cleanString = rawCommissionData.replace(/\\"/g, '"');
            const parsed = JSON.parse(cleanString);
            if (Array.isArray(parsed)) commissionPropertyPairs = parsed;
          } catch (e) {
            console.error("Error parsing rollover commission_property_pair:", e);
          }
        } else if (Array.isArray(rawCommissionData)) {
          commissionPropertyPairs = rawCommissionData;
        }

        // Parse earned details
        const earnedDetails = (agent.earnedDetails || []).filter((d: any) =>
          d && d.propertyCode && d.commission !== null && d.commission !== undefined
        );

        // Get earned property codes
        const earnedCodes = new Set(
          earnedDetails.map((d: any) => d.propertyCode?.trim().toLowerCase()).filter(Boolean)
        );

        // Filter for incomplete commissions (not earned)
        const incompleteCommissions: RolloverCommission[] = commissionPropertyPairs
          .filter(pair => {
            if (!pair) return false;
            const commValue = pair.commissionValue;
            if (commValue === null || commValue === undefined || commValue === '' || commValue === 'null') return false;
            const numValue = parseFloat(commValue);
            if (isNaN(numValue) || numValue === 0) return false;

            const normalizedCode = pair.propertyCode?.trim().toLowerCase();
            return normalizedCode && !earnedCodes.has(normalizedCode);
          })
          .map(pair => ({
            ...pair,
            isRollover: true,
            sourceMonth: previousMonthStr,
            sourceMonthLabel: monthLabel
          }));

        if (incompleteCommissions.length > 0) {
          newRolloverData.set(agentName.toLowerCase(), incompleteCommissions);
        }
      });

      setRolloverData(newRolloverData);
      setRolloverSourceMonth(previousMonthStr);
    } catch (error) {
      console.error("Error fetching rollover data:", error);
      setRolloverData(new Map());
    } finally {
      setRolloverLoading(false);
    }
  }, []);

  // API Fetching Functions
  const fetchAvailableMonths = async () => {
    try {
      const response = await fetch('/api/available-months');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      if (Array.isArray(data.months)) {
        setAvailableMonths(data.months);
        if (data.months.length > 0) {
          setSelectedMonth(data.months[0].value);
        } else {
          const currentMonth = new Date().toISOString().slice(0, 7);
          setSelectedMonth(currentMonth);
          setAvailableMonths([{ value: currentMonth, label: formatMonthName(currentMonth) }]);
        }
      } else {
        console.error("Unexpected data format for available months:", data);
        const currentMonth = new Date().toISOString().slice(0, 7);
        setSelectedMonth(currentMonth);
        setAvailableMonths([{ value: currentMonth, label: formatMonthName(currentMonth) }]);
      }
    } catch (error: any) {
      console.error("Error fetching available months:", error);
      const currentMonth = new Date().toISOString().slice(0, 7);
      setSelectedMonth(currentMonth);
      setAvailableMonths([{ value: currentMonth, label: formatMonthName(currentMonth) }]);
    }
  };

  const fetchData = async (isAutoRefresh = false) => {
    if (isAutoRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
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

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorData.error || errorMsg;
        } catch (jsonError) { }
        throw new Error(errorMsg);
      }

      const data: ApiDashboardResponse = await response.json();

      const processedData: AgentLeaderboardData[] = data.leaderboard
        .map((agent) => {
          const commission = parseFloat(agent['Commission (£)'] || agent.commission) || 0;
          const bonus = parseFloat(agent['Bonus (£)'] || agent.bonus) || 0;
          const sales = parseInt(agent['Sales'] || agent.sales) || 0;
          const above_10 = parseInt(agent['Above 10'] || agent.above_10) || 0;
          const commissionEarned = parseFloat(agent.commissionEarned) || 0;

          let commissionPropertyPairs: CommissionPropertyPair[] = [];
          try {
            const rawCommissionData = agent['commission_property_pair'];
            if (rawCommissionData && typeof rawCommissionData === 'string') {
              let cleanString = rawCommissionData;
              if (cleanString.includes('\\"')) {
                cleanString = cleanString.replace(/\\"/g, '"');
              }
              try {
                const parsed = JSON.parse(cleanString);
                if (Array.isArray(parsed)) commissionPropertyPairs = parsed;
              } catch (parseError) {
                console.error("Error parsing commission_property_pair:", parseError, rawCommissionData);
                commissionPropertyPairs = [];
              }
            } else if (Array.isArray(rawCommissionData)) {
              commissionPropertyPairs = rawCommissionData;
            }
          } catch (error) {
            console.error("Unexpected error processing commission_property_pair:", error);
            commissionPropertyPairs = [];
          }

          // Process earned details
          let earnedDetails: EarnedDetail[] = [];
          try {
            if (agent.earnedDetails && Array.isArray(agent.earnedDetails)) {
              earnedDetails = agent.earnedDetails.filter((detail: any) =>
                detail && detail.propertyCode && detail.commission !== null && detail.commission !== undefined
              );
            }
          } catch (error) {
            console.error("Error processing earnedDetails:", error);
            earnedDetails = [];
          }

          // Get agent name - handle null/undefined/empty
          const agentName = agent['Agent Name'] || agent.name || '';
          const displayName = agentName.trim() !== '' ? agentName : 'Unknown Agent';

          return {
            rank: parseInt(agent['Rank'] || agent.rank) || 0,
            name: String(displayName),
            sales, above_10, commission, bonus,
            toEarn: Math.max(500 - commission, 0),
            totalEarnings: commission + bonus,
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

  // Auto-refresh management
  const startAutoRefresh = () => {
    // Clear any existing intervals
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Set initial countdown
    setTimeUntilRefresh(REFRESH_INTERVAL);

    // Start countdown timer (updates every second)
    countdownIntervalRef.current = setInterval(() => {
      setTimeUntilRefresh(prev => {
        if (prev <= 1) {
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    // Start refresh interval
    refreshIntervalRef.current = setInterval(() => {
      fetchData(true);
    }, REFRESH_INTERVAL * 1000);
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const handleManualRefresh = () => {
    fetchData(false);
    // Reset the auto-refresh timer
    stopAutoRefresh();
    startAutoRefresh();
  };

  // Effects
  useEffect(() => {
    fetchAvailableMonths();

    // Cleanup on unmount
    return () => {
      stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      fetchData();
    }
  }, [selectedMonth]);

  // Start auto-refresh after initial load
  useEffect(() => {
    if (!loading && selectedMonth) {
      startAutoRefresh();
    }

    return () => {
      stopAutoRefresh();
    };
  }, [loading, selectedMonth]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredData(leaderboardData);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = leaderboardData.filter(agent =>
        agent.name.toLowerCase().includes(query) ||
        agent.rank.toString().includes(query) ||
        agent.sales.toString().includes(query)
      );
      setFilteredData(filtered);
    }
  }, [searchQuery, leaderboardData]);

  // Handle rollover toggle
  useEffect(() => {
    if (includeRollover && selectedMonth) {
      const previousMonth = getPreviousMonth(selectedMonth);
      if (previousMonth && availableMonths.some(m => m.value === previousMonth)) {
        fetchRolloverData(previousMonth);
      } else {
        setRolloverData(new Map());
        setRolloverSourceMonth('');
      }
    } else {
      setRolloverData(new Map());
      setRolloverSourceMonth('');
    }
  }, [includeRollover, selectedMonth, availableMonths, fetchRolloverData]);


  // Event Handlers
  // Event Handlers
  const handleCommissionClick = (agent: AgentLeaderboardData) => {
    setExpandedAgentRank(expandedAgentRank === agent.name ? null : agent.name);
  };

  const handleEarnedClick = (agent: AgentLeaderboardData) => {
    setExpandedEarnedAgentRank(expandedEarnedAgentRank === agent.name ? null : agent.name);
  };

  const getValidCommissionPairs = (agent: AgentLeaderboardData): CommissionPropertyPair[] => {
    if (!agent.commissionPropertyPairs || !Array.isArray(agent.commissionPropertyPairs)) return [];
    return agent.commissionPropertyPairs.filter(pair => {
      if (!pair) return false;
      const commValue = pair.commissionValue;
      if (commValue === null || commValue === undefined || commValue === '' || commValue === 'null') return false;
      const numValue = parseFloat(commValue);
      return !isNaN(numValue) && numValue !== 0;
    });
  };

  const getValidEarnedDetails = (agent: AgentLeaderboardData): EarnedDetail[] => {
    if (!agent.earnedDetails || !Array.isArray(agent.earnedDetails)) return [];
    return agent.earnedDetails.filter(detail =>
      detail && detail.commission !== null && detail.commission !== undefined && detail.commission !== 0
    );
  };

  // Check if a property code has been earned
  const isPropertyEarned = (agent: AgentLeaderboardData, propertyCode: string | null): boolean => {
    if (!propertyCode || !agent.earnedDetails || !Array.isArray(agent.earnedDetails)) return false;

    // Normalize property codes for comparison (trim whitespace and convert to lowercase)
    const normalizedPropertyCode = propertyCode.trim().toLowerCase();

    return agent.earnedDetails.some(detail =>
      detail.propertyCode &&
      detail.propertyCode.trim().toLowerCase() === normalizedPropertyCode
    );
  };

  const calculateTotalFromPairs = (agent: AgentLeaderboardData): number => {
    const validPairs = getValidCommissionPairs(agent);
    return validPairs.reduce((total, pair) => {
      const value = parseFloat(pair.commissionValue || '0');
      return total + (isNaN(value) ? 0 : value);
    }, 0);
  };

  const downloadCSV = () => {
    const headers = ['Rank', 'Agent Name', 'Sales', 'Above 10', 'Commission (£)', 'Earned (£)', 'Bonus (£)'];
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
          agent.bonus
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

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 70));
  const resetZoom = () => setZoomLevel(100);

  const toggleFullscreen = () => {
    if (!leaderboardRef.current) return;
    if (!document.fullscreenElement) {
      leaderboardRef.current.requestFullscreen().catch(err => console.error("Fullscreen request failed:", err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleColumn = (column: string) => {
    setHiddenColumns(prev =>
      prev.includes(column) ? prev.filter(col => col !== column) : [...prev, column]
    );
  };

  const getAgentsBelowPace = () => {
    return leaderboardData.filter(agent => agent.sales < 10);
  };

  // Render Logic
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
          <h2 className="text-red-500 text-xl font-bold mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => { setError(null); fetchData(); }}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isOnTrack = (teamData?.totalSales || 0) >= 90;
  const isUnlocked = (teamData?.totalSales || 0) >= 100;
  const agentsBelowPace = getAgentsBelowPace();

  return (
    <div className="min-h-screen bg-[#1a1d24] text-white font-sans flex flex-col" ref={leaderboardRef}>
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#1a1d24] flex-shrink-0 sticky top-0 z-10">
        <div className="px-4 py-3 w-full">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg bg-[#252932] border border-gray-700"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <img
                src="/logo.png"
                alt="Deal With IT Solutions"
                className="h-16 w-auto object-contain"
                onError={(e: any) => {
                  e.target.style.display = 'none';
                  console.warn("Logo image failed to load.");
                }}
              />
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-xs text-gray-400">
                Updated: <span className="text-gray-300">{formatTimeAgo(lastRefreshTime)}</span>
              </div>
              <div className="text-xs text-gray-400">
                Next: <span className="text-blue-400">{timeUntilRefresh}s</span>
              </div>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:flex items-center justify-between mb-4">
            {/* Logo on far left */}
            <div className="flex items-center">
              <img
                src="/logo.png"
                alt="Deal With IT Solutions"
                className="h-24 w-auto object-contain"
                onError={(e: any) => {
                  e.target.style.display = 'none';
                  console.warn("Logo image failed to load.");
                }}
              />
            </div>

            {/* Title and Month Selector centered */}
            <div className="flex flex-col items-center flex-1">
              <h1 className="text-xl font-bold text-white text-center mb-2">
                Team Overview
              </h1>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-[#252932] to-[#2d3139] rounded-lg p-1 border border-gray-700 shadow-xl min-w-[200px]">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full bg-[#1a1d24] text-white border-none rounded-md px-3 py-1 text-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
                  >
                    {availableMonths.map((month) => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                </div>

                {/* Rollover Toggle */}
                <button
                  onClick={() => setIncludeRollover(!includeRollover)}
                  disabled={rolloverLoading}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${includeRollover
                    ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                    : 'bg-[#252932] border-gray-700 text-gray-400 hover:border-gray-500'
                    } ${rolloverLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:shadow-lg'}`}
                  title="Include incomplete commissions from previous month"
                >
                  {rolloverLoading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Calendar size={16} />
                  )}
                  <span className="text-sm font-medium whitespace-nowrap">
                    {includeRollover ? 'Rollover ON' : 'Include Rollover'}
                  </span>
                  {includeRollover && rolloverSourceMonth && (
                    <span className="text-xs bg-orange-500/30 px-2 py-0.5 rounded-full">
                      +{formatMonthName(rolloverSourceMonth).split(' ')[0]}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Auto-refresh info on far right */}
            <div className="flex flex-col items-end gap-1 min-w-[120px]">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Updated: <span className="text-gray-300 font-medium">{formatTimeAgo(lastRefreshTime)}</span></span>
              </div>
              <div className="text-xs text-gray-400">
                Next refresh: <span className="text-blue-400 font-medium">{timeUntilRefresh}s</span>
              </div>
            </div>
          </div>

          {/* Mobile Month Selector */}
          <div className={`lg:hidden ${mobileMenuOpen ? 'block' : 'hidden'} mb-4 space-y-3`}>
            <div className="bg-gradient-to-r from-[#252932] to-[#2d3139] rounded-lg p-1 border border-gray-700 shadow-xl">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-[#1a1d24] text-white border-none rounded-md px-3 py-2 text-base cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
              >
                {availableMonths.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>

            {/* Mobile Rollover Toggle */}
            <button
              onClick={() => setIncludeRollover(!includeRollover)}
              disabled={rolloverLoading}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${includeRollover
                ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                : 'bg-[#252932] border-gray-700 text-gray-400'
                } ${rolloverLoading ? 'opacity-50 cursor-wait' : ''}`}
            >
              {rolloverLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Calendar size={16} />
              )}
              <span className="text-sm font-medium">
                {includeRollover ? 'Rollover ON' : 'Include Previous Month'}
              </span>
              {includeRollover && rolloverSourceMonth && (
                <span className="text-xs bg-orange-500/30 px-2 py-0.5 rounded-full">
                  +{formatMonthName(rolloverSourceMonth).split(' ')[0]}
                </span>
              )}
            </button>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#252932] rounded-lg p-3 border-l-4 border-blue-500 shadow-inner">
              <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">Team Sales</div>
              <div className="text-lg font-bold">
                {formatInteger(teamData?.totalSales || 0)} <span className="text-sm text-gray-500 font-normal">/ {formatInteger(teamData?.target || 100)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(((teamData?.totalSales || 0) / (teamData?.target || 100) * 100))}% Complete
              </div>
            </div>

            <div className="bg-[#252932] rounded-lg p-3 border-l-4 border-yellow-500 shadow-inner">
              <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">Week-3 Status</div>
              <div className={`inline-flex items-center gap-1 text-base font-bold ${isOnTrack ? 'text-green-500' : 'text-red-500'}`}>
                {isOnTrack ? '✓ ON TRACK' : '⚠ BELOW PACE'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Target: 90+ by Week 3
              </div>
            </div>

            <div className="bg-[#252932] rounded-lg p-3 border-l-4 border-purple-500 shadow-inner">
              <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">Unlock Status</div>
              <div className="flex items-center gap-1 mb-1">
                {isUnlocked ? (
                  <>
                    <Unlock className="text-green-500" size={16} />
                    <span className="text-base font-bold text-green-500">Unlocked</span>
                  </>
                ) : (
                  <>
                    <Lock className="text-yellow-500" size={16} />
                    <span className="text-base font-bold text-yellow-500">Locked</span>
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500">
                Unlock at 100+ sales
              </div>
            </div>

            <div className="bg-[#252932] rounded-lg p-3 border-l-4 border-green-500 shadow-inner">
              <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">Total Sales &gt; 10</div>
              <div className="text-lg font-bold">{teamData?.totalSalesAbove10 || 0}</div>
              <div className="text-xs text-gray-500 mt-1">
                High-value deals
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-4 py-3">
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 flex-shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">🏆 Agent Leaderboard</h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#2d3139] text-white border border-gray-700 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>

            {/* Control Buttons */}
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-[#2d3139] rounded-lg p-1 text-sm shadow-sm">
                <button onClick={handleZoomOut} className="p-2 hover:bg-gray-700 rounded-lg transition-colors" title="Zoom Out">
                  <ZoomOut size={16} />
                </button>
                <span className="px-2 font-medium text-sm min-w-[45px] text-center">{zoomLevel}%</span>
                <button onClick={handleZoomIn} className="p-2 hover:bg-gray-700 rounded-lg transition-colors" title="Zoom In">
                  <ZoomIn size={16} />
                </button>
              </div>

              {/* Manual Refresh */}
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className={`p-2 bg-[#2d3139] hover:bg-gray-700 rounded-lg shadow-sm transition duration-200 ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Manual Refresh"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>

              {/* Download & Fullscreen */}
              <button
                onClick={downloadCSV}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm shadow-sm transition duration-200"
                title="Download CSV"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Download</span>
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-[#2d3139] hover:bg-gray-700 rounded-lg shadow-sm transition duration-200"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 bg-[#252932] rounded-lg shadow-lg border border-gray-800 overflow-hidden" style={{ fontSize: `${zoomLevel}%` }}>
          {/* Table - Horizontal scroll on mobile */}
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Table Header */}
              <div className="grid grid-cols-7 gap-4 px-4 py-3 bg-[#2d3139] text-gray-300 font-semibold border-b border-gray-700">
                <div className="text-sm">Rank</div>
                <div className="text-sm">Agent Name</div>
                <div className="text-sm">Sales</div>
                <div className="text-sm">Above 10</div>
                <div className="text-sm">Commission (£)</div>
                <div className="text-sm">Earned (£)</div>
                <div className="text-sm">Bonus (£)</div>
              </div>

              {/* Table Body */}
              <div className="max-h-[60vh] overflow-y-auto">
                {filteredData.length > 0 ? (
                  <div>
                    {filteredData.map((agent) => (
                      <React.Fragment key={agent.rank}>
                        {/* Agent Row */}
                        <div className="grid grid-cols-7 gap-4 px-4 py-3 border-b border-gray-800 bg-[#252932] hover:bg-[#2d3139] transition-colors duration-150 items-center">
                          <div className="font-semibold text-blue-400 text-base">
                            {agent.rank === 1 ? '1 🥇' : agent.rank === 2 ? '2 🥈' : agent.rank === 3 ? '3 🥉' : agent.rank}
                          </div>
                          <div className="font-medium truncate text-base" title={agent.name}>{agent.name}</div>
                          <div className="text-base">{agent.sales}</div>
                          <div className="text-green-400 text-base">{agent.above_10}</div>
                          <div>
                            <button
                              onClick={() => handleCommissionClick(agent)}
                              className="text-blue-400 hover:text-blue-300 transition duration-150 text-base font-medium"
                            >
                              {formatCurrency(agent.commission)}
                            </button>
                          </div>
                          <div>
                            <button
                              onClick={() => handleEarnedClick(agent)}
                              className="text-green-500 hover:text-green-400 transition duration-150 text-base font-semibold"
                            >
                              {formatCurrency(agent.commissionEarned)}
                            </button>
                          </div>
                          <div className="text-yellow-400 font-medium text-base">{formatCurrency(agent.bonus)}</div>
                        </div>

                        {/* Commission Details Dropdown */}
                        {expandedAgentRank === agent.name && (
                          <div className="bg-[#2d3139] border-t border-gray-700 px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-semibold text-blue-400">Commission Breakdown</div>
                              {/* Count rollover items from the current month's data */}
                              {includeRollover && agent.commissionPropertyPairs?.some(p => (p as RolloverCommission).isRollover) && (
                                <div className="flex items-center gap-2 text-xs text-orange-400">
                                  <Clock size={12} />
                                  <span>Includes Rollover Items</span>
                                </div>
                              )}
                            </div>

                            {getValidCommissionPairs(agent).length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {getValidCommissionPairs(agent)
                                  .filter(pair => includeRollover || !(pair as RolloverCommission).isRollover)
                                  .map((pair, idx) => {
                                    const isRolloverItem = (pair as RolloverCommission).isRollover;
                                    const rolloverPair = pair as RolloverCommission;
                                    const isEarned = isPropertyEarned(agent, pair.propertyCode);

                                    return (
                                      <div
                                        key={`${isRolloverItem ? 'rollover' : 'current'}-${idx}`}
                                        className={`group relative flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${isRolloverItem
                                          ? 'border-orange-500/50 bg-orange-900/10 hover:bg-orange-900/20'
                                          : isEarned
                                            ? 'border-green-500 bg-green-900/20'
                                            : 'border-gray-700 bg-[#252932]'
                                          } hover:border-gray-500`}
                                      >
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${isRolloverItem ? 'bg-orange-500' : 'bg-blue-500'
                                          }`}>
                                          {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <div className="text-sm font-medium text-gray-300 truncate" title={pair.propertyCode || '—'}>
                                              {pair.propertyCode && pair.propertyCode.trim() !== '' ? pair.propertyCode : '—'}
                                            </div>
                                            {isEarned && (
                                              <Check className="text-green-500 flex-shrink-0" size={16} />
                                            )}
                                            {isRolloverItem && (
                                              <span className="text-xs bg-orange-500/30 text-orange-300 px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
                                                <Clock size={10} />
                                                {rolloverPair.sourceMonthLabel?.split(' ')[0] || 'Prev'}
                                              </span>
                                            )}
                                          </div>
                                          <div className={`text-sm font-bold mt-1 ${isRolloverItem ? 'text-orange-400' : 'text-blue-400'}`}>
                                            {formatCurrency(pair.commissionValue)}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <div className="text-2xl mb-2 text-gray-500">📭</div>
                                <div className="text-sm font-medium text-gray-400">No detailed commission data available</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Earned Details Dropdown */}
                        {expandedEarnedAgentRank === agent.name && (
                          <div className="bg-[#2d3139] border-t border-gray-700 px-4 py-3">
                            <div className="text-sm font-semibold text-green-400 mb-2">Earned Breakdown</div>
                            {getValidEarnedDetails(agent).length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {getValidEarnedDetails(agent).map((detail, idx) => (
                                  <div key={idx} className="group relative flex items-center gap-3 p-3 rounded-lg border border-gray-700 bg-[#252932] hover:bg-[#323742] hover:border-gray-600 transition-all duration-200">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                                      {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-300 truncate" title={detail.propertyCode || '—'}>
                                        {detail.propertyCode && detail.propertyCode.trim() !== '' ? detail.propertyCode : '—'}
                                      </div>
                                      <div className="text-sm font-bold text-green-400 mt-1">{formatCurrency(detail.commission)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <div className="text-2xl mb-2 text-gray-500">📭</div>
                                <div className="text-sm font-medium text-gray-400">No detailed earned data available</div>
                              </div>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-gray-500 text-base">
                    {searchQuery
                      ? `No agents found matching "${searchQuery}".`
                      : `No data available for ${formatMonthName(selectedMonth)}.`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        {leaderboardData.length > 0 && (
          <div className="mt-4 flex-shrink-0">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2 text-yellow-500">⚠️ Performance Alerts</h2>
            <div className="space-y-2">
              {!isOnTrack && (
                <div className="bg-yellow-900/20 border-l-4 border-yellow-500 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                      <div className="font-semibold text-yellow-400 text-sm uppercase tracking-wider">Team is below pace</div>
                      <div className="text-xs text-gray-300 mt-1">Target: 90+ sales by Week 3. Current: {teamData?.totalSales || 0}.</div>
                    </div>
                  </div>
                </div>
              )}
              {agentsBelowPace.length > 0 && (
                <div className="bg-yellow-900/20 border-l-4 border-yellow-500 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                      <div className="font-semibold text-yellow-400 text-sm uppercase tracking-wider">Agents below pace</div>
                      <div className="text-xs text-gray-300 mt-1">
                        Agents with less than 10 sales: {agentsBelowPace.map(a => a.name).join(', ')}.
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {isOnTrack && agentsBelowPace.length === 0 && (
                <div className="bg-green-900/20 border-l-4 border-green-500 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-green-500 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                      <div className="font-semibold text-green-400 text-sm uppercase tracking-wider">Excellent Performance!</div>
                      <div className="text-xs text-gray-300 mt-1">All agents are on track! Keep up the great work! 🎉</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DWITSDashboard;