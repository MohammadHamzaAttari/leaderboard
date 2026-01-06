/**
 * Utility function to trigger webhook
 * @param {string} operation - The CRUD operation type (create, update, delete)
 * @param {object} data - The employee/agent data
 */
export async function triggerAgentWebhook(operation, data) {
    const WEBHOOK_URL = 'https://dealwithitsolutions.app.n8n.cloud/webhook/agent-update';

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                operation,
                timestamp: new Date().toISOString(),
                data,
            }),
        });

        if (!response.ok) {
            console.error(`Webhook trigger failed: ${response.status} ${response.statusText}`);
        } else {
            console.log(`Webhook triggered successfully for ${operation} operation`);
        }
    } catch (error) {
        // Log error but don't fail the main operation
        console.error('Error triggering webhook:', error.message);
    }
}
