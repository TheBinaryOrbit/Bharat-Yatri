import bcrypt from 'bcrypt'
import 'dotenv/config'

export const generatePassword = (password)  =>{
    const hasedPassword = bcrypt.hashSync(password , 10)
    return hasedPassword
}

export const matchedPassword = (password , hasedPassword) => {
    return bcrypt.compareSync(password, hasedPassword);
}