import multer from "multer";
import path from 'path'


const Storage = multer.diskStorage({
    destination : function(req,file , cb){
        cb(null , './public/aadhar');
    },
    filename : function(req,file , cb){
        const name  = file.originalname.split('.')[0]
        const ext = path.extname(file.originalname)
        cb(null , `${name}${Date.now()}${ext}`);
    }
})

export const uploadAadhar =  multer({ storage : Storage })