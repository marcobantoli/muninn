import { Router, Request, Response } from 'express';
import { getAllProfiles, getProfileById, createProfile, updateProfile, deleteProfile } from '../services/profileService';

export const profileRoutes = Router();

// GET /api/profiles
profileRoutes.get('/', async (_req: Request, res: Response) => {
    try {
        const profiles = await getAllProfiles();
        res.json(profiles);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profiles' });
    }
});

// GET /api/profiles/:id
profileRoutes.get('/:id', async (req: Request, res: Response) => {
    try {
        const profile = await getProfileById(req.params.id);
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json(profile);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// POST /api/profiles
profileRoutes.post('/', async (req: Request, res: Response) => {
    try {
        const profile = await createProfile(req.body);
        res.status(201).json(profile);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create profile' });
    }
});

// PUT /api/profiles/:id
profileRoutes.put('/:id', async (req: Request, res: Response) => {
    try {
        const profile = await updateProfile(req.params.id, req.body);
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json(profile);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// DELETE /api/profiles/:id
profileRoutes.delete('/:id', async (req: Request, res: Response) => {
    try {
        const success = await deleteProfile(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete profile' });
    }
});
