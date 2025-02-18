import { ride } from "../../Modal/RideModal.js";
import { sendnotification } from "../../Notification/notification.js";

export const addride = async (req, res) => {
    try {
        const { carModel, from, to, description, createdBy, rideType ,carrier } = req.body;
        if (!carModel || !from || !to || !description || !createdBy || !rideType || !carrier ) return res.status(400).json({ "error": "All Fields Are required" });

        if (rideType == 'Duty') {
            const { PickupDateAndTime, customerFare, commissionFee, tripType } = req.body;
            if (!PickupDateAndTime || !customerFare || !commissionFee || !tripType) return res.status(400).json({ "error": "All Fields Are required" });
            const result = await ride.create({ carModel, from, to, description, createdBy, rideType, PickupDateAndTime, customerFare, commissionFee, tripType });

            if (!result) return res.status(400).json({ "error": "Something Went Wrong" });

            // Sending notification
            sendnotification(from, { carModel, from, to, description }, createdBy)

            // sending response
            return res.status(201).json({ "message": "Ride Added Sucessfully" });
        }
        else {
            const result = await ride.create({ carModel, from, to, description, createdBy, rideType });
            if (!result) return res.status(400).json({ "error": "Something Went Wrong" });

            // Sending notification
            sendnotification(from, { carModel, from, to, description, rideType }, createdBy);

            // sending response
            return res.status(201).json({ "message": "Ride Added Sucessfully" });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ "error": "Something Went Wrong" });
    }
}

export const getAllrides = async (req, res) => {
    try {   
        let matchCondition = {};
        if (req.query.status && req.query.status !== 'all') {
            matchCondition.status = req.query.status;
        }

        const result = await ride.aggregate([
            {
                $match: {
                    $and : [
                        matchCondition ,
                        {rideType : req.query.ridetype}
                    ]
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'createdByDetails'
                }
            },
            {
                $unwind: "$createdByDetails"
            },
            {
                $project: {
                    _id: 1,
                    createdAt: 1,
                    status: 1,
                    to : 1,
                    from : 1,
                    description :  1,
                    PickupDateAndTime : 1,
                    customerFare  :1,
                    commissionFee: 1,
                    tripType : 1,
                    carModel : 1,
                    rideType : 1,
                    carrier  :1,   
                    "createdByDetails.name": 1,
                    "createdByDetails.phoneNumber": 1,
                    "createdByDetails.email": 1,
                    "createdByDetails.userType": 1,
                    "createdByDetails._id" : 1
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $facet: {
                    metadata: [{ $count: "totalRides" }],
                    data: [
                        { $skip: (+req.query.page - 1) * (+req.query.limit) },
                        { $limit: +req.query.limit }
                    ]
                }
            }
        ]);

        let rides = result[0].data;
        const totalrides = result[0].metadata.length > 0 ? result[0].metadata[0].totalRides : 0;
        rides = rides.map((ride) => {
            return {
                ...ride,
                createdAt: ride.createdAt.toLocaleString("en-Us", {timeZone: 'Asia/Kolkata'})
            }
        });


        if (!result) return res.status(500).json({ "error": "Error in Getting Rides" });
        return res.status(200).json({   totalrides , rides});
    } catch (e) {
        console.log(e)
        return res.status(500).json({ "error": "Error in Getting Rides" });
    }
}

export const getOwnrides = async (req, res) => {
    try {
        const result = await ride.find({ createdBy: req.params.id });
        if (!result) return res.status(500).json({ "error": "Error in Getting Rides" });
        return res.status(200).json(result);
    } catch (e) {
        console.log(e)
        return res.status(500).json({ "error": "Error in Getting Rides" });
    }
}

export const hanldeUpdateRide = async (req, res) => {
    try {
        const result = await ride.findByIdAndUpdate(req.params.id, req.body);
        if (!result) return res.status(404).json({ "error": "Ride Not Found" }, { new: true });
        return res.status(200).json({ "message": "Ride Updated Sucessfully" });
    } catch (e) {
        console.log(e)
        return res.status(500).json({ "error": "Error in Updating Rides" });
    }
}


export const hanldeDeleteRide = async (req, res) => {
    try {
        const result = await ride.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ "error": "Ride Not Found" });
        return res.status(200).json({ "message": "Ride Deleted Sucessfully" });
    } catch (e) {
        console.log(e)
        return res.status(500).json({ "error": "Error in Deleting Rides" });
    }
}


