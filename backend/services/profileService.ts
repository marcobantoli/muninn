import { PersonProfile } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../firebase';
import { 
    collection, 
    getDocs, 
    getDoc, 
    setDoc, 
    deleteDoc, 
    doc,
    updateDoc,
    query,
    orderBy
} from 'firebase/firestore';

import { getSeedProfiles } from '../seed';

const COLLECTION_NAME = 'profiles';

export async function getAllProfiles(): Promise<PersonProfile[]> {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            console.log('[MUNINN] Firestore is empty, seeding default profiles...');
            const seeds = getSeedProfiles();
            for (const profile of seeds) {
                await setDoc(doc(db, COLLECTION_NAME, profile.id), profile);
            }
            return seeds;
        }

        return querySnapshot.docs.map(doc => doc.data() as PersonProfile);
    } catch (e) {
        console.error('[MUNINN] Failed to fetch profiles from Firestore:', e);
        return [];
    }
}

export async function getProfileById(id: string): Promise<PersonProfile | null> {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as PersonProfile) : null;
    } catch (e) {
        console.error('[MUNINN] Failed to fetch profile from Firestore:', e);
        return null;
    }
}

export async function createProfile(data: Partial<PersonProfile>): Promise<PersonProfile> {
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
        face_reference_image: data.face_reference_image || '',
        faceDescriptor: data.faceDescriptor || [],
        createdAt: now,
        updatedAt: now
    };

    try {
        await setDoc(doc(db, COLLECTION_NAME, id), profile);
        return profile;
    } catch (e) {
        console.error('[MUNINN] Failed to create profile in Firestore:', e);
        throw e;
    }
}

export async function updateProfile(id: string, data: Partial<PersonProfile>): Promise<PersonProfile | null> {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) return null;

        const updatedData = {
            ...data,
            updatedAt: new Date().toISOString()
        };

        await updateDoc(docRef, updatedData);
        
        // Return the full updated profile
        const finalSnap = await getDoc(docRef);
        return finalSnap.data() as PersonProfile;
    } catch (e) {
        console.error('[MUNINN] Failed to update profile in Firestore:', e);
        return null;
    }
}

export async function deleteProfile(id: string): Promise<boolean> {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        return true;
    } catch (e) {
        console.error('[MUNINN] Failed to delete profile from Firestore:', e);
        return false;
    }
}
