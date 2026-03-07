// ─── MUNINN Shared Types ───

export interface PersonProfile {
    id: string;
    name: string;
    relationship: string;
    identity_summary: string;
    hobbies: string[];
    pride_points: string[];
    emotional_anchors: string[];
    conversation_starters: string[];
    communication_tips: string[];
    face_reference_image?: string;
    faceDescriptor?: number[]; // 128d numerical embedding from face-api
    createdAt?: string;
    updatedAt?: string;
}

export interface FaceBoundingBox {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    linkedProfileId?: string;
}

export interface GazePoint {
    x: number;
    y: number;
    timestamp: number;
}

export type GazeTrackingMode = 'webgazer' | 'mouse';

export interface OverlayTrackingCommand {
    type: 'start-eye-tracking' | 'stop-eye-tracking' | 'start-calibration';
}

export interface RecognitionEvent {
    faceId: string;
    profileId: string;
    dwellTime: number;
    heartRate: number;
    timestamp: number;
    isStressed: boolean;
}

export interface PersonhoodNote {
    profileId: string;
    name: string;
    relationship: string;
    points: string[];
    isStressed: boolean;
    hcpGuidance?: string[];
    generatedAt: string;
}

export interface OverlayData {
    visible: boolean;
    x: number;
    y: number;
    note: PersonhoodNote | null;
}

export interface AppState {
    isCapturing: boolean;
    isCalibrated: boolean;
    hcpMode: boolean;
    heartRate: number;
    detectedFaces: any[];
    gazePoint: GazePoint | null;
    activeRecognition: PersonhoodNote | null;
}
