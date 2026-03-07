import { PersonProfile, PersonhoodNote } from '../../shared/types';

// ─── Simulated AI Personhood Note Generator ───
// Template-based generation that mimics what Gemini Flash would produce

export async function generatePersonhoodNote(
    profile: PersonProfile,
    isStressed: boolean,
    hcpMode: boolean
): Promise<PersonhoodNote> {
    const points: string[] = [];

    // Point 1: Identity
    points.push(`This is ${profile.name}, your ${profile.relationship}`);

    // Point 2: Based on stress level, choose content
    if (isStressed && profile.emotional_anchors.length > 0) {
        // Prioritize emotional anchors when stressed
        points.push(`💛 ${profile.emotional_anchors[0]}`);
        if (profile.emotional_anchors.length > 1) {
            points.push(`💛 ${profile.emotional_anchors[1]}`);
        }
    } else {
        // Normal: show identity summary
        if (profile.identity_summary) {
            points.push(profile.identity_summary);
        }
    }

    // Point 3: Hobby or pride point
    if (profile.hobbies.length > 0) {
        const hobby = profile.hobbies[Math.floor(Math.random() * profile.hobbies.length)];
        points.push(`They enjoy ${hobby}`);
    }
    if (profile.pride_points.length > 0) {
        const pride = profile.pride_points[Math.floor(Math.random() * profile.pride_points.length)];
        points.push(pride);
    }

    // Point 4-5: Conversation starters
    if (profile.conversation_starters.length > 0) {
        const starter = profile.conversation_starters[Math.floor(Math.random() * profile.conversation_starters.length)];
        points.push(`💬 Try asking: "${starter}"`);
    }

    // Ensure we have exactly 5 points
    while (points.length < 5) {
        if (profile.communication_tips.length > 0) {
            const tip = profile.communication_tips[points.length % profile.communication_tips.length];
            points.push(`💡 ${tip}`);
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

        if (isStressed) {
            hcpGuidance.unshift('⚠️ Elevated heart rate detected — prioritize calming presence');
        }
    }

    return {
        profileId: profile.id,
        name: profile.name,
        relationship: profile.relationship,
        points: points.slice(0, 5),
        isStressed,
        hcpGuidance,
        generatedAt: new Date().toISOString()
    };
}
