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

export interface CursorPoint {
    x: number;
    y: number;
    timestamp: number;
}

export interface RecognitionEvent {
    faceId: string;
    profileId: string;
    dwellTime: number;
    timestamp: number;
}

export interface PersonhoodNote {
    profileId: string;
    name: string;
    relationship: string;
    points: string[];
    summary?: string;
    opener?: string;
    memorySpark?: string;
    careTip?: string;
    highlights?: string[];
    generatedAt: string;
}

export interface HoverPreview {
    title: string;
    subtitle: string;
    progress: number;
    status: 'recognized' | 'low-confidence' | 'unrecognized';
    distance?: number;
}

export interface OverlayData {
    visible: boolean;
    x: number;
    y: number;
    note: PersonhoodNote | null;
    hoverPreview?: HoverPreview | null;
}

export interface AppState {
    isCapturing: boolean;
    isCalibrated: boolean;
    detectedFaces: any[];
    activeRecognition: PersonhoodNote | null;
}
