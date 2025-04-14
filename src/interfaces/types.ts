export interface UsageItem {
    calculation: string;
    totalDollars: string;
}

export interface UsageBasedPricing {
    items: UsageItem[];
    hasUnpaidMidMonthInvoice: boolean;
    midMonthPayment: number;
}

export interface CursorStats {
    currentMonth: {
        month: number;
        year: number;
        usageBasedPricing: UsageBasedPricing;
    };
    lastMonth: {
        month: number;
        year: number;
        usageBasedPricing: UsageBasedPricing;
    };
    premiumRequests: {
        current: number;
        total?: number;
        limit: number;
        startOfMonth: string;
    };
}

export interface SQLiteRow {
    value: string;
}

export interface SQLiteError extends Error {
    code?: string;
    errno?: number;
}

export interface AxiosErrorData {
    status?: number;
    data?: any;
    message?: string;
}

export interface ExtendedAxiosError {
    response?: AxiosErrorData;
    message: string;
}

export interface ComposerData {
    conversation: Array<{
        timingInfo?: {
            clientStartTime: number;
            [key: string]: any;
        };
        [key: string]: any;
    }>;
}

export interface TimingInfo {
    key: string;
    timestamp: number;
    timingInfo: {
        clientStartTime: number;
        [key: string]: any;
    };
}

export interface UsageLimitResponse {
    hardLimit?: number;
    noUsageBasedAllowed?: boolean;
}

export interface GitHubRelease {
    tag_name: string;
    name: string;
    body: string;
    prerelease: boolean;
    html_url: string;
    zipball_url: string;
    tarball_url: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
    }>;
}

export interface ReleaseCheckResult {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    isPrerelease: boolean;
    releaseUrl: string;
    releaseNotes: string;
    releaseName: string;
    zipballUrl: string;
    tarballUrl: string;
    assets: Array<{
        name: string;
        downloadUrl: string;
    }>;
}

export interface CursorUsageResponse {
    'gpt-4': {
        numRequests: number;
        numRequestsTotal: number;
        numTokens: number;
        maxRequestUsage: number;
        maxTokenUsage: number | null;
    };
    'gpt-3.5-turbo': {
        numRequests: number;
        numRequestsTotal: number;
        numTokens: number;
        maxRequestUsage: number | null;
        maxTokenUsage: number | null;
    };
    'gpt-4-32k': {
        numRequests: number;
        numRequestsTotal: number;
        numTokens: number;
        maxRequestUsage: number | null;
        maxTokenUsage: number | null;
    };
    startOfMonth: string;
}

export interface TeamInfo {
    teams: Team[];
}

export interface Team {
    name: string;
    id: number;
    role: string;
    seats: number;
    hasBilling: boolean;
    requestQuotaPerSeat: number;
    privacyModeForced: boolean;
    allowSso: boolean;
}

export interface TeamMemberInfo {
    teamMembers: TeamMember[];
    userId: number;
}

export interface TeamMember {
    name: string;
    email: string;
    id: number;
    role: string;
}

export interface TeamUsageResponse {
    teamMemberUsage: TeamMemberUsage[];
}

export interface TeamMemberUsage {
    id: number;
    usageData: UsageData[];
}

export interface UsageData {
    modelType: string;
    numRequests: number;
    numTokens: number;
    maxRequestUsage: number;
    lastUsage: string;
    copilotUsage: number;
    docsCount: number;
    copilotAcceptedUsage: number;
}

export interface UserCache {
    userId: number;
    jwtSub: string;
    isTeamMember: boolean;
    teamId?: number;
    lastChecked: number;
    startOfMonth?: string;
}