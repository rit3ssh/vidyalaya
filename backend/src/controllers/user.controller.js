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
    const studentId = req.params.studentId;
    const schoolId = req.user.schoolId;
    const { firstName, lastName, email, rollNumber, classId, parentEmail } = req.body;

    try {
        // Update the core user account
        const student = await studentModel.findOne({ _id: studentId }).populate('userId');
        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }

        const updatedUser = await userModel.findOneAndUpdate(
            { _id: student.userId._id, schoolId, role: 'STUDENT' },
            { firstName, lastName, email },
            { new: true }
        );

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

        // Update the academic profile
        const updatedStudent = await studentModel.findOneAndUpdate(
            { _id: studentId },
            { rollNumber, classId, parentId: resolvedParentId },
            { new: true }
        );

        res.status(200).json({
            message: "Student updated successfully",
            student: {
                studentId: updatedStudent._id,
                name: updatedUser.firstName + " " + updatedUser.lastName,
                email: updatedUser.email,
                rollNumber: updatedStudent.rollNumber,
                classId: updatedStudent.classId,
                parentId: updatedStudent.parentId
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to update student" });
    }


}



async function deleteStudent(req, res) {
    const studentId = req.params.studentId;
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication

    try {
        // Find the student to get the associated userId
        const student = await studentModel.findOne({ _id: studentId });
        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }

        // Delete the academic profile
        await studentModel.deleteOne({ _id: studentId });

        // Delete the core user account
        await userModel.deleteOne({ _id: student.userId, schoolId, role: 'STUDENT' });

        res.status(200).json({ message: "Student deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete student" });
    }
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
    const { firstName, lastName, email, qualification, joiningDate, phoneNumber, specialization, salary } = req.body;
    console.log(salary);
    const schoolId = req.user.schoolId; // the school ID is available in the authenticated user's data

    if (!firstName || !lastName || !email || !qualification || !joiningDate || !phoneNumber || !specialization || !salary) {
        return res.status(400).json({ error: "All fields are required" });
    }

    // Check if the teacher already exists
    const existingTeacher = await userModel.findOne({ email, role: 'TEACHER', schoolId });
    if (existingTeacher) {
        return res.status(400).json({ error: "A teacher with this email already exists" });
    }

    // Generate a secure random password (12 characters)
    const temporaryPassword = crypto.randomBytes(6).toString('hex'); 
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    try {
        // Create the core login account for the teacher
        const newUser = await userModel.create({
            schoolId,
            firstName,
            lastName,
            email,
            password: hashedPassword,
            role: 'TEACHER',
        });

        // Create the teacher profile linked to the core account
        const newTeacher = await teacherModel.create({
            userId: newUser._id,
            qualification,
            joiningDate,
            phoneNumber,
            specialization,
            salary
        });

        res.status(200).json({
            message: "Teacher added successfully",
            temporaryPassword: temporaryPassword, // Send this so the admin can give it to the teacher
            teacher: {
                teacherId: newTeacher._id,
                name: newUser.firstName + " " + newUser.lastName,
                email: newUser.email,
                qualification: newTeacher.qualification,
                joiningDate: newTeacher.joiningDate,
                phoneNumber: newTeacher.phoneNumber,
                specialization: newTeacher.specialization,
                salary: newTeacher.salary
            }
        });
    } catch (error) {
        return res.status(500).json({ error: "Failed to add teacher", details: error.message });
    }
}

async function viewAllTeachers(req, res) {
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication

    try {
        const teachers = await teacherModel.find().populate({path:'userId',
            match:{schoolId,role:'TEACHER'},select:'firstName lastName email'});
        res.status(200).json({
            message: "Teachers retrieved successfully",
            teachers: teachers.map(teacher => ({
                teacherId: teacher._id,
                name: teacher.userId.firstName + " " + teacher.userId.lastName,
                email: teacher.userId.email,
                qualification: teacher.qualification,
                joiningDate: teacher.joiningDate,
                phoneNumber: teacher.phoneNumber,
                specialization: teacher.specialization,
                salary: teacher.salary
            }))
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve teachers" });
    }
}

async function viewTeacher(req, res) {
    const teacherId = req.params.teacherId;
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication

    try {
        const teacher = await teacherModel.findOne({ _id: teacherId }).populate('userId', 'firstName lastName email');

        if (!teacher) {
            return res.status(404).json({ error: "Teacher not found" });
        }

        res.status(200).json({
            message: "Teacher retrieved successfully",
            teacher: {
                teacherId: teacher._id,
                name: teacher.userId.firstName + " " + teacher.userId.lastName,
                email: teacher.userId.email,
                qualification: teacher.qualification,
                joiningDate: teacher.joiningDate,
                phoneNumber: teacher.phoneNumber,
                specialization: teacher.specialization,
                salary: teacher.salary
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve teacher" });
    }
}

async function updateTeacher(req, res) {
    const teacherId = req.params.teacherId;
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication
    const { firstName, lastName, email, qualification, joiningDate, phoneNumber, specialization, salary } = req.body;

    try {
        // Update the core user account
        const teacher = await teacherModel.findOne({ _id: teacherId }).populate('userId');
        if (!teacher) {
            return res.status(404).json({ error: "Teacher not found" });
        }

        const updatedUser = await userModel.findOneAndUpdate(
            { _id: teacher.userId._id, schoolId, role: 'TEACHER' },
            { firstName, lastName, email },
            { new: true }
        );

        // Update the teacher profile
        const updatedTeacher = await teacherModel.findOneAndUpdate(
            { _id: teacherId },
            { qualification, joiningDate, phoneNumber, specialization, salary },
            { new: true }
        );

        res.status(200).json({
            message: "Teacher updated successfully",
            teacher: {
                teacherId: updatedTeacher._id,
                name: updatedUser.firstName + " " + updatedUser.lastName,
                email: updatedUser.email,
                qualification: updatedTeacher.qualification,
                joiningDate: updatedTeacher.joiningDate,
                phoneNumber: updatedTeacher.phoneNumber,
                specialization: updatedTeacher.specialization,
                salary: updatedTeacher.salary
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to update teacher" });
    }
}

async function deleteTeacher(req, res) {
    const teacherId = req.params.teacherId;
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication

    try {
        // Find the teacher to get the associated userId
        const teacher = await teacherModel.findOne({ _id: teacherId });
        if (!teacher) {
            return res.status(404).json({ error: "Teacher not found" });
        }

        // Delete the teacher profile
        await teacherModel.deleteOne({ _id: teacherId });

        // Delete the core user account
        await userModel.deleteOne({ _id: teacher.userId, schoolId, role: 'TEACHER' });

        res.status(200).json({ message: "Teacher deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete teacher" });
    }   
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