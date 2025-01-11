import multer from "multer";
import path from 'path'


const Storage = multer.diskStorage({
    destination : function(req,file , cb){
        cb(null , './public/pan');
    },
    filename : function(req,file , cb){
        const ext = path.extname(file.originalname)
        cb(null , `${Date.now()}${ext}`);
    }
})

export const uploadPan =  multer({ storage : Storage })