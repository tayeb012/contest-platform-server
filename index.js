const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRETE_KEY);
const port = process.env.PORT || 12002;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASSWORD}@cluster0.4pz9upq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const database = client.db("ContestCraft");
    const allContest = database.collection("allContest");
    const registeredContests = database.collection("registeredContests");
    const usersCollection = database.collection("usersCollection");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      // console.log("the token", token);
      res.send({ token });
    });

    // middleware
    const verifyToken = (req, res, next) => {
      // console.log("Inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        // error
        if (err) {
          // console.log("jwt.verify", err);
          return res.status(401).send({ message: "Unauthorized it" });
        }
        // if token is valid then it would be decoded
        // console.log("value in the token", decoded);
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const fillet = { email: email };
      const user = await usersCollection.findOne(fillet);
      const isAdmin = user?.role === "ADMIN";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // use verify admin
    const verifyCreator = async (req, res, next) => {
      const email = req.decoded.email;
      const fillet = { email: email };
      const user = await usersCollection.findOne(fillet);
      const isCreator = user?.role === "CREATOR";
      if (!isCreator) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.post("/usersInsert", async (req, res) => {
      const user = req.body;
      // console.log("new user", user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      // console.log(result);
      res.send(result);
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      // console.log(result);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      // console.log("Inside verify token", req.headers.authorization);
      const email = req.params?.email;
      // console.log(req.params?.email, req.decoded?.email);
      if (email !== req.decoded?.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const fillet = { email: email };
      const user = await usersCollection.findOne(fillet);
      let admin = false;
      if (user) {
        admin = user?.role === "ADMIN";
      }
      res.send({ admin });
    });

    app.get("/users/update/:email", verifyToken, async (req, res) => {
      const email = req.params?.email;
      console.log("/users/update/:email", email);
      const fillet = { email: email };
      const user = await usersCollection.findOne(fillet);
      console.log("/users/update/:email", user);
      res.send(user);
    });

    app.get("/creator/user", async (req, res) => {
      const fillet = { role: "CREATOR" };
      const user = await usersCollection.find(fillet).toArray();
      res.send(user);
    });

    app.get("/users/creator/:email", verifyToken, async (req, res) => {
      // console.log("Inside verify token", req.headers.authorization);
      const email = req.params?.email;
      // console.log(req.params?.email, req.decoded?.email);
      if (email !== req.decoded?.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const fillet = { email: email };
      const user = await usersCollection.findOne(fillet);
      let creator = false;
      if (user) {
        creator = user?.role === "CREATOR";
      }
      res.send({ creator });
    });

    app.delete(
      "/user/delete/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(query);
        res.send(result);
      }
    );

    app.patch("/user/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateRole = req.body;
      const contest = {
        $set: {
          role: updateRole.role,
          registeredCount: updateRole.registeredCount,
        },
      };
      const result = await usersCollection.updateOne(filter, contest);
      // console.log(result);
      res.send(result);
    });

    app.get("/allContest", async (req, res) => {
      const result = await allContest.find().toArray();
      res.send(result);
    });

    app.put("/updateContest/id/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedContest = req.body;
      // console.log(updatedContest);
      const contest = {
        $set: {
          image: updatedContest.image,
          contestName: updatedContest.contestName,
          contestDescription: updatedContest.contestDescription,
          contestPrice: updatedContest.contestPrice,
          prizeMoney: updatedContest.prizeMoney,
          taskSubmissionText: updatedContest.taskSubmissionText,
          contestType: updatedContest.contestType,
          contestDeadline: updatedContest.contestDeadline,
          attemptedCount: updatedContest.attemptedCount,
        },
      };
      const result = await allContest.updateOne(filter, contest, options);
      // console.log(result);
      res.send(result);
    });

    app.delete("/delete/id/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allContest.deleteOne(query);
      // console.log(result);
      res.send(result);
    });

    app.post("/registeredContest", async (req, res) => {
      const registeredContest = req.body;
      // console.log(registeredContest);
      const result = await registeredContests.insertOne(registeredContest);
      res.send(result);
    });

    app.get("/registeredContest", async (req, res) => {
      const email = req.query.email;
      // console.log("registeredContest", email);
      const query = { registerEmail: email };
      // console.log("query", query);
      const result = await registeredContests.find(query).toArray();
      // console.log(result);
      res.send(result);
    });

    app.get("/registeredUserOfCreator", async (req, res) => {
      const email = req.query.email;
      // console.log("registeredContest", email);
      const query = { creatorEmail: email, participate: "Attend" };
      // console.log("query", query);
      const result = await registeredContests.find(query).toArray();
      // console.log(result);
      res.send(result);
    });

    app.put("/registeredContest/id/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const participateContest = req.body;
      // console.log(participateContest);
      const contest = {
        $set: {
          participate: participateContest.participate,
        },
      };
      const result = await registeredContests.updateOne(
        filter,
        contest,
        options
      );
      // console.log(result);
      res.send(result);
    });
    app.put("/registeredContestWinnerDeclare/id/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const participateContest = req.body;
      // console.log(participateContest);
      const contest = {
        $set: {
          states: participateContest.states,
        },
      };
      const result = await registeredContests.updateOne(
        filter,
        contest,
        options
      );
      // console.log("registeredContestWinnerDeclare", result);
      res.send(result);
    });

    app.put("/updateWinnerDeclare/id/:id", async (req, res) => {
      const id = req.params.id;
      // console.log("updateWinnerDeclare", id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const winnerInformation = req.body;
      // console.log(winnerInformation);
      const contest = {
        $set: {
          // contestWinner: {
          //   name: winnerInformation.name,
          //   avatarImage: winnerInformation.avatarImage,
          // },
          "contestWinner.name": winnerInformation.contestWinner.name.winnerName,
          "contestWinner.avatarImage":
            winnerInformation.contestWinner.avatarImage.winnerPhoto,
        },
      };
      const result = await allContest.updateOne(filter, contest, options);
      // console.log("updateWinnerDeclare", result);
      res.send(result);
    });

    app.post("/addContest", verifyToken, verifyCreator, async (req, res) => {
      const addedContest = req.body;
      // console.log("new added Contest", addedContest);
      const result = await allContest.insertOne(addedContest);
      // console.log(result);
      res.send(result);
    });

    app.get("/addedContest", verifyToken, verifyCreator, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      const query = {
        creatorEmail: email,
      };
      const result = await allContest.find(query).toArray();
      // console.log(result);
      res.send(result);
    });

    app.get("/addedContest/admin", async (req, res) => {
      const result = await allContest.find().toArray();
      // console.log(result);
      res.send(result);
    });

    app.put("/acceptSubmission/id/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const confirmContest = req.body;
      // console.log(participateContest);
      const contest = {
        $set: {
          submission: confirmContest.submission,
        },
      };
      const result = await allContest.updateOne(filter, contest, options);
      // console.log(result);
      res.send(result);
    });

    app.put(
      "/updateRegisterCountToTheCreator/email/:email",
      async (req, res) => {
        const email = req.params.email;
        // console.log("updateRegisterCountToTheCreator", email);
        const filter = { email: email };
        const options = { upsert: true };
        const updateRegisterCount = req.body;
        // console.log(updateRegisterCount);
        const contest = {
          $set: {
            registeredCount: updateRegisterCount.registeredCount,
          },
        };
        const result = await usersCollection.updateOne(
          filter,
          contest,
          options
        );
        // console.log(result);
        res.send(result);
      }
    );

    app.put("/updateParticipationCount/id/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateContestAttempted = req.body;
      // console.log(participateContest);
      const contest = {
        $set: {
          attemptedCount: updateContestAttempted.attemptedCount,
        },
      };
      const result = await allContest.updateOne(filter, contest, options);
      // console.log(result);
      res.send(result);
    });

    app.delete("/deleteCreatedContest/id/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allContest.deleteOne(query);
      // console.log(result);
      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      // console.log("req.body", req?.body);
      const { contestPrice } = req?.body;
      const amount = parseInt(contestPrice);
      // console.log("amount inside the", typeof amount);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Contest Competition");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});


/**
 * echo "# b8a12-server-side-tayeb012" >> README.md
  git init
  git add README.md
  git commit -m "first commit"
  git branch -M main
  git remote add origin https://github.com/programming-hero-web-course1/b8a12-server-side-tayeb012.git
  git push -u origin main
 */