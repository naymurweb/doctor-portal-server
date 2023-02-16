const express = require("express");
const app = express();
const {
  MongoClient,
  ServerApiVersion,
  CURSOR_FLAGS,
  ObjectId,
} = require("mongodb");
const cors = require("cors");
const port = process.env.PORT || 7000;
require("dotenv").config();
const jwt = require("jsonwebtoken");

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0uz0dda.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

const run = async () => {
  try {
    const appointmentOptionsCollection = client
      .db("doctor-portal")
      .collection("appointmentOptions");

    const bookingsCollection = client
      .db("doctor-portal")
      .collection("bookings");

    const usersCollection = client.db("doctor-portal").collection("users");
    const doctorsCollection = client.db("doctor-portal").collection("doctors");

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const filter = { email: decodedEmail };
      const user = await usersCollection.findOne(filter);
      if (user?.role !== "Admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

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
        option.slots = remainingSlots;
      });

      res.send(options);
    });

    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden assess" });
      }
      const query = { email: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment,
      };
      const alreadyBooked = await bookingsCollection.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `You already have a booking on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    app.get("/users", async (req, res) => {
      const query = {};
      const user = await usersCollection.find(query).toArray();
      res.send(user);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "Admin" });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.put("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { email };
      const updateDoc = {
        $set: { role: "Admin" },
      };

      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.get("/appointmentSpecialty", async (req, res) => {
      const query = {};
      const result = await appointmentOptionsCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
    });

    app.get("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const quary = {};
      const doctors = await doctorsCollection.find(quary).toArray();
      res.send(doctors);
    });
    app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    });

    app.delete("/doctors/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const result = await doctorsCollection.deleteOne(filter);
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
