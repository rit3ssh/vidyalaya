import userModel from "../models/user.model.js";
import studentModel from "../models/student.model.js";
import teacherModel from "../models/teacher.model.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

//student controller 




async function addStudent(req, res) {
    //  Accept parentEmail from the client
    const { firstName, lastName, email, rollNumber, parentEmail ,classId} = req.body;
    const schoolId = req.user.schoolId; 

    if (!firstName || !lastName || !email || !rollNumber) {
        return res.status(400).json({ error: "All fields are required" });
    }

    // Check if the login credentials already exist
    const existingUser = await userModel.findOne({ email: email.toLowerCase(), schoolId });
    if (existingUser) {
        return res.status(400).json({ error: "A user with this email already exists" });
    }

    // Resolve the parent account if provided
    let resolvedParentId = null;
    if (parentEmail) {
        const parentUser = await userModel.findOne({ 
            email: parentEmail.toLowerCase(), 
            role: 'PARENT', 
            schoolId 
        });
        
        if (!parentUser) {
            return res.status(400).json({ error: "No parent account found with this email address. Please register the parent first." });
        }
        resolvedParentId = parentUser._id;
    }

    try {
        const password = crypto.randomBytes(6).toString('hex'); 
        const hashedPassword = await bcrypt.hash(password, 10); 
        
        // Create the core login account
        const newUser = await userModel.create({
            schoolId,
            firstName,
            lastName,
            email: email,
            password: hashedPassword, // Store the hash so they can log in!
            role: 'STUDENT',
        });

        // Create the academic profile linked to the core account
        const newStudent = await studentModel.create({
            userId: newUser._id,
            rollNumber: rollNumber.trim(),
            classId: classId, 
            parentId: resolvedParentId, 
        });

   
        res.status(200).json({ 
            message: "Student added successfully",
            temporaryPassword: password, // Send this so the admin can give it to the student
            student: {
                studentId: newStudent._id,
                name: newUser.firstName + " " + newUser.lastName,
                email: newUser.email,
                rollNumber: newStudent.rollNumber,
                classId: newStudent.classId,
                parentId: newStudent.parentId
            }

        });

    } catch (error) {
        return res.status(500).json({ error: "Failed to add student to database", details: error.message });
    }
}







