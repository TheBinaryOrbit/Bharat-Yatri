import { verifyToken } from "../AuthToken/jwt.js"

export const checkadmin = (req, res, next) => {
    try {
        if (!req.get('Authorization')) return res.status(401).json({ error: "token Expired" })
        const token = req.get('Authorization').split("Bearer ")[1]
        const admin = verifyToken(token)
        if (admin.userType == 'ADMIN') {
            next();
        }
        else {
            return res.status(401).json({ error: "Not an Admin" })
        }
    } catch (e) {
        console.log(e)
        return res.status(401).json({ error: "Not an Admin Token Modified" })
    }
}