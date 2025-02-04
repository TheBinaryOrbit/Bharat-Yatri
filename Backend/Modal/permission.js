import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema({
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