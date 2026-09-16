import userModel from "../models/user.model.js" ;
import schoolModel from "../models/school.model.js" ;
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";




async function registerController(req, res) {
    // const {name, email, password,role} = req.body;

    const schoolLogoURL = req.body.schoolLogoURL || null; // have to use imageKit to upload the image and get the url of the image and store it in the database. For now we are using null as default value.
    const profileImageURL = req.body.profileImageURL || null; // have to use imageKit to upload the image and get the url of the image and store it in the database. For now we are using null as default value.
    
    
    
    const { schoolName,schoolAddress,schoolEmail,schoolPhoneNumber,
        firstName, lastName, email, password,phoneNumber} = req.body;

    if (!schoolName || !schoolAddress ||!schoolEmail ||!schoolPhoneNumber || !firstName || !lastName || !email || !password || !phoneNumber) {
        return res.status(400).json({message: "Please provide all required fields to register a school and admin user"});
    }

    //check if user or school already exists
    const existingUser = await userModel.findOne({email});
    const existingSchool = await schoolModel.findOne({schoolEmail});

    if(existingUser){
        return res.status(400).
        json({message: "User already exists"});
    }

    if(existingSchool){
        return res.status(400).
        json({message: "School already exists"});
    }

    // Uses a Mongo transaction so School + admin User are created atomically.
    // Requires MongoDB running as a replica set (default on Atlas; for local
    // standalone Mongo, either enable a single-node replica set or drop the
    // session and accept eventual manual cleanup on partial failure).


    const session = await mongoose.startSession();

    try {
        await session.startTransaction();

        const [school] = await schoolModel.create([{
            schoolName,
            schoolAddress,
            schoolEmail,
            schoolPhoneNumber,
            schoolLogoURL
        }], { session });

        const hashedPassword = await bcrypt.hash(password, 10);

        const [admin] = await userModel.create([{
            schoolId: school._id,
            firstName,
            lastName,
            email,
            passwordHash: hashedPassword,
            phoneNumber,
            profileImageURL,
            role: "SCHOOL_ADMIN"
        }], { session });

        await session.commitTransaction();

        const token = jwt.sign({
            id: admin._id,
            schoolId: admin.schoolId,
            name: `${admin.firstName} ${admin.lastName}`,
            role: admin.role
        }, process.env.JWT_SECRET_KEY, {
            expiresIn: "1d"
        });

        res.cookie("token", token, {
            httpOnly: true,
        });

        res.status(201).json({
            message: "School and admin user registered successfully",
            user: {
                user_id: admin._id,
                school_id: admin.schoolId,
                name: `${admin.firstName} ${admin.lastName}`,
                role: admin.role,
                schoolName: school.schoolName
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error(error);

        res.status(500).json({
            message: error.message
        });

    } finally {
        await session.endSession();
    }
}





async function loginController(req, res) {
  // Handle user login logic here
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Username and Password required " });
    }

    //check if user exists
  
    const user = await userModel.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: "Username or Password is invalid" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
    if(!isPasswordCorrect){
        return res.status(400).json({ message: "Username or password is invalid" });
    }


    // Generate JWT token and set it in a cookie
    const token = jwt.sign({
        id: user._id,
        schoolId: user.schoolId,
        name: user.firstName + " " + user.lastName,
        role: user.role
    }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });


    res.cookie("token", token, {
        httpOnly: true,
    });



    
    const school = await schoolModel.findById(user.schoolId)

    res.status(200).json({ 
        message: "User logged in successfully", 
        user: {
            user_id: user._id,
            school_id: user.schoolId,
            name: user.firstName + " " + user.lastName,
            role: user.role,
            schoolName: school?.schoolName || ""
        },
      
    });
}






async function logoutController(req, res) {
    res.clearCookie("token");
    res.status(200).json({ message: "User logged out successfully" });
}   



export { registerController, loginController, logoutController };