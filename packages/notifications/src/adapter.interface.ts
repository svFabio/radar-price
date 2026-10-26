export interface DealNotificationPayload {
  dealTitle: string;
  brand?: string | null;
  model?: string | null;
  specs: {
    cpu?: string | null;
    ramGb?: number | null;
    gpu?: string | null;
    storageGb?: number | null;
  };
  listedPrice?: number | null;
  realPrice?: number | null;
  estimatedMarketPrice?: number | null;
  currency: string;
  dealScore: number;
  conditionRating?: number | null;
  reasoning?: string | null;
  url: string;
  imageUrls: string[];
  location?: string | null;
}

export interface NotificationProvider {
  readonly channelName: string;
  sendDealAlert(payload: DealNotificationPayload): Promise<{ success: boolean; error?: string }>;
  sendDailyDigest(deals: DealNotificationPayload[]): Promise<{ success: boolean; error?: string }>;
}
