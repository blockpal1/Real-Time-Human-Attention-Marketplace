export interface AIBid {
    id: string;
    agentName: string;
    bidPerSecond: number;
    taskDescription: string;
    taskLength: number; // seconds
    priority: number;
}