async function viewAllStudents(req, res) {
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication
    console.log("School ID from token:", schoolId); // Debugging line
    try {
        const students = await studentModel.find().populate({path:'userId',
            match:{schoolId,role:'STUDENT'},select:'firstName lastName email'}).populate('classId', 'className classSection').populate('parentId', 'firstName lastName email');
        res.status(200).json({
            message: "Students retrieved successfully",
            students: students.map(student => ({
                studentId: student._id,
                name: student.userId.firstName + " " + student.userId.lastName,
                email: student.userId.email,
                rollNumber: student.rollNumber,
                classId: student.classId ? {
                    classId: student.classId._id,
                    className: student.classId.className,
                    classSection: student.classId.classSection
                } : null,
                parentId: student.parentId ? {
                    parentId: student.parentId._id,
                    name: student.parentId.firstName + " " + student.parentId.lastName,
                    email: student.parentId.email
                } : null
            }))
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve students" });
    }
}

async function viewStudent(req, res) {
    const studentId = req.params.studentId;
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication

    try {
        const student= await studentModel.findOne({ _id: studentId }).populate('userId', 'firstName lastName email').populate('classId', 'className classSection').populate('parentId', 'firstName lastName email');

        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }

        res.status(200).json({
            message: "Student retrieved successfully",
            student: {
                studentId: student._id,
                name: student.userId.firstName + " " + student.userId.lastName,
                email: student.userId.email,
                rollNumber: student.rollNumber,
                classId: student.classId,
                parentId: student.parentId
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve student" });
    }
}

async function updateStudent(req, res) {


}



async function deleteStudent(req, res) {
    // Logic to delete a student
    res.status(200).json({ message: "Student deleted successfully" });
}


/**
 * 
 * parent controller
 * 
**/

async function addParent(req, res) {
    const { firstName, lastName, email } = req.body;
    const schoolId = req.user.schoolId; // the school ID is available in the authenticated user's data
    if (!firstName || !lastName || !email ) {
        return res.status(400).json({ error: "All fields are required" });
    }
    console.log(firstName, lastName, email, schoolId);
    // check if parent already exists
    const existingParent = await userModel.findOne({ email, role: 'PARENT', schoolId });
    if (existingParent) {
        return res.status(400).json({ error: "Parent with this email already exists" });
    }

    //Generate a secure random password (12 characters)
    const temporaryPassword = crypto.randomBytes(6).toString('hex'); 
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    try {
        const newparent = await userModel.create({
            schoolId,
            firstName,
            lastName,
            email,
            password:hashedPassword,
            role: 'PARENT',
        });
        res.status(200).json({ message: "Parent added successfully",
        parent: {
            name: newparent.firstName + " " + newparent.lastName,
            email: newparent.email,
            password: temporaryPassword, // Send the temporary password to the parent
     }});
    } catch (error) {
        return res.status(500).json({ error: "Failed to add parent" });
    }

}
    

async function viewAllParent(req, res) {
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication
    
    try {
        const parents = await userModel.find({ schoolId, role: 'PARENT' });
        res.status(200).json({
            message: "Parents retrieved successfully",
            parents: parents.map(parent => ({
                parentId: parent._id,
                name: parent.firstName + " " + parent.lastName,
                email: parent.email
            }))
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve parents" });
    }
}


async function viewParent(req, res) {
    const parentId = req.params.parentId;
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication

    try {
        const parent = await userModel.findOne({ _id: parentId, schoolId, role: 'PARENT' });

        if (!parent) {
            return res.status(404).json({ error: "Parent not found" });
        }

        res.status(200).json({
            message: "Parent retrieved successfully",
            parent: {
                parentId: parent._id,
                name: parent.firstName + " " + parent.lastName,
                email: parent.email
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve parent" });
    }
}

async function updateParent(req, res) {
    const parentId = req.params.parentId;
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication
    const { firstName, lastName, email } = req.body;

    try {
        const updatedParent = await userModel.findOneAndUpdate(
            { _id: parentId, schoolId, role: 'PARENT' },
            { firstName, lastName, email },
            { new: true }
        );

        if (!updatedParent) {
            return res.status(404).json({ error: "Parent not found" });
        }

        res.status(200).json({
            message: "Parent updated successfully",
            parent: {
                parentId: updatedParent._id,
                name: updatedParent.firstName + " " + updatedParent.lastName,
                email: updatedParent.email
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to update parent" });
    }
}

async function deleteParent(req, res) {
    const parentId = req.params.parentId;
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication

    try {
        const deletedParent = await userModel.findOneAndDelete({ _id: parentId, schoolId, role: 'PARENT' });

        if (!deletedParent) {
            return res.status(404).json({ error: "Parent not found" });
        }

        res.status(200).json({ message: "Parent deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete parent" });
    }
}



/**
 * 
 * teacher controller
 */

async function addTeacher(req, res) {
    // Logic to add a teacher
    res.status(200).json({ message: "Teacher added successfully" });
}

async function viewAllTeachers(req, res) {
    // Logic to view all teachers
    res.status(200).json({ message: "All teachers retrieved successfully" });
}

async function viewTeacher(req, res) {
    // Logic to view a specific teacher
    res.status(200).json({ message: "Teacher retrieved successfully" });
}

async function updateTeacher(req, res) {
    // Logic to update a teacher
    res.status(200).json({ message: "Teacher updated successfully" });
}

async function deleteTeacher(req, res) {
    // Logic to delete a teacher
    res.status(200).json({ message: "Teacher deleted successfully" });
}  


export {
    addStudent,
    viewAllStudents,
    viewStudent,
    updateStudent,
    deleteStudent,
    addParent,
    viewAllParent,
    viewParent,
    updateParent,
    deleteParent,
    addTeacher,
    viewAllTeachers,
    viewTeacher,
    updateTeacher,
    deleteTeacher,
};