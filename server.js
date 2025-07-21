import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
const app = express();

const port = process.env.PORT || 4000;

import connectToDB from './db/conn.js';
connectToDB(process.env.DB_CONNECT)

import Contact from './models/contact.model.js';

app.use(express.json());
app.use(express.urlencoded({extended : true}));

app.get('/',(req,res)=>{
    res.send('👁 Bitespeed Backend Task: Identity Reconciliations');
})

app.post('/identify', async(req, res) => {
    try{
    const phoneNumber = req.body?.phoneNumber;
    const email = req.body?.email;

    if(!phoneNumber && !email){ 
        return res.status(400).json({
        msg: "At least one of phoneNumber or email must be provided"
        });
    }

    let matchingContacts = await Contact.find({
        $or : [{phoneNumber},{email}]  
    }).sort({createdAt : 1})


    if(matchingContacts.length > 0 && matchingContacts[0].linkPrecedence === 'secondary'){
        const truePrimary = await Contact.findById(matchingContacts[0].linkedId);
        console.log(truePrimary);
        const allRelated = await Contact.find({linkedId: truePrimary._id });
        console.log(allRelated);
        matchingContacts = [truePrimary,...matchingContacts,...allRelated];
    }

    if(matchingContacts.length > 0){
        const primaryContact = matchingContacts[0];

        for (let i = 0; i < matchingContacts.length; i++) {
            const contact = matchingContacts[i];
            if (contact.linkPrecedence === 'primary'){
                if(i!==0){
                    await Contact.findByIdAndUpdate(contact._id, {
                    linkPrecedence: 'secondary',
                    linkedId: primaryContact._id
                    });
                }

                const itsChildren = await Contact.find({ linkedId: contact._id });
                
                for (const child of itsChildren) {
                await Contact.findByIdAndUpdate(child._id, {
                    linkedId: primaryContact._id
                });
                }
                matchingContacts.push(...itsChildren);
            }
        }

        const uniqueContactsMap = new Map();
        matchingContacts.forEach(contact => {
        uniqueContactsMap.set(contact._id.toString(), contact);
        });
        matchingContacts = Array.from(uniqueContactsMap.values());
    }


    const phoneNumbersSet = new Set();
    const emailsSet = new Set();

    matchingContacts.forEach(contact => {
        if (contact.phoneNumber) phoneNumbersSet.add(contact.phoneNumber);
        if (contact.email) emailsSet.add(contact.email);
    });

    if(matchingContacts.length === 0){
        const newContact = await Contact.create({
            phoneNumber : phoneNumber,
            email : email,
            linkPrecedence : 'primary'
        })
        matchingContacts.push(newContact);
        if (newContact.phoneNumber){
            phoneNumbersSet.add(newContact.phoneNumber);
        }
        if (newContact.email){ 
            emailsSet.add(newContact.email);
        }
    }
    else{
        const isPhoneInSet = phoneNumber && phoneNumbersSet.has(phoneNumber);
        const isEmailInSet = email && emailsSet.has(email);
        if(!isPhoneInSet || !isEmailInSet){
            const secondaryContact = await Contact.create({
                phoneNumber : phoneNumber,
                email : email,
                linkPrecedence : 'secondary',
                linkedId : matchingContacts[0]._id
            })
            matchingContacts.push(secondaryContact);
            if (secondaryContact.phoneNumber){ 
                phoneNumbersSet.add(secondaryContact.phoneNumber);
            }
            if (secondaryContact.email){ 
                emailsSet.add(secondaryContact.email);
            }
        }
    }

    const uniquePhoneNumbers = [...phoneNumbersSet];
    const uniqueEmails = [...emailsSet];

    const primaryContactId = matchingContacts[0]._id;
    const secondaryContactIds = matchingContacts
    .filter(contact => contact._id.toString() !== primaryContactId.toString() && contact.linkPrecedence === 'secondary')
    .map(contact => contact._id);

    return res.status(200).json({
        "contact":{
            "primaryContactId" : primaryContactId,
            "emails" : uniqueEmails,
            "phoneNumbers" : uniquePhoneNumbers,
            "secondaryContactIds": secondaryContactIds 
        }
    })
    }
    catch(err){
        return res.status(500).json({
            msg : "Internal Server error",
            err : err
        })
    }
});



app.listen(port,()=>{
    console.log(`Server is listening on the port ${port}.`);
})