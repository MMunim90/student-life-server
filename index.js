const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5tlsytf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    await client.connect();

    //posts api
    const postsCollection = client.db("Brainbox").collection("posts");

    // posts.routes.js

    // Add new post
    app.post("/addPosts", async (req, res) => {
      try {
        const post = req.body;
        post.createdAt = new Date();

        const result = await postsCollection.insertOne(post);

        res.status(201).send({
          success: true,
          message: "Post added successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error adding post:", error);
        res.status(500).send({
          success: false,
          message: "Failed to add post",
        });
      }
    });

    // Get all posts
    app.get("/getAllPosts", async (req, res) => {
      try {
        const posts = await postsCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.send(posts);
      } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch posts",
        });
      }
    });

    // Get posts by user email
    app.get("/getUserPosts/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const posts = await postsCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(posts);
      } catch (error) {
        console.error("Error fetching user posts:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch user posts",
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Brainbox server is running");
});

app.listen(port, () => {
  console.log(`Brainbox server is running on port ${port}`);
});
