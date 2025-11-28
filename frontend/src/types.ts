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

export type SignalingMessage =
  | RoleAssignmentMessage
  | OfferMessage
  | AnswerMessage;

type DataChannelVideoState = {
  type: "videoState";
  data: boolean;
};

type DataChannelMessageSound = {
  type: "sound";
  data: string;
};

type DataChannelMessageMorse = {
  type: "morse";
  data: boolean;
};

type DataChannelMessageMessage = {
  type: "message";
  data: string;
};

export type DataChannelMessage =
  | DataChannelVideoState
  | DataChannelMessageSound
  | DataChannelMessageMorse
  | DataChannelMessageMessage;
