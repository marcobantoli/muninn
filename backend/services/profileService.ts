import { PersonProfile } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { getSeedProfiles } from '../seed';
import { getFirestoreDb } from './firebase';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    writeBatch
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'profiles.json');
const COLLECTION_NAME = 'profiles';
let initializationPromise: Promise<void> | null = null;

function getProfilesCollection() {
    return collection(getFirestoreDb(), COLLECTION_NAME);
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
}

function normalizeNumberArray(value: unknown): number[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }

    const descriptor = value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
    return descriptor.length > 0 ? descriptor : undefined;
}

function hydrateProfile(id: string, raw: Partial<PersonProfile> | Record<string, unknown>): PersonProfile {
    return {
        id,
        name: typeof raw.name === 'string' ? raw.name : 'Unknown',
        relationship: typeof raw.relationship === 'string' ? raw.relationship : '',
        identity_summary: typeof raw.identity_summary === 'string' ? raw.identity_summary : '',
        hobbies: normalizeStringArray(raw.hobbies),
        pride_points: normalizeStringArray(raw.pride_points),
        emotional_anchors: normalizeStringArray(raw.emotional_anchors),
        conversation_starters: normalizeStringArray(raw.conversation_starters),
        communication_tips: normalizeStringArray(raw.communication_tips),
        face_reference_image: typeof raw.face_reference_image === 'string' ? raw.face_reference_image : undefined,
        faceDescriptor: normalizeNumberArray(raw.faceDescriptor),
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined
    };
}

function serializeProfile(profile: PersonProfile): Record<string, unknown> {
    return {
        id: profile.id,
        name: profile.name,
        relationship: profile.relationship,
        identity_summary: profile.identity_summary,
        hobbies: profile.hobbies,
        pride_points: profile.pride_points,
        emotional_anchors: profile.emotional_anchors,
        conversation_starters: profile.conversation_starters,
        communication_tips: profile.communication_tips,
        ...(profile.face_reference_image ? { face_reference_image: profile.face_reference_image } : {}),
        ...(profile.faceDescriptor ? { faceDescriptor: profile.faceDescriptor } : {}),
        ...(profile.createdAt ? { createdAt: profile.createdAt } : {}),
        ...(profile.updatedAt ? { updatedAt: profile.updatedAt } : {})
    };
}

async function loadProfilesFromDisk(): Promise<PersonProfile[]> {
    try {
        if (!fs.existsSync(DB_PATH)) {
            return [];
        }

        const data = await fs.promises.readFile(DB_PATH, 'utf-8');
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
            .map((entry) => hydrateProfile(typeof entry.id === 'string' ? entry.id : uuidv4(), entry));
    } catch (error) {
        console.error('[MUNINN] Failed to read profiles.json for Firestore migration:', error);
        return [];
    }
}

async function seedFirestoreIfEmpty(): Promise<void> {
    const snapshot = await getDocs(getProfilesCollection());
    if (!snapshot.empty) {
        return;
    }

    const migratedProfiles = await loadProfilesFromDisk();
    const seedProfiles = migratedProfiles.length > 0 ? migratedProfiles : getSeedProfiles();
    const sourceLabel = migratedProfiles.length > 0 ? 'profiles.json migration' : 'seed data';

    const batch = writeBatch(getFirestoreDb());
    seedProfiles.forEach((profile) => {
        batch.set(doc(getProfilesCollection(), profile.id), serializeProfile(profile));
    });

    await batch.commit();
    console.log(`[MUNINN] Seeded Firestore with ${seedProfiles.length} profiles from ${sourceLabel}`);
}

async function ensureInitialized() {
    if (!initializationPromise) {
        initializationPromise = (async () => {
            await seedFirestoreIfEmpty();
        })().catch((error) => {
            initializationPromise = null;
            throw error;
        });
    }

    try {
        await initializationPromise;
    } catch (e) {
        try {
            const fallbackProfiles = getSeedProfiles();
            const batch = writeBatch(getFirestoreDb());
            fallbackProfiles.forEach((profile) => {
                batch.set(doc(getProfilesCollection(), profile.id), serializeProfile(profile));
            });
            await batch.commit();
            console.warn('[MUNINN] Firestore initialization failed; seed profiles were written as a fallback.');
        } catch (fallbackError) {
            console.error('[MUNINN] Failed to initialize Firestore profiles store.', e);
            throw fallbackError;
        }
    }
}

export async function getAllProfiles(): Promise<PersonProfile[]> {
    await ensureInitialized();
    const snapshot = await getDocs(getProfilesCollection());
    return snapshot.docs
        .map((entry) => hydrateProfile(entry.id, entry.data()))
        .sort((left, right) => {
            if (left.createdAt && right.createdAt) {
                return left.createdAt.localeCompare(right.createdAt);
            }

            return left.name.localeCompare(right.name);
        });
}

export async function getProfileById(id: string): Promise<PersonProfile | null> {
    await ensureInitialized();
    const snapshot = await getDoc(doc(getProfilesCollection(), id));
    return snapshot.exists() ? hydrateProfile(snapshot.id, snapshot.data()) : null;
}

export async function createProfile(data: Partial<PersonProfile>): Promise<PersonProfile> {
    await ensureInitialized();
    const now = new Date().toISOString();
    const id = uuidv4();
    const profile: PersonProfile = {
        id,
        name: data.name || 'Unknown',
        relationship: data.relationship || '',
        identity_summary: data.identity_summary || '',
        hobbies: data.hobbies || [],
        pride_points: data.pride_points || [],
        emotional_anchors: data.emotional_anchors || [],
        conversation_starters: data.conversation_starters || [],
        communication_tips: data.communication_tips || [],
        face_reference_image: data.face_reference_image,
        faceDescriptor: data.faceDescriptor,
        createdAt: now,
        updatedAt: now
    };

    await setDoc(doc(getProfilesCollection(), id), serializeProfile(profile));
    return profile;
}

export async function updateProfile(id: string, data: Partial<PersonProfile>): Promise<PersonProfile | null> {
    await ensureInitialized();
    const existing = await getProfileById(id);
    if (!existing) return null;

    if (data.faceDescriptor) {
        console.log(`[MUNINN API] updateProfile received FaceDescriptor length: ${data.faceDescriptor.length} (is fallback object: ${!Array.isArray(data.faceDescriptor)})`);
    }

    const updated: PersonProfile = {
        ...existing,
        ...data,
        id, // never override id
        updatedAt: new Date().toISOString()
    };

    await setDoc(doc(getProfilesCollection(), id), serializeProfile(updated));
    return updated;
}

export async function deleteProfile(id: string): Promise<boolean> {
    await ensureInitialized();
    const reference = doc(getProfilesCollection(), id);
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) {
        return false;
    }

    await deleteDoc(reference);
    return true;
}
