import userModel from "../models/user.model.js" ;
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";




async function registerController(req, res) {
    const {name, email, password} = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({message: "Please provide all required fields"});
    }

    //check if user already exists
    const existingUser = await userModel.findOne({email});
    if(existingUser){
        return res.status(400).
        json({message: "User already exists"});
    }


    const hash = await bcrypt.hash(password, 10);


    //create new user
    const user= await userModel.create({
        name,
        email,
        password: hash  
    });

    const token = jwt.sign({
        id: user._id,
        name: user.name,
    }, process.env.JWT_SECRET_KEY, {expiresIn: "1d"
    })


    res.cookie("token", token, {
        httpOnly: true,
    });

    res.status(201).json({
        message: "User registered successfully", 
        user:{

            user_id: user._id,
            name: user.name,
        },
        // token
    });

}





async function loginController(req, res) {
  // Handle user login logic here
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Please provide all required fields" });
    }

    //check if user exists
  
    const user = await userModel.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if(!isPasswordCorrect){
        return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign({
        id: user._id,
        name: user.name,
    }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });


    res.cookie("token", token, {
        httpOnly: true,
    });

    res.status(200).json({ 
        message: "User logged in successfully", 
        user: {
            user_id: user._id,
            name: user.name,
        },
        // token 
    });
}


async function logoutController(req, res) {
    res.clearCookie("token");
    res.status(200).json({ message: "User logged out successfully" });
}   



export { registerController, loginController, logoutController };