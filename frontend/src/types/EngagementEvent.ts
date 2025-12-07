export interface EngagementEvent {
    humanId: string;
    timestamp: number;
    engagementScore: number; // 0–1
    microExpression: string; // "smile", "laugh", etc.
    fraudScore?: number;
}
