//For school profile management

import { Router } from "express";
import { authenticateUser,authorizeRoles } from "../middleware/auth.middleware.js";
import School from "../models/school.model.js";

const schoolRouter = Router();




// 1. VIEW SCHOOL INFO (Accessible by the School Admin)
schoolRouter.get('/profile', authenticateUser, authorizeRoles('SCHOOL_ADMIN'), async (req, res) => {
  try {
    // req.user.schoolId is pulled directly from the logged-in admin's token
    const school = await School.findById(req.user.schoolId);
    
    if (!school) {
      return res.status(404).json({ error: 'School not found.' });
    }

    res.status(200).json(school);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve school information.' });
  }
});



export default schoolRouter;