
import classModel from "../models/class.model.js";


async function addClass (req, res){
    const { className, classSection } = req.body;
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication


    try {
        classModel.create({
            schoolId,
            className,
            classSection
        });
        res.status(201).json({ 
            message: "Class added successfully" ,
            class: {
                schoolId,
                className,
                classSection
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to add class" });
    }
}


async function viewAllClass(req, res) {
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication

    try {
        const classes = await classModel.find({ schoolId });
        res.status(200).json({
            message: "Classes retrieved successfully",
            classes: classes.map(cls => ({
                classId: cls._id,
                className: cls.className,
                classSection: cls.classSection
            }))
        });
        } catch (error) {
            res.status(500).json({ error: "Failed to retrieve classes" });
        }
}

async function viewClass(req, res) {
    const classId = req.params.classId;
    const schoolId = req.user.schoolId; // the school ID is stored in the user object after authentication

    try {
        const cls = await classModel.findOne({ _id: classId, schoolId });

        if (!cls) {
            return res.status(404).json({ error: "Class not found" });
        }

        res.status(200).json({
            message: "Class retrieved successfully",
            class: {
                classId: cls._id,
                className: cls.className,
                classSection: cls.classSection
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve class" });
    }
}



async function updateClass(req, res) {
    const classId = req.params.classId;
    try {
        const updatedClass = await classModel.findByIdAndUpdate(
            { _id: classId },
            { $set: req.body },
            { new: true }
        );

        if (!updatedClass) {
            return res.status(404).json({ error: "Class not found" });
        }

        res.status(200).json({
            message: "Class updated successfully",
            class: {
                className: updatedClass.className,
                classSection: updatedClass.classSection
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to update class" });
    }
}


async function deleteClass(req, res) {
    const classId = req.params.classId;

    try {
        if(!classModel.findById(classId)){
            return res.status(404).json({ error: "Class not found" });
        }
        const deletedClass=await classModel.findByIdAndDelete(classId);
        res.status(200).json({ 
            message: "Class deleted successfully",
            class: {
                className: deletedClass.className,
                classSection: deletedClass.classSection
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete class" });
    }
}

export { addClass, viewAllClass,viewClass,updateClass, deleteClass };
