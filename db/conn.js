import mongoose from "mongoose";

function connectToDB(uri){
    mongoose.connect(uri)
    .then(()=>{
        console.log('Connection Successful');
    })
    .catch((err)=>{
        console.log('No Connection');
        console.log(err);
    })
}

export default connectToDB;