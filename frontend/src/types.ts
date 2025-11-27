export type Role = "offerer" | "answerer" | null;

export type RoleAssignmentMessage = {
  type: "role";
  data: {
    role: Role;
    clientId: string;
    roomId: string;
  };
};

export interface IceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
}

export type OfferOrAnswerData = {
  sdp: string;
  ice: IceCandidateInit[];
};

export type OfferMessage = {
  type: "offer";
  data: OfferOrAnswerData;
};

export type AnswerMessage = {
  type: "answer";
  data: OfferOrAnswerData;
};

export type SignalingMessage = RoleAssignmentMessage | OfferMessage | AnswerMessage;

export interface DataChannelMessage {
  type: "videoState" | "message" | "sound" | "morse";
  data: any;
  enabled?: boolean; // For videoState
}
