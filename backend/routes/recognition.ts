import { Router, Request, Response } from 'express';
import { getProfileById } from '../services/profileService';
import { generatePersonhoodNote } from '../services/aiService';

export const recognitionRoutes = Router();

// POST /api/recognition-event
recognitionRoutes.post('/recognition-event', async (req: Request, res: Response) => {
    try {
        const { profileId, hcpMode } = req.body;

        if (!profileId) {
            return res.status(400).json({ error: 'profileId is required' });
        }

        const profile = await getProfileById(profileId);
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const note = await generatePersonhoodNote(profile, hcpMode || false);

        res.json(note);
    } catch (err) {
        res.status(500).json({ error: 'Failed to process recognition event' });
    }
});
