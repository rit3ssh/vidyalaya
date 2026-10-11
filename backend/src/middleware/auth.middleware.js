
import jwt from 'jsonwebtoken';

async function authenticateUser(req, res, next){

        const token = req.cookies.token
        if (!token){
            return res.status(401).json({
                message: 'Unauthorized no token provided'
            });
        }
    
        try{
            const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
            if (!decodedToken){
                return res.status(401).json({
                    message: 'Unauthorized wrong token '
                });
            }
            req.user=decodedToken;
            next();
        }
        catch (err){
            return res.status(401).json({
                message: 'Unauthorized error verifying token'
            });
        }
}



/**
 * Middleware factory to restrict route access to specific roles.
 * Must be placed AFTER authenticateToken in the route definition.
 * 
 * @param {...string} allowedRoles - List of roles permitted to access the route
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // If authenticateToken didn't run or role isn't matched
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied. You do not have permission to view this resource.' 
      });
    }
    next();
  };
};


export { authenticateUser, authorizeRoles };