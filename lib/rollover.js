/**
 * Shared logic for handling commission rollovers.
 * This ensures consistency between dashboard auto-rollover and admin manual merge.
 */

/**
 * Get previous month in YYYY-MM format
 */
export function getPreviousMonth(monthStr) {
    if (!monthStr) return null;
    try {
        const [year, month] = monthStr.split('-').map(Number);
        const date = new Date(year, month - 2, 1); // month is 0-indexed, so month-2 for previous
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } catch (e) {
        console.error("Error calculating previous month:", e);
        return null;
    }
}

/**
 * Format month string for display (e.g., "2025-12" -> "December 2025")
 */
export function formatMonthLabel(monthStr) {
    if (!monthStr) return 'Unknown';
    try {
        const date = new Date(monthStr + '-01');
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch (e) {
        return monthStr;
    }
}

/**
 * Parse commission_property_pair string or array
 */
export function parseCommissionPairs(rawData) {
    if (!rawData) return [];

    if (Array.isArray(rawData)) {
        return rawData;
    }

    if (typeof rawData === 'string') {
        // 1. Try direct parse
        try {
            const parsed = JSON.parse(rawData);
            if (Array.isArray(parsed)) return parsed;
            if (typeof parsed === 'string') {
                // Maybe double stringified?
                try {
                    const inner = JSON.parse(parsed);
                    if (Array.isArray(inner)) return inner;
                } catch (e) { }
                // Try the clean method on the parsed string
                return parseCommissionPairs(parsed);
            }
        } catch (e) {
            // Direct parse failed, try cleaning
        }

        // 2. Try legacy cleaning (replace \" with ") 
        // This handles cases like "[{\"key\":\"value\"}]" which are technically invalid JSON strings if not improperly escaped
        try {
            let cleanString = rawData.replace(/\\"/g, '"');
            // If it starts/ends with quote, remove them to try to fix bad stringification
            if (cleanString.startsWith('"') && cleanString.endsWith('"')) {
                cleanString = cleanString.slice(1, -1);
            }
            const parsed = JSON.parse(cleanString);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error("Error parsing commission_property_pair:", e);
            return [];
        }
    }

    return [];
}

/**
 * Get incomplete commissions (not in earnedDetails) from a set of pairs and earned details
 */
export function getIncompleteCommissions(commissionPairs, earnedDetails) {
    const earnedCodes = new Set(
        (earnedDetails || [])
            .map(d => d.propertyCode?.trim().toLowerCase())
            .filter(Boolean)
    );

    return commissionPairs.filter(pair => {
        if (!pair) return false;
        const commValue = pair.commissionValue;
        // Strict check for valid commission value
        if (commValue === null || commValue === undefined || commValue === '' || commValue === 'null') return false;

        const numValue = parseFloat(commValue);
        if (isNaN(numValue) || numValue === 0) return false;

        const normalizedCode = pair.propertyCode?.trim().toLowerCase();
        // Must have a property code and NOT be in earned codes
        return normalizedCode && !earnedCodes.has(normalizedCode);
    });
}

/**
 * Check and apply rollover for a given month (idempotent safe)
 * Returns { applied: boolean, itemsMerged: number, message: string }
 */
export async function checkAndApplyRollover(db, targetMonth) {
    try {
        const previousMonth = getPreviousMonth(targetMonth);
        if (!previousMonth) {
            return { applied: false, itemsMerged: 0, error: 'Could not calculate previous month' };
        }

        console.log(`[Rollover] Checking rollover from ${previousMonth} -> ${targetMonth}`);

        // 2. Fetch previous month data
        const previousData = await db.collection('leader_board')
            .find({ month: previousMonth })
            .project({ 'Agent Name': 1, commission_property_pair: 1, earnedDetails: 1 })
            .toArray();

        if (!previousData || previousData.length === 0) {
            await markRolloverAsApplied(db, targetMonth, 0, 'no_previous_data');
            return { applied: true, itemsMerged: 0, message: 'No data in previous month to rollover.' };
        }

        // 3. Build map of incomplete commissions to roll over
        // Key: userId (preferred) or Agent Name (fallback)
        const rolloverMap = new Map();
        const sourceMonthLabel = formatMonthLabel(previousMonth);

        for (const agent of previousData) {
            // Try to extract userId from userIdMonthId (format: ID_YYYYMM)
            // Example: 4QBAZF23WXnIX9KHcOcl_202512
            let key = null;
            if (agent.userIdMonthId && agent.userIdMonthId.includes('_')) {
                key = agent.userIdMonthId.split('_')[0];
            } else {
                key = (agent['Agent Name'] || '').trim().toLowerCase();
            }

            if (!key) continue;

            // Parse current commissions
            let commissionPairs = [];
            try {
                commissionPairs = parseCommissionPairs(agent.commission_property_pair);
            } catch (e) {
                console.warn(`[Rollover] Failed to parse commissions for agent ${agent['Agent Name']}`);
                continue;
            }

            // Parse earned details
            const earnedDetails = (agent.earnedDetails || []).filter(d =>
                d && d.propertyCode && d.commission !== null && d.commission !== undefined
            );

            const incomplete = getIncompleteCommissions(commissionPairs, earnedDetails);

            if (incomplete.length > 0) {
                const enrichedItems = incomplete.map(item => ({
                    ...item,
                    sourceMonth: previousMonth,
                    sourceMonthLabel,
                    isRollover: true
                }));

                rolloverMap.set(key, enrichedItems);
            }
        }

        if (rolloverMap.size === 0) {
            await markRolloverAsApplied(db, targetMonth, 0, 'no_incomplete_items');
            return { applied: true, itemsMerged: 0, message: 'No incomplete items found to rollover.' };
        }

        // 4. Update current month's data
        const currentData = await db.collection('leader_board').find({ month: targetMonth }).toArray();
        let updatedCount = 0;
        let totalMergedItems = 0; // Track total items merged across all agents

        for (const agent of currentData) {
            // Generate key using same logic as map building
            let key = null;
            if (agent.userIdMonthId && agent.userIdMonthId.includes('_')) {
                key = agent.userIdMonthId.split('_')[0];
            } else {
                key = (agent['Agent Name'] || '').trim().toLowerCase();
            }

            const rolloverItems = rolloverMap.get(key);
            if (rolloverItems && rolloverItems.length > 0) {
                let currentPairs = parseCommissionPairs(agent.commission_property_pair);

                // Deduplicate logic
                const existingKeys = new Set(
                    currentPairs
                        .filter(p => p.isRollover === true)
                        .map(p => `${p.propertyCode?.trim().toLowerCase()}_${p.sourceMonth}`)
                );

                let added = false;
                let itemsAddedToAgent = 0;
                for (const item of rolloverItems) {
                    const itemKey = `${item.propertyCode?.trim().toLowerCase()}_${item.sourceMonth}`;
                    if (!existingKeys.has(itemKey)) {
                        currentPairs.push(item);
                        added = true;
                        itemsAddedToAgent++;
                    }
                }

                if (added) {
                    await db.collection('leader_board').updateOne(
                        { _id: agent._id },
                        {
                            $set: {
                                commission_property_pair: JSON.stringify(currentPairs),
                                last_rollover_update: new Date()
                            }
                        }
                    );
                    updatedCount++;
                    totalMergedItems += itemsAddedToAgent;
                }
            }
        }

        // 5. Mark as applied
        await markRolloverAsApplied(db, targetMonth, totalMergedItems, 'success', previousMonth);

        console.log(`[Rollover] Successfully merged ${totalMergedItems} items for ${updatedCount} agents.`);
        return { applied: true, itemsMerged: totalMergedItems, agentsUpdated: updatedCount, message: 'Rollover applied successfully.' };

    } catch (error) {
        console.error('[Rollover] Error:', error);
        return { applied: false, error: error.message };
    }
}

async function markRolloverAsApplied(db, month, itemsMerged, reason, sourceMonth = null) {
    await db.collection('rollover_status').updateOne(
        { month },
        {
            $set: {
                applied: true,
                appliedAt: new Date(),
                itemsMerged,
                reason,
                sourceMonth
            }
        },
        { upsert: true }
    );
}
