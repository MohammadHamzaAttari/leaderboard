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
 * Check and apply rollover for a given month
 * Uses a two-phase approach:
 * 1. Calculate rollover items and persist them to 'rollover_items' collection (if not already done)
 * 2. Apply rollover items to any agent records that are missing rollover_commission_list (continuous sync)
 * 
 * Returns { applied: boolean, itemsMerged: number, message: string }
 */
export async function checkAndApplyRollover(db, targetMonth) {
    try {
        const previousMonth = getPreviousMonth(targetMonth);
        if (!previousMonth) {
            return { applied: false, itemsMerged: 0, error: 'Could not calculate previous month' };
        }

        console.log(`[Rollover] Checking rollover from ${previousMonth} -> ${targetMonth}`);

        // Phase 1: Ensure rollover items are calculated and persisted
        const rolloverMap = await ensureRolloverItemsCalculated(db, targetMonth, previousMonth);

        if (rolloverMap.size === 0) {
            return { applied: true, itemsMerged: 0, message: 'No rollover items to apply.' };
        }

        // Phase 2: Apply rollover to any records that are MISSING rollover_commission_list
        // This ensures that new/updated records from n8n get rollover data applied
        const result = await applyRolloverToMissingRecords(db, targetMonth, rolloverMap);

        return result;

    } catch (error) {
        console.error('[Rollover] Error:', error);
        return { applied: false, error: error.message };
    }
}

/**
 * Ensure rollover items are calculated and persisted to the rollover_items collection.
 * This is idempotent - if items already exist, they are loaded from the collection.
 * Returns a Map of userId/agentName -> rollover items
 */
async function ensureRolloverItemsCalculated(db, targetMonth, previousMonth) {
    const rolloverMap = new Map();

    // Check if we already have rollover items calculated for this target month
    const existingRolloverItems = await db.collection('rollover_items')
        .find({ targetMonth })
        .toArray();

    if (existingRolloverItems.length > 0) {
        // Load existing items into the map
        for (const item of existingRolloverItems) {
            let parsedItems = item.rolloverItems;
            if (typeof parsedItems === 'string') {
                try { parsedItems = JSON.parse(parsedItems); } catch (e) { parsedItems = []; }
            }
            if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                rolloverMap.set(item.agentKey, parsedItems);
            }
        }
        console.log(`[Rollover] Loaded ${rolloverMap.size} existing rollover mappings for ${targetMonth}`);
        return rolloverMap;
    }

    // No existing items - calculate them fresh
    console.log(`[Rollover] Calculating rollover items from ${previousMonth} -> ${targetMonth}`);

    const previousData = await db.collection('leader_board')
        .find({ month: previousMonth })
        .project({ 'Agent Name': 1, userIdMonthId: 1, commission_property_pair: 1, earnedDetails: 1 })
        .toArray();

    if (!previousData || previousData.length === 0) {
        console.log(`[Rollover] No previous month data found for ${previousMonth}`);
        return rolloverMap;
    }

    const sourceMonthLabel = formatMonthLabel(previousMonth);

    for (const agent of previousData) {
        // Extract key (userId or agent name)
        let key = null;
        if (agent.userIdMonthId && agent.userIdMonthId.includes('_')) {
            key = agent.userIdMonthId.split('_')[0];
        } else {
            key = (agent['Agent Name'] || '').trim().toLowerCase();
        }

        if (!key) continue;

        // Parse commissions
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

            // Persist to rollover_items collection for future use
            await db.collection('rollover_items').updateOne(
                { targetMonth, agentKey: key },
                {
                    $set: {
                        targetMonth,
                        agentKey: key,
                        sourceMonth: previousMonth,
                        rolloverItems: JSON.stringify(enrichedItems),
                        itemCount: enrichedItems.length,
                        calculatedAt: new Date()
                    }
                },
                { upsert: true }
            );
        }
    }

    console.log(`[Rollover] Calculated and persisted ${rolloverMap.size} rollover mappings for ${targetMonth}`);
    return rolloverMap;
}

/**
 * Apply rollover items to any agent records that are MISSING the rollover_commission_list field.
 * This is called on every API request to ensure new/updated records get rollover data.
 */
async function applyRolloverToMissingRecords(db, targetMonth, rolloverMap) {
    // Find records that are either:
    // 1. Missing rollover_commission_list entirely
    // 2. Have an empty/null rollover_commission_list
    const currentData = await db.collection('leader_board')
        .find({
            month: targetMonth,
            $or: [
                { rollover_commission_list: { $exists: false } },
                { rollover_commission_list: null },
                { rollover_commission_list: '' },
                { rollover_commission_list: '[]' }
            ]
        })
        .toArray();

    let updatedCount = 0;
    let totalMergedItems = 0;

    for (const agent of currentData) {
        // Extract key using same logic
        let key = null;
        if (agent.userIdMonthId && agent.userIdMonthId.includes('_')) {
            key = agent.userIdMonthId.split('_')[0];
        } else {
            key = (agent['Agent Name'] || '').trim().toLowerCase();
        }

        const rolloverItems = rolloverMap.get(key);
        if (rolloverItems && rolloverItems.length > 0) {
            // Apply rollover to this record
            await db.collection('leader_board').updateOne(
                { _id: agent._id },
                {
                    $set: {
                        rollover_commission_list: JSON.stringify(rolloverItems),
                        last_rollover_update: new Date()
                    }
                }
            );
            updatedCount++;
            totalMergedItems += rolloverItems.length;
            console.log(`[Rollover] Applied ${rolloverItems.length} items to agent: ${agent['Agent Name'] || key}`);
        }
    }

    if (updatedCount > 0) {
        console.log(`[Rollover] Applied rollover to ${updatedCount} missing records (${totalMergedItems} items total)`);
    }

    // Update rollover status
    await markRolloverAsApplied(db, targetMonth, totalMergedItems, 'success_continuous_sync');

    return {
        applied: true,
        itemsMerged: totalMergedItems,
        agentsUpdated: updatedCount,
        message: updatedCount > 0
            ? `Applied rollover to ${updatedCount} records.`
            : 'All records already have rollover data.'
    };
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
