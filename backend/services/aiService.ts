import { PersonProfile, PersonhoodNote } from '../../shared/types';

// ─── Simulated AI Personhood Note Generator ───
// Template-based generation that mimics what Gemini Flash would produce

export async function generatePersonhoodNote(
    profile: PersonProfile,
    hcpMode: boolean
): Promise<PersonhoodNote> {
    const points: string[] = [];
    const highlights: string[] = [];
    const summary = profile.identity_summary || `${profile.name} is your ${profile.relationship}.`;
    const opener = profile.conversation_starters.length > 0
        ? profile.conversation_starters[Math.floor(Math.random() * profile.conversation_starters.length)]
        : `It's a good moment to say hello to ${profile.name}.`;
    const memorySpark = profile.emotional_anchors.length > 0
        ? profile.emotional_anchors[Math.floor(Math.random() * profile.emotional_anchors.length)]
        : summary;
    const careTip = profile.communication_tips.length > 0
        ? profile.communication_tips[Math.floor(Math.random() * profile.communication_tips.length)]
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
        const hobby = profile.hobbies[Math.floor(Math.random() * profile.hobbies.length)];
        points.push(`They enjoy ${hobby}`);
        highlights.push(hobby);
    }
    if (profile.pride_points.length > 0) {
        const pride = profile.pride_points[Math.floor(Math.random() * profile.pride_points.length)];
        points.push(pride);
        highlights.push(pride);
    }

    // Point 4-5: Conversation starters
    if (profile.conversation_starters.length > 0) {
        const starter = profile.conversation_starters[Math.floor(Math.random() * profile.conversation_starters.length)];
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

    // HCP guidance
    let hcpGuidance: string[] | undefined;
    if (hcpMode) {
        hcpGuidance = [
            'Validate their emotions before correcting facts',
            'Avoid saying "Don\'t you remember?"',
            'Use gentle redirection if they seem confused',
            'Maintain eye contact and speak slowly',
            'Focus on feelings, not factual accuracy'
        ];

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
        hcpGuidance,
        generatedAt: new Date().toISOString()
    };
}
