import { PersonProfile, PersonhoodNote } from '../../shared/types';

// ─── Personhood Context Note Builder ───
// Deterministically maps stored profile fields into a display-ready note.

export async function buildPersonhoodNote(
    profile: PersonProfile
): Promise<PersonhoodNote> {
    const points: string[] = [];
    const highlights: string[] = [];
    const summary = profile.identity_summary || `${profile.name} is your ${profile.relationship}.`;
    const opener = profile.conversation_starters.length > 0
        ? profile.conversation_starters[0]
        : `It's a good moment to say hello to ${profile.name}.`;
    const memorySpark = profile.emotional_anchors.length > 0
        ? profile.emotional_anchors[0]
        : summary;
    const careTip = profile.communication_tips.length > 0
        ? profile.communication_tips[0]
        : `Keep the conversation grounded in familiar details about ${profile.name}.`;

    // Point 1: Identity
    points.push(`This is ${profile.name}, your ${profile.relationship}`);

    if (profile.identity_summary) {
        points.push(profile.identity_summary);
    } else if (profile.emotional_anchors.length > 0) {
        points.push(profile.emotional_anchors[0]);
    }

    // Point 3: Hobby or pride point
    if (profile.hobbies.length > 0) {
        const hobby = profile.hobbies[0];
        points.push(`They enjoy ${hobby}`);
        highlights.push(hobby);
    }
    if (profile.pride_points.length > 0) {
        const pride = profile.pride_points[0];
        points.push(pride);
        highlights.push(pride);
    }

    // Point 4-5: Conversation starters
    if (profile.conversation_starters.length > 0) {
        const starter = profile.conversation_starters[0];
        points.push(`Try asking: "${starter}"`);
    }

    // Ensure we have exactly 5 points
    while (points.length < 5) {
        if (profile.communication_tips.length > 0) {
            const tip = profile.communication_tips[points.length % profile.communication_tips.length];
            points.push(tip);
        } else {
            points.push(`${profile.name} cares about you`);
        }
    }

    return {
        profileId: profile.id,
        name: profile.name,
        relationship: profile.relationship,
        points: points.slice(0, 5),
        summary,
        opener,
        memorySpark,
        careTip,
        highlights: highlights.slice(0, 2),
        generatedAt: new Date().toISOString()
    };
}

export const generatePersonhoodNote = buildPersonhoodNote;
