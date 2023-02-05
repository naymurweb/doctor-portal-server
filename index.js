const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, CURSOR_FLAGS } = require("mongodb");
const cors = require("cors");
const port = process.env.PORT || 7000;
require("dotenv").config();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0uz0dda.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    const appointmentOptionsCollection = client
      .db("doctor-portal")
      .collection("appointmentOptions");

    const bookingsCollection = client
      .db("doctor-portal")
      .collection("bookings");

    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const options = await appointmentOptionsCollection.find(query).toArray();

      const bookingQuery = {
        appointmentDate: date,
      };

      const alreadyBooked = await bookingsCollection
        .find(bookingQuery)
        .toArray();

      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        const bookedSlots = optionBooked.map((book) => book.slot);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots=remainingSlots
      });

      res.send(options);
    });

    app.post("/bookings", async (req, res) => {
      const booking= req.body
      console.log(booking)
      const query={
        appointmentDate:booking.appointmentDate,
        email:booking.email,  
        treatment:booking.treatment
      }
      const alreadyBooked=await bookingsCollection.find(query).toArray()
      if(alreadyBooked.length){
          const message=`You already have a booking on ${booking.appointmentDate}`
          return res.send({acknowledged:false,message})

      }
      const result= await bookingsCollection.insertOne(booking);
      res.send(result);
    });
  } finally {
  }
};
run().catch((error) => console.log(error));

app.get("/", (req, res) => {
  res.send("this is doctor portal server");
});

app.listen(port, () => {
  console.log(`doctor portal port ${port}`);
});
