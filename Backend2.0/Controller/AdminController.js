import Admin from "../Model/admin.js";
import { matchedPassword } from "../utils/password.js";
import { User } from "../Model/UserModel.js";
import { booking } from "../Model/BookingModel.js";

export const loginAdmin = async (req, res) => {
    const { email, password } = req.body;
    try {

        const admin = await Admin.findOne({ email });
        
        if (!admin) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        if (!matchedPassword(password, admin.password)) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        res.status(200).json({ message: "Login successful", admin });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};