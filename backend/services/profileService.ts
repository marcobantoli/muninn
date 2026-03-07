import { PersonProfile } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { getSeedProfiles } from '../seed';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'profiles.json');
let profiles: Map<string, PersonProfile> = new Map();
let initialized = false;

async function flushToDisk() {
    try {
        const data = Array.from(profiles.values());
        await fs.promises.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error('[MUNINN] Failed to write profiles.json:', e);
    }
}

async function ensureInitialized() {
    if (!initialized) {
        try {
            if (fs.existsSync(DB_PATH)) {
                const data = await fs.promises.readFile(DB_PATH, 'utf-8');
                const parsed: PersonProfile[] = JSON.parse(data);
                parsed.forEach(p => profiles.set(p.id, p));
                console.log(`[MUNINN] Loaded ${parsed.length} profiles from disk`);
            } else {
                const seeds = getSeedProfiles();
                seeds.forEach(p => profiles.set(p.id, p));
                console.log(`[MUNINN] Loaded ${seeds.length} seed profiles (new db created)`);
                await flushToDisk();
            }
        } catch (e) {
            console.error('[MUNINN] Failed to load profiles DB, falling back to seeds.', e);
            const seeds = getSeedProfiles();
            seeds.forEach(p => profiles.set(p.id, p));
        }
        initialized = true;
    }
}

export async function getAllProfiles(): Promise<PersonProfile[]> {
    await ensureInitialized();
    return Array.from(profiles.values());
}

export async function getProfileById(id: string): Promise<PersonProfile | null> {
    await ensureInitialized();
    return profiles.get(id) || null;
}

export async function createProfile(data: Partial<PersonProfile>): Promise<PersonProfile> {
    await ensureInitialized();
    const now = new Date().toISOString();
    const profile: PersonProfile = {
        id: uuidv4(),
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
    profiles.set(profile.id, profile);
    await flushToDisk();
    return profile;
}

export async function updateProfile(id: string, data: Partial<PersonProfile>): Promise<PersonProfile | null> {
    await ensureInitialized();
    const existing = profiles.get(id);
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
    profiles.set(id, updated);
    await flushToDisk();
    return updated;
}

export async function deleteProfile(id: string): Promise<boolean> {
    await ensureInitialized();
    const didDelete = profiles.delete(id);
    if (didDelete) {
        await flushToDisk();
    }
    return didDelete;
}
