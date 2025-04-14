import { log } from './logger';
import { getCursorTokenFromDB } from '../services/database';
import { checkUsageBasedStatus, fetchCursorStats, getStripeSessionUrl } from '../services/api';
import { checkAndNotifyUsage, checkAndNotifySpending } from '../handlers/notifications';
import {
    startRefreshInterval,
    startCountdownDisplay,
    formatCountdown,
    COOLDOWN_DURATION_MS,
    getRefreshInterval,
    getCooldownStartTime,
    getConsecutiveErrorCount,
    incrementConsecutiveErrorCount,
    setCooldownStartTime,
    setConsecutiveErrorCount,
    resetConsecutiveErrorCount
} from './cooldown';
import { createMarkdownTooltip, formatTooltipLine, getMaxLineWidth, getStatusBarColor, getUsageEmoji, createSeparator } from '../handlers/statusBar';
import * as vscode from 'vscode';

export async function updateStats(statusBarItem: vscode.StatusBarItem) {
    try {
        log('[Stats] Starting stats update...');
        const token = await getCursorTokenFromDB();

        if (!token) {
            log('[Critical] No valid token found', true);
            statusBarItem.text = "$(alert) Cursor Billing Stats: No token found";
            statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorBackground');
            const tooltipLines = [
                '⚠️ Could not retrieve Cursor token from database'
            ];
            statusBarItem.tooltip = await createMarkdownTooltip(tooltipLines, true);
            log('[Status Bar] Updated status bar with no token message');
            statusBarItem.show();
            log('[Status Bar] Status bar visibility updated after no token');
            return;
        }

        // Check usage-based status first
        const usageStatus = await checkUsageBasedStatus(token);
        log(`[Stats] Usage-based pricing status: ${JSON.stringify(usageStatus)}`);

        // Show status bar early to ensure visibility
        statusBarItem.show();

        log('[Stats] Token retrieved successfully, fetching stats...');
        const stats = await fetchCursorStats(token).catch(async (error: any) => {
            if (error.response?.status === 401 || error.response?.status === 403) {
                log('[Auth] Token expired or invalid, attempting to refresh...', true);
                const newToken = await getCursorTokenFromDB();
                if (newToken) {
                    log('[Auth] Successfully retrieved new token, retrying stats fetch...');
                    return await fetchCursorStats(newToken);
                }
            }
            log(`[Critical] API error: ${error.message}`, true);
            throw error; // Re-throw to be caught by outer catch
        });

        // 원본 API 응답을 저장 (디버깅 및 비교용)
        log('[Stats] 원본 API 응답:', JSON.stringify({
            premiumRequests: stats.premiumRequests,
            current: stats.premiumRequests.current,
            total: stats.premiumRequests.total,
            limit: stats.premiumRequests.limit,
        }));

        // API 응답 로그 기록 - 디버깅 용도
        log('[Stats] API Response:', {
            premiumRequests: stats.premiumRequests,
            currentMonth: stats.currentMonth.month,
            usageBasedItems: stats.currentMonth.usageBasedPricing.items.length
        });

        // 중요: API 데이터 유효성을 반드시 확인
        log('[Stats] Raw premium requests data: ' + JSON.stringify(stats.premiumRequests));

        // Reset error count on successful fetch
        if (getConsecutiveErrorCount() > 0 || getCooldownStartTime()) {
            log('[Stats] API connection restored, resetting error state');
            resetConsecutiveErrorCount();
            if (getCooldownStartTime()) {
                setCooldownStartTime(null);
                startRefreshInterval();
            }
        }

        // API에서 제공하는 원본 값
        const totalRequests = stats.premiumRequests.total || 0; // numRequestsTotal
        const successfulRequests = stats.premiumRequests.current || 0; // numRequestsCurrent

        // usage-based 관련 변수들
        let usageBasedRequestsNum = 0;
        let usageBasedPercent = 0;
        let totalCostBeforeMidMonth = 0;

        if (stats.lastMonth.usageBasedPricing.items.length > 0) {
            const items = stats.lastMonth.usageBasedPricing.items;
            usageBasedRequestsNum = items.reduce((sum, item) => {
                const match = item.calculation.match(/(\d+)\s*\*/);
                return sum + (match ? parseInt(match[1]) : 0);
            }, 0);

            // 비용 계산
            totalCostBeforeMidMonth = items.reduce((sum, item) =>
                sum + parseFloat(item.totalDollars.replace('$', '')), 0);

            // Usage-based 퍼센트 계산 (한도가 있는 경우 안전하게 처리)
            if (usageStatus.isEnabled && usageStatus.limit && usageStatus.limit > 0) {
                usageBasedPercent = (totalCostBeforeMidMonth / usageStatus.limit) * 100;
            }
        }

        // 모든 성공한 요청 = 기본 성공 요청 + usage-based 요청
        const allSuccessfulRequests = successfulRequests + usageBasedRequestsNum;

        // 실패 요청은 단순히 전체 요청 - 모든 성공 요청 (이것이 정확한 계산 방식)
        const failedRequests = totalRequests - allSuccessfulRequests;
        const failedPercentage = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

        // 디버깅용 로그
        log('[Stats] 계산 검증 (API 원본 값):', {
            numRequestsTotal: totalRequests,
            numRequestsCurrent: successfulRequests,
            usageBasedRequestsNum: usageBasedRequestsNum,
            allSuccessfulRequests: allSuccessfulRequests,
            failedRequests: failedRequests,
            failedPercentage: failedPercentage.toFixed(1) + '%'
        });

        // 전체 코드 범위에서 한 번만 선언하고 전역적으로 사용

        // 프리미엄 요청 비율 계산
        const premiumPercent = stats.premiumRequests.limit > 0
            ? Math.min(Math.round((totalRequests / stats.premiumRequests.limit) * 100), 999)
            : 0;

        // 상태바 색상 설정
        const usagePercent = premiumPercent < 100 ? premiumPercent :
                           (usageStatus.isEnabled ? usageBasedPercent : premiumPercent);
        statusBarItem.color = getStatusBarColor(usagePercent);

        // ===== Tooltip 내용 구성 =====
        const title = '⚡ Cursor Usage Statistics ⚡';
        const contentLines = [
            title,
            '',
            '🚀 Premium Fast Requests'
        ];

        // 날짜 형식 함수
        const formatDateWithMonthName = (date: Date) => {
            const day = date.getDate();
            const monthName = date.toLocaleString('en-US', { month: 'long' });
            return `${day} ${monthName}`;
        };

        // Usage Based Period 정보 추가 (있는 경우)
        if (usageStatus.isEnabled && stats.lastMonth.usageBasedPricing.items.length > 0) {
            // Calculate usage-based pricing period
            const billingDay = 3;
            const currentDate = new Date();
            let periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), billingDay);
            let periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, billingDay - 1);

            // If we're before the billing day, adjust the period to the previous month
            if (currentDate.getDate() < billingDay) {
                periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, billingDay);
                periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), billingDay - 1);
            }

            contentLines.push(
                formatTooltipLine(`Usage Based Period: ${formatDateWithMonthName(periodStart)} - ${formatDateWithMonthName(periodEnd)}`)
            );
        }

        // ===== Detailed Requests 섹션 추가 =====
        contentLines.push('', 'Detailed Requests');

        // 상세 정보 추가 - API 원본 값과 계산된 값 명확히 표시

        contentLines.push(
            formatTooltipLine(`• 📊 Total Requests: ${totalRequests}/${stats.premiumRequests.limit} (Include Failed Requests)`),
            formatTooltipLine(`• ✅ Successful Requests: ${allSuccessfulRequests} (Base Request: ${successfulRequests}, Usage-Based: ${usageBasedRequestsNum})`),
            failedRequests > 0 ? formatTooltipLine(`• ❌ Failed Requests: ${failedRequests} (${failedPercentage.toFixed(1)}%)`) : '',
            formatTooltipLine(`• 🔄 Usage-Based Requests: +${usageBasedRequestsNum}`)
        );

        // ===== Usage-Based Pricing 섹션 추가 =====
        contentLines.push('', '📈 Usage-Based Pricing');

        if (stats.lastMonth.usageBasedPricing.items.length > 0) {
            const items = stats.lastMonth.usageBasedPricing.items;
            // Calculate total cost without including the mid-month payment in the sum
            let totalCost = items.reduce((sum, item) => sum + parseFloat(item.totalDollars.replace('$', '')), 0);

            // Calculate usage-based pricing period
            const billingDay = 3;
            const currentDate = new Date();
            let periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), billingDay);
            let periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, billingDay - 1);

            // If we're before the billing day, adjust the period to the previous month
            if (currentDate.getDate() < billingDay) {
                periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, billingDay);
                periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), billingDay - 1);
            }

            contentLines.push(
                formatTooltipLine(`Period: ${formatDateWithMonthName(periodStart)} - ${formatDateWithMonthName(periodEnd)}`),
            );

            // Add total cost header with unpaid amount if there's a mid-month payment
            const unpaidAmount = totalCostBeforeMidMonth - stats.lastMonth.usageBasedPricing.midMonthPayment;

            if (stats.lastMonth.usageBasedPricing.midMonthPayment > 0) {
                contentLines.push(
                    formatTooltipLine(`Current Usage (Total: $${totalCostBeforeMidMonth.toFixed(2)} - Unpaid: $${unpaidAmount.toFixed(2)})`),
                    ''
                );
            } else {
                contentLines.push(
                    formatTooltipLine(`Current Usage (Total: $${totalCostBeforeMidMonth.toFixed(2)})`),
                    ''
                );
            }

            for (const item of items) {
                contentLines.push(formatTooltipLine(`• ${item.calculation} ➜ ${item.totalDollars}`));
            }

            if (stats.lastMonth.usageBasedPricing.midMonthPayment > 0) {
                contentLines.push(
                    '',
                    formatTooltipLine(`ℹ️ You have paid $${stats.lastMonth.usageBasedPricing.midMonthPayment.toFixed(2)} of this cost already`)
                );
            }

            contentLines.push(
                '',
                formatTooltipLine(`💳 Total Cost: $${totalCostBeforeMidMonth.toFixed(2)}`)
            );

            // Add spending notification check
            if (usageStatus.isEnabled) {
                setTimeout(() => {
                    checkAndNotifySpending(totalCostBeforeMidMonth);
                }, 1000);
            }
        } else {
            contentLines.push('ℹ️ No usage data for last month');
        }

        // Calculate separator width based on content
        const maxWidth = getMaxLineWidth(contentLines);
        const separator = createSeparator(maxWidth);

        // Create final tooltip content with Last Updated at the bottom
        const tooltipLines = [
            '⚡ Cursor Usage Statistics ⚡',
            separator,
            ...contentLines.slice(1),
            '',
            formatTooltipLine(`🕒 Last Updated: ${new Date().toLocaleString()}`),
        ];

        // Update usage based percent for notifications (재선언하지 않고 기존 변수 사용)
        // 이미 계산된 usageBasedPercent 사용
        if (usageStatus.isEnabled && usageStatus.limit && usageStatus.limit > 0) {
            // usageBasedPercent는 이미 계산되어 있음 - 불필요한 재계산 방지
            log('[Stats] Using calculated usageBasedPercent:', usageBasedPercent);
        }

        log('[Status Bar] Updating status bar with new stats...');
        // 하단 상태바에는 성공한 요청만 표시 (기본 + usage-based)
        let statusText = '';

        // 하단 상태바에는 성공한 모든 요청(기본 + usage-based) 표시
        statusText = `$(graph) ${allSuccessfulRequests}/${stats.premiumRequests.limit}`;
        if (failedRequests > 0) {
            statusText += ` (${failedRequests} failed)`;
        }

        // 비용 정보 추가
        if (totalCostBeforeMidMonth > 0) {
            const costText = ` $(credit-card) $${totalCostBeforeMidMonth.toFixed(2)}`;
            statusText += costText;
        }

        statusBarItem.text = statusText;
        statusBarItem.tooltip = await createMarkdownTooltip(tooltipLines);
        statusBarItem.show();
        log('[Status Bar] Status bar visibility updated after stats update');
        log('[Stats] Stats update completed successfully');

        // Show notifications after ensuring status bar is visible
        if (usageStatus.isEnabled) {
            setTimeout(() => {
                // First check premium usage
                const premiumPercent = Math.min(Math.round((totalRequests / stats.premiumRequests.limit) * 100), 999);
                checkAndNotifyUsage({
                    percentage: premiumPercent,
                    type: 'premium'
                });

                // Only check usage-based if premium is over limit
                if (premiumPercent >= 100) {
                    checkAndNotifyUsage({
                        percentage: usageBasedPercent,
                        type: 'usage-based',
                        limit: usageStatus.limit,
                        premiumPercentage: premiumPercent
                    });
                }

                if (stats.lastMonth.usageBasedPricing.hasUnpaidMidMonthInvoice) {
                    vscode.window.showWarningMessage('⚠️ You have an unpaid mid-month invoice. Please pay it to continue using usage-based pricing.', 'Open Billing Page')
                        .then(async (selection: string | undefined) => {
                            if (selection === 'Open Billing Page') {
                                try {
                                    const stripeUrl = await getStripeSessionUrl(token);
                                    vscode.env.openExternal(vscode.Uri.parse(stripeUrl));
                                } catch (error) {
                                    // Fallback to settings page if stripe URL fails
                                    vscode.env.openExternal(vscode.Uri.parse('https://www.cursor.com/settings'));
                                }
                            }
                        });
                }
            }, 1000);
        } else {
            setTimeout(() => {
                checkAndNotifyUsage({
                    percentage: premiumPercent,
                    type: 'premium'
                });
            }, 1000);
        }
    } catch (error: any) {
        const errorCount = incrementConsecutiveErrorCount();
        log(`[Critical] Error updating stats (Error count: ${errorCount}): ${error.message}`, true);

        if (errorCount >= 2) {
            // Always reset cooldown timer on errors after 2 consecutive failures
            setCooldownStartTime(Date.now());
            const refreshInterval = getRefreshInterval();
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
            startCountdownDisplay();
            log('[Critical] Starting/Resetting cooldown period due to consecutive errors');
        }

        const cooldownStartTime = getCooldownStartTime();
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorBackground');

        if (cooldownStartTime) {
            const now = Date.now();
            const elapsed = now - cooldownStartTime;
            const remaining = COOLDOWN_DURATION_MS - elapsed;
            statusBarItem.text = `$(warning) Cursor Billing API Unavailable (Retrying in ${formatCountdown(remaining)})`;
        } else {
            statusBarItem.text = "$(error) Cursor Billing Stats: Error";
        }

        const errorLines = [
            '⚠️ Error fetching Cursor stats',
            `❌ ${error.response?.status >= 500 ? 'Cursor API is temporarily unavailable' : 'Unable to retrieve usage statistics'}`,
            cooldownStartTime ? '\nAuto-refresh paused due to consecutive errors' : '',
            '',
            `🕒 Last attempt: ${new Date().toLocaleString()}`
        ];

        statusBarItem.tooltip = await createMarkdownTooltip(errorLines, true);
        statusBarItem.show();
    }
}