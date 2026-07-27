import userModel from "../models/user.model.js" ;
import schoolModel from "../models/school.model.js" ;
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";




async function registerController(req, res) {
    // const {name, email, password,role} = req.body;
    const { schoolName,schoolAddress,firstName, lastName, email, password} = req.body;

    if (!schoolName || !schoolAddress || !firstName || !lastName || !email || !password ) {
        return res.status(400).json({message: "Please provide all required fields"});
    }

    //check if user already exists
    const existingUser = await userModel.findOne({email});
    if(existingUser){
        return res.status(400).
        json({message: "User already exists"});
    }


    //create new school
    const school = await schoolModel.create({
        schoolName,
        schoolAddress
    });
    const hash = await bcrypt.hash(password, 10);
    
    //create new user
    const user= await userModel.create({
        schoolId: school._id,
        firstName,
        lastName,
        email,
        password: hash,
        role:'SCHOOL_ADMIN',
    });




    const token = jwt.sign({
        id: user._id,
        schoolId: school._id,
        name: user.firstName + " " + user.lastName,
        role: user.role
    }, process.env.JWT_SECRET_KEY, {expiresIn: "1d"
    })


    res.cookie("token", token, {
        httpOnly: true,
    });

    res.status(201).json({
        message: "School & Admin registered successfully", 
        user:{

            user_id: user._id,
            school_id: school._id,
            name: user.firstName + " " + user.lastName,
            role: user.role
        },
        // token
    });

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

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if(!isPasswordCorrect){
        return res.status(400).json({ message: "Username or password is invalid" });
    }

    const token = jwt.sign({
        id: user._id,
        schoolId: user.schoolId,
        name: user.firstName + " " + user.lastName,
        role: user.role
    }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });


    res.cookie("token", token, {
        httpOnly: true,
    });

    res.status(200).json({ 
        message: "User logged in successfully", 
        user: {
            user_id: user._id,
            school_id: user.schoolId,
            name: user.firstName + " " + user.lastName,
            role: user.role
        },
        // token 
    });
}


async function logoutController(req, res) {
    res.clearCookie("token");
    res.status(200).json({ message: "User logged out successfully" });
}   



export { registerController, loginController, logoutController };