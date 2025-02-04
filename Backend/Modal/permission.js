import mongoose from "mongoose";
import { type } from "os";

const permissionSchema = new mongoose.Schema({
    priority :{
        type : Number,
        required : true
    },
    name:{
        type : String,
        required : true
    },
    child : [
        {
            name  :{
                type : String,
                required :true
            },
            icon :{
                type : String,
                required :true
            }
        }
    ]
})

export const permission = mongoose.model('permission' , permissionSchema);