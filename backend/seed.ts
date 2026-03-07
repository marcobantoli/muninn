import { PersonProfile } from '../shared/types';

// ─── Seed Data: 4 Sample Person Profiles ───

export function getSeedProfiles(): PersonProfile[] {
    const now = new Date().toISOString();

    return [
        {
            id: 'seed-sarah-001',
            name: 'Sarah Mitchell',
            relationship: 'Daughter',
            identity_summary: 'Sarah is your eldest daughter. She is 42 and lives in Portland with her husband Mark.',
            hobbies: ['gardening', 'reading mystery novels', 'baking sourdough bread'],
            pride_points: [
                'She recently got promoted to head teacher at Westfield Elementary',
                'She ran her first half-marathon last spring'
            ],
            emotional_anchors: [
                'She used to sit on your lap while you read her bedtime stories',
                'You both love watching old movies together on Sunday evenings'
            ],
            conversation_starters: [
                'How are the roses in your garden doing?',
                'Have you read any good books lately?',
                'How is Mark doing?'
            ],
            communication_tips: [
                'She appreciates when you listen to her stories',
                'She may talk about school — she loves teaching'
            ],
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'seed-james-002',
            name: 'James Wilson',
            relationship: 'Son',
            identity_summary: 'James is your son. He is 38 and works as a software engineer in Seattle.',
            hobbies: ['playing guitar', 'hiking', 'cooking Italian food'],
            pride_points: [
                'He built an app that helps seniors stay connected',
                'He volunteers at the local food bank every weekend'
            ],
            emotional_anchors: [
                'You taught him to ride a bike in the backyard when he was 6',
                'He still makes your favorite pasta recipe every time he visits'
            ],
            conversation_starters: [
                'Have you been on any good hikes recently?',
                'Are you still playing guitar?',
                'What are you cooking these days?'
            ],
            communication_tips: [
                'He likes talking about technology but keeps it simple for you',
                'He may seem busy but always makes time for calls'
            ],
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'seed-margaret-003',
            name: 'Margaret Chen',
            relationship: 'Best Friend',
            identity_summary: 'Margaret has been your best friend for over 40 years. You met at the community center.',
            hobbies: ['watercolor painting', 'tai chi', 'bird watching'],
            pride_points: [
                'She won the community art fair last year',
                'She organized the neighborhood watch program'
            ],
            emotional_anchors: [
                'You and Margaret went on a road trip to California in 1985',
                'She was there when your grandchildren were born'
            ],
            conversation_starters: [
                'Have you painted anything new lately?',
                'Did you see any interesting birds this week?',
                'How is your tai chi class going?'
            ],
            communication_tips: [
                'She is patient and understanding',
                'She enjoys reminiscing about old times'
            ],
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'seed-drpatel-004',
            name: 'Dr. Anand Patel',
            relationship: 'Doctor',
            identity_summary: 'Dr. Patel is your primary care physician. He has been your doctor for 12 years.',
            hobbies: ['chess', 'classical music', 'traveling'],
            pride_points: [
                'He received the community healthcare excellence award',
                'He speaks four languages fluently'
            ],
            emotional_anchors: [
                'He always takes extra time to explain things clearly',
                'He remembers details about your family and asks about them'
            ],
            conversation_starters: [
                'Have you traveled anywhere interesting recently?',
                'Do you still play chess?',
                'How is the clinic doing?'
            ],
            communication_tips: [
                'He prefers if you write down questions before appointments',
                'He is happy to repeat information if needed'
            ],
            createdAt: now,
            updatedAt: now
        }
    ];
}
