export type Role = "offerer" | "answerer" | null;

export interface SignalingMessage {
  type: string;
  data: any;
}

export interface DataChannelMessage {
  type: "videoState" | "message" | "sound" | "morse";
  data: any;
  enabled?: boolean; // For videoState
}

