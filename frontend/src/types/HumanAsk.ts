export interface HumanAsk {
    id: string;
    avatarUrl?: string;
    pricePerSecond: number;
    remainingSeconds: number;
    taskType: string; // "meme", "doc", "video"
    status: "online" | "busy" | "verified";
}
